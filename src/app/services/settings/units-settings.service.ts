import { Injectable, signal, inject } from '@angular/core';
import { STORAGE_KEYS, TEMPERATURE_UNITS, WIND_SPEED_UNITS } from '../../constants';
import { LocalStorageService } from '../storage/local-storage.service';

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
  private readonly storage = inject(LocalStorageService);

  readonly temperatureUnit = signal<TemperatureUnit>(TEMPERATURE_UNITS.CELSIUS);
  readonly windSpeedUnit = signal<WindSpeedUnit>(WIND_SPEED_UNITS.KNOTS);
  readonly decimalPrecision = signal<DecimalPrecision>(2);

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
    const parsed = this.storage.getJson<UnitsSettings>(STORAGE_KEYS.UNITS_SETTINGS);
    if (!parsed) return;
    this.temperatureUnit.set(parsed.temperatureUnit ?? TEMPERATURE_UNITS.CELSIUS);
    this.windSpeedUnit.set(parsed.windSpeedUnit ?? WIND_SPEED_UNITS.KNOTS);
    this.decimalPrecision.set(parsed.decimalPrecision ?? 2);
  }

  private saveToStorage(): void {
    const payload: UnitsSettings = {
      temperatureUnit: this.temperatureUnit(),
      windSpeedUnit: this.windSpeedUnit(),
      decimalPrecision: this.decimalPrecision(),
    };
    this.storage.setJson(STORAGE_KEYS.UNITS_SETTINGS, payload);
  }
}
