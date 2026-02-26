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
import { Layer, LayerCategory, LayerType } from '../../../../models';
import { LayersService } from '../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../services/layers/layer-control.service';
import { LayerConfigService } from '../../../../services/layers/layer-config.service';
import { LayerRefreshService } from '../../../../services/layers/layer-refresh.service';

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
  isControlsExpanded = signal(false);
  isExpanded = signal(false);

  isPlaying = computed(() => this.controlService.isPlaying(this.layer.id));
  playSpeed = computed(() => {
    const controls = this.controlService.getControls(this.layer.id);
    return controls && controls.type === LayerType.TILE ? controls.playback.speed : 1;
  });
  lastImagesCount = computed(() => {
    const controls = this.controlService.getControls(this.layer.id);
    return controls && controls.type === LayerType.TILE ? controls.playback.lastImagesCount : 1;
  });

  /**
   * Obtiene las opciones de períodos disponibles desde la configuración de la capa
   */
  lastImagesOptions = computed(() => {
    return this.layer.type === LayerType.TILE ? (this.layer.availablePeriods ?? [1]) : [1];
  });

  getActiveLayer = computed(() => {
    return this.controlService.activeLayers().find((item) => item.layer.id === this.layer.id);
  });

  /**
   * Obtiene la opacidad actual de la capa activa
   */
  currentOpacity = computed(() => {
    const activeLayer = this.getActiveLayer();
    return activeLayer?.controls.opacity ?? 100;
  });

  /**
   * Indica si la capa está activa (visible en el mapa)
   */
  isActive = computed(() => {
    return this.getActiveLayer() !== undefined;
  });

  hasTimeControl = computed(() => {
    return this.configService.hasConfig(this.layer.id);
  });

  /**
   * Verifica si la capa necesita control de elevación (solo RADAR)
   */
  hasElevationControl = computed(() => {
    return (
      this.layer.category === LayerCategory.RADAR &&
      this.layer.type === LayerType.TILE &&
      this.layer.availableElevations &&
      this.layer.availableElevations.length > 0
    );
  });

  /**
   * Obtiene las elevaciones disponibles
   */
  availableElevations = computed(() => {
    return this.layer.type === LayerType.TILE && this.layer.category === LayerCategory.RADAR
      ? (this.layer.availableElevations ?? [])
      : [];
  });

  /**
   * Obtiene el índice de elevación actual
   */
  currentElevationIndex = computed(() => {
    const activeItem = this.getActiveLayer();
    if (
      activeItem &&
      activeItem.controls.type === LayerType.TILE &&
      'elevation' in activeItem.controls
    ) {
      return activeItem.controls.elevation?.elevationIndex ?? 0;
    }
    return 0;
  });

  /**
   * Obtiene el índice máximo de tiempo
   */
  maxTimeIndex = computed(() => {
    const tilesets = this.configService.getAvailableTilesets(this.layer.id);
    return Math.max(0, (tilesets?.length ?? 1) - 1);
  });

  /**
   * Verifica si hay múltiples períodos (más de 1)
   */
  hasMultiplePeriods = computed(() => {
    return this.maxTimeIndex() > 0;
  });

  /**
   * Verifica si la capa tiene controles avanzados (tiempo/animación)
   */
  hasAdvancedControls = computed(() => {
    switch (this.layer.category) {
      case LayerCategory.GOES_19:
        return this.layer.type === LayerType.TILE && this.layer.availablePeriods !== undefined;
      case LayerCategory.RADAR:
        return (
          this.layer.type === LayerType.TILE &&
          this.layer.availablePeriods !== undefined &&
          this.layer.availableElevations !== undefined
        );
      default:
        return false;
    }
  });

  /**
   * Obtiene el índice mínimo para el slider (limitado por el máximo del dropdown)
   */
  minTimeIndex = computed(() => {
    const max = this.maxTimeIndex();
    const options = this.lastImagesOptions();
    const maxSelectableCount = options.length > 0 ? Math.max(...options) : 1;
    const effectiveCount = Math.min(max + 1, maxSelectableCount);
    return Math.max(0, max - effectiveCount + 1);
  });

  /**
   * Obtiene el índice mínimo para reproducción (basado en la selección del usuario)
   */
  playbackMinTimeIndex = computed(() => {
    const max = this.maxTimeIndex();
    const count = this.lastImagesCount();
    return Math.max(0, max - count + 1);
  });

  /**
   * Índice de tiempo actual - lee directamente del servicio
   */
  currentTimeIndex = computed(() => {
    const activeItem = this.getActiveLayer();
    const currentIndex =
      activeItem && activeItem.controls.type === LayerType.TILE
        ? (activeItem.controls.playback?.timeIndex ?? this.maxTimeIndex())
        : this.maxTimeIndex();
    // Asegurar que el índice actual esté dentro del rango visible
    const min = this.minTimeIndex();
    const max = this.maxTimeIndex();
    return Math.min(Math.max(currentIndex, min), max);
  });

  ngOnInit(): void {
    // Si la capa está activa y necesita configuración, cargarla
    if (this.isActive() && this.needsConfig()) {
      this.loadChannelConfig();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si cambia la capa, verificar si necesita configuración
    if (changes['layer']) {
      if (this.isActive() && this.needsConfig()) {
        this.loadChannelConfig();
      }
    }
  }

  ngOnDestroy(): void {
    // Don't stop playback on destroy - let it continue in the background
    // The layer service will manage playback lifecycle independently
  }

  /**
   * Verifica si la capa necesita cargar configuración
   */
  private needsConfig(): boolean {
    const isSatellite = this.layer.id.startsWith('abi-') || this.layer.id.startsWith('glm-');
    const isRadar = this.layer.category === LayerCategory.RADAR;
    return (isSatellite || isRadar) && !this.configService.hasConfig(this.layer.id);
  }

  /**
   * Carga la configuración del canal desde el backend
   */
  private loadChannelConfig(): void {
    if (this.isLoadingConfig()) return;

    this.isLoadingConfig.set(true);
    this.configService.fetchLayerConfig(this.layer).subscribe({
      next: () => {
        this.isLoadingConfig.set(false);
      },
      error: (err: Error) => {
        this.isLoadingConfig.set(false);
        console.error(`❌ [LayerItem] Error cargando config de ${this.layer.id}:`, err);
      },
    });
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
      // Controls remain collapsed by default
      // this.isControlsExpanded.set(true);
    } else {
      this.deactivateLayer();
    }
  }

  /**
   * Alterna la expansión de los controles
   */
  toggleControls(): void {
    if (this.isControlsExpanded()) {
      // Si ya está abierto, solo cerramos los controles de animación
      this.isControlsExpanded.set(false);
      // Mantenemos isExpanded en true (opacidad visible)
    } else {
      // Si está cerrado, abrimos animación Y aseguramos que el contenedor esté expandido
      this.isExpanded.set(true);
      this.isControlsExpanded.set(true);
    }
  }

  /**
   * Alterna la expansión del card completo (opacidad + controles)
   */
  toggleExpansion(): void {
    if (this.isExpanded()) {
      // Si colapsamos, cerramos TODO (incluida la animación)
      this.isExpanded.set(false);
      this.isControlsExpanded.set(false);
    } else {
      // Si expandimos, mostramos solo opacidad inicialmente (animación cerrada)
      this.isExpanded.set(true);
      this.isControlsExpanded.set(false);
    }
  }

  /**
   * Activa la capa
   */
  private activateLayer(): void {
    // Si necesita config, cargarla primero
    if (this.needsConfig()) {
      this.loadChannelConfig();
      setTimeout(() => {
        this.controlService.activateLayer(this.layer.id);
      }, 100);
    } else {
      this.controlService.activateLayer(this.layer.id);
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
    this.controlService.setOpacity(this.layer.id, opacity);
  }

  /**
   * Formatea el valor de opacidad para el slider
   */
  formatOpacity = (value: number): string => {
    return `${value}%`;
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
    if (this.isPlaying()) {
      this.controlService.stopPlayback(this.layer.id);
    }

    this.controlService.setTimeIndex(this.layer.id, timeIndex);
  }

  // ==========================================================================
  // Control de Elevación (RADAR)
  // ==========================================================================

  onElevationChange(elevationIndex: number): void {
    this.controlService.setElevationIndex(this.layer.id, elevationIndex);

    // Reload configuration when elevation changes
    if (this.layer.category === LayerCategory.RADAR) {
      this.isLoadingConfig.set(true);
      this.configService.fetchLayerConfig(this.layer).subscribe({
        next: () => {
          this.isLoadingConfig.set(false);
        },
        error: (err: Error) => {
          this.isLoadingConfig.set(false);
          console.error(`❌ [LayerItem] Error cargando config de radar ${this.layer.id}:`, err);
        },
      });
    }
  }

  /**
   * Obtiene la etiqueta de elevación para mostrar
   */
  getElevationLabel(elevationIndex: number): string {
    const elevations = this.availableElevations();
    if (elevationIndex >= 0 && elevationIndex < elevations.length) {
      const elevation = elevations[elevationIndex];
      // Convertir 'elev0' en 'Elevación 0'
      const num = elevation.replace('elev', '');
      return `Elevación ${num}`;
    }
    return 'N/A';
  }

  /**
   * Obtiene la etiqueta de tiempo para mostrar (YYYY-MM-DD HH:MM)
   */
  getTimeLabel(timeIndex: number): string {
    if (!this.hasTimeControl()) {
      return 'Cargando...';
    }

    const tilesets = this.configService.getAvailableTilesets(this.layer.id);
    if (!tilesets || timeIndex < 0 || timeIndex >= tilesets.length) {
      return 'Sin datos';
    }

    const tileset = tilesets[timeIndex];
    // Extraer información de fecha del ID
    // ABI formato: OR_ABI-L1b-RadF-M6C13_G19_s20261234567 (11 dígitos: YYYYDDDHHMI)
    // GLM formato: GLM_FED_s2026044013000 (13 dígitos: YYYYDDDHHMISS)
    const match = tileset.match(/_s(\d+)/);
    if (match) {
      const dateStr = match[1];
      const year = dateStr.substring(0, 4);
      const dayOfYear = dateStr.substring(4, 7);
      const hour = dateStr.substring(7, 9);
      const minute = dateStr.substring(9, 11);
      // Seconds only present in GLM format (13 digits)
      const hasSeconds = dateStr.length >= 13;

      // Convertir día juliano a fecha
      const date = this.julianToDate(year, dayOfYear);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return tileset;
  }

  /**
   * Obtiene solo la hora de un período (HH:MM)
   */
  getTimeOnly(timeIndex: number): string {
    if (!this.hasTimeControl()) {
      return '--:--';
    }

    const tilesets = this.configService.getAvailableTilesets(this.layer.id);
    if (!tilesets || timeIndex < 0 || timeIndex >= tilesets.length) {
      return '--:--';
    }

    const tileset = tilesets[timeIndex];
    // Handle both ABI (11 digits) and GLM (13 digits) formats
    const match = tileset.match(/_s(\d+)/);
    if (match) {
      const dateStr = match[1];
      const hour = dateStr.substring(7, 9);
      const minute = dateStr.substring(9, 11);
      return `${hour}:${minute}`;
    }
    return '--:--';
  }

  /**
   * Convierte año juliano a fecha
   */
  private julianToDate(year: string, dayOfYear: string): Date {
    const yearNum = parseInt(year);
    const dayNum = parseInt(dayOfYear);
    const date = new Date(yearNum, 0);
    date.setDate(dayNum);
    return date;
  }

  // ==========================================================================
  // Control de Reproducción
  // ==========================================================================

  togglePlayback(): void {
    this.controlService.togglePlayback(this.layer.id);
  }

  onPlaySpeedChange(speed: number): void {
    this.controlService.setPlaySpeed(this.layer.id, speed);
  }

  onLastImagesCountChange(count: number): void {
    const wasPlaying = this.isPlaying();

    this.controlService.setLastImagesCount(this.layer.id, count);

    if (count === 1 && wasPlaying) {
      this.controlService.stopPlayback(this.layer.id);
      return;
    }

    if (wasPlaying) {
      setTimeout(() => {
        this.controlService.startPlayback(this.layer.id);
      }, 0);
    }
  }
}
