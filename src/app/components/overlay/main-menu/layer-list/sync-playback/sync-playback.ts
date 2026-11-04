import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SyncPlaybackService } from '../../../../../services/layers/sync-playback.service';
import { SyncGroupComponent } from './sync-group/sync-group';

/** Sincronización tab: one independent timeline per group of compatible layers. */
@Component({
  selector: 'app-sync-playback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, SyncGroupComponent],
  templateUrl: './sync-playback.html',
  styleUrl: './sync-playback.scss',
})
export class SyncPlaybackComponent {
  readonly activeGroupIds = inject(SyncPlaybackService).activeGroupIds;
}
