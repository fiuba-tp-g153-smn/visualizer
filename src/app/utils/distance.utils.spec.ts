import { describe, it, expect } from 'vitest';
import { formatDistance, haversineMeters, pathSegmentsMeters } from './distance.utils';

const BUENOS_AIRES = { lat: -34.6037, lng: -58.3816 };
const CORDOBA = { lat: -31.4201, lng: -64.1888 };
const MENDOZA = { lat: -32.8895, lng: -68.8458 };

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(BUENOS_AIRES, BUENOS_AIRES)).toBe(0);
  });

  it('measures Buenos Aires – Córdoba at about 647 km', () => {
    expect(haversineMeters(BUENOS_AIRES, CORDOBA) / 1000).toBeCloseTo(647, 0);
  });

  it('is symmetric', () => {
    expect(haversineMeters(CORDOBA, MENDOZA)).toBeCloseTo(haversineMeters(MENDOZA, CORDOBA), 6);
  });

  it('measures one degree of latitude at about 111.2 km', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000).toBeCloseTo(111.2, 1);
  });
});

describe('pathSegmentsMeters', () => {
  it('has no segments for fewer than two points', () => {
    expect(pathSegmentsMeters([])).toEqual([]);
    expect(pathSegmentsMeters([BUENOS_AIRES])).toEqual([]);
  });

  it('returns one length per leg', () => {
    const segments = pathSegmentsMeters([BUENOS_AIRES, CORDOBA, MENDOZA]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toBeCloseTo(haversineMeters(BUENOS_AIRES, CORDOBA), 6);
    expect(segments[1]).toBeCloseTo(haversineMeters(CORDOBA, MENDOZA), 6);
  });
});

describe('formatDistance', () => {
  it('uses whole meters under 1 km', () => {
    expect(formatDistance(849.6)).toBe('850 m');
  });

  it('uses one decimal under 100 km', () => {
    expect(formatDistance(12_345)).toBe('12,3 km');
  });

  it('uses whole kilometers with thousands separator beyond 100 km', () => {
    expect(formatDistance(1_234_567)).toBe('1.235 km');
  });
});
