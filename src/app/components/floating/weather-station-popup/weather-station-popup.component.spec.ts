import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import {
  WeatherStationPopupComponent,
  WeatherStationPopupData,
} from './weather-station-popup.component';
import { WindCompassComponent } from '../wind-compass/wind-compass.component';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import type {
  StationSeries,
  StationSeriesPoint,
} from '../../../models/geo/weather-station-series.model';

const flush = () => new Promise((r) => setTimeout(r, 0));

const DATA: WeatherStationPopupData = {
  stationId: 87593,
  stationName: 'BUENOS AIRES',
  province: 'CABA',
  lat: -34.59,
  lon: -58.32,
  temperature: '11.6 °C',
  feelsLike: '0.0 °C',
  weatherDescription: 'Ligeramente nublado',
  values: [
    { label: 'Humedad', value: '91 %' },
    { label: 'Presión', value: '1019.2 hPa' },
    { label: 'Visibilidad', value: '10.0 km' },
  ],
  wind: { speed: '2', unit: 'km/h', deg: 180, direction: 'Sur' },
  updatedAt: '31/05 20:00',
};

function pt(t: string, temp: number, dew: number): StationSeriesPoint {
  return {
    t: Date.parse(t),
    observedAt: t,
    temperature: temp,
    feelsLike: null,
    humidity: null,
    pressure: null,
    visibility: null,
    dewPoint: dew,
    windSpeed: null,
    windDeg: null,
    windDirection: null,
  };
}

const SERIES: StationSeries = {
  stationId: 87593,
  stationName: 'BUENOS AIRES',
  province: 'CABA',
  hours: 48,
  points: [pt('2026-05-31T19:00:00Z', 11, 9), pt('2026-05-31T20:00:00Z', 11.6, 10)],
  latest: pt('2026-05-31T20:00:00Z', 11.6, 10),
};

describe('WeatherStationPopupComponent', () => {
  const fetchSeries = vi.fn();
  const dialogOpen = vi.fn();

  beforeEach(() => {
    fetchSeries.mockReset().mockResolvedValue(SERIES);
    dialogOpen.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WeatherStationPopupComponent],
      providers: [
        { provide: WeatherStationsHistoryService, useValue: { fetchSeries } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
    // Stub <apx-chart> (no real ApexCharts in jsdom); keep the real wind compass.
    TestBed.overrideComponent(WeatherStationPopupComponent, {
      set: {
        imports: [CommonModule, WindCompassComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });
  });

  it('shows the header with station id, lat and lon, and the current values', () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('BUENOS AIRES');
    expect(text).toContain('87593');
    expect(text).toContain('-34.59');
    expect(text).toContain('-58.32');
    expect(text).toContain('11.6 °C');
    expect(text).toContain('Humedad');
    expect(text).toContain('desde el Sur'); // wind compass
  });

  it('fills in the dew point from the loaded series', async () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fetchSeries).toHaveBeenCalledWith(87593);
    expect(fixture.nativeElement.textContent).toContain('Punto de rocío');
    expect(fixture.nativeElement.textContent).toContain('10.0 °C');
  });

  it('renders the chart only after switching to the Gráfico tab', async () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    // Current tab: no chart yet.
    expect(fixture.nativeElement.querySelector('apx-chart')).toBeNull();

    const tabs = fixture.nativeElement.querySelectorAll('.ws-card__tab');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('apx-chart')).not.toBeNull();
  });

  it('opens the full-screen all-variables dialog from the Gráfico tab link', async () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    await flush();

    const tabs = fixture.nativeElement.querySelectorAll('.ws-card__tab');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    const link: HTMLButtonElement = fixture.nativeElement.querySelector('.ws-card__all-link');
    link.click();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(dialogOpen.mock.calls[0][1].data.stationId).toBe(87593);
  });
});
