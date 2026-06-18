import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AlertJobDetailDialogComponent } from '../../components/dashboard/alert-job-detail-dialog/alert-job-detail-dialog.component';
import { MetricChartComponent } from '../../components/dashboard/metric-chart/metric-chart.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import { StagePieChartComponent } from '../../components/dashboard/stage-pie-chart/stage-pie-chart.component';
import {
  StatCardsComponent,
  type StatCard,
} from '../../components/data-dashboard/stat-cards/stat-cards.component';
import type {
  AlertJobMetric,
  AlertsJobHistoryPoint,
  AlertsSummary,
  RefreshSeconds,
  WindowHours,
} from '../../models/metrics/alerts-metrics.models';
import {
  buildLineChart,
  type MetricsChartOptions,
} from '../../services/metrics/metrics-chart.util';
import { AlertsMetricsService } from '../../services/metrics/alerts-metrics.service';
import { DepartmentIntersectionService } from '../../services/polygons/department-intersection.service';

interface FailureRow {
  readonly label: string;
  readonly count: number;
}

interface AvgStageRow {
  readonly label: string;
  readonly value: string;
}

/** Range options for the "Actividad por hora" panel (hours). */
type ActivityHours = 24 | 168 | 720;

/** Human labels for the backend `error_code` values. */
const ERROR_CODE_LABELS: Record<string, string> = {
  timeout: 'Tiempo de generación agotado',
  area_too_large: 'Área afectada demasiado grande',
  generation_failed: 'Error de generación',
  unknown: 'Desconocido',
};

const OUTCOME_COLORS: Record<string, string> = {
  Exitosas: '#2e9b51',
  Fallidas: '#d23b4e',
};

function formatMs(ms: number): string {
  if (!ms) {
    return '—';
  }
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/**
 * Panel "Alertas" del shell `/status`: estado de generación de avisos. Dueño del
 * estado (signals), refresca contra el API de métricas del alerts-service y lo
 * reparte a paneles de presentación.
 */
@Component({
  selector: 'app-alerts-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MetricPanelComponent,
    MetricChartComponent,
    StagePieChartComponent,
    StatCardsComponent,
  ],
  providers: [
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 0, hideDelay: 0, touchendHideDelay: 1000 },
    },
  ],
  templateUrl: './alerts-dashboard.component.html',
  styleUrl: './alerts-dashboard.component.scss',
})
export class AlertsDashboardComponent {
  private readonly metrics = inject(AlertsMetricsService);
  private readonly departments = inject(DepartmentIntersectionService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // Controles
  readonly windowHours = signal<WindowHours>(24);
  readonly refreshSecs = signal<RefreshSeconds>(10);
  readonly activityHours = signal<ActivityHours>(24);

  // Datos
  readonly summary = signal<AlertsSummary | null>(null);
  readonly jobs = signal<readonly AlertJobMetric[]>([]);
  readonly activity = signal<readonly AlertsJobHistoryPoint[]>([]);
  readonly phenomena = signal<ReadonlyMap<number, string>>(new Map());

  readonly updatedAt = signal<string>('—');
  readonly errorMsg = signal<string | null>(null);
  readonly loading = signal<boolean>(false);
  readonly hasLoaded = signal<boolean>(false);
  readonly firstLoad = computed<boolean>(() => this.loading() && !this.hasLoaded());
  readonly reloading = signal<boolean>(false);

  /** Conectividad: true=operativo, false=caído, null=conectando. */
  readonly online = computed<boolean | null>(() => {
    if (this.errorMsg()) {
      return false;
    }
    return this.hasLoaded() ? true : null;
  });

  /** Tarjetas KPI (estilo separadores) derivadas del resumen. */
  readonly cards = computed<StatCard[]>(() => {
    const s = this.summary();
    if (!s) {
      return [];
    }
    const { jobs, processor } = s;
    const rateBase = jobs.done + jobs.failed;
    const successRate = rateBase ? (jobs.done / rateBase) * 100 : null;
    return [
      {
        label: 'Alertas generadas',
        value: String(jobs.total),
        tooltip: 'Alertas finalizadas en la ventana (exitosas + fallidas).',
        accent: '',
      },
      {
        label: 'Exitosas',
        value: String(jobs.done),
        tooltip: 'Alertas generadas correctamente (intersección + GIFs + guardado).',
        accent: 'green',
      },
      {
        label: 'Fallidas',
        value: String(jobs.failed),
        tooltip: 'Alertas que terminaron en error (ver desglose por motivo).',
        accent: jobs.failed > 0 ? 'orange' : '',
      },
      {
        label: 'Tasa de éxito',
        value: successRate === null ? '—' : `${successRate.toFixed(0)}%`,
        tooltip: 'Exitosas ÷ (exitosas + fallidas) en la ventana.',
        accent: '',
      },
      {
        label: 'Duración prom.',
        value: formatMs(jobs.avg_duration_ms),
        tooltip: 'Duración media de las alertas generadas con éxito.',
        accent: '',
      },
      {
        label: 'Duración p95',
        value: formatMs(jobs.p95_duration_ms),
        tooltip: 'Percentil 95 de la duración de las alertas exitosas.',
        accent: '',
      },
      {
        label: 'Workers',
        value: String(processor.workers),
        tooltip: 'Workers activos del procesador (último muestreo).',
        accent: '',
      },
      {
        label: 'Pendientes',
        value: String(processor.pending_alerts),
        tooltip: 'Avisos generados que aún no se sincronizaron a la tabla activa.',
        accent: '',
      },
    ];
  });

  /** Desglose de fallos por motivo. */
  readonly failureRows = computed<FailureRow[]>(() => {
    const breakdown = this.summary()?.jobs.failure_breakdown ?? {};
    return Object.entries(breakdown)
      .map(([code, count]) => ({ label: ERROR_CODE_LABELS[code] ?? code, count }))
      .sort((a, b) => b.count - a.count);
  });

  /** Línea de tiempo Exitosas/Fallidas (reusa el builder genérico por "tipo"). */
  readonly activityChart = computed<MetricsChartOptions | null>(() => {
    const rows = this.activity();
    if (!rows.length) {
      return null;
    }
    const lineRows = rows.flatMap((p) => [
      { bucket: p.bucket, job_type: 'Exitosas', count: p.done },
      { bucket: p.bucket, job_type: 'Fallidas', count: p.failed },
    ]);
    return buildLineChart(lineRows, 'count', 'count', 280, (t) => OUTCOME_COLORS[t] ?? '#8e8e8e');
  });

  /** Promedio por etapa (segundos) para la torta de la sección 6. */
  readonly avgStages = computed<Record<string, number>>(() => {
    const j = this.summary()?.jobs;
    if (!j) {
      return {};
    }
    const out: Record<string, number> = {};
    const add = (key: string, ms: number) => {
      if (ms > 0) {
        out[key] = ms / 1000;
      }
    };
    add('intersect', j.avg_intersection_ms);
    add('filter', j.avg_filter_ms);
    add('render', j.avg_render_ms);
    add('persist', j.avg_persist_ms);
    return out;
  });

  readonly avgStageRows = computed<AvgStageRow[]>(() => {
    const j = this.summary()?.jobs;
    if (!j) {
      return [];
    }
    return [
      { label: 'Intersección', value: formatMs(j.avg_intersection_ms) },
      { label: 'Filtrado deptos.', value: formatMs(j.avg_filter_ms) },
      { label: 'Render (GIF)', value: formatMs(j.avg_render_ms) },
      { label: 'Guardado', value: formatMs(j.avg_persist_ms) },
    ];
  });

  readonly hasAvgStages = computed<boolean>(() => Object.keys(this.avgStages()).length > 0);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const seconds = this.refreshSecs();
      this.clearTimer();
      if (seconds > 0) {
        this.intervalId = setInterval(() => void this.refresh(), seconds * 1000);
      }
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
    void this.loadPhenomena();
    void this.refresh(true);
  }

