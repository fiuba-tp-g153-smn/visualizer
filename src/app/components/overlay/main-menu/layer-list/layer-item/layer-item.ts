import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner';
import {
  BarbTileRender,
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  Layer,
  LayerCategory,
  LayerSelectionMode,
  LayerType,
  NotificationType,
  SecondaryVectorRender,
  TilesetEntry,
  WrfLayerControls,
  WrfTileLayer,
  WrfTileLayerConfig,
  PRIMARY_RENDER_ID,
} from '../../../../../models';
import { HttpErrorResponse } from '@angular/common/http';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerConfigService } from '../../../../../services/layers/layer-config.service';
import { LayerRefreshService } from '../../../../../services/layers/layer-refresh.service';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import { NotificationService } from '../../../../../services/notifications/notification.service';
import {
  formatDateFull,
  formatDateTimeOnly,
  parseEcmwfTimestamp,
  parseWrfInitTag,
} from '../../../../../utils/tileset-timestamp';
import { buildEcmwfTpFrameOptions, computeWindowStart } from '../../../../../utils/playback-window';
import { ScaleToolsService } from '../../../../../services/tools/scale-tools.service';
import { WeatherStationsApiKeyService } from '../../../../../services/weather-stations/weather-stations-api-key.service';
import {
  WeatherStationsTemporalMode,
  WEATHER_STATIONS_IMAGE_COUNT_OPTIONS,
} from '../../../../../config/layers/weather-stations/controls.constants';

export enum LayerItemMode {
  AVAILABLE = 'available',
  ACTIVE = 'active',
}

interface ForecastSecondaryRenderItem {
  id: string;
  name: string;
}

interface ForecastControlGroup {
  forecastTs: string;
  displayLabel: string;
  fullLabel: string;
  secondaryRenders: ForecastSecondaryRenderItem[];
}

function isBarbTileRender(
  render: SecondaryVectorRender | BarbTileRender,
): render is BarbTileRender {
  return 'kind' in render && render.kind === 'barb-tile';
}

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSliderModule,
    MatCheckboxModule,
    MatRadioModule,
    MatSelectModule,
    MatFormFieldModule,
    CdkDragHandle,
    LoadingSpinnerComponent,
  ],
  templateUrl: './layer-item.html',
  styleUrl: './layer-item.scss',
})
export class LayerItemComponent implements OnInit, OnDestroy, OnChanges {
  readonly LayerItemMode = LayerItemMode;
  readonly LayerCategory = LayerCategory;
  readonly LayerSelectionMode = LayerSelectionMode;
  readonly WeatherStationsTemporalMode = WeatherStationsTemporalMode;
  readonly PRIMARY_RENDER_ID = PRIMARY_RENDER_ID;

