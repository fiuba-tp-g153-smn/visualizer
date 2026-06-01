import { describe, it, expect } from 'vitest';
import {
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

describe('toActiveAlert', () => {
  it('maps the backend response into the domain model', () => {
    const res: ActiveAlertResponse = {
      alert_id: 42,
      phenomenon: 'TORMENTAS',
      area: '<b>BUENOS AIRES:</b> La Matanza.',
      polygon: '[-34.60,-58.50],[-34.70,-58.40]',
      start_datetime: '2026-06-01T10:00:00',
      end_datetime: '2026-06-01T13:00:00',
    };

    const alert = toActiveAlert(res);

    expect(alert.alertId).toBe(42);
    expect(alert.phenomenon).toBe('TORMENTAS');
    expect(alert.departments).toEqual([{ name: 'La Matanza', province: 'BUENOS AIRES' }]);
    expect(alert.coordinates).toEqual([
      [-34.6, -58.5],
      [-34.7, -58.4],
    ]);
    expect(alert.startDatetime).toEqual(new Date('2026-06-01T10:00:00'));
    expect(alert.endDatetime).toEqual(new Date('2026-06-01T13:00:00'));
  });
});
