export enum SmnStationsTemporalMode {
  LATEST = 'latest',
  SPECIFIC = 'specific',
}

export const DEFAULT_SMN_STATIONS_MAX_PAST_HOURS = 3;

export const SMN_STATIONS_LAST_IMAGES_COUNT_OPTIONS: readonly number[] = [1, 6, 12, 24];

export function isSmnStationsTemporalMode(value: unknown): value is SmnStationsTemporalMode {
  return value === SmnStationsTemporalMode.LATEST || value === SmnStationsTemporalMode.SPECIFIC;
}
