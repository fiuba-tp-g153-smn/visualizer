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

import { BasemapProvidersTableComponent } from '../../components/data-dashboard/basemap-providers-table/basemap-providers-table.component';
import { DataStatCardsComponent } from '../../components/data-dashboard/data-stat-cards/data-stat-cards.component';
import { DataSyncCyclesTableComponent } from '../../components/data-dashboard/data-sync-cycles-table/data-sync-cycles-table.component';
import { DataSyncStatusTableComponent } from '../../components/data-dashboard/data-sync-status-table/data-sync-status-table.component';
import { RedisInfoCardsComponent } from '../../components/data-dashboard/redis-info-cards/redis-info-cards.component';
import { RedisMemoryTableComponent } from '../../components/data-dashboard/redis-memory-table/redis-memory-table.component';
import { MetricChartComponent } from '../../components/dashboard/metric-chart/metric-chart.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import type {
  BasemapProviderStatus,
  DataMetricsSummary,
  DataSyncCycle,
  DataSyncHistoryPoint,
  DataSyncStatus,
  RedisInfo,
  RedisMemoryHistoryPoint,
  RedisMemoryResponse,
  SyncBucket,
} from '../../models/metrics/data-metrics.models';
import {
  buildMemoryAreaChart,
  buildMemoryBarChart,
  buildSyncErrorsChart,
  buildSyncThroughputChart,
} from '../../services/metrics/data-metrics-chart.util';
import { DataMetricsService } from '../../services/metrics/data-metrics.service';
import type { MetricsChartOptions } from '../../services/metrics/metrics-chart.util';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../services/settings/timezone-settings.service';

type WindowHours = 24 | 168 | 0;
type RefreshSeconds = 0 | 10 | 30 | 60;

/**
 * Panel de estado y memoria del data-service (pestaña "Servicio de datos" del
 * shell `/status`). Dueño del estado: mantiene controles y datos en signals, los
 * refresca contra el API `/metrics` del data-service y los reparte a componentes
 * de presentación.
 */
@Component({
  selector: 'app-data-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MetricPanelComponent,
    MetricChartComponent,
    DataStatCardsComponent,
    DataSyncStatusTableComponent,
    RedisMemoryTableComponent,
    RedisInfoCardsComponent,
    BasemapProvidersTableComponent,
    DataSyncCyclesTableComponent,
  ],
  providers: [
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 0, hideDelay: 0, touchendHideDelay: 1000 },
    },
  ],
  templateUrl: './data-dashboard.component.html',
  styleUrl: './data-dashboard.component.scss',
})
export class DataDashboardComponent {
  private readonly metrics = inject(DataMetricsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timezone = inject(TimezoneSettingsService);

  // Controles
  readonly windowHours = signal<WindowHours>(168);
  readonly bucket = signal<SyncBucket>('hour');
  readonly refreshSecs = signal<RefreshSeconds>(30);

  // Datos
  readonly summary = signal<DataMetricsSummary | null>(null);
  readonly syncStatus = signal<DataSyncStatus | null>(null);
  readonly memory = signal<RedisMemoryResponse | null>(null);
  readonly memoryHistory = signal<readonly RedisMemoryHistoryPoint[]>([]);
  readonly syncHistory = signal<readonly DataSyncHistoryPoint[]>([]);
  readonly info = signal<RedisInfo | null>(null);
  readonly providers = signal<readonly BasemapProviderStatus[]>([]);
  readonly cycles = signal<readonly DataSyncCycle[]>([]);

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

  private get utc(): boolean {
    return this.timezone.mode() === TIMEZONE_MODES.UTC;
  }

  // ── Opciones de gráficos ──────────────────────────────────────────────────

  readonly memoryBarOptions = computed<MetricsChartOptions | null>(() => {
    const mem = this.memory();
    return mem && mem.domains.length ? buildMemoryBarChart(mem.domains) : null;
  });

  readonly memoryAreaOptions = computed<MetricsChartOptions | null>(() => {
    const rows = this.memoryHistory();
    return rows.length ? buildMemoryAreaChart(rows, this.utc) : null;
  });

  readonly throughputOptions = computed<MetricsChartOptions | null>(() => {
    const rows = this.syncHistory();
    return rows.length ? buildSyncThroughputChart(rows, this.utc) : null;
  });

  readonly errorsOptions = computed<MetricsChartOptions | null>(() => {
    const rows = this.syncHistory();
    return rows.length ? buildSyncErrorsChart(rows, this.utc) : null;
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
    void this.refresh();
  }

  // ── Controles ──────────────────────────────────────────────────────────────

  onWindowChange(event: Event): void {
    this.windowHours.set(this.numberValue(event) as WindowHours);
    void this.refresh(true);
  }

  onBucketChange(event: Event): void {
    this.bucket.set(this.stringValue(event) as SyncBucket);
    void this.refresh(true);
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────

  private async refresh(foreground = false): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    if (foreground) {
      this.reloading.set(true);
    }
    try {
      const hours = this.windowHours();
      const [summary, syncStatus, memory, memoryHistory, syncHistory, info, providers, cycles] =
        await Promise.all([
          firstValueFrom(this.metrics.getSummary()),
          firstValueFrom(this.metrics.getSyncStatus()),
          firstValueFrom(this.metrics.getRedisMemory()),
          firstValueFrom(this.metrics.getRedisMemoryHistory(hours)),
          firstValueFrom(this.metrics.getSyncHistory(hours, this.bucket())),
          firstValueFrom(this.metrics.getRedisInfo()),
          firstValueFrom(this.metrics.getBasemapProviders()),
          firstValueFrom(this.metrics.getSyncCycles(hours, undefined, 100)),
        ]);
      this.summary.set(summary);
      this.syncStatus.set(syncStatus);
      this.memory.set(memory);
      this.memoryHistory.set(memoryHistory);
      this.syncHistory.set(syncHistory);
      this.info.set(info);
      this.providers.set(providers);
      this.cycles.set(cycles);
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (error instanceof HttpErrorResponse) {
      return error.status === 0
        ? 'el servicio no responde'
        : `el servicio respondió HTTP ${error.status}`;
    }
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
