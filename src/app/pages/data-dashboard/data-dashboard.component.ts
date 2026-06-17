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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { DataStatCardsComponent } from '../../components/data-dashboard/data-stat-cards/data-stat-cards.component';
import { DataSyncCyclesTableComponent } from '../../components/data-dashboard/data-sync-cycles-table/data-sync-cycles-table.component';
import { DataSyncStatusTableComponent } from '../../components/data-dashboard/data-sync-status-table/data-sync-status-table.component';
import { RedisInfoCardsComponent } from '../../components/data-dashboard/redis-info-cards/redis-info-cards.component';
import { RedisMemoryTableComponent } from '../../components/data-dashboard/redis-memory-table/redis-memory-table.component';
import { JobTimelineEchartsComponent } from '../../components/dashboard/job-timeline-echarts/job-timeline-echarts.component';
import { MetricChartComponent } from '../../components/dashboard/metric-chart/metric-chart.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import type {
  DataMetricsSummary,
  DataSyncCycle,
  DataSyncHistoryPoint,
  DataSyncStatus,
  RedisInfo,
  RedisMemoryHistoryPoint,
  RedisMemoryResponse,
  SyncBucket,
} from '../../models/metrics/data-metrics.models';
import type { RecentJob } from '../../models/metrics/metrics.models';
import {
  buildMemoryAreaChart,
  buildMemoryBarChart,
  buildSyncErrorsChart,
  buildSyncThroughputChart,
  buildSyncTp10Chart,
} from '../../services/metrics/data-metrics-chart.util';
import { domainLabel } from '../../services/metrics/data-metrics-labels';
import { DataMetricsService } from '../../services/metrics/data-metrics.service';
import type { MetricsChartOptions } from '../../services/metrics/metrics-chart.util';
import { ago, secs } from '../../services/metrics/metrics-format.util';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../services/settings/timezone-settings.service';

type WindowHours = 24 | 168 | 0;
type RefreshSeconds = 0 | 10 | 30 | 60;
type TimelineRange = 6 | 12 | 24 | 48 | 72 | 168 | 'all';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

/** Stable key for a cycle (no DB id) — used for lazy-merge dedup. */
function cycleKey(c: DataSyncCycle): string {
  return `${c.domain}|${c.started_at}|${c.finished_at}`;
}

/** Map a sync cycle to the RecentJob shape the timeline component consumes. */
function cycleAsJob(c: DataSyncCycle, index: number): RecentJob {
  return {
    id: index,
    work_unit_id: null,
    image_id: domainLabel(c.domain),
    data_source_id: c.domain,
    processor_id: null,
    band_id: null,
    job_type: c.domain,
    product_label: domainLabel(c.domain),
    image_timestamp: null,
    outcome: c.errors > 0 ? 'error' : 'success',
    worker_host: null,
    started_at: c.started_at,
    finished_at: c.finished_at,
    retry_count: 0,
    error_message: null,
    download_s: null,
    process_s: null,
    total_s: c.duration_ms / 1000,
    stage_timings: {},
  };
}

