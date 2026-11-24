import { describe, it, expect } from 'vitest';
import { weatherStationsTilesetTime } from './weather-stations-tilesets';

describe('weatherStationsTilesetTime', () => {
  it('reads the hour bucket in UTC', () => {
    expect(weatherStationsTilesetTime('20261124T1500Z')).toBe(
      new Date('2026-11-24T15:00:00Z').getTime(),
    );
  });

  it('rejects malformed ids', () => {
    expect(weatherStationsTilesetTime('latest')).toBeNull();
  });
});
