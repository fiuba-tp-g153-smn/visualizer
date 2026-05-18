export enum SmnStationsTemporalMode {
  LATEST = 'latest',
  SPECIFIC = 'specific',
}

export const SMN_STATIONS_MAX_PAST_HOURS_OPTIONS: readonly number[] = [6, 12, 24, 48];

export const DEFAULT_SMN_STATIONS_MAX_PAST_HOURS = 24;

export function isSmnStationsTemporalMode(value: unknown): value is SmnStationsTemporalMode {
  return value === SmnStationsTemporalMode.LATEST || value === SmnStationsTemporalMode.SPECIFIC;
}
