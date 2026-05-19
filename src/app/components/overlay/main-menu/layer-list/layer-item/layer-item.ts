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
import {
  EcmwfTpLayerControls,
  EcmwfTpTileLayerConfig,
  Layer,
  LayerCategory,
  LayerSelectionMode,
  LayerType,
  TilesetEntry,
} from '../../../../../models';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerConfigService } from '../../../../../services/layers/layer-config.service';
import { LayerRefreshService } from '../../../../../services/layers/layer-refresh.service';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import {
  formatDateFull,
  formatDateTimeOnly,
  formatEcmwfForecastTs,
} from '../../../../../utils/tileset-timestamp';
import { computeWindowStart } from '../../../../../utils/playback-window';
import { ScaleToolsService } from '../../../../../services/tools/scale-tools.service';
import { SmnStationsTemporalMode } from '../../../../../config/layers/smn-stations/controls.constants';

/**
 * Modo de visualización del componente
 */
export type LayerItemMode = 'available' | 'active';

/**
 * Componente reutilizable para mostrar y controlar una capa individual
 *
 * Este componente abstrae toda la lógica de una capa incluyendo:
 * - Control de opacidad
 * - Control de tiempo (con play/pause)
 * - Carga de configuración de canales
 * - Activación/desactivación
 *
 * Se utiliza tanto en la pestaña "Disponibles" como "Activas"
 */
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
  ],
  templateUrl: './layer-item.html',
  styleUrl: './layer-item.scss',
})
export class LayerItemComponent implements OnInit, OnDestroy, OnChanges {
  readonly LayerCategory = LayerCategory;
  readonly SmnStationsTemporalMode = SmnStationsTemporalMode;

  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);
  private readonly configService = inject(LayerConfigService);
  private readonly refreshService = inject(LayerRefreshService);
  private readonly syncService = inject(SyncPlaybackService);
  private readonly scaleTools = inject(ScaleToolsService);

  /**
   * Capa a renderizar (requerido)
   */
  @Input({ required: true }) layer!: Layer;

  /**
   * Modo de visualización: 'available' muestra checkbox, 'active' muestra drag handle
   */
  @Input() mode: LayerItemMode = 'available';

  /**
   * Selection behavior for available-mode controls.
   * - MULTIPLE: checkbox behavior
   * - SINGLE: radio-like behavior (exclusive within subgroup)
   */
  @Input() selectionMode: LayerSelectionMode = LayerSelectionMode.MULTIPLE;

  /**
   * Stable name used by Material radios to group options per subgroup.
   */
  @Input() radioGroupName = '';

  // Propiedades derivadas del modo
  readonly showClose = true;
  readonly showDragHandle = true;

  // Estado local
  isLoadingConfig = signal(false);
  isExpanded = signal(false);
  isElevationsExpanded = signal(false);
  isForecastsExpanded = signal(false);
  private smnPlaybackTimerId: number | null = null;
  private readonly smnPlaybackIsPlaying = signal(false);
  private readonly smnPlaybackSpeed = signal(1);

  /** True when this layer is currently controlled by the global sync playback. */
  isSynced = computed(() => this.syncService.isLayerSelected(this.layer.id));

  playSpeed = computed(() => {
    if (this.isSmnStationsLayer()) {
      return this.smnPlaybackSpeed();
    }

    const controls = this.controlService.getControls(this.layer.id);
    switch (controls?.type) {
      case LayerType.TILE:
        return controls.playback.speed;
      default:
        return 1;
    }
  });

  lastImagesCount = computed(() => {
    if (this.isSmnStationsLayer()) {
      return this.controlService.getSmnStationsLastImagesCount();
    }

    const controls = this.controlService.getControls(this.layer.id);
    switch (controls?.type) {
      case LayerType.TILE:
        return controls.playback.lastImagesCount;
      default:
        return 1;
    }
  });

  /**
   * Obtiene las opciones de períodos disponibles desde la configuración de la capa
   */
  lastImagesOptions = computed(() => {
    if (this.isSmnStationsLayer()) {
      return this.smnLastImagesCountOptions();
    }

    switch (this.layer.type) {
      case LayerType.TILE:
        return this.layer.availablePeriods ?? [1];
      default:
        return [1];
    }
  });

  isPlaying = computed(() => {
    if (this.isSmnStationsLayer()) {
      return this.smnPlaybackIsPlaying();
    }

    return this.controlService.isPlaying(this.layer.id);
  });

  canPlayback = computed(() => {
    if (this.isSmnStationsLayer()) {
      return this.maxTimeIndex() - this.minTimeIndex() >= 1;
    }

    return this.maxTimeIndex() > 0 && this.lastImagesCount() > 1;
  });

  getActiveLayer = computed(() => {
    return this.controlService.activeLayers().find((item) => item.layer.id === this.layer.id);
  });

  /**
   * Obtiene la opacidad actual de la capa activa
   * Para capas de radar, retorna la opacidad común de todas las elevaciones si es la misma, sino retorna undefined
   */
  currentOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return;

    if (activeLayer.controls.type === LayerType.TILE) {
      // For radar layers, check if elevations have different opacities
      if (activeLayer.controls.category === LayerCategory.RADAR) {
        return this.globalElevationOpacity();
      }
      // For ECMWF layers, check if forecasts have different opacities
      if (activeLayer.controls.category === LayerCategory.ECMWF_TP) {
        return this.globalForecastOpacity();
      }
    }

    return activeLayer.controls.opacity;
  });

  /**
   * Obtiene la opacidad actual como porcentaje entero (0-100)
   * Retorna undefined si las elevaciones tienen diferentes opacidades
   */
  currentOpacityPercent = computed(() => {
    const opacity = this.currentOpacity();
    if (opacity === undefined) return undefined;
    return Math.round(opacity * 100);
  });

  /**
   * Obtiene la opacidad base de la capa (usada como fallback cuando las elevaciones tienen diferentes opacidades)
   */
  baseLayerOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    return activeLayer?.controls.opacity ?? 1;
  });

  /**
   * Indica si la capa está activa (visible en el mapa)
   */
  isActive = computed(() => {
    return this.getActiveLayer() !== undefined;
  });

  hasTimeControl = computed(() => {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      return this.smnTilesetIds().length > 0;
    }

    // Debe tener configuración Y tilesets disponibles
    if (!this.configService.hasConfig(this.layer.id)) return false;

    const tilesets = this.getAvailableTilesetsForLayer();
    return tilesets && tilesets.length > 0;
  });

  /**
   * Verifica si la capa requiere control de tiempo pero no hay períodos disponibles
   */
  hasNoPeriodsAvailable = computed(() => {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      return this.smnTilesetIds().length === 0;
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

  /**
   * Verifica si la capa necesita control de período (TILE layers)
   */
  needsTimeControl = computed(() => {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      return true;
    }

    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF_TP:
            return true;
          default:
            return false;
        }
      default:
        return false;
    }
  });

  /**
   * Verifica si la capa necesita control de elevación (solo RADAR)
   */
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

  /**
   * Obtiene las elevaciones disponibles
   */
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

  /**
   * Obtiene los índices de elevación como opciones para el selector
   */
  elevationIndexOptions = computed(() => {
    return this.availableElevations().map((_, i) => i);
  });

  /**
   * Obtiene los IDs de las elevaciones seleccionadas
   */
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

  /**
   * Obtiene el índice máximo de tiempo
   */
  maxTimeIndex = computed(() => {
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || tilesets.length === 0) return 0;

    const lastImagesCount = this.lastImagesCount();
    if (lastImagesCount === 1) {
      return tilesets.length - 1;
    }

    const isForecast = this.layer.type === LayerType.TILE && this.layer.isForecast;
    const min = computeWindowStart(tilesets.length, lastImagesCount, isForecast);
    return Math.min(min + lastImagesCount - 1, tilesets.length - 1);
  });

  layerShortName = computed(() => this.layersService.getLayerShortName(this.layer));
  layerFullName = computed(() => this.layersService.getLayerFullName(this.layer));

  /**
   * Obtiene el índice mínimo para el slider (limitado por el selector de últimas imágenes)
   */
  minTimeIndex = computed(() => {
    const tilesets = this.getAvailableTilesetsForLayer();
    if (!tilesets || tilesets.length === 0) return 0;

    const lastImagesCount = this.lastImagesCount();
    if (lastImagesCount === 1) {
      return 0;
    }

    const isForecast = this.layer.type === LayerType.TILE && this.layer.isForecast;
    return computeWindowStart(tilesets.length, lastImagesCount, isForecast);
  });

  /**
   * Índice de tiempo actual - lee directamente del servicio
   */
  currentTimeIndex = computed(() => {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      return this.smnSelectedTilesetIndex();
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

  ngOnInit(): void {
    // Layer refresh service will handle config fetching for active layers
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Layer refresh service will handle config fetching
  }

  ngOnDestroy(): void {
    if (this.isSmnStationsLayer()) {
      this.stopSmnPlayback();
    }

    // Don't stop playback on destroy - let it continue in the background
    // The layer service will manage playback lifecycle independently
  }

  /**
   * Obtiene los tilesets disponibles según la categoría de la capa.
   * Para GOES_19 y RADAR: devuelve todos los tilesets.
   */
  private getAvailableTilesetsForLayer(): TilesetEntry[] | undefined {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      const entries: TilesetEntry[] = [];

      for (const tilesetId of this.smnTilesetIds()) {
        const tilesetTime = this.smnTilesetIdToDate(tilesetId);
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
        console.error(`❌ [LayerItem] Error refrescando config de ${this.layer.id}:`, err);
      },
    });
  }

  // ==========================================================================
  // Activación/Desactivación
  // ==========================================================================

  /**
   * Alterna el estado de activación de la capa
   */
  async toggleActive(checked: boolean): Promise<void> {
    if (checked) {
      await this.activateLayer();
      if (this.isActive()) {
        // Expand details by default when activating
        this.isExpanded.set(true);
      }
    } else {
      this.deactivateLayer();
    }
  }

  async onRadioSelected(): Promise<void> {
    await this.activateLayer();
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

  /**
   * Alterna la expansión del card completo (opacidad + período)
   */
  toggleExpansion(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  /**
   * Alterna la expansión de los controles de elevación
   */
  toggleElevationsExpansion(): void {
    this.isElevationsExpanded.set(!this.isElevationsExpanded());
  }

  /**
   * Alterna la expansión de los controles de corridas ECMWF
   */
  toggleForecastsExpansion(): void {
    this.isForecastsExpanded.set(!this.isForecastsExpanded());
  }

  /**
   * Activa la capa
   */
  private async activateLayer(): Promise<void> {
    if (this.isSmnStationsLayer()) {
      this.captureCurrentSmnSharedState();
    }

    if (this.selectionMode === LayerSelectionMode.SINGLE) {
      this.deactivateSiblingLayersInSubgroup();
    }

    this.controlService.activateLayer(this.layer.id);

    if (this.isSmnStationsLayer()) {
      this.applySharedStateToSmnLayer();
      // Belt-and-suspenders: the weather-stations HTTP interceptor handles
      // 401 re-prompt + notification, and both refresh-service methods are
      // already fail-soft on other errors. The try/catch here just prevents
      // a future regression from surfacing as `Uncaught (in promise)`.
      try {
        await this.refreshService.ensureSmnStationsEndpointConfigLoaded();
        await this.refreshService.loadSmnStationsSnapshot(true);
      } catch (err) {
        console.warn('[LayerItem] SMN stations activation failed:', err);
      }
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

  // ==========================================================================
  // Control de Opacidad
  // ==========================================================================

  onOpacityChange(opacity: number): void {
    const activeLayer = this.getActiveLayer();
    if (activeLayer && activeLayer.controls.type === LayerType.TILE) {
      // For radar layers, update ALL elevations
      if (activeLayer.controls.category === LayerCategory.RADAR) {
        const allElevationIds = this.availableElevations().map((elev) => elev.id);
        allElevationIds.forEach((id) => {
          this.controlService.setElevationOpacity(this.layer.id, id, opacity);
        });
      }
      // For ECMWF layers, update ALL forecasts
      if (activeLayer.controls.category === LayerCategory.ECMWF_TP) {
        const allForecasts = this.availableForecasts();
        allForecasts.forEach((ts) => {
          this.controlService.setEcmwfTpForecastOpacity(this.layer.id, ts, opacity);
        });
      }
    }

    // Always update the layer's base opacity as well
    this.controlService.setOpacity(this.layer.id, opacity);

    if (this.isSmnStationsLayer()) {
      this.controlService.setSmnStationsSharedOpacity(opacity);
    }
  }

  /**
   * Formatea el valor de opacidad para el slider (convierte 0-1 a porcentaje entero)
   */
  formatOpacity = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  /**
   * Formatea el índice de tiempo para el slider (muestra HH:MM)
   */
  formatTimeIndex = (value: number): string => {
    return this.getTimeOnly(value);
  };

  // ==========================================================================
  // Control de Tiempo
  // ==========================================================================

  onTimeIndexChange(timeIndex: number): void {
    if (this.layer.category === LayerCategory.SMN_STATIONS) {
      this.stopSmnPlayback();
      const tilesetId = this.smnTilesetIds()[timeIndex];
      if (!tilesetId) {
        return;
      }

      this.controlService.setSmnStationsSelectedTilesetId(tilesetId);
      void this.refreshService.loadSmnStationsSnapshot(true);
      return;
    }

    this.detachIfSynced();
    this.stopIfPlaying();

    this.controlService.setTimeIndex(this.layer.id, timeIndex);
  }

  // ==========================================================================
  // Control de Elevación (RADAR)
  // ==========================================================================

  /**
   * Verifica si una elevación está seleccionada
   */
  isElevationSelected(elevationId: string): boolean {
    return this.selectedElevationIds().includes(elevationId);
  }

  /**
   * Maneja el toggle de una elevación (activar/desactivar)
   */
  onElevationToggle(elevationId: string): void {
    this.controlService.toggleElevation(this.layer.id, elevationId);
  }

  /**
   * Obtiene la opacidad de una elevación específica
   */
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

  /**
   * Obtiene el porcentaje de opacidad de una elevación específica
   */
  getElevationOpacityPercent(elevationId: string): number {
    return Math.round(this.getElevationOpacity(elevationId) * 100);
  }

  /**
   * Establece la opacidad de una elevación específica
   */
  onElevationOpacityChange(elevationId: string, opacity: number): void {
    this.controlService.setElevationOpacity(this.layer.id, elevationId, opacity);
  }

  /**
   * Obtiene la opacidad global de todas las elevaciones seleccionadas
   * Retorna undefined si hay diferentes opacidades
   */
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

  /**
   * Obtiene la opacidad global de todas las corridas seleccionadas.
   * Retorna undefined si hay diferentes opacidades.
   */
  globalForecastOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return undefined;

    const selectedTimestamps = this.selectedForecastTimestamps();
    if (selectedTimestamps.length === 0) return activeLayer.controls.opacity;

    const opacities = selectedTimestamps.map((ts) => this.getForecastOpacity(ts));
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

  /**
   * Formats an ECMWF forecast timestamp for display in the selector.
   */
  formatForecastTs(forecastTs: string): string {
    return formatEcmwfForecastTs(forecastTs);
  }

  /**
   * Checks if the layer requires forecast control (ECMWF only)
   */
  hasForecastControl = computed(() => {
    if (this.layer.type !== LayerType.TILE || this.layer.category !== LayerCategory.ECMWF_TP) {
      return false;
    }
    const config = this.configService.getConfig(this.layer.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    return (config?.availableForecasts?.length ?? 0) > 0;
  });

  /**
   * Available forecast runs (ECMWF layers only)
   */
  availableForecasts = computed((): string[] => {
    if (this.layer.type !== LayerType.TILE || this.layer.category !== LayerCategory.ECMWF_TP) {
      return [];
    }
    const config = this.configService.getConfig(this.layer.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    return config?.availableForecasts ?? [];
  });

  /**
   * IDs of selected forecasts
   */
  selectedForecastTimestamps = computed((): string[] => {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return [];
    if (
      activeItem.controls.type === LayerType.TILE &&
      activeItem.controls.category === LayerCategory.ECMWF_TP
    ) {
      return (activeItem.controls as EcmwfTpLayerControls).forecast.selectedForecastTimestamps;
    }
    return [];
  });

  /**
   * Checks if a forecast run is selected
   */
  isForecastSelected(forecastTs: string): boolean {
    return this.selectedForecastTimestamps().includes(forecastTs);
  }

  /**
   * Toggles a forecast run (activate/deactivate)
   */
  onForecastToggle(forecastTs: string): void {
    this.controlService.toggleEcmwfTpForecast(this.layer.id, forecastTs);
  }

  /**
   * Gets the opacity of a specific forecast run
   */
  getForecastOpacity(forecastTs: string): number {
    const activeItem = this.getActiveLayer();
    if (!activeItem) return 1;
    if (
      activeItem.controls.type === LayerType.TILE &&
      activeItem.controls.category === LayerCategory.ECMWF_TP
    ) {
      const ecmwfControls = activeItem.controls as EcmwfTpLayerControls;
      const forecastOpacity = ecmwfControls.forecast.forecastOpacity[forecastTs];
      return forecastOpacity !== undefined ? forecastOpacity : activeItem.controls.opacity;
    }
    return activeItem.controls.opacity;
  }

  /**
   * Gets the opacity percentage of a specific forecast run
   */
  getForecastOpacityPercent(forecastTs: string): number {
    return Math.round(this.getForecastOpacity(forecastTs) * 100);
  }

  /**
   * Sets the opacity of a specific forecast run
   */
  onForecastOpacityChange(forecastTs: string, opacity: number): void {
    this.controlService.setEcmwfTpForecastOpacity(this.layer.id, forecastTs, opacity);
  }

  // ==========================================================================
  // Control de Reproducción
  // ==========================================================================

  togglePlayback(): void {
    if (this.isSmnStationsLayer()) {
      if (this.isPlaying()) {
        this.stopSmnPlayback();
      } else {
        this.startSmnPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.togglePlayback(this.layer.id);
  }

  onPlaySpeedChange(speed: number): void {
    if (this.isSmnStationsLayer()) {
      this.smnPlaybackSpeed.set(this.clampPlaybackSpeed(speed));
      if (this.isPlaying()) {
        this.startSmnPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.setPlaySpeed(this.layer.id, speed);
  }

  onLastImagesCountChange(count: number): void {
    if (this.isSmnStationsLayer()) {
      this.controlService.setSmnStationsLastImagesCount(count);
      if (this.isPlaying()) {
        this.startSmnPlayback();
      }
      return;
    }

    this.detachIfSynced();
    this.controlService.setLastImagesCount(this.layer.id, count);
  }

  private detachIfSynced(): void {
    if (this.isSynced()) this.syncService.detachLayer(this.layer.id);
  }

  private stopIfPlaying(): void {
    if (this.isPlaying()) this.controlService.stopPlayback(this.layer.id);
  }

  // ==========================================================================
  // Control de Escalas
  // ==========================================================================

  hasScale(): boolean {
    return this.layer.scale !== undefined;
  }

  isScaleSelected(): boolean {
    return this.scaleTools.enabled() && this.scaleTools.isLayerSelected(this.layer.id);
  }

  toggleScale(): void {
    if (!this.scaleTools.enabled()) {
      this.scaleTools.setEnabled(true);
    }
    this.scaleTools.toggleLayerSelection(this.layer.id);

    if (this.isSmnStationsLayer()) {
      this.controlService.setSmnStationsScaleVisible(
        this.scaleTools.enabled() && this.scaleTools.isLayerSelected(this.layer.id),
      );
    }
  }

  private isSmnStationsLayer(): boolean {
    return this.layer.category === LayerCategory.SMN_STATIONS;
  }

  readonly smnTemporalMode = computed(() => this.controlService.getSmnStationsTemporalMode());

  readonly isSmnSpecificTemporalMode = computed(
    () => this.smnTemporalMode() === SmnStationsTemporalMode.SPECIFIC,
  );

  readonly smnMaxPastHours = computed(() => this.controlService.getSmnStationsMaxPastHours());

  // Bound to the "Mostrar estaciones sin datos" checkbox. When false, the
  // renderer drops stations whose `hasData` is false (last observation falls
  // outside the requested tolerance window).
  readonly smnShowStationsWithoutData = this.controlService.smnStationsShowStationsWithoutData;

  readonly smnLastImagesCountOptions = computed(() => [1, 3, 6, 12, 24]);

  readonly smnTilesetIds = computed(() => this.refreshService.getSmnStationsAvailableTilesetIds());

  readonly smnSelectedTilesetIndex = computed(() => {
    const tilesetIds = this.smnTilesetIds();
    if (tilesetIds.length === 0) {
      return 0;
    }

    const selectedTilesetId = this.controlService.getSmnStationsSelectedTilesetId();
    if (!selectedTilesetId) {
      return tilesetIds.length - 1;
    }

    const selectedIndex = tilesetIds.indexOf(selectedTilesetId);
    return selectedIndex >= 0 ? selectedIndex : tilesetIds.length - 1;
  });

  onSmnTemporalModeChange(mode: SmnStationsTemporalMode): void {
    this.controlService.setSmnStationsTemporalMode(mode);
    if (mode === SmnStationsTemporalMode.LATEST) {
      this.stopSmnPlayback();
      const latestTilesetId = this.smnTilesetIds().at(-1) ?? null;
      this.controlService.setSmnStationsSelectedTilesetId(latestTilesetId);
    }
    void this.refreshService.loadSmnStationsSnapshot(true);
  }

  onSmnMaxPastHoursChange(maxPastHours: number): void {
    this.controlService.setSmnStationsMaxPastHours(maxPastHours);
    if (this.smnTemporalMode() === SmnStationsTemporalMode.SPECIFIC) {
      if (this.isPlaying()) {
        this.startSmnPlayback();
      }
      void this.refreshService.loadSmnStationsSnapshot(true);
    }
  }

  onSmnShowStationsWithoutDataChange(showStationsWithoutData: boolean): void {
    // Pure display-side toggle: no re-fetch needed, the renderer reads the
    // signal on its next render pass.
    this.controlService.setSmnStationsShowStationsWithoutData(showStationsWithoutData);
  }

  onSmnTilesetIndexChange(tilesetIndex: number): void {
    const tilesetId = this.smnTilesetIds()[tilesetIndex];
    if (!tilesetId) {
      return;
    }

    this.controlService.setSmnStationsSelectedTilesetId(tilesetId);
    if (this.smnTemporalMode() === SmnStationsTemporalMode.SPECIFIC) {
      void this.refreshService.loadSmnStationsSnapshot(true);
    }
  }

  private startSmnPlayback(): void {
    if (!this.isActive() || !this.isSmnSpecificTemporalMode()) {
      return;
    }

    const min = this.minTimeIndex();
    const max = this.maxTimeIndex();
    if (max - min < 1) {
      return;
    }

    this.stopSmnPlayback();
    this.smnPlaybackIsPlaying.set(true);
    const intervalMs = this.clampPlaybackSpeed(this.playSpeed()) * 1000;

    this.smnPlaybackTimerId = window.setInterval(() => {
      const dynamicMin = this.minTimeIndex();
      const dynamicMax = this.maxTimeIndex();

      if (dynamicMax - dynamicMin < 1) {
        this.stopSmnPlayback();
        return;
      }

      const nextIndex =
        this.currentTimeIndex() >= dynamicMax ? dynamicMin : this.currentTimeIndex() + 1;

      this.onSmnTilesetIndexChange(nextIndex);
    }, intervalMs);
  }

  private stopSmnPlayback(): void {
    if (this.smnPlaybackTimerId !== null) {
      window.clearInterval(this.smnPlaybackTimerId);
      this.smnPlaybackTimerId = null;
    }

    this.smnPlaybackIsPlaying.set(false);
  }

  private clampPlaybackSpeed(speed: number): number {
    return Math.max(0.4, Math.min(10, speed));
  }

  private smnTilesetIdToDate(tilesetId: string): Date | null {
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

  private captureCurrentSmnSharedState(): void {
    const activeSmnLayer = this.controlService
      .activeLayers()
      .find((item) => item.layer.category === LayerCategory.SMN_STATIONS);

    if (activeSmnLayer) {
      this.controlService.captureSmnStationsSharedFromControls(activeSmnLayer.controls);
      this.controlService.setSmnStationsScaleVisible(
        this.scaleTools.enabled() && this.scaleTools.isLayerSelected(activeSmnLayer.layer.id),
      );
      return;
    }

    this.controlService.captureSmnStationsSharedFromControls(
      this.controlService.getControls(this.layer.id),
    );
  }

  private applySharedStateToSmnLayer(): void {
    this.controlService.setOpacity(
      this.layer.id,
      this.controlService.getSmnStationsSharedOpacity(),
    );

    const sharedZIndex = this.controlService.getSmnStationsSharedZIndex();
    if (sharedZIndex !== null) {
      this.controlService.setZIndex(this.layer.id, sharedZIndex);
    }

    if (!this.hasScale()) {
      return;
    }

    const shouldShowScale = this.controlService.isSmnStationsScaleVisible();
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
