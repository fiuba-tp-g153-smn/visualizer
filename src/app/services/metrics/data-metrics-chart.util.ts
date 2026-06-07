import type {
  ApexChart,
  ApexGrid,
  ApexLegend,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import type {
  DataSyncHistoryPoint,
  RedisMemoryDomain,
  RedisMemoryHistoryPoint,
} from '../../models/metrics/data-metrics.models';
import {
  buildTypeColorMap,
  pivot,
  typeColor,
  type MetricsChartOptions,
} from './metrics-chart.util';
import { fmtBucket } from './metrics-format.util';

const GRID_COLOR = '#e3e3e6';
const LABEL_COLOR = '#5f6368';

/** Bytes → human string (B/KB/MB/GB/TB). Shared by charts and tables. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

type Formatter = (value: number | null) => string;

const bytesFormatter: Formatter = (value) => (value == null ? '' : formatBytes(value));
const countFormatter: Formatter = (value) =>
  value == null ? '' : String(Math.round(value));

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

function valueYAxis(formatter: Formatter): ApexYAxis {
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

/** Stacked area of Redis memory per domain over time (the growth chart). */
export function buildMemoryAreaChart(
  history: readonly RedisMemoryHistoryPoint[],
  utc = true,
): MetricsChartOptions {
  const rows = history.map((p) => ({
    bucket: p.sampled_at,
    job_type: p.domain,
    memory_bytes: p.memory_bytes,
  }));
  const data = pivot(rows, 'memory_bytes');
  const colorFor = buildTypeColorMap(data.types);
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type) ?? 0),
    })),
    chart: baseChart('area', true, 300),
    colors: data.types.map(colorFor),
    xaxis: categoryXAxis(data.buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(bytesFormatter),
    stroke: { curve: 'straight', width: 1 },
    fill: { type: 'solid', opacity: 0.4 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: { theme: 'light', shared: true, intersect: false, y: { formatter: bytesFormatter } },
    plotOptions: {},
  };
}

/** Vertical bars of current Redis memory per domain (one color per domain). */
export function buildMemoryBarChart(
  domains: readonly RedisMemoryDomain[],
): MetricsChartOptions {
  return {
    series: [{ name: 'memoria', data: domains.map((d) => d.memory_bytes) }],
    chart: baseChart('bar', false, 300),
    colors: domains.map((d) => typeColor(d.domain)),
    xaxis: categoryXAxis(domains.map((d) => d.domain)),
    yaxis: valueYAxis(bytesFormatter),
    stroke: { width: 0 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: baseGrid(),
    tooltip: { theme: 'light', y: { formatter: bytesFormatter } },
    plotOptions: { bar: { distributed: true, columnWidth: '60%', borderRadius: 2 } },
  };
}

/** Stacked bars of tiles downloaded per time bucket and domain. */
export function buildSyncThroughputChart(
  history: readonly DataSyncHistoryPoint[],
  utc = true,
): MetricsChartOptions {
  const rows = history.map((p) => ({
    bucket: p.bucket,
    job_type: p.domain,
    downloaded: p.downloaded,
  }));
  const data = pivot(rows, 'downloaded');
  const colorFor = buildTypeColorMap(data.types);
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type) ?? 0),
    })),
    chart: baseChart('bar', true, 260),
    colors: data.types.map(colorFor),
    xaxis: categoryXAxis(data.buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(countFormatter),
    stroke: { width: 0 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: { theme: 'light', shared: true, intersect: false, y: { formatter: countFormatter } },
    plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
  };
}

/** Lines of sync errors per time bucket and domain. */
export function buildSyncErrorsChart(
  history: readonly DataSyncHistoryPoint[],
  utc = true,
): MetricsChartOptions {
  const rows = history.map((p) => ({
    bucket: p.bucket,
    job_type: p.domain,
    errors: p.errors,
  }));
  const data = pivot(rows, 'errors');
  const colorFor = buildTypeColorMap(data.types);
  return {
    series: data.types.map((type) => ({
      name: type,
      data: data.buckets.map((bucket) => data.at(bucket, type) ?? 0),
    })),
    chart: baseChart('line', false, 220),
    colors: data.types.map(colorFor),
    xaxis: categoryXAxis(data.buckets.map((bucket) => fmtBucket(bucket, utc))),
    yaxis: valueYAxis(countFormatter),
    stroke: { curve: 'straight', width: 2 },
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: baseLegend(),
    grid: baseGrid(),
    tooltip: { theme: 'light', shared: true, intersect: false, y: { formatter: countFormatter } },
    plotOptions: {},
  };
}
