import { TEMPERATURE_UNITS, KELVIN_TO_CELSIUS_OFFSET } from '../constants';

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
 * Obtiene la unidad de visualización para temperatura
 * (convierte Kelvin a Celsius para display)
 */
export function getDisplayUnit(unit: string): string {
  return isKelvinUnit(unit) ? TEMPERATURE_UNITS.CELSIUS : unit;
}

/**
 * Convierte un valor según su unidad para visualización
 * (solo aplica a temperatura por ahora)
 */
export function convertValueForDisplay(value: number, unit: string): number {
  return isKelvinUnit(unit) ? convertKelvinToCelsius(value) : value;
}