  onWindowChange(event: Event): void {
    this.windowHours.set(this.numberValue(event) as WindowHours);
    void this.refresh(true);
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  onActivityRangeChange(event: Event): void {
    this.activityHours.set(this.numberValue(event) as ActivityHours);
    void this.loadActivity();
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  phenomenonName(code: number): string {
    return this.phenomena().get(code) ?? '';
  }

  errorCodeLabel(code: string | null): string {
    return code ? (ERROR_CODE_LABELS[code] ?? code) : '—';
  }

  formatDuration(ms: number | null): string {
    return ms == null ? '—' : formatMs(ms);
  }

  openJob(job: AlertJobMetric): void {
    this.dialog.open(AlertJobDetailDialogComponent, {
      data: {
        job,
        phenomenon: this.phenomenonName(job.phenomenon_code),
        errorLabel: job.outcome === 'failed' ? this.errorCodeLabel(job.error_code) : null,
      },
      width: '520px',
      autoFocus: false,
    });
  }

  private async refresh(foreground = false): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    if (foreground) {
      this.reloading.set(true);
    }
    const hours = this.windowHours();
    try {
      const [summary, jobs] = await Promise.all([
        firstValueFrom(this.metrics.getSummary(hours)),
        firstValueFrom(this.metrics.getJobs(hours, 200)),
        this.loadActivity(),
      ]);
      this.summary.set(summary);
      this.jobs.set(jobs);
      this.updatedAt.set(new Date().toLocaleTimeString());
      this.errorMsg.set(null);
      this.hasLoaded.set(true);
    } catch (error) {
      this.errorMsg.set(this.describeError(error));
    } finally {
      this.loading.set(false);
      this.reloading.set(false);
    }
  }

  private async loadActivity(): Promise<void> {
    const hours = this.activityHours();
    const bucket = hours <= 48 ? 'hour' : 'day';
    this.activity.set(await firstValueFrom(this.metrics.getJobsHistory(hours, bucket)));
  }

  private async loadPhenomena(): Promise<void> {
    try {
      const list = await firstValueFrom(this.departments.getPhenomena());
      this.phenomena.set(new Map(list.map((p) => [p.code, p.description ?? ''])));
    } catch {
      // Non-fatal: the table just shows codes without names.
    }
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private numberValue(event: Event): number {
    return Number((event.target as HTMLSelectElement).value);
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0
        ? 'el servicio no responde'
        : `el servicio respondió HTTP ${error.status}`;
    }
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
