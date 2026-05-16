import {
  KELVIN_TO_CELSIUS_OFFSET,
  KNOT_TO_KILOMETERS_PER_HOUR_FACTOR,
  TEMPERATURE_UNITS,
  WIND_SPEED_UNIT_ALIASES,
  WIND_SPEED_UNITS,
} from '../constants';
import { UnitsSettingsService } from '../services/settings/units-settings.service';

/**
 * Utilidades para conversión de unidades
 */

/**
 * Convierte un valor de Kelvin a Celsius
 */
export function convertKelvinToCelsius(value: number): number {
  return value - KELVIN_TO_CELSIUS_OFFSET;
}

/**
 * Convierte un valor de Celsius a Kelvin
 */
export function convertCelsiusToKelvin(value: number): number {
  return value + KELVIN_TO_CELSIUS_OFFSET;
}

/**
 * Convierte un valor de km/h a nudos
 */
export function convertKilometersPerHourToKnots(value: number): number {
  return value / KNOT_TO_KILOMETERS_PER_HOUR_FACTOR;
}

/**
 * Convierte un valor de nudos a km/h
 */
export function convertKnotsToKilometersPerHour(value: number): number {
  return value * KNOT_TO_KILOMETERS_PER_HOUR_FACTOR;
}

/**
 * Verifica si una unidad es Kelvin
 */
export function isKelvinUnit(unit: string): boolean {
  return unit === TEMPERATURE_UNITS.KELVIN;
}

/**
 * Verifica si una unidad es Celsius
 */
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

/**
 * Obtiene la unidad de visualización para temperatura según configuración del usuario
 */
export function getDisplayUnit(unit: string, unitsSettings: UnitsSettingsService): string {
  if (isTemperatureUnit(unit)) {
    return unitsSettings.temperatureUnit();
  }

  if (isWindSpeedUnit(unit)) {
    return unitsSettings.windSpeedUnit();
  }

  return unit;
}

/**
 * Convierte un valor según su unidad para visualización según configuración del usuario
 */
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
