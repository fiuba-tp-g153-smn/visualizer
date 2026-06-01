import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgApexchartsModule } from 'ng-apexcharts';

import { StationSeries } from '../../../models/geo/weather-station-series.model';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';
import { buildSeriesCharts } from '../../../services/layers/weather-station-chart.util';

export interface WeatherStationHistoryChartsData {
  stationId: number;
  stationName: string | null;
  province: string | null;
  /** Pre-fetched series passed by the popover so the dialog opens with no new request. */
  series?: StationSeries | null;
}

/**
 * Full-screen view of a station's last 48 h: one time-aligned chart per variable
 * (shared hover crosshair via ApexCharts' `chart.group`). Opened as a full-screen
 * `MatDialog`. Consumes the single bundled series — reused from the popover.
 */
@Component({
  selector: 'app-weather-station-history-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgApexchartsModule,
  ],
  templateUrl: './weather-station-history-charts.component.html',
  styleUrl: './weather-station-history-charts.component.scss',
})
export class WeatherStationHistoryChartsComponent {
  private readonly data = inject<WeatherStationHistoryChartsData>(MAT_DIALOG_DATA);
  private readonly historyService = inject(WeatherStationsHistoryService);
  private readonly unitsSettings = inject(UnitsSettingsService);
  private readonly timezone = inject(TimezoneSettingsService);
  readonly dialogRef = inject(MatDialogRef<WeatherStationHistoryChartsComponent>);

  readonly stationName = this.data.stationName ?? 'Estación';
  readonly province = this.data.province ?? '';

  private readonly series = signal<StationSeries | null>(this.data.series ?? null);
  readonly loading = signal<boolean>(!this.data.series);
  readonly error = signal<boolean>(false);

  /** Rebuilds when the series, unit settings, or timezone mode change. */
  readonly charts = computed(() => {
    const current = this.series();
    if (!current) {
      return [];
    }
    return buildSeriesCharts(current, this.unitsSettings, {
      group: 'ws-48h',
      utc: this.timezone.mode() === TIMEZONE_MODES.UTC,
      height: 200,
    });
  });

  readonly hasPoints = computed(() => (this.series()?.points.length ?? 0) > 0);

  constructor() {
    if (!this.data.series) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.series.set(await this.historyService.fetchSeries(this.data.stationId));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
