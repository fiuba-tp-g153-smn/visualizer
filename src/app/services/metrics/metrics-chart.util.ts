import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import type {
  StageTimings,
  ThroughputBucket,
  TimingSeriesPoint,
} from '../../models/metrics/metrics.models';
import { fmtBucket, secs } from './metrics-format.util';
import { stageLabel } from './metrics-labels.constants';

export interface MetricsChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  colors: string[];
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  markers: ApexMarkers;
}

export interface StagePieOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
}

const GRID_COLOR = '#e3e3e6';
export const LABEL_COLOR = '#5f6368';
const DEFAULT_HEIGHT = 240;
const NETWORK_COLOR = '#90a4ae';

const TYPE_PALETTE: readonly string[] = [
  '#0090d0',
  '#2e9b51',
  '#e0a200',
  '#e8702a',
  '#d23b4e',
  '#9b5bbd',
  '#1f9aa0',
  '#6b8e23',
  '#c2569b',
  '#3b6fb5',
  '#b5892a',
  '#4aa3df',
  '#7e57c2',
  '#00838f',
  '#558b2f',
  '#ad1457',
  '#5d4037',
  '#0277bd',
  '#ef6c00',
  '#9e9d24',
  '#00acc1',
  '#8e24aa',
  '#43a047',
  '#f4511e',
  '#3949ab',
  '#c2185b',
  '#00897b',
  '#f9a825',
  '#6d4c41',
  '#546e7a',
];

const STAGE_COLORS: Readonly<Record<string, string>> = {
  read: '#8e8e8e',
  load: '#8e8e8e',
  aggregate: '#9b5bbd',
  georef: '#0090d0',
  extract: '#9b5bbd',
  mapping: '#1f9aa0',
  brightness_temp: '#1f9aa0',
  reproject: '#178a8c',
  rgba: '#2e9b51',
  cog: '#e8702a',
  geotiff: '#cf5f1e',
  prewarp: '#c79a1e',
  secondary_cog: '#d9b400',
  geojson: '#2e9b51',
  tiling: '#d23b4e',
  upload: '#a31626',
  list: '#5b6bbd', // ECMWF producer existence-check — indigo, distinct from georef/reproject
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function typeColor(jobType: string): string {
  return TYPE_PALETTE[hashString(jobType) % TYPE_PALETTE.length];
}

export function stageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? '#8e8e8e';
}

