import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../../constants';
import {
  WeatherStationsApiKeyDialogComponent,
  WeatherStationsApiKeyDialogResult,
} from '../../components/floating/weather-stations-api-key-dialog/weather-stations-api-key-dialog';

interface StoredKeyState {
  key: string;
}

/**
 * Owns the data-service `X-API-Key` value used on every /weather-stations/*
 * request. Resolution order:
 *   1. localStorage (set via the prompt dialog or General Settings)
 *   2. environment.weatherStations.apiKey (build-time env-var fallback)
 * Storing in localStorage is necessary because the data-service rejects all
 * read requests without a valid header; the env-var path lets dev / CI bake
 * a key into the bundle for unattended runs.
 */
@Injectable({ providedIn: 'root' })
export class WeatherStationsApiKeyService {
  private readonly dialog = inject(MatDialog);
  private readonly keyChangeTick = signal(0);
  private dialogInFlight: Promise<string | null> | null = null;

  /** Read-only tick that consumers can subscribe to for reactive header rebuilds. */
  readonly keyChanges = this.keyChangeTick.asReadonly();

  /** Returns the effective API key, or null when neither localStorage nor env have one. */
  getKey(): string | null {
    const stored = this.readStoredKey();
    if (stored) {
      return stored;
    }
    const envKey = environment.weatherStations.apiKey;
    return envKey ? envKey : null;
  }

  hasKey(): boolean {
    return this.getKey() !== null;
  }

  /** Whether the active key came from the user prompt (true) or the env fallback (false). */
  isUserProvided(): boolean {
    return this.readStoredKey() !== null;
  }

  setKey(key: string): void {
    const normalized = key.trim();
    if (!normalized) {
      this.clearKey();
      return;
    }
    this.storeKey(normalized);
  }

  clearKey(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.WEATHER_STATIONS_API_KEY);
    this.keyChangeTick.update((v) => v + 1);
  }

  /**
   * Returns the existing key, prompting the user if there isn't one. Multiple
   * concurrent calls share a single in-flight prompt so a stampede (e.g. the
   * panel `(opened)` event firing twice on rapid clicks) doesn't stack dialogs.
   */
  async ensureKey(): Promise<string | null> {
    const existing = this.getKey();
    if (existing) {
      return existing;
    }
    if (this.dialogInFlight) {
      return this.dialogInFlight;
    }
    this.dialogInFlight = this.promptForKey();
    try {
      return await this.dialogInFlight;
    } finally {
      this.dialogInFlight = null;
    }
  }

  /**
   * Always opens the dialog (even if a key is stored), so the user can rotate.
   * Pass a `reason` to render a warning banner at the top of the dialog — used
   * by the unauthorized-recovery flow.
   */
  async promptForKey(reason?: string): Promise<string | null> {
    const result = await firstValueFrom(
      this.dialog
        .open<
          WeatherStationsApiKeyDialogComponent,
          { initialKey: string; reason?: string },
          WeatherStationsApiKeyDialogResult | null
        >(WeatherStationsApiKeyDialogComponent, {
          width: '480px',
          autoFocus: true,
          restoreFocus: true,
          data: { initialKey: this.readStoredKey() ?? '', reason },
        })
        .afterClosed(),
    );
    if (!result) {
      return null;
    }
    const trimmed = result.key.trim();
    if (!trimmed) {
      return null;
    }
    this.storeKey(trimmed);
    return trimmed;
  }

  /**
   * Backend just returned 401. Clear the stored key (it's no good anymore)
   * and re-prompt the user with a warning banner. Returns the new key on
   * success, null if the user cancels.
   *
   * Concurrent callers collapse onto a single prompt via `dialogInFlight`
   * so a burst of 401s (latest + tilesets + registry firing in parallel)
   * doesn't stack dialogs.
   */
  async handleUnauthorized(): Promise<string | null> {
    this.clearKey();
    if (this.dialogInFlight) {
      return this.dialogInFlight;
    }
    this.dialogInFlight = this.promptForKey(
      'Tu clave ya no funciona. Pedile una nueva al administrador del sistema y pegala acá.',
    );
    try {
      return await this.dialogInFlight;
    } finally {
      this.dialogInFlight = null;
    }
  }

  private readStoredKey(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WEATHER_STATIONS_API_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredKeyState;
      return parsed.key ? parsed.key : null;
    } catch {
      return null;
    }
  }

  private storeKey(key: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const payload: StoredKeyState = { key };
      localStorage.setItem(
        STORAGE_KEYS.WEATHER_STATIONS_API_KEY,
        JSON.stringify(payload),
      );
      this.keyChangeTick.update((v) => v + 1);
    } catch {
      // Storage failures (private mode, quota) are non-fatal — the key is
      // already in memory for this session; the next reload will re-prompt.
    }
  }
}
