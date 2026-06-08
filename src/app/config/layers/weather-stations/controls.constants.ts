export enum WeatherStationsTemporalMode {
  LATEST = 'latest',
  SPECIFIC = 'specific',
}

export const DEFAULT_WEATHER_STATIONS_GRACE_PERIOD_HOURS = 2;

export const WEATHER_STATIONS_IMAGE_COUNT_OPTIONS: readonly number[] = [1, 6, 12, 24];

export function isWeatherStationsTemporalMode(value: unknown): value is WeatherStationsTemporalMode {
  return value === WeatherStationsTemporalMode.LATEST || value === WeatherStationsTemporalMode.SPECIFIC;
}
