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
import { Layer } from '../../../../models';
import { LayerService } from '../../../../services/layer.service';
import { ChannelConfigService } from '../../../../services/channel-config.service';
import { LayerReloadService } from '../../../../services/layer-reload.service';

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
  private readonly layerService = inject(LayerService);
  private readonly channelConfigService = inject(ChannelConfigService);
  private readonly reloadService = inject(LayerReloadService);

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

  /**
   * Estado de reproducción - lee del servicio
   */
  isPlaying = computed(() => this.layerService.isPlaying(this.layer.id));
  playSpeed = computed(() => this.layerService.getPlaySpeed(this.layer.id));
  lastImagesCount = computed(() => this.layerService.getLastImagesCount(this.layer.id));

  /**
   * Obtiene las opciones de períodos disponibles desde la configuración de la capa
   */
  lastImagesOptions = computed(() => {
    return this.layer.availablePeriods ?? [1]; // Fallback a valor por defecto
  });

  /**
   * Obtiene la capa actualizada desde el servicio (single source of truth)
   */
  getActiveLayer = computed(() => {
    return this.layerService.activeLayers().find((l) => l.id === this.layer.id);
  });
  /**
   * Indica si la capa está activa (visible en el mapa)
   */
  isActive = computed(() => {
    return this.getActiveLayer() !== undefined;
  });

  /**
   * Verifica si la capa necesita control de tiempo
   */
  hasTimeControl = computed(() => {
    return this.channelConfigService.hasConfig(this.layer.id);
  });

  /**
   * Obtiene el índice máximo de tiempo
   */
  maxTimeIndex = computed(() => {
    const tilesets = this.channelConfigService.getTilesets(this.layer.id);
    return Math.max(0, tilesets.length - 1);
  });

  /**
   * Verifica si hay múltiples períodos (más de 1)
   */
  hasMultiplePeriods = computed(() => {
    return this.maxTimeIndex() > 0;
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
    const activeLayer = this.getActiveLayer();
    const currentIndex = activeLayer?.timeIndex ?? this.maxTimeIndex();
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
    return this.layer.id.startsWith('abi-') && !this.channelConfigService.hasConfig(this.layer.id);
  }

  /**
   * Carga la configuración del canal desde el backend
   */
  private loadChannelConfig(): void {
    if (this.isLoadingConfig()) return;

    const parts = this.layer.id.split('-');
    if (parts.length < 2) return;

    const instrument = parts[0]; // 'abi'
    const channelNumber = parts[1]; // 'ch13'
    const channel = `ch-${channelNumber.replace('ch', '')}`; // 'ch-13'
    const product = 'goes-19'; // Por defecto

    this.isLoadingConfig.set(true);

    console.log(
      `📡 [LayerItem] Cargando config para ${this.layer.id}: ${product}/${instrument}/${channel}`,
    );

    this.channelConfigService
      .loadChannelConfig(this.layer.id, product, instrument, channel)
      .subscribe({
        next: (config) => {
          this.isLoadingConfig.set(false);
          console.log(
            `✅ [LayerItem] Config cargada para ${this.layer.id}, tilesets: ${config.tilesets.length}`,
          );
        },
        error: (err) => {
          this.isLoadingConfig.set(false);
          console.error(`❌ [LayerItem] Error cargando config de ${this.layer.id}:`, err);
        },
      });
  }

  /**
   * Recarga la configuración del canal (actualiza períodos disponibles)
   */
  reloadChannelConfig(): void {
    // Use reload service to handle the manual refresh
    // This coordinates with auto-refresh and resets the timer
    this.reloadService.manualRefresh(this.layer.id);
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
      // Expandir controles automáticamente al activar
      this.isControlsExpanded.set(true);
    } else {
      this.deactivateLayer();
    }
  }

  /**
   * Alterna la expansión de los controles
   */
  toggleControls(): void {
    this.isControlsExpanded.update((expanded) => !expanded);
  }

  /**
   * Activa la capa
   */
  private activateLayer(): void {
    // Si necesita config, cargarla primero
    if (this.needsConfig()) {
      this.loadChannelConfig();
      // La activación se hará después de cargar la config
      setTimeout(() => {
        this.layerService.activateLayer(this.layer.id);
      }, 100);
    } else {
      this.layerService.activateLayer(this.layer.id);
    }
  }

  /**
   * Desactiva la capa
   */
  deactivateLayer(): void {
    this.layerService.stopPlayback(this.layer.id);
    this.layerService.deactivateLayer(this.layer.id);
  }

  // ==========================================================================
  // Control de Opacidad
  // ==========================================================================

  /**
   * Actualiza la opacidad de la capa
   */
  onOpacityChange(opacity: number): void {
    this.layerService.setOpacity(this.layer.id, opacity);
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

  /**
   * Actualiza el índice de tiempo
   */
  onTimeIndexChange(timeIndex: number): void {
    // Si está reproduciendo, pausar (control manual)
    if (this.isPlaying()) {
      this.layerService.stopPlayback(this.layer.id);
    }

    // Actualizar directamente en el servicio (única fuente de verdad)
    this.layerService.setTimeIndex(this.layer.id, timeIndex);
  }

  /**
   * Obtiene la etiqueta de tiempo para mostrar (YYYY-MM-DD HH:MM)
   */
  getTimeLabel(timeIndex: number): string {
    if (!this.hasTimeControl()) {
      return 'Cargando...';
    }

    const tilesets = this.channelConfigService.getTilesets(this.layer.id);
    if (timeIndex >= 0 && timeIndex < tilesets.length) {
      const tileset = tilesets[timeIndex];
      // Extraer información de fecha del ID (formato: OR_ABI-L1b-RadF-M6C13_G19_s20261234567)
      const match = tileset.id.match(/_s(\d{11})/);
      if (match) {
        const dateStr = match[1];
        const year = dateStr.substring(0, 4);
        const dayOfYear = dateStr.substring(4, 7);
        const hour = dateStr.substring(7, 9);
        const minute = dateStr.substring(9, 11);

        // Convertir día juliano a fecha
        const date = this.julianToDate(year, dayOfYear);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day} ${hour}:${minute}`;
      }
      return tileset.id;
    }
    return 'Sin datos';
  }

  /**
   * Obtiene solo la hora de un período (HH:MM)
   */
  getTimeOnly(timeIndex: number): string {
    if (!this.hasTimeControl()) {
      return '--:--';
    }

    const tilesets = this.channelConfigService.getTilesets(this.layer.id);
    if (timeIndex >= 0 && timeIndex < tilesets.length) {
      const tileset = tilesets[timeIndex];
      const match = tileset.id.match(/_s(\d{11})/);
      if (match) {
        const dateStr = match[1];
        const hour = dateStr.substring(7, 9);
        const minute = dateStr.substring(9, 11);
        return `${hour}:${minute}`;
      }
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

  /**
   * Alterna play/pause
   */
  togglePlayback(): void {
    this.layerService.togglePlayback(
      this.layer.id,
      this.maxTimeIndex(),
      this.playbackMinTimeIndex(),
    );
  }

  /**
   * Actualiza la velocidad de reproducción
   */
  onPlaySpeedChange(speed: number): void {
    this.layerService.setPlaySpeed(this.layer.id, speed);
  }

  /**
   * Actualiza el número de últimas imágenes a mostrar
   */
  onLastImagesCountChange(count: number): void {
    const wasPlaying = this.isPlaying();

    // Actualizar el contador
    this.layerService.setLastImagesCount(this.layer.id, count);

    // Si cambió a 1, detener reproducción inmediatamente
    if (count === 1 && wasPlaying) {
      this.layerService.stopPlayback(this.layer.id);
      return;
    }

    // Si estaba reproduciendo, reiniciar con el nuevo rango (sin detener)
    if (wasPlaying) {
      // Usar setTimeout para asegurar que los computed signals se actualicen
      setTimeout(() => {
        this.layerService.startPlayback(
          this.layer.id,
          this.maxTimeIndex(),
          this.playbackMinTimeIndex(),
        );
      }, 0);
    }
  }
}
