import {
  KELVIN_TO_CELSIUS_OFFSET,
  KNOT_TO_KILOMETERS_PER_HOUR_FACTOR,
  TEMPERATURE_UNITS,
  WIND_SPEED_UNIT_ALIASES,
  WIND_SPEED_UNITS,
} from '../constants';
import { UnitsSettingsService } from '../services/settings/units-settings.service';

export function convertKelvinToCelsius(value: number): number {
  return value - KELVIN_TO_CELSIUS_OFFSET;
}

export function convertCelsiusToKelvin(value: number): number {
  return value + KELVIN_TO_CELSIUS_OFFSET;
}

export function convertKilometersPerHourToKnots(value: number): number {
  return value / KNOT_TO_KILOMETERS_PER_HOUR_FACTOR;
}

export function convertKnotsToKilometersPerHour(value: number): number {
  return value * KNOT_TO_KILOMETERS_PER_HOUR_FACTOR;
}

export function isKelvinUnit(unit: string): boolean {
  return unit === TEMPERATURE_UNITS.KELVIN;
}

export function isCelsiusUnit(unit: string): boolean {
  return unit === TEMPERATURE_UNITS.CELSIUS;
}

function isTemperatureUnit(unit: string): boolean {
  return isKelvinUnit(unit) || isCelsiusUnit(unit);
}

function isWindSpeedUnit(unit: string): boolean {
  return (
    unit === WIND_SPEED_UNITS.KILOMETERS_PER_HOUR ||
    unit === WIND_SPEED_UNITS.KNOTS ||
    unit === WIND_SPEED_UNIT_ALIASES.KNOTS_SPANISH
  );
}

export function getDisplayUnit(unit: string, unitsSettings: UnitsSettingsService): string {
  if (isTemperatureUnit(unit)) {
    return unitsSettings.temperatureUnit();
  }

  if (isWindSpeedUnit(unit)) {
    return unitsSettings.windSpeedUnit();
  }

  return unit;
}

export function convertValueForDisplay(
  value: number,
  unit: string,
  unitsSettings: UnitsSettingsService,
): number {
  if (isTemperatureUnit(unit)) {
    const targetUnit = unitsSettings.temperatureUnit();

    if (unit === TEMPERATURE_UNITS.KELVIN && targetUnit === TEMPERATURE_UNITS.CELSIUS) {
      return convertKelvinToCelsius(value);
    }

    if (unit === TEMPERATURE_UNITS.CELSIUS && targetUnit === TEMPERATURE_UNITS.KELVIN) {
      return convertCelsiusToKelvin(value);
    }

    return value;
  }

  if (isWindSpeedUnit(unit)) {
    const targetUnit = unitsSettings.windSpeedUnit();

    if (unit === WIND_SPEED_UNITS.KILOMETERS_PER_HOUR && targetUnit === WIND_SPEED_UNITS.KNOTS) {
      return convertKilometersPerHourToKnots(value);
    }

    if (
      (unit === WIND_SPEED_UNITS.KNOTS || unit === WIND_SPEED_UNIT_ALIASES.KNOTS_SPANISH) &&
      targetUnit === WIND_SPEED_UNITS.KILOMETERS_PER_HOUR
    ) {
      return convertKnotsToKilometersPerHour(value);
    }

    return value;
  }

  return value;
}
