import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog } from '@angular/material/dialog';
import type { SyncTimelineDialogData } from '../../../../../floating/sync-timeline-dialog/sync-timeline-dialog';
import { SyncPlaybackService } from '../../../../../../services/layers/sync-playback.service';
import { LayersService } from '../../../../../../services/layers/layers.service';
import { syncGroupDefinition } from '../../../../../../config/layers/sync-groups.config';
import { formatDateTimeOnly, formatDateFull } from '../../../../../../utils/tileset-timestamp';
import { Layer, PLAYBACK_SPEED_LIMITS, SyncGroupId } from '../../../../../../models';

/** One sync group: header with play, current instant, timeline, settings and its layers. */
@Component({
  selector: 'app-sync-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSliderModule,
    MatExpansionModule,
  ],
  templateUrl: './sync-group.html',
  styleUrl: './sync-group.scss',
})
export class SyncGroupComponent {
  private readonly syncService = inject(SyncPlaybackService);
  private readonly layersService = inject(LayersService);
  private readonly dialog = inject(MatDialog);

  readonly groupId = input.required<SyncGroupId>();

  readonly PLAYBACK_SPEED_LIMITS = PLAYBACK_SPEED_LIMITS;

  readonly definition = computed(() => syncGroupDefinition(this.groupId()));
  readonly state = computed(() => this.syncService.groupState(this.groupId()));
  readonly layers = computed(() => this.syncService.groupLayers(this.groupId()));
  readonly enrolledCount = computed(() => this.syncService.enrolledLayerIds(this.groupId()).length);
  readonly frameCountOptions = computed(() => this.syncService.frameCountOptions(this.groupId()));
  readonly frameCount = computed(() => this.syncService.frameCount(this.groupId()));
  readonly frameTotal = computed(() => this.syncService.frameTotal(this.groupId()));
  readonly canPlay = computed(() => this.syncService.canPlay(this.groupId()));
  /** The timeline opens once some layer has images, even before the group can sync. */
  readonly hasImages = computed(
    () =>
      this.syncService.groupTimelines(this.groupId()).length > 0 ||
      this.syncService.groupOtherTimelines(this.groupId()).length > 0,
  );
  readonly hint = computed(() => this.syncService.groupHint(this.groupId()));

  readonly expanded = signal(true);

  readonly currentLabel = computed(() => this.edgeFullLabel(this.state().frameIndex));

  /** One-word state for the header, so a collapsed group still tells what it is doing. */
  readonly headerStatus = computed(() =>
    this.canPlay() ? this.edgeLabel(this.state().frameIndex) : 'Sin sincronizar',
  );

  edgeLabel(frameIndex: number): string {
    const time = this.syncService.frameTime(this.groupId(), frameIndex);
    return time ? formatDateTimeOnly(time) : '--:--';
  }

  edgeFullLabel(frameIndex: number): string {
    const time = this.syncService.frameTime(this.groupId(), frameIndex);
    return time ? formatDateFull(time) : '--:--';
  }

  formatFrameLabel = (frameIndex: number): string => this.edgeLabel(frameIndex);

  onLayerToggle(layerId: string, included: boolean): void {
    this.syncService.setLayerIncluded(layerId, included);
  }

  /**
   * Opens the timeline dialog; stops the click from also folding the panel. Loaded on demand
   * so ECharts stays out of the initial bundle.
   */
  async openTimeline(event: Event): Promise<void> {
    event.stopPropagation();
    const { SyncTimelineDialogComponent } =
      await import('../../../../../floating/sync-timeline-dialog/sync-timeline-dialog');
    const data: SyncTimelineDialogData = { groupId: this.groupId() };
    this.dialog.open(SyncTimelineDialogComponent, { data, width: '1080px', maxWidth: '95vw' });
  }

  togglePlayback(): void {
    this.syncService.togglePlayback(this.groupId());
  }

  onFrameCountChange(count: number): void {
    this.syncService.setFrameCount(this.groupId(), count);
  }

  onFrameIndexChange(index: number): void {
    this.syncService.setFrameIndex(this.groupId(), index);
  }

  onSpeedChange(speed: number): void {
    this.syncService.setSpeed(this.groupId(), speed);
  }

  fullNameForLayer(layer: Layer): string {
    return this.layersService.getLayerFullName(layer);
  }
}
