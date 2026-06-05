import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { ThroughputBucket, TimingSeriesPoint } from '../../../models/metrics/metrics.models';
import {
  buildLineChart,
  buildStageAreaChart,
  buildThroughputBarChart,
  type MetricsChartOptions,
} from '../../../services/metrics/metrics-chart.util';
import { MetricChartComponent } from '../metric-chart/metric-chart.component';

/**
 * Las cuatro tendencias del panel: evolución de tiempos, throughput apilado,
 * desglose por etapa (para el tipo seleccionado) y latencia p95. Solo refleja
 * trabajos exitosos (lo que devuelve `/api/timeseries`).
 */
@Component({
  selector: 'app-trend-charts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule, MetricChartComponent],
  templateUrl: './trend-charts.component.html',
  styleUrl: './trend-charts.component.scss',
})
export class TrendChartsComponent {
  readonly timing = input.required<readonly TimingSeriesPoint[]>();
  readonly throughput = input.required<readonly ThroughputBucket[]>();

  private readonly selectedType = signal<string | null>(null);

  readonly jobTypes = computed<string[]>(() =>
    [...new Set(this.timing().map((point) => point.job_type))].sort(),
  );

  /** Tipo elegido para el desglose por etapa (cae al primero disponible). */
  readonly effectiveType = computed<string>(() => {
    const types = this.jobTypes();
    const chosen = this.selectedType();
    return chosen && types.includes(chosen) ? chosen : (types[0] ?? '');
  });

  readonly hasData = computed<boolean>(() => this.timing().length > 0);

  readonly evolutionChart = computed<MetricsChartOptions>(() =>
    buildLineChart(this.timing(), 'avg_total_s', 'secs'),
  );
  readonly throughputChart = computed<MetricsChartOptions>(() =>
    buildThroughputBarChart(this.throughput()),
  );
  readonly stageChart = computed<MetricsChartOptions>(() =>
    buildStageAreaChart(this.timing(), this.effectiveType()),
  );
  readonly p95Chart = computed<MetricsChartOptions>(() =>
    buildLineChart(this.timing(), 'p95_total_s', 'secs'),
  );

  onStageTypeChange(event: Event): void {
    this.selectedType.set((event.target as HTMLSelectElement).value);
  }
}
