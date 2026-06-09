import { Injectable, signal, inject } from '@angular/core';
import { STORAGE_KEYS } from '../../constants';
import {
  setTimestampTimezoneMode,
  TIMESTAMP_TIMEZONE_MODES,
  type TimestampTimezoneMode,
} from '../../utils/tileset-timestamp';
import { LocalStorageService } from '../storage/local-storage.service';

export const TIMEZONE_MODES = TIMESTAMP_TIMEZONE_MODES;

export type TimezoneMode = TimestampTimezoneMode;

interface TimezoneSettings {
  mode: TimezoneMode;
}

function isTimezoneMode(value: unknown): value is TimezoneMode {
  return value === TIMEZONE_MODES.LOCAL || value === TIMEZONE_MODES.UTC;
}

@Injectable({
  providedIn: 'root',
})
export class TimezoneSettingsService {
  private readonly storage = inject(LocalStorageService);

  readonly mode = signal<TimezoneMode>(TIMEZONE_MODES.LOCAL);

  constructor() {
    this.loadFromStorage();
    setTimestampTimezoneMode(this.mode());
  }

  setMode(mode: TimezoneMode): void {
    if (!isTimezoneMode(mode)) {
      return;
    }

    this.mode.set(mode);
    setTimestampTimezoneMode(mode);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    const parsed = this.storage.getJson<Partial<TimezoneSettings>>(STORAGE_KEYS.TIMEZONE_SETTINGS);
    if (!parsed) return;
    if (isTimezoneMode(parsed.mode)) {
      this.mode.set(parsed.mode);
    }
  }

  private saveToStorage(): void {
    const payload: TimezoneSettings = { mode: this.mode() };
    this.storage.setJson(STORAGE_KEYS.TIMEZONE_SETTINGS, payload);
  }
}
