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

function configure(data: WeatherStationHistoryChartsData): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [WeatherStationHistoryChartsComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
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
