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
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { InProgressJobsComponent } from '../../components/dashboard/in-progress-jobs/in-progress-jobs.component';
import { QueueDepthsComponent } from '../../components/dashboard/queue-depths/queue-depths.component';
import { JobTypeSummaryTableComponent } from '../../components/dashboard/job-type-summary-table/job-type-summary-table.component';
import { MetricChartComponent } from '../../components/dashboard/metric-chart/metric-chart.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import { MetricStatCardsComponent } from '../../components/dashboard/metric-stat-cards/metric-stat-cards.component';
import { RecentJobsTableComponent } from '../../components/dashboard/recent-jobs-table/recent-jobs-table.component';
import { JobDetailDialogComponent } from '../../components/dashboard/job-detail-dialog/job-detail-dialog.component';
import { JobTypeDetailDialogComponent } from '../../components/dashboard/job-type-detail-dialog/job-type-detail-dialog.component';
import { JobTimelineEchartsComponent } from '../../components/dashboard/job-timeline-echarts/job-timeline-echarts.component';
import { TrendChartsComponent } from '../../components/dashboard/trend-charts/trend-charts.component';
import type {
  Bucket,
  JobOutcome,
  JobTypeSummary,
  LiveStatus,
  RecentJob,
  RefreshSeconds,
  TenMinWindowHours,
  ThroughputBucket,
  TimelineRange,
  TimelineWindowHours,
  TimingSeriesPoint,
  WindowHours,
} from '../../models/metrics/metrics.models';
import {
  buildLineChart,
  buildTotalThroughputChart,
  buildTypeColorMap,
  type MetricsChartOptions,
} from '../../services/metrics/metrics-chart.util';
import { OUTCOME_LABELS, prod } from '../../services/metrics/metrics-labels.constants';
import { MetricsService } from '../../services/metrics/metrics.service';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../services/settings/timezone-settings.service';

const JOBS_PAGE = 50;
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

// Cotas del rango personalizado del panel "por tipo de trabajo" (en horas).
// El backend acepta cualquier `hours` >= 0; acá limitamos a [1, 720] (30 días)
// para evitar entradas absurdas. "todo" (0) ya cubre el histórico completo.
const SUMMARY_CUSTOM_MIN_HOURS = 1;
const SUMMARY_CUSTOM_MAX_HOURS = 720;
const SUMMARY_CUSTOM_DEFAULT_HOURS = 48;