  private readonly _activating = signal(false);
  readonly displayChecked = computed(() => this._activating() || this.isActive());
  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);
  private readonly configService = inject(LayerConfigService);
  private readonly refreshService = inject(LayerRefreshService);
  private readonly syncService = inject(SyncPlaybackService);
  private readonly scaleTools = inject(ScaleToolsService);
  private readonly apiKeyService = inject(WeatherStationsApiKeyService);
  private readonly notifications = inject(NotificationService);

  @Input({ required: true }) layer!: Layer;

  @Input() mode: LayerItemMode = LayerItemMode.AVAILABLE;

  @Input() selectionMode: LayerSelectionMode = LayerSelectionMode.MULTIPLE;

  @Input() radioGroupName = '';

  readonly showClose = true;
  readonly showDragHandle = true;

  readonly isLoadingConfig = computed(() =>
    this.refreshService.loadingLayerIds().has(this.layer.id),
  );
  isExpanded = signal(false);
  isElevationsExpanded = signal(false);
  isForecastsExpanded = signal(false);
  private expandedForecastRuns = signal<Set<string>>(new Set());
  isWeatherStationsSettingsExpanded = signal(false);
  private weatherStationsPlaybackTimerId: number | null = null;
  private readonly weatherStationsPlaybackIsPlaying = signal(false);
  private readonly weatherStationsPlaybackSpeed = signal(1);

  /** True when this layer is currently controlled by the global sync playback. */
  isSynced = computed(() => this.syncService.isLayerSelected(this.layer.id));

  playSpeed = computed(() => {
    if (this.isWeatherStationsLayer()) {
      return this.weatherStationsPlaybackSpeed();
    }

    const controls = this.controlService.getControls(this.layer.id);
    switch (controls?.type) {
      case LayerType.TILE:
        return controls.playback.speed;
      default:
        return 1;
    }
  });

  imageCount = computed(() => {
    if (this.isWeatherStationsLayer()) {
      return this.controlService.getWeatherStationsImageCount();
    }

    const controls = this.controlService.getControls(this.layer.id);
    switch (controls?.type) {
      case LayerType.TILE:
        return controls.playback.imageCount;
      default:
        return 1;
    }
  });

  lastImagesOptions = computed(() => {
    if (this.isWeatherStationsLayer()) {
      return this.weatherStationsImageCountOptions();
    }

    switch (this.layer.type) {
      case LayerType.TILE: {
        const staticOptions = this.layer.availablePeriods ?? [1];
        if (
          this.layer.category === LayerCategory.ECMWF_TP ||
          this.layer.category === LayerCategory.WRF
        ) {
          const tilesets = this.getAvailableTilesetsForLayer();
          if (tilesets && tilesets.length > 0) {
            return buildEcmwfTpFrameOptions(staticOptions, tilesets.length);
          }
        }
        return staticOptions;
      }
      default:
        return [1];
    }
  });

  isPlaying = computed(() => {
    if (this.isWeatherStationsLayer()) {
      return this.weatherStationsPlaybackIsPlaying();
    }

    return this.controlService.isPlaying(this.layer.id);
  });

  canPlayback = computed(() => {
    if (this.isWeatherStationsLayer()) {
      return this.imageCount() > 1 && this.maxTimeIndex() - this.minTimeIndex() >= 1;
    }

    return this.maxTimeIndex() > 0 && this.imageCount() > 1;
  });

  getActiveLayer = computed(() => {
    return this.controlService.activeLayers().find((item) => item.layer.id === this.layer.id);
  });

  currentOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return;

    if (activeLayer.controls.type === LayerType.TILE) {
      // For radar layers, check if elevations have different opacities
      if (activeLayer.controls.category === LayerCategory.RADAR) {
        return this.globalElevationOpacity();
      }
      // For ECMWF / WRF layers, check if forecasts have different opacities
      if (
        activeLayer.controls.category === LayerCategory.ECMWF_TP ||
        activeLayer.controls.category === LayerCategory.WRF
      ) {
        return this.globalForecastOpacity();
      }
    }

    return activeLayer.controls.opacity;
  });

  currentOpacityPercent = computed(() => {
    const opacity = this.currentOpacity();
    if (opacity === undefined) return undefined;
    return Math.round(opacity * 100);
  });

  baseLayerOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    return activeLayer?.controls.opacity ?? 1;
  });

  isActive = computed(() => {
    return this.getActiveLayer() !== undefined;
  });

  hasTimeControl = computed(() => {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      return this.weatherStationsTilesetIds().length > 0;
    }

    // Debe tener configuración Y tilesets disponibles
    if (!this.configService.hasConfig(this.layer.id)) return false;

    const tilesets = this.getAvailableTilesetsForLayer();
    return tilesets && tilesets.length > 0;
  });

  hasNoPeriodsAvailable = computed(() => {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      return this.weatherStationsTilesetIds().length === 0;
    }

    // Solo aplica a capas TILE
    if (this.layer.type !== LayerType.TILE) return false;

    // No mostrar si está cargando
    if (this.isLoadingConfig()) return false;

    // Si no tiene config aún, no es un error (aún no se intentó cargar)
    if (!this.configService.hasConfig(this.layer.id)) return false;

    // Tiene config pero no hay tilesets disponibles
    const tilesets = this.getAvailableTilesetsForLayer();
    return !tilesets || tilesets.length === 0;
  });

  needsTimeControl = computed(() => {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      return true;
    }

    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF_TP:
          case LayerCategory.WRF:
            return true;
          default:
            return false;
        }
      default:
        return false;
    }
  });

  hasElevationControl = computed(() => {
    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.RADAR:
            return (
              this.layer.availableElevations !== undefined &&
              this.layer.availableElevations.length > 0
            );
          default:
            return false;
        }
      default:
        return false;
    }
  });

  availableElevations = computed(() => {
    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.RADAR:
            return this.layer.availableElevations ?? [];
          default:
            return [];
        }
      default:
        return [];
    }
  });

  elevationIndexOptions = computed(() => {
    return this.availableElevations().map((_, i) => i);
  });

  selectedElevationIds = computed(() => {
    const activeItem = this.getActiveLayer();

    if (!activeItem) return [];

    switch (activeItem.controls.type) {
      case LayerType.TILE:
        if ('elevation' in activeItem.controls) {
          return activeItem.controls.elevation?.selectedElevationIds ?? [];
        }
        return [];
      default:
        return [];
    }
  });

  maxTimeIndex = computed(() => {
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || tilesets.length === 0) return 0;

    const imageCount = this.imageCount();
    if (imageCount === 1) {
      return tilesets.length - 1;
    }

    const isForecast = this.layer.type === LayerType.TILE && this.layer.isForecast;
    const min = computeWindowStart(tilesets.length, imageCount, isForecast);
    return Math.min(min + imageCount - 1, tilesets.length - 1);
  });

  layerShortName = computed(() => this.layersService.getLayerShortName(this.layer));
  layerFullName = computed(() => this.layersService.getLayerFullName(this.layer));

  minTimeIndex = computed(() => {
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || tilesets.length === 0) return 0;

    const imageCount = this.imageCount();
    if (imageCount === 1) {
      return 0;
    }

    const isForecast = this.layer.type === LayerType.TILE && this.layer.isForecast;
    return computeWindowStart(tilesets.length, imageCount, isForecast);
  });

  currentTimeIndex = computed(() => {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      return this.weatherStationsSelectedTilesetIndex();
    }

    const activeItem = this.getActiveLayer();
    let currentIndex: number;

    switch (activeItem?.controls.type) {
      case LayerType.TILE:
        currentIndex = activeItem.controls.playback?.timeIndex ?? this.maxTimeIndex();
        break;
      default:
        currentIndex = this.maxTimeIndex();
        break;
    }

    // Asegurar que el índice actual esté dentro del rango visible
    const min = this.minTimeIndex();
    const max = this.maxTimeIndex();
    return Math.min(Math.max(currentIndex, min), max);
  });

  constructor() {
    // Stop weather stations playback when this layer is deactivated externally
    // (e.g. when a sibling layer is activated with single-selection mode).
    // The timer is local to the component, so it can't be stopped via the service.
    effect(() => {
      if (!this.isActive()) {
        untracked(() => this.stopWeatherStationsPlayback());
      }
    });
  }

  ngOnInit(): void {}

  ngOnChanges(_changes: SimpleChanges): void {}

  ngOnDestroy(): void {
    if (this.isWeatherStationsLayer()) {
      this.stopWeatherStationsPlayback();
    }
  }

  private getAvailableTilesetsForLayer(): TilesetEntry[] | undefined {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      const entries: TilesetEntry[] = [];

      for (const tilesetId of this.weatherStationsTilesetIds()) {
        const tilesetTime = this.weatherStationsTilesetIdToDate(tilesetId);
        if (!tilesetTime) {
          continue;
        }

        entries.push({
          id: tilesetId,
          time: tilesetTime,
        });
      }

      return entries;
    }

    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF_TP:
          case LayerCategory.WRF:
            return this.configService.getAvailableTilesets(this.layer.id);
          default:
            return undefined;
        }
      default:
        return undefined;
    }
  }

  reloadChannelConfig(): void {
    this.refreshService.manualRefresh(this.layer.id).subscribe({
      next: () => {},
      error: (err: Error) => {
        console.error(`[LayerItem] Error refrescando config de ${this.layer.id}:`, err);
      },
    });
  }

  async toggleActive(checked: boolean): Promise<void> {
    if (checked) {
      this._activating.set(true);
      await this.activateLayer();
      this._activating.set(false);
      if (this.isActive()) {
        this.isExpanded.set(true);
      }
    } else {
      this.deactivateLayer();
    }
  }

  async onRadioSelected(): Promise<void> {
    this._activating.set(true);
    await this.activateLayer();
    this._activating.set(false);
    if (this.isActive()) {
      this.isExpanded.set(true);
    }
  }

  onRadioClick(event: MouseEvent): void {
    if (!this.isActive()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.deactivateLayer();
  }

  toggleExpansion(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  toggleElevationsExpansion(): void {
    this.isElevationsExpanded.set(!this.isElevationsExpanded());
  }

  toggleForecastsExpansion(): void {
    const newExpanded = !this.isForecastsExpanded();
    this.isForecastsExpanded.set(newExpanded);
    if (newExpanded) {
      this.expandedForecastRuns.set(new Set(this.selectedForecastTimestamps()));
    }
  }

  toggleForecastRunExpansion(forecastTs: string): void {
    this.expandedForecastRuns.update((prev) => {
      const next = new Set(prev);
      if (next.has(forecastTs)) {
        next.delete(forecastTs);
      } else {
        next.add(forecastTs);
      }
      return next;
    });
  }

  isForecastRunExpanded(forecastTs: string): boolean {
    return this.expandedForecastRuns().has(forecastTs);
  }

  toggleWeatherStationsSettingsExpansion(): void {
    this.isWeatherStationsSettingsExpanded.set(!this.isWeatherStationsSettingsExpanded());
  }

  private async activateLayer(): Promise<void> {
    if (this.isWeatherStationsLayer()) {
      this.captureCurrentWeatherStationsSharedState();
      const key = await this.apiKeyService.ensureKey();
      if (!key) {
        this.notifications.show(
          NotificationType.WARNING,
          'Necesitás configurar tu clave API del SMN para activar las estaciones meteorológicas.',
          { autoClose: true, duration: 6000 },
        );
        return;
      }
      try {
        await this.refreshService.loadWeatherStationsOnActivation();
      } catch (err) {
        if (!(err instanceof HttpErrorResponse && err.status === 401)) {
          const detail =
            err instanceof HttpErrorResponse && err.status >= 500
              ? 'el servidor no está disponible en este momento'
              : 'no se pudo establecer la conexión';
          this.notifications.show(
            NotificationType.ERROR,
            `No se pudieron cargar las estaciones meteorológicas: ${detail}.`,
            { autoClose: true, duration: 5000 },
          );
        }
        return;
      }
    }

    if (this.selectionMode === LayerSelectionMode.SINGLE) {
      this.deactivateSiblingLayersInSubgroup();
    }

    this.controlService.activateLayer(this.layer.id);

    if (this.isWeatherStationsLayer()) {
      this.applySharedStateToWeatherStationsLayer();
    }
  }

  private deactivateSiblingLayersInSubgroup(): void {
    const groups = this.layersService.getLayerGroups();
    for (const group of groups) {
      for (const subgroup of group.subgroups) {
        if (!subgroup.layers.some((layer) => layer.id === this.layer.id)) {
          continue;
        }

        for (const sibling of subgroup.layers) {
          if (sibling.id !== this.layer.id) {
            this.controlService.deactivateLayer(sibling.id);
          }
        }
        return;
      }
    }
  }

  deactivateLayer(): void {
    this.controlService.stopPlayback(this.layer.id);
    this.controlService.deactivateLayer(this.layer.id);
  }

  onOpacityChange(opacity: number): void {
    const activeLayer = this.getActiveLayer();
    if (activeLayer && activeLayer.controls.type === LayerType.TILE) {
      // For radar layers, update ALL elevations (global opacity = all elevations)
      if (activeLayer.controls.category === LayerCategory.RADAR) {
        const allElevationIds = this.availableElevations().map((elev) => elev.id);
        allElevationIds.forEach((id: string) => {
          this.controlService.setElevationOpacity(this.layer.id, id, opacity);
        });
      }
      // For WRF/ECMWF, cascade to all corridas and their renders (mirrors radar elevation
      // model: moving the global slider explicitly pushes the value to all children,
      // overwriting any individual per-forecast / per-render overrides).
      if (activeLayer.controls.category === LayerCategory.WRF) {
        const allForecastTs = this.selectedForecastTimestamps();
        const secondaryRenders = this.getForecastRenders();
        allForecastTs.forEach((forecastTs) => {
          this.controlService.setWrfForecastOpacity(this.layer.id, forecastTs, opacity);
          this.controlService.setWrfForecastRenderOpacity(
            this.layer.id,
            forecastTs,
            PRIMARY_RENDER_ID,
            opacity,
          );
          secondaryRenders.forEach((render) => {
            this.controlService.setWrfForecastRenderOpacity(
              this.layer.id,
              forecastTs,
              render.id,
              opacity,
            );
          });
        });
      }
      if (activeLayer.controls.category === LayerCategory.ECMWF_TP) {
        const allForecastTs = this.selectedForecastTimestamps();
        const secondaryRenders = this.getForecastRenders();
        allForecastTs.forEach((forecastTs) => {
          this.controlService.setEcmwfTpForecastOpacity(this.layer.id, forecastTs, opacity);
          this.controlService.setEcmwfTpForecastRenderOpacity(
            this.layer.id,
            forecastTs,
            PRIMARY_RENDER_ID,
            opacity,
          );
          secondaryRenders.forEach((render) => {
            this.controlService.setEcmwfTpForecastRenderOpacity(
              this.layer.id,
              forecastTs,
              render.id,
              opacity,
            );
          });
        });
      }
    }

    // Always update the layer's base opacity
    this.controlService.setOpacity(this.layer.id, opacity);

    if (this.isWeatherStationsLayer()) {
      this.controlService.setWeatherStationsSharedOpacity(opacity);
    }
  }

  formatOpacity = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  formatTimeIndex = (value: number): string => {
    return this.getTimeOnly(value);
  };

  onTimeIndexChange(timeIndex: number): void {
    if (this.layer.category === LayerCategory.WEATHER_STATIONS) {
      this.stopWeatherStationsPlayback();
      const tilesetId = this.weatherStationsTilesetIds()[timeIndex];
      if (!tilesetId) {
        return;
      }

      this.controlService.setWeatherStationsSelectedTilesetId(tilesetId);
      void this.refreshService.loadWeatherStationsSnapshot(true);
      return;
    }

    this.detachIfSynced();
    this.stopIfPlaying();

    this.controlService.setTimeIndex(this.layer.id, timeIndex);
  }

  isElevationSelected(elevationId: string): boolean {
    return this.selectedElevationIds().includes(elevationId);
  }

  onElevationToggle(elevationId: string): void {
    this.controlService.toggleElevation(this.layer.id, elevationId);
  }

  getElevationOpacity(elevationId: string): number {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return 1;

    if (
      activeItem.controls.type === LayerType.TILE &&
      activeItem.controls.category === LayerCategory.RADAR
    ) {
      const elevationOpacity = activeItem.controls.elevation.elevationOpacity[elevationId];
      return elevationOpacity !== undefined ? elevationOpacity : activeItem.controls.opacity;
    }

    return activeItem.controls.opacity;
  }

  getElevationOpacityPercent(elevationId: string): number {
    return Math.round(this.getElevationOpacity(elevationId) * 100);
  }

  onElevationOpacityChange(elevationId: string, opacity: number): void {
    this.controlService.setElevationOpacity(this.layer.id, elevationId, opacity);
  }

  globalElevationOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return undefined;

    const selectedIds = this.selectedElevationIds();
    if (selectedIds.length === 0) return activeLayer.controls.opacity;

    const opacities = selectedIds.map((id) => this.getElevationOpacity(id));
    const firstOpacity = opacities[0];

    // Check if all opacities are the same
    const allSame = opacities.every((opacity) => Math.abs(opacity - firstOpacity) < 0.001);

    return allSame ? firstOpacity : undefined;
  });

  globalForecastOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return undefined;

    const selectedTimestamps = this.selectedForecastTimestamps();
    if (selectedTimestamps.length === 0) return activeLayer.controls.opacity;

    const uniformOpacities = selectedTimestamps.map((ts) => this.getForecastRunUniformOpacity(ts));
    if (uniformOpacities.some((o) => o === undefined)) return undefined;
    const opacities = uniformOpacities as number[];
    const firstOpacity = opacities[0];
    const allSame = opacities.every((o) => Math.abs(o - firstOpacity) < 0.001);
    return allSame ? firstOpacity : undefined;
  });

  getTimeLabel(timeIndex: number): string {
    if (!this.hasTimeControl()) return 'Cargando...';
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || timeIndex < 0 || timeIndex >= tilesets.length) return 'Sin datos';
    return formatDateFull(tilesets[timeIndex].time);
  }

  getTimeOnly(timeIndex: number): string {
    if (!this.hasTimeControl()) return '--:--';
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || timeIndex < 0 || timeIndex >= tilesets.length) return '--:--';
    return formatDateTimeOnly(tilesets[timeIndex].time);
  }

  /** Forecast run timestamp (ECMWF or WRF) as "HH:MM", for the selector label. */
  formatForecastTime(forecastTs: string): string {
    const date = this.parseForecastTimestamp(forecastTs);
    return date ? formatDateTimeOnly(date) : forecastTs;
  }

  /** Forecast run timestamp (ECMWF or WRF) as "YYYY-MM-DD HH:MM", for its tooltip. */
  formatForecastFull(forecastTs: string): string {
    const date = this.parseForecastTimestamp(forecastTs);
    return date ? formatDateFull(date) : forecastTs;
  }

  private parseForecastTimestamp(forecastTs: string): Date | null {
    if (this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.WRF) {
      return parseWrfInitTag(forecastTs);
    }
    return parseEcmwfTimestamp(forecastTs);
  }

  forecastControlGroups = computed((): ForecastControlGroup[] => {
    const secondaryRenders = this.getForecastRenders().map((render) => ({
      id: render.id,
      name: this.getForecastRenderName(render),
    }));

    return this.availableForecasts().map((forecastTs) => ({
      forecastTs,
      displayLabel: this.formatForecastTime(forecastTs),
      fullLabel: this.formatForecastFull(forecastTs),
      secondaryRenders,
    }));
  });

  hasForecastControl = computed(() => {
    if (this.layer.type !== LayerType.TILE) return false;
    if (
      this.layer.category !== LayerCategory.ECMWF_TP &&
      this.layer.category !== LayerCategory.WRF
    ) {
      return false;
    }
    const config = this.configService.getConfig(this.layer.id) as
      | EcmwfTpTileLayerConfig
      | WrfTileLayerConfig
      | undefined;
    return (config?.availableForecasts?.length ?? 0) > 0;
  });

  availableForecasts = computed((): string[] => {
    if (this.layer.type !== LayerType.TILE) return [];
    if (
      this.layer.category !== LayerCategory.ECMWF_TP &&
      this.layer.category !== LayerCategory.WRF
    ) {
      return [];
    }
    const config = this.configService.getConfig(this.layer.id) as
      | EcmwfTpTileLayerConfig
      | WrfTileLayerConfig
      | undefined;
    return config?.availableForecasts ?? [];
  });

  selectedForecastTimestamps = computed((): string[] => {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return [];
    if (
      activeItem.controls.type === LayerType.TILE &&
      (activeItem.controls.category === LayerCategory.ECMWF_TP ||
        activeItem.controls.category === LayerCategory.WRF)
    ) {
      return (activeItem.controls as EcmwfTpLayerControls | WrfLayerControls).forecast
        .selectedForecastTimestamps;
    }
    return [];
  });

  isForecastSelected(forecastTs: string): boolean {
    return this.selectedForecastTimestamps().includes(forecastTs);
  }

  onForecastToggle(forecastTs: string): void {
    const wasSelected = this.isForecastSelected(forecastTs);

    if (this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.WRF) {
      this.controlService.toggleWrfForecast(this.layer.id, forecastTs);
    } else {
      this.controlService.toggleEcmwfTpForecast(this.layer.id, forecastTs);
    }

    this.expandedForecastRuns.update((prev) => {
      const next = new Set(prev);
      if (wasSelected) {
        next.delete(forecastTs);
      } else if (this.isForecastsExpanded()) {
        next.add(forecastTs);
      }
      return next;
    });
  }

  getForecastOpacity(forecastTs: string): number {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return 1;
    if (
      activeItem.controls.type === LayerType.TILE &&
      (activeItem.controls.category === LayerCategory.ECMWF_TP ||
        activeItem.controls.category === LayerCategory.WRF)
    ) {
      const forecastControls = (activeItem.controls as EcmwfTpLayerControls | WrfLayerControls)
        .forecast;
      const forecastOpacity = forecastControls.forecastOpacity[forecastTs];
      return forecastOpacity !== undefined ? forecastOpacity : activeItem.controls.opacity;
    }
    return activeItem.controls.opacity;
  }

  getForecastOpacityPercent(forecastTs: string): number {
    return Math.round(this.getForecastOpacity(forecastTs) * 100);
  }

  onForecastOpacityChange(forecastTs: string, opacity: number): void {
    if (this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.WRF) {
      this.controlService.setWrfForecastOpacity(this.layer.id, forecastTs, opacity);
      // Cascade to primary and all secondary renders for this corrida (mirrors radar elevation
      // model: moving the corrida slider explicitly pushes the value to all its renders).
      this.controlService.setWrfForecastRenderOpacity(
        this.layer.id,
        forecastTs,
        PRIMARY_RENDER_ID,
        opacity,
      );
      this.getForecastRenders().forEach((render) => {
        this.controlService.setWrfForecastRenderOpacity(
          this.layer.id,
          forecastTs,
          render.id,
          opacity,
        );
      });
      return;
    }
    // Cascade to primary and all secondary renders for this run (mirrors WRF / radar model).
    this.controlService.setEcmwfTpForecastOpacity(this.layer.id, forecastTs, opacity);
    this.controlService.setEcmwfTpForecastRenderOpacity(
      this.layer.id,
      forecastTs,
      PRIMARY_RENDER_ID,
      opacity,
    );
    this.getForecastRenders().forEach((render) => {
      this.controlService.setEcmwfTpForecastRenderOpacity(
        this.layer.id,
        forecastTs,
        render.id,
        opacity,
      );
    });
  }

  getForecastRunUniformOpacity(forecastTs: string): number | undefined {
    const allRenderIds = [PRIMARY_RENDER_ID, ...this.getForecastRenders().map((r) => r.id)];
    const opacities = allRenderIds.map((id) => this.getForecastRenderOpacity(forecastTs, id));
    const first = opacities[0];
    return opacities.every((o) => Math.abs(o - first) < 0.001) ? first : undefined;
  }

  isForecastRenderSelected(forecastTs: string, renderId: string): boolean {
    return (
      this.isForecastSelected(forecastTs) && this.getForecastRenderVisible(forecastTs, renderId)
    );
  }

  onForecastRenderToggle(forecastTs: string, renderId: string): void {
    const nextVisible = !this.getForecastRenderVisible(forecastTs, renderId);

    if (this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.WRF) {
      this.controlService.setWrfForecastRenderVisible(
        this.layer.id,
        forecastTs,
        renderId,
        nextVisible,
      );
    } else {
      this.controlService.setEcmwfTpForecastRenderVisible(
        this.layer.id,
        forecastTs,
        renderId,
        nextVisible,
      );
    }
  }

  getForecastRenderOpacity(forecastTs: string, renderId: string): number {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return this.getForecastOpacity(forecastTs);

    if (
      activeItem.controls.type === LayerType.TILE &&
      (activeItem.controls.category === LayerCategory.ECMWF_TP ||
        activeItem.controls.category === LayerCategory.WRF)
    ) {
      const renderOpacity = (activeItem.controls as EcmwfTpLayerControls | WrfLayerControls)
        .forecast.renderControls[forecastTs]?.renderOpacity[renderId];
      return renderOpacity !== undefined ? renderOpacity : this.getForecastOpacity(forecastTs);
    }

    return this.getForecastOpacity(forecastTs);
  }

  getForecastRenderOpacityPercent(forecastTs: string, renderId: string): number {
    return Math.round(this.getForecastRenderOpacity(forecastTs, renderId) * 100);
  }

  onForecastRenderOpacityChange(forecastTs: string, renderId: string, opacity: number): void {
    if (this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.WRF) {
      this.controlService.setWrfForecastRenderOpacity(this.layer.id, forecastTs, renderId, opacity);
      return;
    }

    this.controlService.setEcmwfTpForecastRenderOpacity(
      this.layer.id,
      forecastTs,
      renderId,
      opacity,
    );
  }

  togglePlayback(): void {
    if (this.isWeatherStationsLayer()) {
      if (this.isPlaying()) {
        this.stopWeatherStationsPlayback();
      } else {
        this.startWeatherStationsPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.togglePlayback(this.layer.id);
  }

  onPlaySpeedChange(speed: number): void {
    if (this.isWeatherStationsLayer()) {
      this.weatherStationsPlaybackSpeed.set(this.clampPlaybackSpeed(speed));
      if (this.isPlaying()) {
        this.startWeatherStationsPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.setPlaySpeed(this.layer.id, speed);
  }

  onImageCountChange(count: number): void {
    if (this.isWeatherStationsLayer()) {
      this.controlService.setWeatherStationsImageCount(count);
      if (this.isPlaying()) {
        this.startWeatherStationsPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.setImageCount(this.layer.id, count);
  }

  private detachIfSynced(): void {
    if (this.isSynced()) this.syncService.detachLayer(this.layer.id);
  }

  private stopIfPlaying(): void {
    if (this.isPlaying()) this.controlService.stopPlayback(this.layer.id);
  }

  hasScale(): boolean {
    return this.layer.scale !== undefined;
  }

  isPrimaryRenderActiveForAnyForecast = computed((): boolean => {
    if (
      this.layer.type !== LayerType.TILE ||
      (this.layer.category !== LayerCategory.ECMWF_TP && this.layer.category !== LayerCategory.WRF)
    ) {
      return true;
    }
    const selected = this.selectedForecastTimestamps();
    if (selected.length === 0) return false;
    return selected.some((ts) => this.getForecastRenderVisible(ts, PRIMARY_RENDER_ID));
  });

  isScaleSelected(): boolean {
    return this.scaleTools.enabled() && this.scaleTools.isLayerSelected(this.layer.id);
  }

  toggleScale(): void {
    if (!this.scaleTools.enabled()) {
      this.scaleTools.setEnabled(true);
    }
    this.scaleTools.toggleLayerSelection(this.layer.id);

    if (this.isWeatherStationsLayer()) {
      this.controlService.setWeatherStationsScaleVisible(
        this.scaleTools.enabled() && this.scaleTools.isLayerSelected(this.layer.id),
      );
    }
  }

  private isWeatherStationsLayer(): boolean {
    return this.layer.category === LayerCategory.WEATHER_STATIONS;
  }

  private getForecastRenders(): readonly (SecondaryVectorRender | BarbTileRender)[] {
    if (this.layer.type !== LayerType.TILE) {
      return [];
    }

    if (this.layer.category === LayerCategory.ECMWF_TP) {
      const secondary = (this.layer as EcmwfTpTileLayer).secondaryRender;
      return secondary ? [secondary] : [];
    }

    if (this.layer.category === LayerCategory.WRF) {
      return (this.layer as WrfTileLayer).secondaryRenders ?? [];
    }

    return [];
  }

  private getForecastRenderVisible(forecastTs: string, renderId: string): boolean {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return true;

    if (
      activeItem.controls.type === LayerType.TILE &&
      (activeItem.controls.category === LayerCategory.ECMWF_TP ||
        activeItem.controls.category === LayerCategory.WRF)
    ) {
      return (
        (activeItem.controls as EcmwfTpLayerControls | WrfLayerControls).forecast.renderControls[
          forecastTs
        ]?.selectedRenderIds.includes(renderId) ?? true
      );
    }

    return true;
  }

  private getForecastRenderName(render: SecondaryVectorRender | BarbTileRender): string {
    if (render.pointQuery?.name) {
      return render.pointQuery.name;
    }

    if (isBarbTileRender(render)) {
      return 'Barbas';
    }

    const suffix = render.id.split('-').at(-1) ?? render.id;
    switch (suffix) {
      case 'mslp':
      case 'slp':
      case 'isobars':
      case 'isobaras':
        return 'Presión a nivel del mar';
      case 'gust_threshold':
        return 'Umbral de ráfagas';
      case 'shear_850_500':
        return 'Cortante 850-500 hPa';
      case 'shear_850_700':
        return 'Cortante 850-700 hPa';
      case 'brn':
        return 'Bulk Richardson Number';
      case 'haildiammax':
        return 'Diámetro máximo de granizo';
      default:
        return suffix.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }

  readonly weatherStationsTemporalMode = computed(() =>
    this.controlService.getWeatherStationsTemporalMode(),
  );

  readonly isWeatherStationsSpecificTemporalMode = computed(
    () => this.weatherStationsTemporalMode() === WeatherStationsTemporalMode.SPECIFIC,
  );

  readonly weatherStationsGracePeriodHours = computed(() =>
    this.controlService.getWeatherStationsGracePeriodHours(),
  );

  // Bound to the "Mostrar estaciones sin datos" checkbox. When false, the
  // renderer drops stations whose `hasData` is false (last observation falls
  // outside the grace-period window).
  readonly weatherStationsShowStationsWithoutData =
    this.controlService.weatherStationsShowStationsWithoutData;

  readonly weatherStationsImageCountOptions = computed(() => [
    ...WEATHER_STATIONS_IMAGE_COUNT_OPTIONS,
  ]);

  readonly weatherStationsTilesetIds = computed(() =>
    this.refreshService.getWeatherStationsAvailableTilesetIds(),
  );

  readonly weatherStationsSelectedTilesetIndex = computed(() => {
    const tilesetIds = this.weatherStationsTilesetIds();
    if (tilesetIds.length === 0) {
      return 0;
    }

    const selectedTilesetId = this.controlService.getWeatherStationsSelectedTilesetId();
    if (!selectedTilesetId) {
      return tilesetIds.length - 1;
    }

    const selectedIndex = tilesetIds.indexOf(selectedTilesetId);
    return selectedIndex >= 0 ? selectedIndex : tilesetIds.length - 1;
  });

  onWeatherStationsTemporalModeChange(mode: WeatherStationsTemporalMode): void {
    this.controlService.setWeatherStationsTemporalMode(mode);
    if (mode === WeatherStationsTemporalMode.LATEST) {
      this.stopWeatherStationsPlayback();
      const latestTilesetId = this.weatherStationsTilesetIds().at(-1) ?? null;
      this.controlService.setWeatherStationsSelectedTilesetId(latestTilesetId);
    }
    void this.refreshService.loadWeatherStationsSnapshot(true);
  }

  onWeatherStationsGracePeriodHoursChange(gracePeriodHours: number): void {
    this.controlService.setWeatherStationsGracePeriodHours(gracePeriodHours);
    if (this.weatherStationsTemporalMode() === WeatherStationsTemporalMode.SPECIFIC) {
      if (this.isPlaying()) {
        this.startWeatherStationsPlayback();
      }
      void this.refreshService.loadWeatherStationsSnapshot(true);
    }
  }

  onWeatherStationsShowWithoutDataChange(showStationsWithoutData: boolean): void {
    // Pure display-side toggle: no re-fetch needed, the renderer reads the
    // signal on its next render pass.
    this.controlService.setWeatherStationsShowStationsWithoutData(showStationsWithoutData);
  }

  onWeatherStationsTilesetIndexChange(tilesetIndex: number): void {
    const tilesetId = this.weatherStationsTilesetIds()[tilesetIndex];
    if (!tilesetId) {
      return;
    }

    this.controlService.setWeatherStationsSelectedTilesetId(tilesetId);
    if (this.weatherStationsTemporalMode() === WeatherStationsTemporalMode.SPECIFIC) {
      void this.refreshService.loadWeatherStationsSnapshot(true);
    }
  }

  private startWeatherStationsPlayback(): void {
    if (!this.isActive() || !this.isWeatherStationsSpecificTemporalMode()) {
      return;
    }

    if (this.imageCount() <= 1) {
      this.stopWeatherStationsPlayback();
      return;
    }

    const min = this.minTimeIndex();
    const max = this.maxTimeIndex();
    if (max - min < 1) {
      this.stopWeatherStationsPlayback();
      return;
    }

    this.stopWeatherStationsPlayback();
    this.weatherStationsPlaybackIsPlaying.set(true);
    const intervalMs = this.clampPlaybackSpeed(this.playSpeed()) * 1000;

    this.weatherStationsPlaybackTimerId = window.setInterval(() => {
      const dynamicMin = this.minTimeIndex();
      const dynamicMax = this.maxTimeIndex();

      if (dynamicMax - dynamicMin < 1) {
        this.stopWeatherStationsPlayback();
        return;
      }

      const nextIndex =
        this.currentTimeIndex() >= dynamicMax ? dynamicMin : this.currentTimeIndex() + 1;

      this.onWeatherStationsTilesetIndexChange(nextIndex);
    }, intervalMs);
  }

  private stopWeatherStationsPlayback(): void {
    if (this.weatherStationsPlaybackTimerId !== null) {
      window.clearInterval(this.weatherStationsPlaybackTimerId);
      this.weatherStationsPlaybackTimerId = null;
    }

    this.weatherStationsPlaybackIsPlaying.set(false);
  }

  private clampPlaybackSpeed(speed: number): number {
    return Math.max(0.4, Math.min(10, speed));
  }

  private weatherStationsTilesetIdToDate(tilesetId: string): Date | null {
    const match = tilesetId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})00Z$/);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour] = match;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0),
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private captureCurrentWeatherStationsSharedState(): void {
    const activeWeatherStationLayer = this.controlService
      .activeLayers()
      .find((item) => item.layer.category === LayerCategory.WEATHER_STATIONS);

    if (activeWeatherStationLayer) {
      this.controlService.captureWeatherStationsSharedFromControls(
        activeWeatherStationLayer.controls,
      );
      this.controlService.setWeatherStationsScaleVisible(
        this.scaleTools.enabled() &&
          this.scaleTools.isLayerSelected(activeWeatherStationLayer.layer.id),
      );
      return;
    }

    this.controlService.captureWeatherStationsSharedFromControls(
      this.controlService.getControls(this.layer.id),
    );
  }

  private applySharedStateToWeatherStationsLayer(): void {
    this.controlService.setOpacity(
      this.layer.id,
      this.controlService.getWeatherStationsSharedOpacity(),
    );

    const sharedZIndex = this.controlService.getWeatherStationsSharedZIndex();
    if (sharedZIndex !== null) {
      this.controlService.setZIndex(this.layer.id, sharedZIndex);
    }

    if (!this.hasScale()) {
      return;
    }

    const shouldShowScale = this.controlService.isWeatherStationsScaleVisible();
    const isSelected = this.scaleTools.isLayerSelected(this.layer.id);

    if (shouldShowScale) {
      if (!this.scaleTools.enabled()) {
        this.scaleTools.setEnabled(true);
      }
      if (!isSelected) {
        this.scaleTools.toggleLayerSelection(this.layer.id);
      }
      return;
    }

    if (isSelected) {
      this.scaleTools.toggleLayerSelection(this.layer.id);
    }
  }
}
