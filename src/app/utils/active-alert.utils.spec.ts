import { describe, it, expect } from 'vitest';
import {
  ACTIVE_ALERT_EXPIRY_COLORS,
  activeAlertColorForExpiry,
  parseActiveAlertPolygon,
  parseAffectedDepartments,
  toActiveAlert,
} from './active-alert.utils';
import { ActiveAlertResponse } from '../models/geo';

describe('parseActiveAlertPolygon', () => {
  it('parses "[lat,lon],..." into [lat, lng] pairs', () => {
    const result = parseActiveAlertPolygon('[-34.60,-58.50],[-34.70,-58.40],[-34.80,-58.60]');
    expect(result).toEqual([
      [-34.6, -58.5],
      [-34.7, -58.4],
      [-34.8, -58.6],
    ]);
  });

  it('tolerates whitespace and returns [] for an empty string', () => {
    expect(parseActiveAlertPolygon('[ -34.6 , -58.5 ]')).toEqual([[-34.6, -58.5]]);
    expect(parseActiveAlertPolygon('')).toEqual([]);
  });
});

describe('parseAffectedDepartments', () => {
  it('extracts departments with province, sorted alphabetically by name', () => {
    const html = '<b>BUENOS AIRES:</b> Moreno - La Matanza.<br /><br /><b>CORDOBA:</b> Capital.';
    expect(parseAffectedDepartments(html)).toEqual([
      { name: 'Capital', province: 'CORDOBA' },
      { name: 'La Matanza', province: 'BUENOS AIRES' },
      { name: 'Moreno', province: 'BUENOS AIRES' },
    ]);
  });

  it('returns [] when there are no departments', () => {
    expect(parseAffectedDepartments('(Sin departamentos en el área)')).toEqual([]);
    expect(parseAffectedDepartments('')).toEqual([]);
  });
});

describe('activeAlertColorForExpiry', () => {
  const now = new Date('2026-06-01T12:00:00').getTime();
  const inMinutes = (m: number): Date => new Date(now + m * 60_000);

  it('is green when more than 30 minutes remain', () => {
    expect(activeAlertColorForExpiry(inMinutes(40), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.GREEN);
    expect(activeAlertColorForExpiry(inMinutes(31), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.GREEN);
  });

  it('is yellow when between 11 and 30 minutes remain', () => {
    expect(activeAlertColorForExpiry(inMinutes(30), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.YELLOW);
    expect(activeAlertColorForExpiry(inMinutes(11), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.YELLOW);
  });

  it('is red when 10 minutes or less remain (including expired)', () => {
    expect(activeAlertColorForExpiry(inMinutes(10), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.RED);
    expect(activeAlertColorForExpiry(inMinutes(1), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.RED);
    expect(activeAlertColorForExpiry(inMinutes(-5), now)).toBe(ACTIVE_ALERT_EXPIRY_COLORS.RED);
  });
});

describe('toActiveAlert', () => {
  it('maps the backend response into the domain model', () => {
    const res: ActiveAlertResponse = {
      alert_id: 42,
      phenomenon: 'TORMENTAS',
      area: '<b>BUENOS AIRES:</b> La Matanza.',
      polygon: '[-34.60,-58.50],[-34.70,-58.40]',
      start_datetime: '2026-06-01T10:00:00Z',
      end_datetime: '2026-06-01T13:00:00Z',
    };

    const alert = toActiveAlert(res);

    expect(alert.alertId).toBe(42);
    expect(alert.phenomenon).toBe('TORMENTAS');
    expect(alert.departments).toEqual([{ name: 'La Matanza', province: 'BUENOS AIRES' }]);
    expect(alert.coordinates).toEqual([
      [-34.6, -58.5],
      [-34.7, -58.4],
    ]);
    // The 'Z' suffix must be interpreted as UTC (independent of the runner's tz).
    expect(alert.startDatetime.getTime()).toBe(Date.UTC(2026, 5, 1, 10, 0, 0));
    expect(alert.endDatetime.getTime()).toBe(Date.UTC(2026, 5, 1, 13, 0, 0));
  });
});
