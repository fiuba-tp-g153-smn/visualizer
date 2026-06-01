import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';

import {
  WeatherStationPopupComponent,
  WeatherStationPopupData,
} from './weather-station-popup.component';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import type { StationSeries } from '../../../models/geo/weather-station-series.model';

const flush = () => new Promise((r) => setTimeout(r, 0));

const DATA: WeatherStationPopupData = {
  stationId: 87344,
  stationName: 'CORDOBA AERO',
  province: 'CORDOBA',
  values: [{ label: 'Temperatura', value: '18.4 °C' }],
  updatedAt: '17/05 14:00',
};

const SERIES: StationSeries = {
  stationId: 87344,
  stationName: 'CORDOBA AERO',
  province: 'CORDOBA',
  hours: 48,
  points: [
    {
      t: Date.parse('2026-05-17T13:00:00Z'),
      observedAt: '2026-05-17T13:00:00Z',
      temperature: 17,
      feelsLike: 16,
      humidity: 60,
      pressure: 1013,
      visibility: 10,
      windSpeed: 5,
      windDeg: 350,
      windDirection: 'Norte',
    },
    {
      t: Date.parse('2026-05-17T14:00:00Z'),
      observedAt: '2026-05-17T14:00:00Z',
      temperature: 18,
      feelsLike: 17,
      humidity: 62,
      pressure: 1013,
      visibility: 10,
      windSpeed: 8,
      windDeg: 5,
      windDirection: 'Norte',
    },
  ],
  latest: null,
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
    // Stub out <apx-chart> so the real ApexCharts never renders in jsdom.
    TestBed.overrideComponent(WeatherStationPopupComponent, {
      set: {
        imports: [CommonModule, MatButtonModule, MatIconModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });
  });

  it('renders the current measurement values', () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('CORDOBA AERO');
    expect(text).toContain('Temperatura');
    expect(text).toContain('18.4 °C');
  });

  it('fetches the 48 h series once and shows the trend preview', async () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fetchSeries).toHaveBeenCalledWith(87344);
    expect(fixture.nativeElement.textContent).toContain('Últimas 48 h');
  });

  it('opens the full-screen dialog with the station id and the loaded series', async () => {
    const fixture = TestBed.createComponent(WeatherStationPopupComponent);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.weather-station-popup__history-btn',
    );
    button.click();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const config = dialogOpen.mock.calls[0][1];
    expect(config.data.stationId).toBe(87344);
    expect(config.data.series).toBe(SERIES);
  });
});