// Cotas del rango personalizado del panel "throughput · cada 10 min" (en horas).
// El tope se mantiene bajo (48h = 288 buckets de 10 min) porque es un panel de
// ventana corta; los presets llegan hasta 12h.
const TP_CUSTOM_MIN_HOURS = 1;
const TP_CUSTOM_MAX_HOURS = 48;
const TP_CUSTOM_DEFAULT_HOURS = 12;

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
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MetricPanelComponent,
    MetricStatCardsComponent,
    QueueDepthsComponent,
    InProgressJobsComponent,
    TrendChartsComponent,
    MetricChartComponent,
    JobTypeSummaryTableComponent,
    RecentJobsTableComponent,
    JobTimelineEchartsComponent,
  ],
  // Tooltips instantáneos solo en el dashboard (no afecta al resto de la app).
  providers: [
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 0, hideDelay: 0, touchendHideDelay: 1000 },
    },
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly metrics = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly timezone = inject(TimezoneSettingsService);

  // Controles
  readonly windowHours = signal<WindowHours>(24);
  readonly bucket = signal<Bucket>('hour');
  readonly refreshSecs = signal<RefreshSeconds>(30);
  readonly tpWindowHours = signal<TenMinWindowHours>(6);
  /** Modo "personalizado" del rango de throughput: muestra un input de horas a medida. */
  readonly tpCustom = signal<boolean>(false);
  /** Valor del input personalizado (horas), usado solo cuando tpCustom() es true. */
  readonly tpCustomHours = signal<number>(TP_CUSTOM_DEFAULT_HOURS);
  /** Horas efectivas que se envían al API de throughput: preset fijo o valor personalizado. */
  readonly tpEffectiveHours = computed<number>(() =>
    this.tpCustom() ? this.tpCustomHours() : this.tpWindowHours(),
  );
  /** Valor que muestra el <select> de throughput ('custom' en modo personalizado). */
  readonly tpSelectValue = computed<string>(() =>
    this.tpCustom() ? 'custom' : String(this.tpWindowHours()),
  );
  protected readonly TP_CUSTOM_MIN_HOURS = TP_CUSTOM_MIN_HOURS;
  protected readonly TP_CUSTOM_MAX_HOURS = TP_CUSTOM_MAX_HOURS;
  /** Ventana propia de la tabla "por tipo de trabajo", independiente de la global. */
  readonly summaryTableWindowHours = signal<WindowHours>(24);
  /** Modo "personalizado" del rango del panel: muestra un input de horas a medida. */
  readonly summaryTableCustom = signal<boolean>(false);
  /** Valor del input personalizado (horas), usado solo cuando summaryTableCustom() es true. */
  readonly summaryTableCustomHours = signal<number>(SUMMARY_CUSTOM_DEFAULT_HOURS);
  /** Horas efectivas que se envían al API: preset fijo o valor personalizado. */
  readonly summaryTableEffectiveHours = computed<number>(() =>
    this.summaryTableCustom() ? this.summaryTableCustomHours() : this.summaryTableWindowHours(),
  );
  /** Valor que muestra el <select> del panel ('custom' en modo personalizado). */
  readonly summaryTableSelectValue = computed<string>(() =>
    this.summaryTableCustom() ? 'custom' : String(this.summaryTableWindowHours()),
  );
  // Cotas expuestas al template para los atributos min/max del input.
  protected readonly SUMMARY_CUSTOM_MIN_HOURS = SUMMARY_CUSTOM_MIN_HOURS;
  protected readonly SUMMARY_CUSTOM_MAX_HOURS = SUMMARY_CUSTOM_MAX_HOURS;
  /** Modo del panel de throughput: 'total' (línea agregada, por defecto) o 'byType' (desglose). */
  readonly tpMode = signal<'total' | 'byType'>('total');

  // Filtros de la tabla de trabajos recientes ('' = todos). Se aplican del lado
  // del servidor vía getJobs (que ya acepta type/outcome).
  readonly outcomeFilter = signal<JobOutcome | ''>('');
  readonly typeFilter = signal<string>('');

  /** Opciones del filtro de resultado (clave del API + etiqueta en español). */
  readonly outcomeOptions: ReadonlyArray<{ value: string; label: string }> = Object.entries(
    OUTCOME_LABELS,
  ).map(([value, label]) => ({ value, label }));

  /** Opciones del filtro de tipo, derivadas del resumen (mismas claves del backend). */
  readonly jobTypeOptions = computed<ReadonlyArray<{ value: string; label: string }>>(() =>
    this.summary().map((entry) => ({
      value: entry.job_type,
      label: prod(entry.product_label ?? entry.job_type),
    })),
  );

  // Datos
  readonly summary = signal<readonly JobTypeSummary[]>([]);
  /** Datos de la tabla "por tipo de trabajo" (ventana propia del panel). */
  readonly summaryTable = signal<readonly JobTypeSummary[]>([]);
  readonly jobs = signal<readonly RecentJob[]>([]);
  readonly jobsHasMore = signal<boolean>(false);
  readonly live = signal<LiveStatus | null>(null);
  readonly timing = signal<readonly TimingSeriesPoint[]>([]);
  readonly throughput = signal<readonly ThroughputBucket[]>([]);
  private readonly tp10 = signal<readonly ThroughputBucket[]>([]);

  // Línea de tiempo de unidades (`/api/timeline`, formato compacto). Rangos fijos
  // (6h…7d) cargan todo el rango de una; 'all' es perezoso: arranca en la última
  // semana y carga semanas anteriores al desplazarte, con la vista acotada a 7 días.
  readonly timelineRange = signal<TimelineRange>(24);
  readonly timelineJobs = signal<readonly RecentJob[]>([]);
  /** Tope de la ventana visible en modo 'all' (7 días); null en rangos fijos. */
  readonly timelineMaxSpanMs = computed<number | null>(() =>
    this.timelineRange() === 'all' ? SEVEN_DAYS_MS : null,
  );
  /** Cambia en cada carga fresca (cambio de rango); el componente preserva la vista en appends. */
  readonly timelineReloadKey = signal(0);
  /** Carga fresca de la línea de tiempo en curso (estado propio del panel). */
  readonly timelineLoading = signal<boolean>(false);
  /** Error de la última carga de la línea de tiempo; no afecta al resto del panel. */
  readonly timelineError = signal<string | null>(null);
  /** Muestra el gráfico salvo en la primera carga o si falló sin datos previos. */
  readonly timelineShowChart = computed<boolean>(
    () => this.timelineJobs().length > 0 || (!this.timelineLoading() && !this.timelineError()),
  );
  // Estado del modo perezoso 'all'.
  private timelineOldestMs: number | null = null;
  private timelineReachedStart = false;
  private timelineLoadingOlder = false;
  // Secuencia de cargas: descarta respuestas de una carga ya reemplazada.
  private timelineSeq = 0;

  readonly updatedAt = signal<string>('—');
  readonly errorMsg = signal<string | null>(null);

  // Estado de carga: `loading` indica un refresco en curso; `hasLoaded`, que ya
  // se completó al menos una carga con éxito. `firstLoad` es la primera carga
  // (aún sin datos): muestra un spinner. Los refrescos en segundo plano NO
  // vacían la vista — los datos previos siguen visibles hasta que llegan los
  // nuevos o falla (en cuyo caso se conservan y aparece el banner de error).
  readonly loading = signal<boolean>(false);
  readonly hasLoaded = signal<boolean>(false);
  readonly firstLoad = computed<boolean>(() => this.loading() && !this.hasLoaded());
  // Recarga "en primer plano" (cambio de ventana por el usuario): atenúa los
  // paneles y muestra un spinner encima mientras llegan los datos. NO se activa
  // en el auto-refresco de fondo, que mantiene la vista intacta.
  readonly reloading = signal<boolean>(false);

  /** Conectividad con el servicio de métricas: true=operativo, false=caído, null=conectando. */
  readonly online = computed<boolean | null>(() => {
    if (this.errorMsg()) {
      return false;
    }
    return this.hasLoaded() ? true : null;
  });

  /** Gráfico de throughput de 10 min (null cuando no hay datos en el rango). */
  readonly tp10Options = computed<MetricsChartOptions | null>(() => {
    const rows = this.tp10();
    if (!rows.length) {
      return null;
    }
    const utc = this.timezone.mode() === TIMEZONE_MODES.UTC;
    if (this.tpMode() === 'total') {
      return buildTotalThroughputChart(rows, 260, utc);
    }
    // Mapa local: este panel es un dataset aparte (bucket de 10 min), así que
    // sus colores quedan únicos dentro del gráfico; la paridad exacta con el
    // panel de tendencias es best-effort (datasets y orden distintos).
    const colorFor = buildTypeColorMap(rows.map((row) => row.job_type));
    return buildLineChart(rows, 'count', 'count', 260, colorFor, utc);
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
    void this.refresh(true);
  }

  // ── Manejadores de controles ────────────────────────────────────────────

  onWindowChange(event: Event): void {
    this.windowHours.set(this.numberValue(event) as WindowHours);
    // Recarga en primer plano: el rango "todo" puede tardar, así que se muestra
    // el spinner sobre los paneles atenuados.
    void this.refresh(false, true);
  }

  onBucketChange(event: Event): void {
    this.bucket.set(this.stringValue(event) as Bucket);
    void this.loadCharts();
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(this.numberValue(event) as RefreshSeconds);
  }

  onTpWindowChange(event: Event): void {
    // 'custom' no es numérico, así que se ramifica antes de cualquier Number().
    const value = this.stringValue(event);
    if (value === 'custom') {
      this.tpCustom.set(true); // revela el input; carga con las horas personalizadas
    } else {
      this.tpCustom.set(false);
      this.tpWindowHours.set(Number(value) as TenMinWindowHours);
    }
    void this.loadTp10();
  }

  /** Commit del input personalizado de throughput (Enter / blur): valida, recorta y recarga. */
  onTpCustomHoursChange(input: HTMLInputElement): void {
    const clamped = this.clampTpCustomHours(input.value);
    // Reescribe el campo para que nunca quede mostrando un valor inválido o fuera de rango.
    input.value = String(clamped);
    this.tpCustomHours.set(clamped);
    void this.loadTp10();
  }

  /** Recorta a [MIN, MAX] horas; conserva el último valor válido si la entrada es basura/<MIN. */
  private clampTpCustomHours(raw: string): number {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < TP_CUSTOM_MIN_HOURS) {
      return this.tpCustomHours();
    }
    return Math.min(n, TP_CUSTOM_MAX_HOURS);
  }

  onSummaryTableWindowChange(event: Event): void {
    // El valor del <select> es string: 'custom' no es numérico, así que se
    // ramifica antes de cualquier Number() (numberValue daría NaN).
    const value = this.stringValue(event);
    if (value === 'custom') {
      this.summaryTableCustom.set(true); // revela el input; carga con las horas personalizadas
    } else {
      this.summaryTableCustom.set(false);
      this.summaryTableWindowHours.set(Number(value) as WindowHours);
    }
    void this.loadSummaryTable();
  }

  /** Commit del input personalizado (Enter / blur): valida, recorta y recarga. */
  onSummaryTableCustomHoursChange(input: HTMLInputElement): void {
    const clamped = this.clampSummaryCustomHours(input.value);
    // Reescribe el campo para que nunca quede mostrando un valor inválido o
    // fuera de rango aunque la señal no cambie (mismo enfoque que el input de
    // precisión en general-settings).
    input.value = String(clamped);
    this.summaryTableCustomHours.set(clamped);
    void this.loadSummaryTable();
  }

  /** Recorta a [MIN, MAX] horas; conserva el último valor válido si la entrada es basura/<MIN. */
  private clampSummaryCustomHours(raw: string): number {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < SUMMARY_CUSTOM_MIN_HOURS) {
      return this.summaryTableCustomHours();
    }
    return Math.min(n, SUMMARY_CUSTOM_MAX_HOURS);
  }

  onTimelineWindowChange(event: Event): void {
    const value = this.stringValue(event);
    this.timelineRange.set(value === 'all' ? 'all' : (Number(value) as TimelineWindowHours));
    void this.loadTimeline();
  }

  /**
   * Click en una barra de la línea de tiempo: abre el detalle de ese trabajo. La
   * línea de tiempo trae sólo los campos que dibuja, así que el registro completo
   * se pide por id; si falla, se abre igual con lo que hay.
   */
  async onTimelineJobClick(job: RecentJob): Promise<void> {
    let full = job;
    try {
      full = await firstValueFrom(this.metrics.getJob(job.id));
    } catch {
      // Detalle parcial antes que un clic sin respuesta.
    }
    this.dialog.open(JobDetailDialogComponent, { data: full, width: '560px', autoFocus: false });
  }

  /** Modo 'all': el componente pide datos más viejos al desplazarse al borde. */
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
    const seq = this.timelineSeq;
    try {
      const oldest = this.timelineOldestMs;
      const older = await firstValueFrom(
        this.metrics.getTimeline({
          since: new Date(oldest - SEVEN_DAYS_MS).toISOString(),
          before: new Date(oldest).toISOString(),
        }),
      );
      if (seq !== this.timelineSeq) {
        return; // una carga fresca (cambio de rango) reemplazó los datos
      }
      if (!older.length) {
        this.timelineReachedStart = true;
        return;
      }
      // Merge sin duplicar (por id); el componente preserva la vista (mismo reloadKey).
      const byId = new Map(this.timelineJobs().map((job) => [job.id, job]));
      for (const job of older) {
        byId.set(job.id, job);
      }
      const merged = [...byId.values()];
      const newOldest = this.oldestFinishedMs(merged, oldest);
      if (newOldest >= oldest) {
        // El chunk no trajo nada más viejo que el borde (solo el límite ya cargado):
        // llegamos al comienzo. Evita re-pedir el mismo tramo en bucle.
        this.timelineReachedStart = true;
        return;
      }
      this.timelineJobs.set(merged);
      this.timelineOldestMs = newOldest;
    } finally {
      this.timelineLoadingOlder = false;
    }
  }

  onOutcomeFilterChange(event: Event): void {
    this.outcomeFilter.set(this.stringValue(event) as JobOutcome | '');
    void this.loadJobs(true);
  }

  onTypeFilterChange(event: Event): void {
    this.typeFilter.set(this.stringValue(event));
    void this.loadJobs(true);
  }

  /** Drill-down desde el resumen: abre el detalle completo de ese tipo. */
  onSummaryTypeClick(jobType: string): void {
    const entry = this.summaryTable().find((item) => item.job_type === jobType);
    if (!entry) {
      return;
    }
    this.dialog.open(JobTypeDetailDialogComponent, {
      data: entry,
      width: '600px',
      panelClass: 'jtd-dialog',
      autoFocus: false,
    });
  }

  onLoadMore(): void {
    void this.loadJobs(false);
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  // `includeTimeline` solo se activa en la carga inicial, el refresco manual y al
  // cambiar el rango: el auto-refresco NO recarga la línea de tiempo para no
  // resetear el zoom/pan que el usuario haya hecho. La línea de tiempo se pide
  // aparte, al terminar el resto: es la respuesta más pesada (miles de filas) y
  // dentro del Promise.all retenía todo el panel y competía por ancho de banda y
  // CPU del API con los paneles livianos. Su panel muestra su propia carga/error.
  private async refresh(includeTimeline = false, foreground = false): Promise<void> {
    if (this.loading()) {
      return; // evita refrescos solapados disparados por el intervalo
    }
    this.loading.set(true);
    if (foreground) {
      this.reloading.set(true);
    }
    if (includeTimeline) {
      this.timelineLoading.set(true); // el panel muestra "cargando" desde ya
    }
    try {
      await Promise.all([
        this.loadSummaries(),
        this.loadJobs(true),
        this.loadCharts(),
        this.loadLive(),
        this.loadTp10(),
      ]);
      this.updatedAt.set(new Date().toLocaleTimeString());
      this.errorMsg.set(null);
      this.hasLoaded.set(true);
    } catch (error) {
      // Conserva los datos ya cargados; solo muestra el banner de error.
      this.errorMsg.set(this.describeError(error));
    } finally {
      this.loading.set(false);
      this.reloading.set(false);
    }
    if (includeTimeline) {
      void this.loadTimeline();
    }
  }

  // Resumen global + tabla "por tipo de trabajo". Si ambas usan la misma
  // ventana, una sola consulta alimenta a las dos (es el endpoint más costoso).
  private async loadSummaries(): Promise<void> {
    const hours = this.windowHours();
    if (this.summaryTableEffectiveHours() !== hours) {
      await Promise.all([this.loadSummary(hours), this.loadSummaryTable()]);
      return;
    }
    const summary = await firstValueFrom(this.metrics.getSummary(hours));
    this.summary.set(summary);
    this.summaryTable.set(summary);
  }

  private async loadSummary(hours: number): Promise<void> {
    this.summary.set(await firstValueFrom(this.metrics.getSummary(hours)));
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
    const type = this.typeFilter() || undefined;
    const outcome = this.outcomeFilter() || undefined;
    if (reset) {
      const limit = Math.max(JOBS_PAGE, this.jobs().length);
      const page = await firstValueFrom(this.metrics.getJobs({ limit, offset: 0, type, outcome }));
      this.jobs.set(page);
      this.jobsHasMore.set(page.length >= JOBS_PAGE);
      return;
    }
    const page = await firstValueFrom(
      this.metrics.getJobs({ limit: JOBS_PAGE, offset: this.jobs().length, type, outcome }),
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
    this.tp10.set(await firstValueFrom(this.metrics.getThroughput('10min', this.tpEffectiveHours())));
  }

  private async loadSummaryTable(): Promise<void> {
    this.summaryTable.set(
      await firstValueFrom(this.metrics.getSummary(this.summaryTableEffectiveHours())),
    );
  }

  // Carga "fresca" de la línea de tiempo (cambio de rango / inicial / refresco
  // manual). Bumpea `timelineReloadKey` para que el componente reencuadre. Nunca
  // lanza: un fallo queda en `timelineError` y conserva los datos previos. Si
  // otra carga la reemplazó mientras tanto (cambio de rango), se descarta.
  private async loadTimeline(): Promise<void> {
    const seq = ++this.timelineSeq;
    this.timelineReachedStart = false;
    this.timelineLoadingOlder = false;
    this.timelineLoading.set(true);
    try {
      const { jobs, oldestMs } = await this.fetchTimeline(this.timelineRange());
      if (seq !== this.timelineSeq) {
        return;
      }
      this.timelineJobs.set(jobs);
      this.timelineOldestMs = oldestMs;
      this.timelineError.set(null);
      this.timelineReloadKey.update((key) => key + 1);
    } catch (error) {
      if (seq === this.timelineSeq) {
        this.timelineError.set(this.describeError(error));
      }
    } finally {
      if (seq === this.timelineSeq) {
        this.timelineLoading.set(false);
      }
    }
  }

  // Rangos fijos traen toda la ventana; 'all' arranca en la última semana.
  private async fetchTimeline(
    range: TimelineRange,
  ): Promise<{ jobs: readonly RecentJob[]; oldestMs: number | null }> {
    if (range !== 'all') {
      const jobs = await firstValueFrom(this.metrics.getTimeline({ hours: range }));
      return { jobs, oldestMs: null };
    }
    const sinceMs = Date.now() - SEVEN_DAYS_MS;
    const jobs = await firstValueFrom(
      this.metrics.getTimeline({ since: new Date(sinceMs).toISOString() }),
    );
    return { jobs, oldestMs: this.oldestFinishedMs(jobs, sinceMs) };
  }

  /** El finished_at más viejo (ms) de un conjunto; `fallback` si está vacío. */
  private oldestFinishedMs(jobs: readonly RecentJob[], fallback: number): number {
    let oldest = Infinity;
    for (const job of jobs) {
      const ms = Date.parse(job.finished_at);
      if (ms < oldest) {
        oldest = ms;
      }
    }
    return Number.isFinite(oldest) ? oldest : fallback;
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
    if (error instanceof HttpErrorResponse) {
      // status 0 = inalcanzable (servicio caído / conexión rechazada / CORS).
      return error.status === 0
        ? 'el servicio no responde'
        : `el servicio respondió HTTP ${error.status}`;
    }
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
