import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import { LayersService } from '../../../../../services/layers/layers.service';
import {
  formatDurationMs,
  formatDateTimeOnly,
  formatDateFull,
} from '../../../../../utils/tileset-timestamp';
import { Layer, LayerCategory, RadarTileLayer } from '../../../../../models';

/**
 * Tab de sincronización de reproducción entre múltiples capas.
 *
 * Permite seleccionar varias capas activas con períodos temporales y reproducirlas
 * de forma sincronizada usando un índice de frame compartido.
 *
 * Alineación temporal: anchor = capa con timestamp más viejo; las demás buscan
 * el tileset más cercano dentro de ±5 min. Si no encajan, el anchor avanza un
 * paso hasta encontrar alineación o bloquear la sync.
 */
@Component({
  selector: 'app-sync-playback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSliderModule,
    MatChipsModule,
  ],
  templateUrl: './sync-playback.html',
  styleUrl: './sync-playback.scss',
})
export class SyncPlaybackComponent {
  private readonly syncService = inject(SyncPlaybackService);
  private readonly layersService = inject(LayersService);

  readonly eligibleLayers = this.syncService.eligibleLayers;
  readonly state = this.syncService.syncState;
  readonly availableFrameCounts = this.syncService.availableFrameCounts;
  readonly layersWithFewerFrames = this.syncService.layersWithFewerFrames;
  readonly effectiveFrameCount = this.syncService.effectiveFrameCount;
  readonly isAligned = this.syncService.isAligned;

  /**
   * True when effectiveFrameCount differs from the user-selected frameCount.
   * Used to show a visual indicator that fewer frames are actually being used.
   */
  readonly hasReducedFrameCount = computed(() => {
    const selected = this.state().frameCount;
    const effective = this.effectiveFrameCount();
    return effective > 0 && effective < selected;
  });

  readonly canPlay = computed(() => {
    const s = this.state();
    return (
      s.selectedLayerIds.length > 0 &&
      this.isAligned() &&
      this.effectiveFrameCount() >= 2 &&
      this.availableFrameCounts().length > 0
    );
  });

  readonly hasSelectedLayers = computed(() => this.state().selectedLayerIds.length > 0);

  readonly currentFrameLabel = computed(() => {
    const info = this.syncService.currentFrameInfo();
    if (!info) return '--:--';
    const deviation = info.deviationMs > 0 ? ` ± ${formatDurationMs(info.deviationMs)}` : '';
    return formatDateFull(info.avgTime) + deviation;
  });

  readonly frameEdgeMin = computed(() => this.edgeLabel(0));
  readonly frameEdgeMax = computed(() => this.edgeLabel(this.effectiveFrameCount() - 1));

  readonly frameEdgeMinFull = computed(() => this.edgeFullLabel(0));
  readonly frameEdgeMaxFull = computed(() => this.edgeFullLabel(this.effectiveFrameCount() - 1));

  private edgeLabel(frameIndex: number): string {
    const info = this.syncService.getFrameInfo(frameIndex);
    return info ? formatDateTimeOnly(info.avgTime) : '--:--';
  }

  private edgeFullLabel(frameIndex: number): string {
    const info = this.syncService.getFrameInfo(frameIndex);
    return info ? formatDateFull(info.avgTime) : '--:--';
  }

  isLayerSelected(layerId: string): boolean {
    return this.syncService.isLayerSelected(layerId);
  }

  toggleLayer(layerId: string): void {
    this.syncService.toggleLayerSelection(layerId);
  }

  togglePlayback(): void {
    this.syncService.togglePlayback();
  }

  onFrameCountChange(count: number): void {
    this.syncService.setFrameCount(count);
  }

  onFrameIndexChange(index: number): void {
    this.syncService.setFrameIndex(index);
  }

  onSpeedChange(speed: number): void {
    this.syncService.setSpeed(speed);
  }

  formatFrameLabel = (frameIndex: number): string => {
    const info = this.syncService.getFrameInfo(frameIndex);
    return info ? formatDateTimeOnly(info.avgTime) : '--:--';
  };

  fullNameForLayer(layer: Layer): string {
    return this.layersService.getLayerFullName(layer);
  }

  /**
   * Returns the actual available tileset count for a layer.
   * Used in the warning tooltip to show "tiene X imágenes disponibles".
   */
  getActualTilesetCount(layerId: string): number {
    return this.syncService.getActualTilesetCount(layerId);
  }
}