/** HH:mm:ss respecting the UTC/local toggle. */
function clock(iso: string, utc: boolean): string {
  const d = new Date(iso);
  const h = String(utc ? d.getUTCHours() : d.getHours()).padStart(2, '0');
  const m = String(utc ? d.getUTCMinutes() : d.getMinutes()).padStart(2, '0');
  const s = String(utc ? d.getUTCSeconds() : d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function tipRow(label: string, value: string): string {
  return (
    `<div class="apx-tip__row"><span class="apx-tip__name">${label}</span>` +
    `<span class="apx-tip__val">${value}</span></div>`
  );
}

/** Resúmenes con viñetas para los tooltips de cada panel (clase `panel__tooltip`
 *  respeta los saltos de línea). Clave: qué muestra · de dónde · cada cuánto. */
const PANEL_TIPS = {
  summary:
    'Estado de un vistazo.\n' +
    '• Memoria y claves: colector de Redis, ~15 min\n' +
    '• Sync (ciclos, fallos): hash sync:status, ~60 s',
  syncStatus:
    'Último ciclo de cada dominio (tabla sync_cycles).\n' +
    '• Tiles S3→Redis (sat/radar/ECMWF/WRF): ~60 s\n' +
    '• Estaciones (SMN): ~5 min · Mapa base: ~7 días\n' +
    '• "descargado" = ítems nuevos del ciclo',
  memory:
    'Qué está llenando Redis.\n' +
    '• SCAN + MEMORY USAGE por prefijo de clave, ~15 min\n' +
    '• Lo llenan tiles (~60 s) y estaciones (~5 min)\n' +
    '• Mapa base (no_cache): escribe S3, ≈ 0 en Redis',
  memoryHistory:
    'Crecimiento de memoria por dominio (área apilada).\n' +
    '• Tabla redis_memory_samples\n' +
    '• 1 punto cada ~15 min · retención 14 días\n' +
    '• Sigue la ventana e intervalo',
  throughput:
    'Ítems descargados por intervalo y dominio.\n' +
    '• Agrega sync_cycles por bucket (hora/día)\n' +
    '• Tiles S3→Redis, obs. del SMN, tiles de mapa base',
  throughput10:
    'Ítems descargados en buckets de 10 minutos (ventana corta).\n' +
    '• "Total" agrega todos los dominios; "Por tipo" abre uno por dominio\n' +
    '• Rango propio (1–12 h o personalizado), independiente de la ventana global',
  errors:
    'Errores por intervalo y dominio.\n' +
    '• Agrega sync_cycles por bucket\n' +
    '• Picos sostenidos = problema persistente (S3, SMN, providers)',
  info:
    'Redis INFO + DBSIZE, ~15 min.\n' +
    '• Fragmentación = RSS ÷ used_memory\n' +
    '• Hit rate = hits ÷ (hits + misses)\n' +
    '• Desalojadas > 0 = descartando datos por memoria',
  cycles:
    'Filas crudas de sync_cycles (más nuevas primero, máx. 100).\n' +
    '• El detalle sin agregar detrás de throughput y errores',
  timeline:
    'Cada ciclo de sync como una barra (inicio → fin), apilado en filas sin solaparse.\n' +
    '• Color por dominio (toggle a resultado); las filas son concurrencia, no workers\n' +
    '• Rango 6h…7d + "todo" con carga perezosa al desplazarte; rueda/arrastre = zoom\n' +
    '• Se carga al cambiar el rango (no en el auto-refresh, para no perder el zoom)',
} as const;

/** "muestreado hace …" para un timestamp ISO, o '' si no hay. */
function stampAgo(iso: string | null | undefined): string {
  return iso ? 'muestreado ' + ago(iso) : '';
}

// Cotas del rango personalizado del throughput de sync a 10 min (en horas).
// Tope bajo (48h = 288 buckets de 10 min) porque es un panel de ventana corta.
const SYNC_TP_CUSTOM_MIN_HOURS = 1;
const SYNC_TP_CUSTOM_MAX_HOURS = 48;
const SYNC_TP_CUSTOM_DEFAULT_HOURS = 12;

/**
 * Panel de estado y memoria del data-service (pestaña "Caché" del shell
 * `/status`). Dueño del estado: mantiene controles y datos en signals, los
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
    DataSyncCyclesTableComponent,
    JobTimelineEchartsComponent,
    MatButtonToggleModule,
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

  /** Textos de los tooltips de cada panel. */
  readonly tips = PANEL_TIPS;

  // Controles
  readonly windowHours = signal<WindowHours>(24);
  readonly bucket = signal<SyncBucket>('hour');
  readonly refreshSecs = signal<RefreshSeconds>(30);
  // Tope de filas de "Ciclos recientes" (crece con "cargar 50 más").
  readonly cyclesLimit = signal<number>(50);

  // Throughput de sync a 10 min: modo Total/Por tipo + rango propio (estilo tiles).
  readonly syncTpMode = signal<'total' | 'byType'>('total');
  readonly syncTpWindowHours = signal<number>(6);
  readonly syncTpCustom = signal<boolean>(false);
  readonly syncTpCustomHours = signal<number>(SYNC_TP_CUSTOM_DEFAULT_HOURS);
  readonly syncTpEffectiveHours = computed<number>(() =>
    this.syncTpCustom() ? this.syncTpCustomHours() : this.syncTpWindowHours(),
  );
  readonly syncTpSelectValue = computed<string>(() =>
    this.syncTpCustom() ? 'custom' : String(this.syncTpWindowHours()),
  );
  protected readonly SYNC_TP_CUSTOM_MIN_HOURS = SYNC_TP_CUSTOM_MIN_HOURS;
  protected readonly SYNC_TP_CUSTOM_MAX_HOURS = SYNC_TP_CUSTOM_MAX_HOURS;

  // Datos
  readonly summary = signal<DataMetricsSummary | null>(null);
  readonly syncStatus = signal<DataSyncStatus | null>(null);
  readonly memory = signal<RedisMemoryResponse | null>(null);
  readonly memoryHistory = signal<readonly RedisMemoryHistoryPoint[]>([]);
  readonly syncHistory = signal<readonly DataSyncHistoryPoint[]>([]);
  readonly info = signal<RedisInfo | null>(null);
  readonly cycles = signal<readonly DataSyncCycle[]>([]);
  /** Datos del throughput de sync a 10 min (ventana propia del panel). */
  readonly syncTp10 = signal<readonly DataSyncHistoryPoint[]>([]);

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

  /** Hay más ciclos por traer si la API devolvió una página completa. */
  readonly cyclesHasMore = computed<boolean>(() => this.cycles().length >= this.cyclesLimit());

  /** Nombres de los dominios de sync; alimentan el tooltip de "Dominios de sync". */
  readonly syncDomainNames = computed<readonly string[]>(
    () => this.syncStatus()?.domains.map((d) => d.domain) ?? [],
  );

  // ── Línea de tiempo de sincronización (carga aparte del auto-refresh) ──────
  readonly timelineRange = signal<TimelineRange>(24);
  readonly timelineCycles = signal<readonly DataSyncCycle[]>([]);
  readonly timelineMaxSpanMs = computed<number | null>(() =>
    this.timelineRange() === 'all' ? SEVEN_DAYS_MS : null,
  );
  readonly timelineReloadKey = signal<number>(0);
  readonly timelineJobs = computed<RecentJob[]>(() =>
    this.timelineCycles().map((c, i) => cycleAsJob(c, i)),
  );
  private readonly cycleByKey = computed(
    () => new Map(this.timelineCycles().map((c) => [cycleKey(c), c])),
  );
  private timelineOldestMs: number | null = null;
  private timelineReachedStart = false;
  private timelineLoadingOlder = false;

  /** Tooltip del timeline: lee el ciclo original por clave (descargados/errores). */
  readonly cycleTooltip = (job: RecentJob): string => {
    const c = this.cycleByKey().get(`${job.job_type}|${job.started_at}|${job.finished_at}`);
    const utc = this.utc;
    const rows =
      tipRow('Inicio', clock(job.started_at, utc)) +
      tipRow('Fin', clock(job.finished_at, utc)) +
      tipRow('Duración', secs(job.total_s)) +
      tipRow('Descargados', c ? c.downloaded.toLocaleString('es-AR') : '—') +
      tipRow('Errores', c ? String(c.errors) : '—') +
      tipRow('Resultado', c && c.errors > 0 ? 'error' : 'ok');
    return `<div class="apx-tip"><div class="apx-tip__title">${job.product_label}</div>${rows}</div>`;
  };

  // ── Marcas de "muestreado hace …" para los paneles que se actualizan lento
  //    (colector de Redis ~15 min, barrido de basemap ~7 días). ──────────────
  readonly summaryStamp = computed(() => stampAgo(this.summary()?.sampled_at));
  readonly memoryStamp = computed(() => stampAgo(this.memory()?.sampled_at));
  readonly infoStamp = computed(() => stampAgo(this.info()?.sampled_at));

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

  readonly syncTp10Options = computed<MetricsChartOptions | null>(() => {
    const rows = this.syncTp10();
    return rows.length ? buildSyncTp10Chart(rows, this.syncTpMode(), this.utc) : null;
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
    void this.loadTimeline();
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

  onSyncTpWindowChange(event: Event): void {
    // 'custom' no es numérico, así que se ramifica antes de cualquier Number().
    const value = this.stringValue(event);
    if (value === 'custom') {
      this.syncTpCustom.set(true);
    } else {
      this.syncTpCustom.set(false);
      this.syncTpWindowHours.set(Number(value));
    }
    void this.loadSyncTp10();
  }

  /** Commit del input personalizado del throughput de sync (Enter / blur). */
  onSyncTpCustomHoursChange(input: HTMLInputElement): void {
    const clamped = this.clampSyncTpCustomHours(input.value);
    input.value = String(clamped);
    this.syncTpCustomHours.set(clamped);
    void this.loadSyncTp10();
  }

  /** Recorta a [MIN, MAX] horas; conserva el último valor válido si la entrada es basura/<MIN. */
  private clampSyncTpCustomHours(raw: string): number {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < SYNC_TP_CUSTOM_MIN_HOURS) {
      return this.syncTpCustomHours();
    }
    return Math.min(n, SYNC_TP_CUSTOM_MAX_HOURS);
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  /** "cargar 50 más" en Ciclos recientes: agranda el tope y recarga los ciclos. */
  async onLoadMoreCycles(): Promise<void> {
    this.cyclesLimit.update((n) => n + 50);
    this.cycles.set(
      await firstValueFrom(
        this.metrics.getSyncCycles(this.windowHours(), undefined, this.cyclesLimit()),
      ),
    );
  }

  // ── Línea de tiempo ──────────────────────────────────────────────────────────

  onTimelineRangeChange(event: Event): void {
    const value = this.stringValue(event);
    this.timelineRange.set(value === 'all' ? 'all' : (Number(value) as TimelineRange));
    void this.loadTimeline();
  }

  /** Carga fresca del timeline (cambio de rango / inicial). Bumpea reloadKey. */
  private async loadTimeline(): Promise<void> {
    const range = this.timelineRange();
    this.timelineReachedStart = false;
    this.timelineLoadingOlder = false;
    try {
      if (range === 'all') {
        const sinceMs = Date.now() - SEVEN_DAYS_MS;
        const cycles = await firstValueFrom(
          this.metrics.getSyncCycles(0, undefined, 0, { since: new Date(sinceMs).toISOString() }),
        );
        this.timelineCycles.set(cycles);
        this.timelineOldestMs = this.oldestFinishedMs(cycles, sinceMs);
      } else {
        this.timelineOldestMs = null;
        this.timelineCycles.set(
          await firstValueFrom(this.metrics.getSyncCycles(range, undefined, 0)),
        );
      }
      this.timelineReloadKey.update((k) => k + 1);
    } catch {
      // El timeline es secundario: si falla, conservamos lo que haya.
    }
  }

  /** Modo "todo": pide ciclos más viejos al desplazarse al borde. */
  async onTimelineLoadOlder(): Promise<void> {
    if (
      this.timelineRange() !== 'all' ||
      this.timelineReachedStart ||
      this.timelineLoadingOlder ||
      this.timelineOldestMs == null
    ) {
      return;
    }
    this.timelineLoadingOlder = true;
    try {
      const oldest = this.timelineOldestMs;
      const older = await firstValueFrom(
        this.metrics.getSyncCycles(0, undefined, 0, {
          since: new Date(oldest - SEVEN_DAYS_MS).toISOString(),
          before: new Date(oldest).toISOString(),
        }),
      );
      if (!older.length) {
        this.timelineReachedStart = true;
        return;
      }
      const byKey = new Map(this.timelineCycles().map((c) => [cycleKey(c), c]));
      for (const c of older) {
        byKey.set(cycleKey(c), c);
      }
      const merged = [...byKey.values()];
      const newOldest = this.oldestFinishedMs(merged, oldest);
      if (newOldest >= oldest) {
        this.timelineReachedStart = true;
        return;
      }
      this.timelineCycles.set(merged);
      this.timelineOldestMs = newOldest;
    } finally {
      this.timelineLoadingOlder = false;
    }
  }

  private oldestFinishedMs(cycles: readonly DataSyncCycle[], fallback: number): number {
    let oldest = Infinity;
    for (const c of cycles) {
      const ms = Date.parse(c.finished_at);
      if (ms < oldest) {
        oldest = ms;
      }
    }
    return Number.isFinite(oldest) ? oldest : fallback;
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
      const [summary, syncStatus, memory, memoryHistory, syncHistory, info, cycles, syncTp10] =
        await Promise.all([
          firstValueFrom(this.metrics.getSummary()),
          firstValueFrom(this.metrics.getSyncStatus()),
          firstValueFrom(this.metrics.getRedisMemory()),
          firstValueFrom(this.metrics.getRedisMemoryHistory(hours)),
          firstValueFrom(this.metrics.getSyncHistory(hours, this.bucket())),
          firstValueFrom(this.metrics.getRedisInfo()),
          firstValueFrom(this.metrics.getSyncCycles(hours, undefined, this.cyclesLimit())),
          firstValueFrom(this.metrics.getSyncHistory(this.syncTpEffectiveHours(), '10min')),
        ]);
      this.summary.set(summary);
      this.syncStatus.set(syncStatus);
      this.memory.set(memory);
      this.memoryHistory.set(memoryHistory);
      this.syncHistory.set(syncHistory);
      this.info.set(info);
      this.cycles.set(cycles);
      this.syncTp10.set(syncTp10);
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

  /** Recarga solo el throughput de sync a 10 min (cambio de su rango propio). */
  private async loadSyncTp10(): Promise<void> {
    this.syncTp10.set(
      await firstValueFrom(this.metrics.getSyncHistory(this.syncTpEffectiveHours(), '10min')),
    );
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
