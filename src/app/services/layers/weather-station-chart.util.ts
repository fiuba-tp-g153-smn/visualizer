import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexMarkers,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import {
  SERIES_VARIABLES,
  type SeriesVariable,
  type StationSeries,
} from '../../models/geo/weather-station-series.model';

/** One variable's fully-built ApexCharts option bundle, ready to bind to `<apx-chart>`. */
export interface SeriesChartVm {
  variable: SeriesVariable;
  unit: string;
  /** Latest reading, already converted + formatted with its unit (or '—'). */
  latestText: string;
  hasData: boolean;
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  /** Dashed max/min reference lines (labeled with the value). */
  annotations: ApexAnnotations;
  /** Data-point dots — visible on the full-screen charts, hidden on the popover. */
  markers: ApexMarkers;
  colors: string[];
}

export interface BuildChartsOptions {
  /** ApexCharts `chart.group` — charts sharing it sync their hover crosshair/tooltip. */
  group: string;
  /** Compact popover preview (axis-less, shared bottom timeline) vs. full axes for the dialog. */
  sparkline: boolean;
  /** Render the datetime axis in UTC (mirrors `TimezoneSettingsService`). */
  utc: boolean;
  height: number;
  /**
   * Explicit pixel width. Required for the popover charts: they render while the
   * Leaflet popup element is still detached (0 parent width), so without a fixed
   * width ApexCharts draws an empty 0-px chart. Omit for the full-screen charts
   * (attached → they size to 100% of their container).
   */
  width?: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Tight y-range (data min/max + 15% padding) so a short popover chart's wave
 * fills the height instead of looking flat. `undefined` → ApexCharts auto-scales
 * (used by the roomy full-screen charts, which get nicer ticks that way).
 */
function tightYRange(ys: number[], compact: boolean): { min: number; max: number } | undefined {
  if (!compact || !ys.length) {
    return undefined;
  }
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const span = maxY - minY;
  const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(maxY) * 0.05, 0.5);
  return { min: minY - pad, max: maxY + pad };
}

/** Dashed max + min horizontal guide lines, each labeled with the value + unit. */
function buildMinMaxAnnotations(
  ys: number[],
  variable: SeriesVariable,
  unit: string,
  compact: boolean,
): ApexAnnotations {
  if (!ys.length) {
    return {};
  }
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const line = (y: number, prefix: string) => ({
    y,
    borderColor: variable.color,
    strokeDashArray: 4,
    opacity: 0.5,
    label: {
      text: `${prefix} ${y.toFixed(variable.decimals)} ${unit}`.trim(),
      position: 'right' as const,
      textAnchor: 'end' as const,
      borderColor: 'transparent',
      style: {
        fontSize: compact ? '8px' : '11px',
        color: variable.color,
        background: 'transparent',
      },
    },
  });
  return maxY === minY
    ? { yaxis: [line(maxY, 'máx/mín')] }
    : { yaxis: [line(maxY, 'máx'), line(minY, 'mín')] };
}

function buildOne(
  variable: SeriesVariable,
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
  xMin: number | undefined,
  xMax: number | undefined,
): SeriesChartVm {
  const compact = opts.sparkline;
  const unit = getDisplayUnit(variable.sourceUnit, unitsSettings);
  const data = series.points.map((point) => {
    const raw = variable.accessor(point);
    return {
      x: point.t,
      y:
        raw === null
          ? null
          : roundTo(
              convertValueForDisplay(raw, variable.sourceUnit, unitsSettings),
              variable.decimals,
            ),
    };
  });
  const ys = data.map((d) => d.y).filter((y): y is number => y !== null);
  const hasData = ys.length > 0;
  const yRange = tightYRange(ys, compact);

  const latestRaw = series.latest ? variable.accessor(series.latest) : null;
  const latestText =
    latestRaw === null
      ? '—'
      : `${convertValueForDisplay(latestRaw, variable.sourceUnit, unitsSettings).toFixed(variable.decimals)} ${unit}`.trim();

  const chart: ApexChart = {
    type: 'line',
    height: opts.height,
    ...(opts.width ? { width: opts.width } : {}),
    id: `${opts.group}-${variable.id}`,
    // Only the full-screen charts share a group, which syncs their crosshair +
    // tooltip so hovering one timestamp shows the value on all six at once. The
    // compact popover charts opt out — that multi-hover is too crowded there;
    // they stay time-aligned purely via the shared x-window.
    ...(compact ? {} : { group: opts.group }),
    // Fixed window (toolbar/zoom off) keeps all six charts locked to the same
    // time axis.
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
    sparkline: { enabled: false },
    fontFamily: 'inherit',
  };

  return {
    variable,
    unit,
    latestText,
    hasData,
    colors: [variable.color],
    series: [{ name: variable.label, data }],
    chart,
    // Straight lines (no smoothing) everywhere.
    stroke: { curve: 'straight', width: compact ? 1.5 : 2 },
    dataLabels: { enabled: false },
    markers: compact ? { size: 0 } : { size: 3, strokeWidth: 0, hover: { size: 6 } },
    annotations: buildMinMaxAnnotations(ys, variable, unit, compact),
    grid: compact
      ? { show: false, padding: { left: 4, right: 4, top: 2, bottom: 0 } }
      : { borderColor: '#e5e7eb', strokeDashArray: 4 },
    tooltip: {
      enabled: true,
      x: { format: 'dd MMM HH:mm' },
      y: {
        formatter: (val: number) =>
          val === null || val === undefined
            ? '—'
            : `${val.toFixed(variable.decimals)} ${unit}`.trim(),
      },
    },
    // Compact charts hide the x-axis here; `buildSeriesCharts` re-enables it on
    // the last chart with data so the stack shares a single bottom timeline.
    xaxis: {
      type: 'datetime',
      min: xMin,
      max: xMax,
      labels: { show: !compact, datetimeUTC: opts.utc },
      axisTicks: { show: !compact },
      axisBorder: { show: !compact },
      tooltip: { enabled: false },
    },
    yaxis: {
      show: !compact,
      ...(yRange ? { min: yRange.min, max: yRange.max } : {}),
      labels: {
        formatter: (val: number) =>
          val === null || val === undefined ? '' : val.toFixed(variable.decimals),
      },
    },
  };
}

/** Re-enable a compact chart's datetime x-axis so it carries the shared timeline. */
function showTimeline(vm: SeriesChartVm, utc: boolean): void {
  vm.xaxis = {
    ...vm.xaxis,
    labels: { show: true, datetimeUTC: utc, style: { fontSize: '9px' } },
    axisTicks: { show: true },
    axisBorder: { show: true },
  };
}

/**
 * Build the six time-aligned chart bundles (one per variable, in `SERIES_VARIABLES`
 * order). All share `opts.group` and the same x-window so they read consistently
 * top-to-bottom. Values are converted to the user's unit settings. In compact
 * (popover) mode only the last chart with data shows the x-axis, giving the stack
 * a single shared timeline at the bottom.
 */
export function buildSeriesCharts(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
): SeriesChartVm[] {
  const xMin = series.points.length ? series.points[0].t : undefined;
  const xMax = series.points.length ? series.points[series.points.length - 1].t : undefined;
  const charts = SERIES_VARIABLES.map((variable) =>
    buildOne(variable, series, unitsSettings, opts, xMin, xMax),
  );
  if (opts.sparkline) {
    const lastWithData = [...charts].reverse().find((vm) => vm.hasData);
    if (lastWithData) {
      showTimeline(lastWithData, opts.utc);
    }
  }
  return charts;
}
