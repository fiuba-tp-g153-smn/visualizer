import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  EcmwfTpTileLayerConfig,
  Layer,
  LayerCategory,
  LayerType,
  WrfTileLayerConfig,
} from '../../models';
import { LayerConfigService } from './layer-config.service';
import { LayerRefreshService } from './layer-refresh.service';
import { LayersService } from './layers.service';
import { DataServiceHealthService } from '../data-service-health/data-service-health.service';
import { WeatherStationsApiKeyService } from '../weather-stations/weather-stations-api-key.service';

/**
 * Per-layer availability, from the point of view of "can the user use this
 * product right now". Kept deliberately multi-state so that `loading`/`unknown`
 * never collapse into a greyed-out state:
 *  - `empty`       — probed, and the backend reports zero periods.
 *  - `unreachable` — the data-service itself is down, so nothing can load.
 *  - `loading`/`unknown` — not yet known; the row stays interactive.
 *
 * Both `empty` and `unreachable` grey out the row (see {@link isUnavailable}).
 */
export type Availability = 'loading' | 'available' | 'empty' | 'unreachable' | 'unknown';

/** TILE categories whose availability we can probe from `/products/{id}`. */
const PROBEABLE_TILE_CATEGORIES: ReadonlySet<LayerCategory> = new Set([
  LayerCategory.GOES_19,
  LayerCategory.RADAR,
  LayerCategory.ECMWF_TP,
  LayerCategory.WRF,
]);

/** How many probes may be in flight at once during a prime pass. */
const PROBE_CONCURRENCY = 6;

/** Cadence for re-priming still-empty/unknown inactive layers. */
const RE_PRIME_INTERVAL_MS = 60_000;

/**
 * Centralised source of truth for whether each product currently has data.
 *
 * The rest of the app only ever learns a layer is empty *after* the user
 * activates it (configs are fetched lazily on activation by
 * `LayerRefreshService`). To grey out empty products up front, this service
 * eagerly probes every TILE product on startup — a single lightweight GET per
 * product (`LayerConfigService.probeLayerAvailability`) — and exposes the result
 * as a reactive tri-state.
 *
 * For layers that already have a real config (i.e. active layers the refresh
 * service has loaded) availability is derived from that live config instead of
 * the eager probe, so it stays fresh without extra requests.
 */
@Injectable({ providedIn: 'root' })
export class LayerAvailabilityService {
  private readonly configService = inject(LayerConfigService);
  private readonly refreshService = inject(LayerRefreshService);
  private readonly layersService = inject(LayersService);
  private readonly healthService = inject(DataServiceHealthService);
  private readonly apiKeyService = inject(WeatherStationsApiKeyService);

  /** Eager-probe results, keyed by layer id. Live-config layers bypass this. */
  private readonly probeStatesSignal = signal<ReadonlyMap<string, Availability>>(new Map());

  private rePrimeTimerId: number | null = null;
  private priming = false;

  /**
   * Reactive availability for a layer. Safe to read inside a `computed` — it
   * tracks the config cache, the refresh loading set and the probe results.
   */
  state(layer: Layer): Availability {
    if (layer.category === LayerCategory.WEATHER_STATIONS) {
      return this.weatherStationsState();
    }
    if (layer.type !== LayerType.TILE) {
      return 'available';
    }

    // A live config (a product we already loaded) is the freshest truth and
    // stays usable even mid-outage; prefer it over health/probe state.
    if (this.configService.hasConfig(layer.id)) {
      return this.tileConfigHasData(layer) ? 'available' : 'empty';
    }

    // Data-service confirmed down: nothing can load, so a product we never
    // managed to fetch is unreachable (greyed). Products that already loaded
    // are handled above and stay available.
    if (!this.healthService.isAvailable()) {
      return 'unreachable';
    }

    if (this.refreshService.loadingLayerIds().has(layer.id)) {
      return 'loading';
    }

    return this.probeStatesSignal().get(layer.id) ?? 'unknown';
  }

  /** True when the product is greyed out — probed-empty or the data-service is down. */
  isUnavailable(layer: Layer): boolean {
    const state = this.state(layer);
    return state === 'empty' || state === 'unreachable';
  }

  /**
   * Re-check a single product's availability on demand (a user clicked its
   * recheck button) instead of waiting for the next re-prime tick.
   *
   * If the whole data-service is down, this first forces an immediate /health
   * probe — the recheck then really means "is it back yet?", and on recovery
   * every greyed row un-greys. If the service is up, it re-probes just this
   * product so a newly-published (or newly-emptied) one updates right away.
   */
  async recheck(layer: Layer): Promise<void> {
    await this.recheckMany([layer]);
  }

