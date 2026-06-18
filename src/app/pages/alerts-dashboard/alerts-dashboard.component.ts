import { DatePipe, DecimalPipe } from '@angular/common';
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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import type {
  AlertJobMetric,
  AlertsJobHistoryPoint,
  AlertsLayerRun,
  AlertsProcessorSample,
  AlertsSummary,
  RefreshSeconds,
  WindowHours,
} from '../../models/metrics/alerts-metrics.models';
import { AlertsMetricsService } from '../../services/metrics/alerts-metrics.service';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
  readonly accent: '' | 'green' | 'orange' | 'red';
}

interface FailureRow {
  readonly label: string;
  readonly count: number;
}

/** Human labels for the backend `error_code` values. */
const ERROR_CODE_LABELS: Record<string, string> = {
  timeout: 'Tiempo de generación agotado',
  area_too_large: 'Área afectada demasiado grande',
  generation_failed: 'Error de generación',
  unknown: 'Desconocido',
};

function formatMs(ms: number): string {
  if (!ms) {
    return '—';
  }
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/**
 * Panel "Alertas" del shell `/status`. Dueño del estado: mantiene controles y
 * datos en signals, los refresca contra el API de métricas del alerts-service y
 * los reparte a paneles de presentación.
 */
@Component({
  selector: 'app-alerts-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MetricPanelComponent,
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
  private readonly destroyRef = inject(DestroyRef);

  // Controles
  readonly windowHours = signal<WindowHours>(24);
  readonly refreshSecs = signal<RefreshSeconds>(30);

  // Datos
  readonly summary = signal<AlertsSummary | null>(null);
  readonly jobs = signal<readonly AlertJobMetric[]>([]);
  readonly jobsHistory = signal<readonly AlertsJobHistoryPoint[]>([]);
  readonly processorHistory = signal<readonly AlertsProcessorSample[]>([]);
  readonly layers = signal<readonly AlertsLayerRun[]>([]);

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

  /** Tarjetas KPI derivadas del resumen. */
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
        label: 'Trabajos',
        value: String(jobs.total),
        tooltip: 'Trabajos de generación finalizados en la ventana (exitosos + fallidos).',
        accent: '',
      },
      {
        label: 'Exitosos',
        value: String(jobs.done),
        tooltip: 'Avisos generados correctamente (intersección + GIFs + guardado).',
        accent: 'green',
      },
      {
        label: 'Fallidos',
        value: String(jobs.failed),
        tooltip: 'Trabajos que terminaron en error (ver desglose por motivo).',
        accent: jobs.failed > 0 ? 'orange' : '',
      },
      {
        label: 'Tasa de éxito',
        value: successRate === null ? '—' : `${successRate.toFixed(0)}%`,
        tooltip: 'Exitosos ÷ (exitosos + fallidos) en la ventana.',
        accent: '',
      },
      {
        label: 'Duración prom.',
        value: formatMs(jobs.avg_duration_ms),
        tooltip: 'Duración media de los trabajos exitosos.',
        accent: '',
      },
      {
        label: 'Duración p95',
        value: formatMs(jobs.p95_duration_ms),
        tooltip: 'Percentil 95 de la duración de trabajos exitosos.',
        accent: '',
      },
      {
        label: 'En cola',
        value: String(processor.queue_depth),
        tooltip: 'Trabajos esperando en la cola del procesador (último muestreo).',
        accent: processor.queue_depth > 0 ? 'orange' : '',
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
        tooltip: 'Avisos pendientes (generados, aún no sincronizados) en el último muestreo.',
        accent: '',
      },
    ];
  });

  /** Filas del desglose de fallos por motivo. */
  readonly failureRows = computed<FailureRow[]>(() => {
    const breakdown = this.summary()?.jobs.failure_breakdown ?? {};
    return Object.entries(breakdown)
      .map(([code, count]) => ({ label: ERROR_CODE_LABELS[code] ?? code, count }))
      .sort((a, b) => b.count - a.count);
  });

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
    void this.refresh(true);
  }

  onWindowChange(event: Event): void {
    this.windowHours.set(this.numberValue(event) as WindowHours);
    void this.refresh(true);
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  errorCodeLabel(code: string | null): string {
    return code ? (ERROR_CODE_LABELS[code] ?? code) : '—';
  }

  formatDuration(ms: number): string {
    return formatMs(ms);
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
      const [summary, jobs, jobsHistory, processorHistory, layers] = await Promise.all([
        firstValueFrom(this.metrics.getSummary(hours)),
        firstValueFrom(this.metrics.getJobs(hours, 200)),
        firstValueFrom(this.metrics.getJobsHistory(hours, 'hour')),
        firstValueFrom(this.metrics.getProcessorHistory(hours)),
        firstValueFrom(this.metrics.getLayers(20)),
      ]);
      this.summary.set(summary);
      this.jobs.set(jobs);
      this.jobsHistory.set(jobsHistory);
      this.processorHistory.set(processorHistory);
      this.layers.set(layers);
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
