import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import { SyncGroupComponent } from './sync-group/sync-group';
import { EmptyStateComponent } from '../../../../shared/empty-state/empty-state';

/** Sincronización tab: one independent timeline per group of compatible layers. */
@Component({
  selector: 'app-sync-playback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SyncGroupComponent, EmptyStateComponent],
  templateUrl: './sync-playback.html',
  styleUrl: './sync-playback.scss',
})
export class SyncPlaybackComponent {
  readonly activeGroupIds = inject(SyncPlaybackService).activeGroupIds;
}
