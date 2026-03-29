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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Layer, LayerCategory, LayerType, TilesetEntry } from '../../../../../models';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerConfigService } from '../../../../../services/layers/layer-config.service';
import { LayerRefreshService } from '../../../../../services/layers/layer-refresh.service';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import { formatDateFull, formatDateTimeOnly } from '../../../../../utils/tileset-timestamp';

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
    MatSelectModule,
    MatFormFieldModule,
    CdkDragHandle,
  ],
  templateUrl: './layer-item.html',
  styleUrl: './layer-item.scss',
})
export class LayerItemComponent implements OnInit, OnDestroy, OnChanges {
  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);
  private readonly configService = inject(LayerConfigService);
  private readonly refreshService = inject(LayerRefreshService);
  private readonly syncService = inject(SyncPlaybackService);

  /**
   * Capa a renderizar (requerido)
   */
  @Input({ required: true }) layer!: Layer;

  /**
   * Modo de visualización: 'available' muestra checkbox, 'active' muestra drag handle
   */
  @Input() mode: LayerItemMode = 'available';

  /**
   * Si se muestra el botón de información (solo en modo available)
   */
  @Input() showInfo: boolean = true;

  /**
   * Si se muestra el botón de cerrar (solo en modo active)
   */
  @Input() showClose: boolean = true;

  /**
   * Si se muestra el drag handle (solo en modo active)
   */
  @Input() showDragHandle: boolean = true;

  // Estado local
  isLoadingConfig = signal(false);
  isExpanded = signal(false);
  isElevationsExpanded = signal(false);

  /** True when this layer is currently controlled by the global sync playback. */
  isSynced = computed(() => this.syncService.isLayerSelected(this.layer.id));

  playSpeed = computed(() => {
    const controls = this.controlService.getControls(this.layer.id);
    switch (controls?.type) {
      case LayerType.TILE:
        return controls.playback.speed;
      default:
        return 1;
    }
  });

  lastImagesCount = computed(() => {
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
    switch (this.layer.type) {
      case LayerType.TILE:
        return this.layer.availablePeriods ?? [1];
      default:
        return [1];
    }
  });

  isPlaying = computed(() => this.controlService.isPlaying(this.layer.id));

  canPlayback = computed(() => {
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

    // For radar layers, check if elevations have different opacities
    if (
      activeLayer.controls.type === LayerType.TILE &&
      activeLayer.controls.category === LayerCategory.RADAR
    ) {
      return this.globalElevationOpacity();
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
    // Debe tener configuración Y tilesets disponibles
    if (!this.configService.hasConfig(this.layer.id)) return false;

    const tilesets = this.getAvailableTilesetsForLayer();
    return tilesets && tilesets.length > 0;
  });

  /**
   * Verifica si la capa requiere control de tiempo pero no hay períodos disponibles
   */
  hasNoPeriodsAvailable = computed(() => {
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
    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
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
    return Math.max(0, (tilesets?.length ?? 1) - 1);
  });

  layerShortName = computed(() => this.layersService.getLayerShortName(this.layer));
  layerFullName = computed(() => this.layersService.getLayerFullName(this.layer));

  /**
   * Obtiene el índice mínimo para el slider (limitado por el selector de últimas imágenes)
   */
  minTimeIndex = computed(() => {
    const max = this.maxTimeIndex();
    const options = this.lastImagesOptions();
    const maxSelectableCount = options.length > 0 ? Math.max(...options) : 1;
    const effectiveCount = Math.min(max + 1, maxSelectableCount);
    return Math.max(0, max - effectiveCount + 1);
  });

  /**
   * Índice de tiempo actual - lee directamente del servicio
   */
  currentTimeIndex = computed(() => {
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
    // Don't stop playback on destroy - let it continue in the background
    // The layer service will manage playback lifecycle independently
  }

  /**
   * Obtiene los tilesets disponibles según la categoría de la capa.
   * Para GOES_19 y RADAR: devuelve todos los tilesets.
   */
  private getAvailableTilesetsForLayer(): TilesetEntry[] | undefined {
    switch (this.layer.type) {
      case LayerType.TILE:
        switch (this.layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
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
  toggleActive(checked: boolean): void {
    if (checked) {
      this.activateLayer();
      // Expand details by default when activating
      this.isExpanded.set(true);
    } else {
      this.deactivateLayer();
    }
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
   * Activa la capa
   */
  private activateLayer(): void {
    this.controlService.activateLayer(this.layer.id);
  }

  deactivateLayer(): void {
    this.controlService.stopPlayback(this.layer.id);
    this.controlService.deactivateLayer(this.layer.id);
  }

  // ==========================================================================
  // Control de Opacidad
  // ==========================================================================

  onOpacityChange(opacity: number): void {
    // For radar layers, update ALL elevations (both selected and unselected)
    // This ensures that when an elevation is turned on later, it matches the current opacity
    const activeLayer = this.getActiveLayer();
    if (
      activeLayer &&
      activeLayer.controls.type === LayerType.TILE &&
      activeLayer.controls.category === LayerCategory.RADAR
    ) {
      // Update ALL available elevations, not just selected ones
      const allElevationIds = this.availableElevations().map((elev) => elev.id);
      allElevationIds.forEach((id) => {
        this.controlService.setElevationOpacity(this.layer.id, id, opacity);
      });
    }

    // Always update the layer's base opacity as well
    this.controlService.setOpacity(this.layer.id, opacity);
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

  // ==========================================================================
  // Control de Reproducción
  // ==========================================================================

  togglePlayback(): void {
    this.detachIfSynced();
    this.controlService.togglePlayback(this.layer.id);
  }

  onPlaySpeedChange(speed: number): void {
    this.detachIfSynced();
    this.controlService.setPlaySpeed(this.layer.id, speed);
  }

  onLastImagesCountChange(count: number): void {
    this.detachIfSynced();
    this.controlService.setLastImagesCount(this.layer.id, count);
  }

  private detachIfSynced(): void {
    if (this.isSynced()) this.syncService.detachLayer(this.layer.id);
  }

  private stopIfPlaying(): void {
    if (this.isPlaying()) this.controlService.stopPlayback(this.layer.id);
  }
}
