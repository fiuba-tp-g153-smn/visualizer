import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
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
  colors: string[];
}

export interface BuildChartsOptions {
  /** ApexCharts `chart.group` — charts sharing it sync their hover crosshair/tooltip. */
  group: string;
  /** Sparkline (compact, axis-less) for the popover preview vs. full axes for the dialog. */
  sparkline: boolean;
  /** Render the datetime axis in UTC (mirrors `TimezoneSettingsService`). */
  utc: boolean;
  height: number;
  /** Fixed pixel width (popover sparklines); omitted = ApexCharts' default 100%. */
  width?: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildOne(
  variable: SeriesVariable,
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
  xMin: number | undefined,
  xMax: number | undefined,
): SeriesChartVm {
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
  const hasData = data.some((d) => d.y !== null);

  const latestRaw = series.latest ? variable.accessor(series.latest) : null;
  const latestText =
    latestRaw === null
      ? '—'
      : `${convertValueForDisplay(latestRaw, variable.sourceUnit, unitsSettings).toFixed(variable.decimals)} ${unit}`.trim();

  const chart: ApexChart = {
    type: 'line',
    height: opts.height,
    ...(opts.width ? { width: opts.width } : {}),
    group: opts.group,
    // Fixed window (toolbar/zoom off) keeps all six charts locked to the same
    // time axis; the shared `group` syncs the hover crosshair across them.
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
    sparkline: { enabled: opts.sparkline },
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
    stroke: { curve: 'smooth', width: opts.sparkline ? 1.5 : 2 },
    dataLabels: { enabled: false },
    grid: opts.sparkline
      ? { show: false, padding: { left: 0, right: 0, top: 0, bottom: 0 } }
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
    xaxis: {
      type: 'datetime',
      min: xMin,
      max: xMax,
      labels: { show: !opts.sparkline, datetimeUTC: opts.utc },
      axisTicks: { show: !opts.sparkline },
      axisBorder: { show: !opts.sparkline },
      tooltip: { enabled: false },
    },
    yaxis: {
      show: !opts.sparkline,
      labels: {
        formatter: (val: number) =>
          val === null || val === undefined ? '' : val.toFixed(variable.decimals),
      },
    },
  };
}

/**
 * Build the six time-aligned chart bundles (one per variable, in `SERIES_VARIABLES`
 * order). All share `opts.group` and the same x-window so they read consistently
 * top-to-bottom. Values are converted to the user's unit settings.
 */
export function buildSeriesCharts(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
): SeriesChartVm[] {
  const xMin = series.points.length ? series.points[0].t : undefined;
  const xMax = series.points.length ? series.points[series.points.length - 1].t : undefined;
  return SERIES_VARIABLES.map((variable) =>
    buildOne(variable, series, unitsSettings, opts, xMin, xMax),
  );
}
