import { Injectable, inject, signal } from '@angular/core';
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
import { WeatherStationsApiKeyService } from '../weather-stations/weather-stations-api-key.service';

/**
 * Per-layer availability, from the point of view of "does this product have any
 * data to show". Kept deliberately tri-state so that `loading`/`unknown` never
 * collapse into `empty`: only a product we have actually probed and found to
 * expose zero periods reports `empty`.
 */
export type Availability = 'loading' | 'available' | 'empty' | 'unknown';

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

    // A live config (active layer) is the freshest truth; prefer it over the
    // eager probe so we never grey a product that has just loaded data.
    if (this.configService.hasConfig(layer.id)) {
      return this.tileConfigHasData(layer) ? 'available' : 'empty';
    }

    if (this.refreshService.loadingLayerIds().has(layer.id)) {
      return 'loading';
    }

    return this.probeStatesSignal().get(layer.id) ?? 'unknown';
  }

  /** True only when the product has been probed/loaded and found to have zero data. */
  isUnavailable(layer: Layer): boolean {
    return this.state(layer) === 'empty';
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
    if (!this.apiKeyService.hasKey()) {
      return 'unknown';
    }
    return this.refreshService.getWeatherStationsAvailableTilesetIds().length > 0
      ? 'available'
      : 'unknown';
  }

  private async probeAll(): Promise<void> {
    if (this.priming) {
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
    const prior = this.probeStatesSignal().get(layer.id);
    // Only surface `loading` when we have nothing better yet; keep an already
    // established `available`/`empty` verbatim so re-primes don't flicker.
    if (prior === undefined || prior === 'unknown') {
      this.setProbeState(layer.id, 'loading');
    }
    try {
      const hasData = await firstValueFrom(this.configService.probeLayerAvailability(layer));
      this.setProbeState(layer.id, hasData ? 'available' : 'empty');
    } catch {
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
