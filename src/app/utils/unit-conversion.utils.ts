import { inject } from '@angular/core';
import { TEMPERATURE_UNITS, KELVIN_TO_CELSIUS_OFFSET } from '../constants';
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

/**
 * Obtiene la unidad de visualización para temperatura según configuración del usuario
 */
export function getDisplayUnit(unit: string, unitsSettings: UnitsSettingsService): string {
  if (!isTemperatureUnit(unit)) {
    return unit;
  }

  const targetUnit = unitsSettings.temperatureUnit();
  return targetUnit;
}

/**
 * Convierte un valor según su unidad para visualización según configuración del usuario
 */
export function convertValueForDisplay(
  value: number,
  unit: string,
  unitsSettings: UnitsSettingsService,
): number {
  if (!isTemperatureUnit(unit)) {
    return value;
  }

  const targetUnit = unitsSettings.temperatureUnit();

  if (unit === TEMPERATURE_UNITS.KELVIN && targetUnit === TEMPERATURE_UNITS.CELSIUS) {
    return convertKelvinToCelsius(value);
  }

  if (unit === TEMPERATURE_UNITS.CELSIUS && targetUnit === TEMPERATURE_UNITS.KELVIN) {
    return convertCelsiusToKelvin(value);
  }

  // Si ya está en la unidad de destino, retornar sin conversión.
  return value;
}
