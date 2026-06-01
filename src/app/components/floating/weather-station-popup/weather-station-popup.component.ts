import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import { TEMPERATURE_UNITS } from '../../../constants';
import { StationSeries } from '../../../models/geo/weather-station-series.model';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import { buildTempDewChart } from '../../../services/layers/weather-station-chart.util';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';
import { convertValueForDisplay, getDisplayUnit } from '../../../utils/unit-conversion.utils';
import { WindCompassComponent } from '../wind-compass/wind-compass.component';

export interface WeatherStationPopupItem {
  label: string;
  value: string;
}

export interface WeatherStationPopupWind {
  speed: string;
  unit: string;
  deg: number | null;
  direction: string;
}

export interface WeatherStationPopupData {
  stationId: number;
  stationName: string;
  province: string;
  lat: number | null;
  lon: number | null;
  temperature: string;
  feelsLike: string;
  weatherDescription: string;
  values: ReadonlyArray<WeatherStationPopupItem>;
  wind: WeatherStationPopupWind;
  updatedAt: string;
}

type PopupTab = 'current' | 'graph';

/**
 * Wundermap-style station card: a header with id/lat/lon and two tabs — **Actual**
 * (current values + wind compass) and **Gráfico** (Temperatura + Punto de rocío).
 * The 48 h series is fetched once and feeds both the dew-point value and the chart.
 */
@Component({
  selector: 'app-weather-station-popup',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, WindCompassComponent],
  templateUrl: './weather-station-popup.component.html',
  styleUrl: './weather-station-popup.component.scss',
})
export class WeatherStationPopupComponent implements OnInit {
  @Input({ required: true }) data!: WeatherStationPopupData;

  private readonly historyService = inject(WeatherStationsHistoryService);
  private readonly unitsSettings = inject(UnitsSettingsService);
  private readonly timezone = inject(TimezoneSettingsService);

  private readonly series = signal<StationSeries | null>(null);
  readonly loading = signal<boolean>(true);
  readonly tab = signal<PopupTab>('current');

  /** Dew point of the latest reading, formatted (from the server-computed series). */
  readonly dewPointText = computed(() => {
    const latest = this.series()?.latest;
    if (!latest || latest.dewPoint === null) {
      return '—';
    }
    const unit = getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, this.unitsSettings);
    const value = convertValueForDisplay(
      latest.dewPoint,
      TEMPERATURE_UNITS.CELSIUS,
      this.unitsSettings,
    );
    return `${value.toFixed(1)} ${unit}`.trim();
  });

  /** The Temperatura + Punto de rocío chart (null until the series loads). */
  readonly chart = computed(() => {
    const current = this.series();
    if (!current) {
      return null;
    }
    return buildTempDewChart(current, this.unitsSettings, {
      utc: this.timezone.mode() === TIMEZONE_MODES.UTC,
      height: 210,
      width: 308,
    });
  });

  get latText(): string {
    return this.data.lat === null ? '—' : this.data.lat.toFixed(2);
  }

  get lonText(): string {
    return this.data.lon === null ? '—' : this.data.lon.toFixed(2);
  }

  ngOnInit(): void {
    void this.loadSeries();
  }

  setTab(tab: PopupTab): void {
    this.tab.set(tab);
  }

  private async loadSeries(): Promise<void> {
    try {
      this.series.set(await this.historyService.fetchSeries(this.data.stationId));
    } catch {
      // Leave dew point + chart empty; the current values still render.
    } finally {
      this.loading.set(false);
    }
  }
}
