import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface WeatherStationsApiKeyDialogData {
  initialKey: string;
  /** Optional warning shown above the input, e.g. when the previous key was revoked. */
  reason?: string;
}

export interface WeatherStationsApiKeyDialogResult {
  key: string;
}

@Component({
  selector: 'app-weather-stations-api-key-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './weather-stations-api-key-dialog.html',
  styleUrl: './weather-stations-api-key-dialog.scss',
})
export class WeatherStationsApiKeyDialogComponent {
  readonly dialogRef = inject(
    MatDialogRef<WeatherStationsApiKeyDialogComponent, WeatherStationsApiKeyDialogResult | null>,
  );
  readonly data = inject<WeatherStationsApiKeyDialogData>(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? { initialKey: '' };

  readonly key = signal(this.data.initialKey);
  readonly reason = this.data.reason ?? '';

  save(): void {
    const trimmed = this.key().trim();
    if (!trimmed) {
      this.dialogRef.close(null);
      return;
    }
    this.dialogRef.close({ key: trimmed });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
