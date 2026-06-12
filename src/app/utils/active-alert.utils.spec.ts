import { describe, it, expect } from 'vitest';
import {
  ACTIVE_ALERT_EXPIRY_COLORS,
  activeAlertColorForExpiry,
  formatActiveAlertRemaining,
  parseActiveAlertPolygon,
  parseAffectedDepartments,
  toActiveAlert,
  toPendingAlert,
} from './active-alert.utils';
import { ActiveAlertResponse, PendingAlertResponse } from '../models/geo';

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

describe('formatActiveAlertRemaining', () => {
  const now = new Date('2026-06-01T12:00:00').getTime();
  const inMinutes = (m: number): Date => new Date(now + m * 60_000);

  it('formats hours and minutes', () => {
    expect(formatActiveAlertRemaining(inMinutes(135), now)).toBe('2h 15min');
    expect(formatActiveAlertRemaining(inMinutes(120), now)).toBe('2h');
  });

  it('formats minutes only when under an hour', () => {
    expect(formatActiveAlertRemaining(inMinutes(45), now)).toBe('45min');
    expect(formatActiveAlertRemaining(inMinutes(1), now)).toBe('1min');
  });

  it('shows <1min for less than a minute and Vencido when expired', () => {
    expect(formatActiveAlertRemaining(new Date(now + 30_000), now)).toBe('<1min');
    expect(formatActiveAlertRemaining(inMinutes(-5), now)).toBe('Vencido');
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

describe('toPendingAlert', () => {
  it('maps the backend response and prefixes GIF urls with the base url', () => {
    const res: PendingAlertResponse = {
      alert_id: 7,
      phenomenon: 'GRANIZO',
      area: '<b>CORDOBA:</b> Capital.',
      polygon: '[-31.40,-64.20],[-31.50,-64.10],[-31.60,-64.30]',
      gif_gral_url: '/alerts/gral_alerta.gif',
      gif_area_url: '/alerts/zoom_alerta.gif',
    };

    const alert = toPendingAlert(res, 'http://localhost:8080');

    expect(alert.alertId).toBe(7);
    expect(alert.phenomenon).toBe('GRANIZO');
    expect(alert.departments).toEqual([{ name: 'Capital', province: 'CORDOBA' }]);
    expect(alert.coordinates).toEqual([
      [-31.4, -64.2],
      [-31.5, -64.1],
      [-31.6, -64.3],
    ]);
    expect(alert.gifGralUrl).toBe('http://localhost:8080/alerts/gral_alerta.gif');
    expect(alert.gifAreaUrl).toBe('http://localhost:8080/alerts/zoom_alerta.gif');
  });
});
