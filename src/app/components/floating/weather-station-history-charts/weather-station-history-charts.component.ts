import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';

import { StationSeries } from '../../../models/geo/weather-station-series.model';
import { WeatherStationsHistoryService } from '../../../services/layers/weather-stations-history.service';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';
import { buildSeriesCharts } from '../../../services/layers/weather-station-chart.util';
import { buildSeriesSummary } from '../../../services/layers/weather-station-summary.util';
import { buildObservationRows } from '../../../services/layers/weather-station-observations.util';

export interface WeatherStationHistoryChartsData {
  stationId: number;
  stationName: string | null;
  province: string | null;
  lat: number | null;
  lon: number | null;
  /** Pre-fetched series passed by the popover so the dialog opens with no new request. */
  series?: StationSeries | null;
}

enum DetailSection {
  GRAFICOS = 'graficos',
  RESUMEN = 'resumen',
  OBSERVACIONES = 'observaciones',
}

@Component({
  selector: 'app-weather-station-history-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    NgApexchartsModule,
    LoadingSpinnerComponent,
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
  readonly stationId = this.data.stationId;
  readonly latText = this.data.lat === null ? '—' : this.data.lat.toFixed(2);
  readonly lonText = this.data.lon === null ? '—' : this.data.lon.toFixed(2);

  readonly DetailSection = DetailSection;

  readonly section = signal<DetailSection>(DetailSection.GRAFICOS);

  private readonly series = signal<StationSeries | null>(this.data.series ?? null);
  readonly loading = signal<boolean>(!this.data.series);
  readonly error = signal<boolean>(false);

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

  readonly summary = computed(() => {
    const current = this.series();
    return current ? buildSeriesSummary(current, this.unitsSettings) : [];
  });

  readonly observations = computed(() => {
    const current = this.series();
    void this.timezone.mode(); // formatDateTimeLocalized reads the global mode
    return current ? buildObservationRows(current, this.unitsSettings) : [];
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

  setSection(section: DetailSection): void {
    this.section.set(section);
  }

  close(): void {
    this.dialogRef.close();
  }
}
