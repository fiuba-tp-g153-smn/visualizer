import { describe, it, expect } from 'vitest';

import { buildObservationRows } from './weather-station-observations.util';
import { UnitsSettingsService } from '../settings/units-settings.service';
import type {
  StationSeries,
  StationSeriesPoint,
} from '../../models/geo/weather-station-series.model';

function pt(
  observedAt: string,
  temperature: number | null,
  condition: string | null,
): StationSeriesPoint {
  return {
    t: Date.parse(observedAt),
    observedAt,
    temperature,
    feelsLike: null,
    humidity: 88,
    pressure: 1019.2,
    visibility: 10,
    dewPoint: 9,
    condition,
    windSpeed: 5,
    windDeg: 180,
    windDirection: 'Sur',
  };
}

const SERIES: StationSeries = {
  stationId: 1,
  stationName: 'X',
  province: 'P',
  hours: 48,
  points: [pt('2026-05-30T12:00:00Z', 18, 'Niebla'), pt('2026-05-30T13:00:00Z', 19, null)],
  latest: pt('2026-05-30T13:00:00Z', 19, null),
};

const units = () => new UnitsSettingsService();

describe('buildObservationRows', () => {
  it('builds one row per observation, newest first, with units', () => {
    const rows = buildObservationRows(SERIES, units());
    expect(rows).toHaveLength(2);
    // Newest first.
    expect(rows[0].temperature).toBe('19.0 °C');
    expect(rows[1].temperature).toBe('18.0 °C');
    expect(rows[0].humidity).toBe('88 %');
    expect(rows[0].pressure).toBe('1019.2 hPa');
    expect(rows[0].wind).toBe('Sur');
  });

  it('renders condition (or — when missing)', () => {
    const rows = buildObservationRows(SERIES, units());
    expect(rows[0].condition).toBe('—'); // newest point has no condition
    expect(rows[1].condition).toBe('Niebla');
  });
});
