import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  WeatherStationHistoryChartsComponent,
  WeatherStationHistoryChartsData,
} from './weather-station-history-charts.component';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import type { StationSeries } from '../../../models/geo/weather-station-series.model';

function pt(t: string, temperature: number): StationSeries['points'][number] {
  return {
    t: Date.parse(t),
    observedAt: t,
    temperature,
    feelsLike: null,
    humidity: 60,
    pressure: 1013,
    visibility: 10,
    dewPoint: temperature - 5,
    condition: 'Niebla',
    windSpeed: 8,
    windDeg: 5,
    windDirection: 'Norte',
  };
}

const SERIES: StationSeries = {
  stationId: 87344,
  stationName: 'CORDOBA AERO',
  province: 'CORDOBA',
  hours: 48,
  points: [pt('2026-05-17T13:00:00Z', 17), pt('2026-05-17T14:00:00Z', 18)],
  latest: pt('2026-05-17T14:00:00Z', 18),
};

function configure(
  data: Omit<WeatherStationHistoryChartsData, 'lat' | 'lon'> &
    Partial<Pick<WeatherStationHistoryChartsData, 'lat' | 'lon'>>,
): void {
  const fullData: WeatherStationHistoryChartsData = { lat: -34.59, lon: -58.32, ...data };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [WeatherStationHistoryChartsComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: fullData },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: WeatherStationsHistoryService, useValue: { fetchSeries: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(WeatherStationHistoryChartsComponent, {
    set: {
      imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    },
  });
}

describe('WeatherStationHistoryChartsComponent', () => {
  beforeEach(() =>
    configure({ stationId: 87344, stationName: 'CORDOBA AERO', province: 'CORDOBA' }),
  );

  it('renders one chart per variable for a pre-fetched series', () => {
    configure({
      stationId: 87344,
      stationName: 'CORDOBA AERO',
      province: 'CORDOBA',
      series: SERIES,
    });
    const fixture = TestBed.createComponent(WeatherStationHistoryChartsComponent);
    fixture.detectChanges();

    const charts = fixture.nativeElement.querySelectorAll('.ws-history__chart');
    expect(charts).toHaveLength(6);
    expect(fixture.nativeElement.textContent).toContain('Temperatura');
    expect(fixture.nativeElement.textContent).toContain('Viento');
  });

  it('exposes a nav and renders the Observaciones table when selected', () => {
    configure({
      stationId: 87344,
      stationName: 'CORDOBA AERO',
      province: 'CORDOBA',
      series: SERIES,
    });
    const fixture = TestBed.createComponent(WeatherStationHistoryChartsComponent);
    fixture.detectChanges();

    // The nav offers all three sections; the header shows id/lat/lon.
    const navText = fixture.nativeElement.textContent ?? '';
    expect(navText).toContain('Gráficos');
    expect(navText).toContain('Resumen');
    expect(navText).toContain('Observaciones');
    expect(navText).toContain('87344');
    expect(navText).toContain('-34.59');

    // Default section = Gráficos: no table yet.
    expect(fixture.nativeElement.querySelector('.ws-history__table')).toBeNull();

    // Switch to Observaciones → one row per point, with the condition.
    const navButtons = fixture.nativeElement.querySelectorAll('.ws-history__nav-btn');
    (navButtons[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.ws-history__table tbody tr');
    expect(rows).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Niebla');
  });

  it('shows the empty state when the series has no points', () => {
    configure({
      stationId: 87344,
      stationName: 'CORDOBA AERO',
      province: 'CORDOBA',
      series: { ...SERIES, points: [], latest: null },
    });
    const fixture = TestBed.createComponent(WeatherStationHistoryChartsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin datos');
    expect(fixture.nativeElement.querySelectorAll('.ws-history__chart')).toHaveLength(0);
  });
});
