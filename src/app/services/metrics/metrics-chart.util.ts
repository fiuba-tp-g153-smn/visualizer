import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
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

/**
 * Constructores de opciones de ApexCharts para el panel de rendimiento.
 * Recrean los gráficos del dashboard original (líneas, barras apiladas y áreas
 * apiladas) con un tema claro. Los colores son concretos (no variables CSS)
 * porque ApexCharts los escribe como atributos SVG, no como estilos.
 */
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
}

const GRID_COLOR = '#e3e3e6';
const LABEL_COLOR = '#5f6368';
const DEFAULT_HEIGHT = 240;

/** Paleta estable y legible sobre fondo claro (la primaria de la app primero). */
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
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Color estable y determinista para un tipo de trabajo (igual en todo gráfico). */
export function typeColor(jobType: string): string {
  return TYPE_PALETTE[hashString(jobType) % TYPE_PALETTE.length];
}

/** Color de una etapa del pipeline (gris por defecto si es desconocida). */
export function stageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? '#8e8e8e';
}

// ── Pivot ──────────────────────────────────────────────────────────────────

export interface PivotResult {
  readonly buckets: string[];
  readonly types: string[];
  at(bucket: string, type: string): number | null;
}

/** Reordena filas planas (bucket, job_type, valor) en series por tipo. */
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

// ── Chart builders ────────────────────────────────────────────────────────────

/** Líneas por tipo de trabajo: tiempos (`secs`) o conteos (`count`). */
export function buildLineChart(
  rows: ReadonlyArray<{ bucket: string; job_type: string }>,
  valueKey: string,
  unit: 'secs' | 'count',
  height: number = DEFAULT_HEIGHT,
): MetricsChartOptions {
  const data = pivot(rows, valueKey);
  const formatter = unit === 'secs' ? secsFormatter : countFormatter;
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type)),
    })),
    chart: baseChart('line', false, height),
    colors: data.types.map(typeColor),
    xaxis: categoryXAxis(data.buckets.map(fmtBucket)),
    yaxis: valueYAxis(formatter),
    stroke: { curve: 'straight', width: 2 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: baseTooltip(formatter),
    plotOptions: {},
  };
}

/** Barras apiladas: trabajos finalizados por intervalo y tipo. */
export function buildThroughputBarChart(
  rows: readonly ThroughputBucket[],
  height: number = DEFAULT_HEIGHT,
): MetricsChartOptions {
  const data = pivot(rows, 'count');
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type) ?? 0),
    })),
    chart: baseChart('bar', true, height),
    colors: data.types.map(typeColor),
    xaxis: categoryXAxis(data.buckets.map(fmtBucket)),
    yaxis: valueYAxis(countFormatter),
    stroke: { width: 0 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: baseTooltip(countFormatter),
    plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
  };
}

/** Áreas apiladas: segundos promedio por etapa para un tipo de trabajo. */
export function buildStageAreaChart(
  series: readonly TimingSeriesPoint[],
  jobType: string,
  height: number = DEFAULT_HEIGHT,
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
    xaxis: categoryXAxis(buckets.map(fmtBucket)),
    yaxis: valueYAxis(secsFormatter),
    stroke: { curve: 'straight', width: 1 },
    fill: { type: 'solid', opacity: 0.35 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: baseTooltip(secsFormatter),
    plotOptions: {},
  };
}
