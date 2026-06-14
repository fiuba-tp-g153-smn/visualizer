import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';

export interface GifPreviewDialogData {
  title: string;
  url: string;
}

/**
 * Dialog that previews an alert GIF with a link to open it in a new tab.
 */
@Component({
  selector: 'app-gif-preview-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatTooltipModule, LoadingSpinnerComponent],
  templateUrl: './gif-preview-dialog.html',
  styleUrl: './gif-preview-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GifPreviewDialogComponent {
  readonly data = inject<GifPreviewDialogData>(MAT_DIALOG_DATA);

  readonly loaded = signal<boolean>(false);
  readonly failed = signal<boolean>(false);

  onLoad(): void {
    this.loaded.set(true);
  }

  onError(): void {
    this.loaded.set(true);
    this.failed.set(true);
  }
}