  /**
   * Re-check a batch of products at once (a user clicked a subgroup's recheck
   * button). Performs the "is the service back?" health probe a single time,
   * then re-probes each still-unloaded data-service product in parallel.
   */
  async recheckMany(layers: readonly Layer[]): Promise<void> {
    if (!this.healthService.isAvailable()) {
      await this.healthService.checkNow();
      if (!this.healthService.isAvailable()) {
        return; // still down — the rows stay 'unreachable'
      }
    }
    // Products served by the data-service that we haven't loaded yet: re-probe.
    // (Live-config products and weather stations reflect their own state and
    // recover from the health check above alone.)
    const toProbe = layers.filter(
      (layer) =>
        layer.type === LayerType.TILE &&
        PROBEABLE_TILE_CATEGORIES.has(layer.category) &&
        !this.configService.hasConfig(layer.id),
    );
    await this.runThrottled(toProbe, (layer) => this.probeOne(layer), PROBE_CONCURRENCY);
  }

  /**
   * Eagerly probe every TILE product once, then keep re-priming the ones that
   * are still empty/unknown on a slow cadence (so a product greys/un-greys as
   * its backend sync finishes). Idempotent — safe to call more than once.
   */
  primeAll(): void {
    void this.probeAll();
    if (this.rePrimeTimerId === null) {
      this.rePrimeTimerId = window.setInterval(() => void this.probeAll(), RE_PRIME_INTERVAL_MS);
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private tileConfigHasData(layer: Layer): boolean {
    const config = this.configService.getConfig(layer.id);
    if (!config || config.type !== LayerType.TILE) {
      return false;
    }
    if (layer.category === LayerCategory.ECMWF_TP || layer.category === LayerCategory.WRF) {
      const forecastConfig = config as EcmwfTpTileLayerConfig | WrfTileLayerConfig;
      return (forecastConfig.availableForecasts?.length ?? 0) > 0;
    }
    return config.availableTilesets.length > 0;
  }

  /**
   * Weather stations follow a separate fetch/signal path and require an API
   * key. We never grey them for "no key" (that is a distinct state with its own
   * activation warning) and we never eagerly fetch them (a 401 would pop the
   * key dialog on startup) — availability is reflected only from the shared
   * tileset signal once it is populated.
   */
  private weatherStationsState(): Availability {
    // Re-evaluate when the key changes so the row reacts to key add/remove.
    this.apiKeyService.keyChanges();
    // No key is a distinct state with its own activation warning — not "down".
    if (!this.apiKeyService.hasKey()) {
      return 'unknown';
    }
    if (this.refreshService.getWeatherStationsAvailableTilesetIds().length > 0) {
      return 'available';
    }
    // Key present but nothing loaded: grey only when we know the service is down.
    return this.healthService.isAvailable() ? 'unknown' : 'unreachable';
  }

  private async probeAll(): Promise<void> {
    if (this.priming) {
      return;
    }
    // Don't hammer a data-service that's already known to be down — the health
    // tracker polls /health and flips back to available on recovery, and the
    // next re-prime tick then resumes probing.
    if (!this.healthService.isAvailable()) {
      return;
    }
    this.priming = true;
    try {
      const layers = this.layersService
        .getAllLayers()
        .filter(
          (layer) =>
            layer.type === LayerType.TILE &&
            PROBEABLE_TILE_CATEGORIES.has(layer.category) &&
            // Active layers derive availability from their live config — no probe needed.
            !this.configService.hasConfig(layer.id),
        );
      await this.runThrottled(layers, (layer) => this.probeOne(layer), PROBE_CONCURRENCY);
    } finally {
      this.priming = false;
    }
  }

  private async probeOne(layer: Layer): Promise<void> {
    // Bail if the service went down mid-pass — the remaining queued probes
    // become no-ops instead of piling up more failed requests.
    if (!this.healthService.isAvailable()) {
      return;
    }
    const prior = this.probeStatesSignal().get(layer.id);
    // Only surface `loading` when we have nothing better yet; keep an already
    // established `available`/`empty` verbatim so re-primes don't flicker.
    if (prior === undefined || prior === 'unknown') {
      this.setProbeState(layer.id, 'loading');
    }
    try {
      const hasData = await firstValueFrom(this.configService.probeLayerAvailability(layer));
      this.setProbeState(layer.id, hasData ? 'available' : 'empty');
    } catch (err) {
      // A network-level failure (connection refused / timeout, status 0) means
      // the data-service itself is unreachable — hand off to the health tracker
      // so it shows the single banner and starts polling for recovery. A real
      // HTTP status (404 for an unpublished product, etc.) is not a service
      // outage, so it just leaves this layer 'unknown'.
      if (err instanceof HttpErrorResponse && err.status === 0) {
        this.healthService.reportFailure();
      }
      if (prior === undefined || prior === 'unknown') {
        this.setProbeState(layer.id, 'unknown');
      }
    }
  }

  private setProbeState(layerId: string, state: Availability): void {
    const current = this.probeStatesSignal();
    if (current.get(layerId) === state) {
      return;
    }
    const next = new Map(current);
    next.set(layerId, state);
    this.probeStatesSignal.set(next);
  }

  private async runThrottled<T>(
    items: readonly T[],
    worker: (item: T) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    let index = 0;
    const runNext = async (): Promise<void> => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
    await Promise.all(workers);
  }
}