function shade(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    return hex;
  }
  const factor = Math.max(0, 1 - amount);
  const byte = (component: string): string =>
    Math.round(parseInt(component, 16) * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(match[1])}${byte(match[2])}${byte(match[3])}`;
}

export function buildTypeColorMap(types: readonly string[]): (type: string) => string {
  const unique = [...new Set(types)].sort();
  const map = new Map<string, string>();
  unique.forEach((type, index) => {
    const base = TYPE_PALETTE[index % TYPE_PALETTE.length];
    const cycle = Math.floor(index / TYPE_PALETTE.length);
    map.set(type, cycle === 0 ? base : shade(base, cycle * 0.18));
  });
  return (type) => map.get(type) ?? typeColor(type);
}

// ── Pivot ──────────────────────────────────────────────────────────────────

export interface PivotResult {
  readonly buckets: string[];
  readonly types: string[];
  at(bucket: string, type: string): number | null;
}

export function pivot(
  rows: ReadonlyArray<{ bucket: string; job_type: string }>,
  valueKey: string,
): PivotResult {
  const buckets = [...new Set(rows.map((row) => row.bucket))].sort();
  const types = [...new Set(rows.map((row) => row.job_type))].sort();
  const cell = new Map<string, number | null>();
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[valueKey];
    cell.set(row.bucket + '|' + row.job_type, typeof value === 'number' ? value : null);
  }
  return {
    buckets,
    types,
    at: (bucket, type) => cell.get(bucket + '|' + type) ?? null,
  };
}

// ── Formatters ───────────────────────────────────────────────────────────────

type ValueFormatter = (value: number | null) => string;

const secsFormatter: ValueFormatter = (value) => (value == null ? '' : secs(value));
const countFormatter: ValueFormatter = (value) => (value == null ? '' : String(Math.round(value)));

// ── Shared option fragments ──────────────────────────────────────────────────

function baseChart(type: ApexChart['type'], stacked: boolean, height: number): ApexChart {
  return {
    type,
    height,
    stacked,
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
    fontFamily: 'inherit',
    parentHeightOffset: 0,
  };
}

function categoryXAxis(categories: string[]): ApexXAxis {
  return {
    categories,
    labels: {
      rotate: 0,
      hideOverlappingLabels: true,
      style: { colors: LABEL_COLOR, fontSize: '11px' },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
  };
}

function valueYAxis(formatter: ValueFormatter): ApexYAxis {
  return {
    min: 0,
    forceNiceScale: true,
    labels: { formatter, style: { colors: LABEL_COLOR, fontSize: '11px' } },
  };
}

function baseLegend(): ApexLegend {
  return {
    position: 'bottom',
    fontSize: '11px',
    labels: { colors: LABEL_COLOR },
    markers: { size: 6 },
  };
}

function baseGrid(): ApexGrid {
  return { borderColor: GRID_COLOR, padding: { left: 8, right: 12, top: 0, bottom: 0 } };
}

function baseTooltip(formatter: ValueFormatter): ApexTooltip {
  return { theme: 'light', shared: true, intersect: false, y: { formatter } };
}

/** Contexto que ApexCharts pasa a un tooltip `custom` (tipado para evitar `any`). */
interface CustomTooltipContext {
  readonly series: ReadonlyArray<ReadonlyArray<number | null>>;
  readonly dataPointIndex: number;
  readonly w: {
    readonly globals: {
      readonly seriesNames: readonly string[];
      readonly colors: readonly string[];
      readonly labels: ReadonlyArray<string | number>;
    };
  };
}

/** Arma el HTML del tooltip de conteos: una fila por tipo + un total acumulado. */
function renderCountTooltip(context: CustomTooltipContext): string {
  const { series, dataPointIndex, w } = context;
  const { seriesNames, colors, labels } = w.globals;

  let total = 0;
  const rows: string[] = [];
  for (let i = 0; i < series.length; i++) {
    const value = series[i]?.[dataPointIndex];
    const count = typeof value === 'number' ? value : 0;
    total += count;
    if (count > 0) {
      rows.push(
        `<div class="apx-tip__row">` +
          `<span class="apx-tip__dot" style="background:${colors[i]}"></span>` +
          `<span class="apx-tip__name">${seriesNames[i]}</span>` +
          `<span class="apx-tip__val">${Math.round(count)}</span>` +
          `</div>`,
      );
    }
  }

  const label = labels?.[dataPointIndex];
  const title = label == null ? '' : `<div class="apx-tip__title">${label}</div>`;
  const totalRow =
    `<div class="apx-tip__row apx-tip__total">` +
    `<span class="apx-tip__name">Total</span>` +
    `<span class="apx-tip__val">${Math.round(total)}</span>` +
    `</div>`;
  return `<div class="apx-tip">${title}${rows.join('')}${totalRow}</div>`;
}

/**
 * Tooltip de conteos con total acumulado: muestra el conteo de cada tipo (con
 * valor > 0) y, destacado al pie, la suma de todos los tipos en ese intervalo.
 */
function totalCountTooltip(): ApexTooltip {
  return {
    shared: true,
    intersect: false,
    custom: (context: CustomTooltipContext) => renderCountTooltip(context),
  };
}

/**
 * Marcadores para puntos aislados de un gráfico de líneas: un valor no nulo cuyos
 * vecinos (anterior y siguiente) son nulos o inexistentes. Sin segmento que dibujar,
 * ApexCharts dejaría el dato invisible; lo mostramos como un círculo del color de su
 * serie. `size: 0` mantiene ocultos el resto de los marcadores.
 */
export function isolatedPointMarkers(
  series: ReadonlyArray<{ data: ReadonlyArray<number | null> }>,
  colors: readonly string[],
): ApexMarkers {
  const discrete: NonNullable<ApexMarkers['discrete']> = [];
  series.forEach((line, seriesIndex) => {
    const { data } = line;
    data.forEach((value, i) => {
      if (value == null) {
        return;
      }
      const prev = i > 0 ? data[i - 1] : null;
      const next = i < data.length - 1 ? data[i + 1] : null;
      if (prev == null && next == null) {
        const color = colors[seriesIndex];
        discrete.push({
          seriesIndex,
          dataPointIndex: i,
          size: 4,
          shape: 'circle',
          fillColor: color,
          strokeColor: color,
        });
      }
    });
  });
  return { size: 0, discrete };
}

// ── Chart builders ────────────────────────────────────────────────────────────

export function buildLineChart(
  rows: ReadonlyArray<{ bucket: string; job_type: string }>,
  valueKey: string,
  unit: 'secs' | 'count',
  height: number = DEFAULT_HEIGHT,
  colorFor: (type: string) => string = typeColor,
  utc = true,
): MetricsChartOptions {
  const data = pivot(rows, valueKey);
  const formatter = unit === 'secs' ? secsFormatter : countFormatter;
  // Conteos: un bucket sin filas significa 0 trabajos, así que rellenamos el hueco
  // con 0 para que la línea quede continua y conecte los picos. Tiempos: un hueco
  // es "sin trabajos exitosos"; rellenar con 0 fingiría procesamiento instantáneo,
  // así que se deja null (corta la línea) y el punto aislado se marca con un círculo.
  const series = data.types.map((type) => ({
    name: type,
    data: data.buckets.map((bucket) => {
      const value = data.at(bucket, type);
      return value == null && unit === 'count' ? 0 : value;
    }),
  }));
  const colors = data.types.map(colorFor);
  return {
    series,
    chart: baseChart('line', false, height),
    colors,
    xaxis: categoryXAxis(data.buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(formatter),
    // Tiempos: dejamos huecos (null) en vez de 0 ficticios, así que usamos
    // `monotoneCubic` —la única curva de ApexCharts que omite los null y conecta
    // los puntos a través del hueco—. Conteos: ya quedan continuos con relleno 0,
    // así que se mantiene la línea recta.
    stroke: { curve: unit === 'secs' ? 'monotoneCubic' : 'straight', width: 2 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: unit === 'count' ? totalCountTooltip() : baseTooltip(formatter),
    plotOptions: {},
    markers: isolatedPointMarkers(series, colors),
  };
}

export function buildThroughputBarChart(
  rows: readonly ThroughputBucket[],
  height: number = DEFAULT_HEIGHT,
  colorFor: (type: string) => string = typeColor,
  utc = true,
): MetricsChartOptions {
  const data = pivot(rows, 'count');
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type) ?? 0),
    })),
    chart: baseChart('bar', true, height),
    colors: data.types.map(colorFor),
    xaxis: categoryXAxis(data.buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(countFormatter),
    stroke: { width: 0 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: totalCountTooltip(),
    plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
    markers: { size: 0 },
  };
}

/**
 * Throughput agregado: una sola línea con el total de trabajos por bucket de 10
 * min (suma de todos los tipos). Es la vista por defecto del panel; el desglose
 * por tipo queda detrás del toggle vía `buildLineChart`.
 */
export function buildTotalThroughputChart(
  rows: readonly ThroughputBucket[],
  height: number = DEFAULT_HEIGHT,
  utc = true,
): MetricsChartOptions {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + row.count);
  }
  const buckets = [...totals.keys()].sort();
  const color = TYPE_PALETTE[0]; // un solo color para la línea agregada
  const series = [{ name: 'Total', data: buckets.map((bucket) => totals.get(bucket) ?? 0) }];
  return {
    series,
    chart: baseChart('line', false, height),
    colors: [color],
    xaxis: categoryXAxis(buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(countFormatter),
    stroke: { curve: 'straight', width: 2 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: { ...baseLegend(), show: false }, // serie única: leyenda redundante
    grid: baseGrid(),
    tooltip: baseTooltip(countFormatter), // muestra "Total: N" del bucket
    plotOptions: {},
    markers: isolatedPointMarkers(series, [color]),
  };
}

export function buildStageAreaChart(
  series: readonly TimingSeriesPoint[],
  jobType: string,
  height: number = DEFAULT_HEIGHT,
  utc = true,
): MetricsChartOptions {
  const rows = series.filter((row) => row.job_type === jobType);
  const buckets = [...new Set(rows.map((row) => row.bucket))].sort();
  const stageNames = [...new Set(rows.flatMap((row) => Object.keys(row.stages ?? {})))];
  const byBucket = new Map<string, StageTimings>();
  for (const row of rows) {
    byBucket.set(row.bucket, row.stages ?? {});
  }
  return {
    series: stageNames.map((stage) => ({
      name: stageLabel(stage),
      data: buckets.map((bucket) => byBucket.get(bucket)?.[stage] ?? 0),
    })),
    chart: baseChart('area', true, height),
    colors: stageNames.map(stageColor),
    xaxis: categoryXAxis(buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(secsFormatter),
    stroke: { curve: 'straight', width: 1 },
    fill: { type: 'solid', opacity: 0.35 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: baseTooltip(secsFormatter),
    plotOptions: {},
    markers: { size: 0 },
  };
}

export function buildStagePieChart(
  stages: StageTimings,
  networkSecs: number | null,
  includeRed: boolean,
  height: number = 280,
  legendPosition: 'bottom' | 'right' = 'bottom',
): StagePieOptions {
  const labels: string[] = [];
  const series: number[] = [];
  const colors: string[] = [];
  for (const [name, value] of Object.entries(stages ?? {})) {
    labels.push(stageLabel(name));
    series.push(value);
    colors.push(stageColor(name));
  }
  if (includeRed && networkSecs != null && networkSecs > 0) {
    labels.push('Descarga');
    series.push(networkSecs);
    colors.push(NETWORK_COLOR);
  }
  return {
    series,
    chart: {
      type: 'donut',
      height,
      animations: { enabled: false },
      fontFamily: 'inherit',
    },
    labels,
    colors,
    legend: { ...baseLegend(), position: legendPosition },
    dataLabels: {
      enabled: true,
      formatter: (value: string | number | number[]) => `${Math.round(Number(value))}%`,
      style: { fontSize: '11px' },
    },
    tooltip: { theme: 'light', y: { formatter: secsFormatter } },
    plotOptions: { pie: { donut: { size: '55%' } } },
    stroke: { width: 1, colors: ['#fff'] },
  };
}
