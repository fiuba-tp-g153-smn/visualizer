import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { SyncPlaybackService } from '../../../../services/layers/sync-playback.service';
import { LayersService } from '../../../../services/layers/layers.service';

/**
 * Componente para sincronizar la reproducción temporal de múltiples capas
 *
 * Permite:
 * - Seleccionar capas activas con períodos temporales
 * - Definir un rango de tiempo personalizado
 * - Controlar la velocidad de reproducción
 * - Reproducir sincronizadamente múltiples fuentes de datos
 */
@Component({
  selector: 'app-sync-playback',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
  ],
  templateUrl: './sync-playback.html',
  styleUrl: './sync-playback.scss',
})
export class SyncPlaybackComponent {
  private readonly syncService = inject(SyncPlaybackService);
  private readonly layersService = inject(LayersService);

  eligibleLayers = this.syncService.eligibleLayers;
  config = this.syncService.syncConfig;
  hasIntersection = this.syncService.hasIntersection;
  availableTimeRange = this.syncService.availableTimeRange;

  /**
   * Obtiene el nombre de display de una capa
   */
  getLayerDisplayName(layerId: string): string {
    return this.layersService.getLayerDisplayName(layerId);
  }

  /**
   * Verifica si una capa está seleccionada
   */
  isLayerSelected(layerId: string): boolean {
    return this.config().selectedLayerIds.includes(layerId);
  }

  /**
   * Alterna la selección de una capa
   */
  toggleLayer(layerId: string): void {
    this.syncService.toggleLayerSelection(layerId);
  }

  /**
   * Alterna la reproducción
   */
  togglePlayback(): void {
    this.syncService.togglePlayback();
  }

  /**
   * Obtiene el icono de play/pause
   */
  getPlayIcon(): string {
    return this.config().isPlaying ? 'pause' : 'play_arrow';
  }

  /**
   * Obtiene el tooltip para el botón de play/pause
   */
  getPlayTooltip(): string {
    const cfg = this.config();
    if (cfg.isPlaying) return 'Pausar';
    if (cfg.speed === 0) return 'No se puede reproducir con velocidad 0';
    if (!cfg.minTime || !cfg.maxTime) return 'Selecciona capas para reproducir';
    if (cfg.selectedLayerIds.length === 0) return 'Selecciona al menos una capa';
    return 'Reproducir';
  }

  /**
   * Convierte una fecha a un valor numérico para el slider (timestamp)
   */
  dateToSliderValue(date: Date | undefined): number {
    return date ? date.getTime() : 0;
  }

  /**
   * Maneja el cambio del rango mínimo desde el slider
   */
  onMinTimeSliderChange(timestamp: number): void {
    this.syncService.setMinTime(new Date(timestamp));
  }

  /**
   * Maneja el cambio del rango máximo desde el slider
   */
  onMaxTimeSliderChange(timestamp: number): void {
    this.syncService.setMaxTime(new Date(timestamp));
  }

  /**
   * Maneja el cambio del tiempo actual desde el slider
   */
  onCurrentTimeChange(timestamp: number): void {
    this.syncService.setCurrentTime(new Date(timestamp));
  }

  /**
   * Maneja el cambio de velocidad
   */
  onSpeedChange(speed: number): void {
    this.syncService.setSpeed(speed);
  }

  /**
   * Formatea el valor de velocidad para mostrar
   */
  formatSpeed = (value: number): string => {
    if (value === 1) return '1x';
    if (value < 1) return `${value.toFixed(1)}x`;
    return `${Math.round(value)}x`;
  };

  /**
   * Formatea un tiempo para mostrar solo HH:MM
   */
  formatTimeOnly(date: Date | undefined): string {
    if (!date) return '--:--';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  /**
   * Formatea un timestamp para el tooltip del slider (solo minutos)
   */
  formatTimeTooltip = (timestamp: number): string => {
    return this.formatTimeOnly(new Date(timestamp));
  };

  /**
   * Verifica si hay capas seleccionadas
   */
  hasSelectedLayers = computed(() => {
    return this.config().selectedLayerIds.length > 0;
  });

  /**
   * Verifica si se puede reproducir
   */
  canPlay = computed(() => {
    const cfg = this.config();
    return (
      cfg.selectedLayerIds.length > 0 &&
      cfg.minTime !== undefined &&
      cfg.maxTime !== undefined &&
      cfg.speed > 0
    );
  });
}
