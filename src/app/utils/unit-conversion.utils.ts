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
 * Verifica si una unidad es Kelvin
 */
export function isKelvinUnit(unit: string): boolean {
  return unit === TEMPERATURE_UNITS.KELVIN;
}

/**
 * Obtiene la unidad de visualización para temperatura según configuración del usuario
 */
export function getDisplayUnit(unit: string, unitsSettings: UnitsSettingsService): string {
  if (!isKelvinUnit(unit)) {
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
  if (!isKelvinUnit(unit)) {
    return value;
  }

  const targetUnit = unitsSettings.temperatureUnit();

  if (targetUnit === TEMPERATURE_UNITS.CELSIUS) {
    return convertKelvinToCelsius(value);
  }

  // Si el usuario quiere Kelvin, retornar sin conversión
  return value;
}
