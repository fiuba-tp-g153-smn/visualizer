import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { LiveStatusPanelComponent } from '../../components/dashboard/live-status-panel/live-status-panel.component';
import { JobTypeSummaryTableComponent } from '../../components/dashboard/job-type-summary-table/job-type-summary-table.component';
import { MetricChartComponent } from '../../components/dashboard/metric-chart/metric-chart.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import { MetricStatCardsComponent } from '../../components/dashboard/metric-stat-cards/metric-stat-cards.component';
import { RecentJobsTableComponent } from '../../components/dashboard/recent-jobs-table/recent-jobs-table.component';
import { TrendChartsComponent } from '../../components/dashboard/trend-charts/trend-charts.component';
import type {
  Bucket,
  JobTypeSummary,
  LiveStatus,
  RecentJob,
  RefreshSeconds,
  TenMinWindowHours,
  ThroughputBucket,
  TimingSeriesPoint,
  WindowHours,
} from '../../models/metrics/metrics.models';
import {
  buildLineChart,
  type MetricsChartOptions,
} from '../../services/metrics/metrics-chart.util';
import { MetricsService } from '../../services/metrics/metrics.service';

const JOBS_PAGE = 50;

/**
 * Página del panel de rendimiento (ruta `/dashboard`). Es el único dueño del
 * estado: mantiene los controles y los datos en signals, los refresca contra
 * el API de métricas y los reparte a componentes de presentación.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MetricPanelComponent,
    MetricStatCardsComponent,
    LiveStatusPanelComponent,
    TrendChartsComponent,
    MetricChartComponent,
    JobTypeSummaryTableComponent,
    RecentJobsTableComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly metrics = inject(MetricsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Controles
  readonly windowHours = signal<WindowHours>(24);
  readonly bucket = signal<Bucket>('hour');
  readonly refreshSecs = signal<RefreshSeconds>(10);
  readonly tpWindowHours = signal<TenMinWindowHours>(6);

  // Datos
  readonly summary = signal<readonly JobTypeSummary[]>([]);
  readonly jobs = signal<readonly RecentJob[]>([]);
  readonly jobsHasMore = signal<boolean>(false);
  readonly live = signal<LiveStatus | null>(null);
  readonly timing = signal<readonly TimingSeriesPoint[]>([]);
  readonly throughput = signal<readonly ThroughputBucket[]>([]);
  private readonly tp10 = signal<readonly ThroughputBucket[]>([]);

  readonly updatedAt = signal<string>('—');
  readonly errorMsg = signal<string | null>(null);

  /** Gráfico de throughput de 10 min (null cuando no hay datos en el rango). */
  readonly tp10Options = computed<MetricsChartOptions | null>(() => {
    const rows = this.tp10();
    return rows.length ? buildLineChart(rows, 'count', 'count', 260) : null;
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // (Re)programa el auto-refresco cuando cambia la cadencia.
    effect(() => {
      const seconds = this.refreshSecs();
      this.clearTimer();
      if (seconds > 0) {
        this.intervalId = setInterval(() => void this.refresh(), seconds * 1000);
      }
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
    void this.refresh();
  }

  // ── Manejadores de controles ────────────────────────────────────────────

  onWindowChange(event: Event): void {
    this.windowHours.set(this.numberValue(event) as WindowHours);
    void this.refresh();
  }

  onBucketChange(event: Event): void {
    this.bucket.set(this.stringValue(event) as Bucket);
    void this.loadCharts();
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  onTpWindowChange(event: Event): void {
    this.tpWindowHours.set(this.numberValue(event) as TenMinWindowHours);
    void this.loadTp10();
  }

  onLoadMore(): void {
    void this.loadJobs(false);
  }

  refreshNow(): void {
    void this.refresh();
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  private async refresh(): Promise<void> {
    try {
      this.summary.set(await firstValueFrom(this.metrics.getSummary(this.windowHours())));
      await Promise.all([this.loadJobs(true), this.loadCharts(), this.loadLive(), this.loadTp10()]);
      this.updatedAt.set(new Date().toLocaleTimeString());
      this.errorMsg.set(null);
    } catch (error) {
      this.errorMsg.set(this.describeError(error));
    }
  }

  private async loadCharts(): Promise<void> {
    const [timing, throughput] = await Promise.all([
      firstValueFrom(this.metrics.getTimeSeries(this.bucket(), this.windowHours())),
      firstValueFrom(this.metrics.getThroughput(this.bucket(), this.windowHours())),
    ]);
    this.timing.set(timing);
    this.throughput.set(throughput);
  }

  private async loadJobs(reset: boolean): Promise<void> {
    if (reset) {
      const limit = Math.max(JOBS_PAGE, this.jobs().length);
      const page = await firstValueFrom(this.metrics.getJobs({ limit, offset: 0 }));
      this.jobs.set(page);
      this.jobsHasMore.set(page.length >= JOBS_PAGE);
      return;
    }
    const page = await firstValueFrom(
      this.metrics.getJobs({ limit: JOBS_PAGE, offset: this.jobs().length }),
    );
    this.jobs.update((current) => [...current, ...page]);
    this.jobsHasMore.set(page.length === JOBS_PAGE);
  }

  private async loadLive(): Promise<void> {
    try {
      this.live.set(await firstValueFrom(this.metrics.getLive()));
    } catch {
      this.live.set(null);
    }
  }

  private async loadTp10(): Promise<void> {
    this.tp10.set(await firstValueFrom(this.metrics.getThroughput('10min', this.tpWindowHours())));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private numberValue(event: Event): number {
    return Number((event.target as HTMLSelectElement).value);
  }

  private stringValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'No se pudieron cargar las métricas';
  }
}
