import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { StationSeries } from '../../../models/geo/weather-station-series.model';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';
import { buildSeriesCharts } from '../../../services/layers/weather-station-chart.util';
import {
  WeatherStationHistoryChartsComponent,
  WeatherStationHistoryChartsData,
} from '../weather-station-history-charts/weather-station-history-charts.component';

export interface WeatherStationPopupItem {
  label: string;
  value: string;
}

export interface WeatherStationPopupData {
  stationId: number;
  stationName: string;
  province: string;
  values: ReadonlyArray<WeatherStationPopupItem>;
  updatedAt: string;
}

/**
 * Right-click preview for a station: the current measurement (always visible)
 * plus a compact 48 h sparkline per variable, and a link to the full-page
 * charts. The 48 h series is fetched once (single bundled request) and handed to
 * the full-page dialog so it opens instantly.
 */
@Component({
  selector: 'app-weather-station-popup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, NgApexchartsModule],
  templateUrl: './weather-station-popup.component.html',
})
export class WeatherStationPopupComponent implements OnInit {
  @Input({ required: true }) data!: WeatherStationPopupData;

  private readonly historyService = inject(WeatherStationsHistoryService);
  private readonly unitsSettings = inject(UnitsSettingsService);
  private readonly timezone = inject(TimezoneSettingsService);
  private readonly dialog = inject(MatDialog);

  private readonly series = signal<StationSeries | null>(null);

  /** Compact sparklines (rebuilds when the series / units / timezone change). */
  readonly previewCharts = computed(() => {
    const current = this.series();
    if (!current) {
      return [];
    }
    return buildSeriesCharts(current, this.unitsSettings, {
      group: 'ws-48h-preview',
      sparkline: true,
      utc: this.timezone.mode() === TIMEZONE_MODES.UTC,
      height: 34,
      width: 132,
    });
  });

  readonly hasPreview = computed(() => this.previewCharts().some((vm) => vm.hasData));

  ngOnInit(): void {
    void this.loadSeries();
  }

  private async loadSeries(): Promise<void> {
    try {
      this.series.set(await this.historyService.fetchSeries(this.data.stationId));
    } catch {
      // Leave the preview hidden; the latest values + link still work.
    }
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
          series: this.series(),
        },
      },
    );
  }
}
