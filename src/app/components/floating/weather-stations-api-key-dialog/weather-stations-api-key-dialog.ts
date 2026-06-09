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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { buildWeatherStationsTilesetsUrl } from '../../../config/backend.config';

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
    MatProgressSpinnerModule,
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
  readonly isValidating = signal(false);
  readonly validationError = signal<string | null>(this.data.reason ?? null);

  // Bypasses interceptors so the tentative key isn't overwritten by the stored one.
  private readonly http: HttpClient;

  constructor() {
    const backend = inject(HttpBackend);
    this.http = new HttpClient(backend);
  }

  async save(): Promise<void> {
    const trimmed = this.key().trim();
    if (!trimmed) {
      this.dialogRef.close(null);
      return;
    }

    this.isValidating.set(true);
    this.validationError.set(null);

    try {
      await firstValueFrom(
        this.http.get(buildWeatherStationsTilesetsUrl(), {
          headers: { 'X-API-Key': trimmed, 'Cache-Control': 'no-cache' },
        }),
      );
      this.dialogRef.close({ key: trimmed });
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.validationError.set('La clave ingresada no es válida. Verificá que sea correcta e intentá de nuevo.');
      } else {
        // Red de conectividad u otro error del servidor — cerramos y el
        // interceptor maneja el error cuando se haga la primera request real.
        this.dialogRef.close({ key: trimmed });
      }
    } finally {
      this.isValidating.set(false);
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
