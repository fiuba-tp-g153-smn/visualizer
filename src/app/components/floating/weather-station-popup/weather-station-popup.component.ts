import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NgApexchartsModule } from 'ng-apexcharts';

import { TEMPERATURE_UNITS } from '../../../constants';
import { StationSeries } from '../../../models/geo/weather-station-series.model';
import {
  LayerCategory,
  WeatherStationLayer,
  WeatherStationVariable,
} from '../../../models/layers/models';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import { LayerControlService } from '../../../services/layers/layer-control.service';
import { buildTabChart } from '../../../services/layers/weather-station-chart.util';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';
import { convertValueForDisplay, getDisplayUnit } from '../../../utils/unit-conversion.utils';
import { WindCompassComponent } from '../wind-compass/wind-compass.component';
import {
  WeatherStationHistoryChartsComponent,
  WeatherStationHistoryChartsData,
} from '../weather-station-history-charts/weather-station-history-charts.component';

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

enum PopupTab {
  CURRENT = 'current',
  GRAPH = 'graph',
}

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
  private readonly dialog = inject(MatDialog);
  private readonly layerControl = inject(LayerControlService);

  /** The SMN variable currently selected on the map (defaults to Temperatura). */
  private readonly selectedVariable = computed<WeatherStationVariable>(() => {
    const entry = this.layerControl
      .activeLayers()
      .find((e) => e.layer.category === LayerCategory.WEATHER_STATIONS);
    return (
      (entry?.layer as WeatherStationLayer | undefined)?.variable ??
      WeatherStationVariable.TEMPERATURE
    );
  });

  readonly series = signal<StationSeries | null>(null);
  readonly loading = signal<boolean>(true);
  readonly PopupTab = PopupTab;

  readonly tab = signal<PopupTab>(PopupTab.CURRENT);

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

  readonly chart = computed(() => {
    const current = this.series();
    if (!current) {
      return null;
    }
    return buildTabChart(current, this.selectedVariable(), this.unitsSettings, {
      utc: this.timezone.mode() === TIMEZONE_MODES.UTC,
      // Sized so chart + legend ≈ the Actual tab's height (popover doesn't resize).
      height: 150,
      width: 326,
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

  openFullScreen(): void {
    this.dialog.open<WeatherStationHistoryChartsComponent, WeatherStationHistoryChartsData>(
      WeatherStationHistoryChartsComponent,
      {
        panelClass: 'ws-history-fullscreen',
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        autoFocus: false,
        data: {
          stationId: this.data.stationId,
          stationName: this.data.stationName,
          province: this.data.province,
          lat: this.data.lat,
          lon: this.data.lon,
          series: this.series(),
        },
      },
    );
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
