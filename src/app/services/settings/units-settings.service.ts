import { Injectable, signal, computed } from '@angular/core';
import { STORAGE_KEYS, TEMPERATURE_UNITS, WIND_SPEED_UNITS } from '../../constants';

export type TemperatureUnit = typeof TEMPERATURE_UNITS.KELVIN | typeof TEMPERATURE_UNITS.CELSIUS;
export type WindSpeedUnit =
  | typeof WIND_SPEED_UNITS.KILOMETERS_PER_HOUR
  | typeof WIND_SPEED_UNITS.KNOTS;
export type DecimalPrecision = 0 | 1 | 2 | 3;

interface UnitsSettings {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  decimalPrecision: DecimalPrecision;
}

@Injectable({
  providedIn: 'root',
})
export class UnitsSettingsService {
  readonly temperatureUnit = signal<TemperatureUnit>(TEMPERATURE_UNITS.KELVIN);
  readonly windSpeedUnit = signal<WindSpeedUnit>(WIND_SPEED_UNITS.KILOMETERS_PER_HOUR);
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

  setWindSpeedUnit(unit: WindSpeedUnit): void {
    this.windSpeedUnit.set(unit);
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
      const raw = localStorage.getItem(STORAGE_KEYS.UNITS_SETTINGS);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as UnitsSettings;
      this.temperatureUnit.set(parsed.temperatureUnit ?? TEMPERATURE_UNITS.KELVIN);
      this.windSpeedUnit.set(parsed.windSpeedUnit ?? WIND_SPEED_UNITS.KILOMETERS_PER_HOUR);
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
      windSpeedUnit: this.windSpeedUnit(),
      decimalPrecision: this.decimalPrecision(),
    };

    try {
      localStorage.setItem(STORAGE_KEYS.UNITS_SETTINGS, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save units settings to localStorage:', error);
    }
  }
}
