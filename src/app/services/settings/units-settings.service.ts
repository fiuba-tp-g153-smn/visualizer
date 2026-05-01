import { Injectable, signal, computed } from '@angular/core';
import { TEMPERATURE_UNITS } from '../../constants';

export type TemperatureUnit = typeof TEMPERATURE_UNITS.KELVIN | typeof TEMPERATURE_UNITS.CELSIUS;
export type DecimalPrecision = 0 | 1 | 2 | 3;

interface UnitsSettings {
  temperatureUnit: TemperatureUnit;
  decimalPrecision: DecimalPrecision;
}

@Injectable({
  providedIn: 'root',
})
export class UnitsSettingsService {
  private readonly STORAGE_KEY = 'smn-units-settings-v2';

  readonly temperatureUnit = signal<TemperatureUnit>(TEMPERATURE_UNITS.CELSIUS);
  readonly decimalPrecision = signal<DecimalPrecision>(2);

  // Computed formatter que se actualiza cuando cambia la precisión
  readonly numberFormatter = computed(() => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: this.decimalPrecision(),
      maximumFractionDigits: this.decimalPrecision(),
    });
  });

  constructor() {
    this.loadFromStorage();
  }

  setTemperatureUnit(unit: TemperatureUnit): void {
    this.temperatureUnit.set(unit);
    this.saveToStorage();
  }

  setDecimalPrecision(precision: DecimalPrecision): void {
    this.decimalPrecision.set(precision);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as UnitsSettings;
      this.temperatureUnit.set(parsed.temperatureUnit ?? TEMPERATURE_UNITS.CELSIUS);
      this.decimalPrecision.set(parsed.decimalPrecision ?? 2);
    } catch (error) {
      console.warn('Failed to load units settings from localStorage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: UnitsSettings = {
      temperatureUnit: this.temperatureUnit(),
      decimalPrecision: this.decimalPrecision(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save units settings to localStorage:', error);
    }
  }
}
