import { Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../../constants';
import {
  setTimestampTimezoneMode,
  TIMESTAMP_TIMEZONE_MODES,
  type TimestampTimezoneMode,
} from '../../utils/tileset-timestamp';

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
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TIMEZONE_SETTINGS);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<TimezoneSettings>;
      if (isTimezoneMode(parsed.mode)) {
        this.mode.set(parsed.mode);
      }
    } catch (error) {
      console.warn('Failed to load timezone settings from localStorage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: TimezoneSettings = {
      mode: this.mode(),
    };

    try {
      localStorage.setItem(STORAGE_KEYS.TIMEZONE_SETTINGS, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save timezone settings to localStorage:', error);
    }
  }
}
