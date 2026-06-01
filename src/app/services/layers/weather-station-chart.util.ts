import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { TEMPERATURE_UNITS } from '../../constants';
import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import {
  SERIES_VARIABLES,
  type SeriesVariable,
  type StationSeries,
} from '../../models/geo/weather-station-series.model';

/** Wundermap-style chart: Temperatura (red) + Punto de rocío (green) overlaid. */
export interface TempDewChartVm {
  hasData: boolean;
  unit: string;
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  legend: ApexLegend;
  colors: string[];
}

export interface TempDewChartOptions {
  /** Render the datetime axis in UTC (mirrors `TimezoneSettingsService`). */
  utc: boolean;
  height: number;
  /** Explicit width (the popup may render while detached); omit for 100%. */
  width?: number;
}

const TEMP_COLOR = '#ff6b59';
const DEW_COLOR = '#003d5c';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Build the single Temperatura + Punto de rocío chart for the popover's Graph tab.
 * Both are temperatures (°C) → converted to the user's unit; tooltip is shared so
 * hovering a time shows both values at once; the y-range is tight over both series.
 */
export function buildTempDewChart(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: TempDewChartOptions,
): TempDewChartVm {
  const unit = getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, unitsSettings);
  const toDisplay = (value: number) =>
    round1(convertValueForDisplay(value, TEMPERATURE_UNITS.CELSIUS, unitsSettings));

  const tempData = series.points.map((p) => ({
    x: p.t,
    y: p.temperature === null ? null : toDisplay(p.temperature),
  }));
  const dewData = series.points.map((p) => ({
    x: p.t,
    y: p.dewPoint === null ? null : toDisplay(p.dewPoint),
  }));

  const ys = [...tempData, ...dewData].map((d) => d.y).filter((y): y is number => y !== null);
  const hasData = ys.length > 0;
  const minY = hasData ? Math.min(...ys) : 0;
  const maxY = hasData ? Math.max(...ys) : 0;
  const span = maxY - minY || Math.max(Math.abs(maxY) * 0.1, 1);

  return {
    hasData,
    unit,
    colors: [TEMP_COLOR, DEW_COLOR],
    series: [
      { name: 'Temperatura', data: tempData },
      { name: 'Punto de rocío', data: dewData },
    ],
    chart: {
      type: 'line',
      height: opts.height,
      ...(opts.width ? { width: opts.width } : {}),
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
      parentHeightOffset: 0,
      fontFamily: 'inherit',
    },
    stroke: { curve: 'straight', width: 2 },
    dataLabels: { enabled: false },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
      padding: { left: 6, right: 10, top: 0, bottom: 0 },
    },
    legend: { show: true, position: 'bottom', fontSize: '11px', itemMargin: { horizontal: 8 } },
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
      x: { format: 'dd MMM HH:mm' },
      y: {
        formatter: (val: number) =>
          val === null || val === undefined ? '—' : `${val.toFixed(1)} ${unit}`.trim(),
      },
    },
    xaxis: {
      type: 'datetime',
      labels: { datetimeUTC: opts.utc, style: { fontSize: '10px' } },
      axisTicks: { show: true },
      axisBorder: { show: true },
      tooltip: { enabled: false },
    },
    yaxis: {
      ...(hasData ? { min: minY - span * 0.1, max: maxY + span * 0.1 } : {}),
      tickAmount: 4,
      labels: {
        formatter: (val: number) => (val === null || val === undefined ? '' : val.toFixed(0)),
      },
    },
  };
}

// ------------------------------------------------ full-screen "all variables"

/** One variable's full chart for the full-screen all-graphs view. */
export interface SeriesChartVm {
  variable: SeriesVariable;
  unit: string;
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
  annotations: ApexAnnotations;
  markers: ApexMarkers;
  colors: string[];
}

export interface BuildChartsOptions {
  /** ApexCharts `chart.group` — charts sharing it sync their hover crosshair. */
  group: string;
  utc: boolean;
  height: number;
}

/** Tight y-range (data min/max + small padding) so the line fills the height. */
function tightYRange(ys: number[]): { min: number; max: number } | undefined {
  if (!ys.length) {
    return undefined;
  }
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const base = maxY - minY || Math.max(Math.abs(maxY) * 0.1, 1);
  return { min: minY - base * 0.08, max: maxY + base * 0.12 };
}

type XAxisLabels = 'top' | 'bottom' | 'hidden';

function buildVariableChart(
  variable: SeriesVariable,
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
  xMin: number | undefined,
  xMax: number | undefined,
  xLabels: XAxisLabels,
): SeriesChartVm {
  const unit = getDisplayUnit(variable.sourceUnit, unitsSettings);
  const data = series.points.map((point) => {
    const raw = variable.accessor(point);
    return {
      x: point.t,
      y:
        raw === null
          ? null
          : Math.round(convertValueForDisplay(raw, variable.sourceUnit, unitsSettings) * 10) / 10,
    };
  });
  const ys = data.map((d) => d.y).filter((y): y is number => y !== null);
  const hasData = ys.length > 0;
  const yRange = tightYRange(ys);

  const latestRaw = series.latest ? variable.accessor(series.latest) : null;
  const latestText =
    latestRaw === null
      ? '—'
      : `${convertValueForDisplay(latestRaw, variable.sourceUnit, unitsSettings).toFixed(variable.decimals)} ${unit}`.trim();

  return {
    variable,
    unit,
    latestText,
    hasData,
    colors: [variable.color],
    series: [{ name: variable.label, data }],
    chart: {
      type: 'line',
      height: opts.height,
      id: `${opts.group}-${variable.id}`,
      group: opts.group,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
      parentHeightOffset: 0,
      fontFamily: 'inherit',
    },
    stroke: { curve: 'straight', width: 2 },
    dataLabels: { enabled: false },
    // Clean professional look: no markers/guide-lines, gridlines + alternating bands.
    markers: { size: 0 },
    annotations: {},
    grid: {
      borderColor: '#e5e7eb',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
      column: { colors: ['#f8f9fa', 'transparent'], opacity: 1 },
      padding: { left: 8, right: 12, top: 0, bottom: 0 },
    },
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
      position: xLabels === 'top' ? 'top' : 'bottom',
      labels: { show: xLabels !== 'hidden', datetimeUTC: opts.utc, style: { fontSize: '11px' } },
      axisTicks: { show: xLabels !== 'hidden' },
      axisBorder: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      ...(yRange ? { min: yRange.min, max: yRange.max } : {}),
      labels: {
        formatter: (val: number) =>
          val === null || val === undefined ? '' : val.toFixed(variable.decimals),
      },
    },
  };
}

/**
 * Build the time-aligned variable charts for the full-screen view. All share
 * `opts.group`, so hovering one timestamp shows the crosshair on every chart. The
 * time-axis labels appear only above the top chart and below the bottom chart,
 * giving the stack a single shared, professional time axis.
 */
export function buildSeriesCharts(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: BuildChartsOptions,
): SeriesChartVm[] {
  const xMin = series.points.length ? series.points[0].t : undefined;
  const xMax = series.points.length ? series.points[series.points.length - 1].t : undefined;
  const last = SERIES_VARIABLES.length - 1;
  return SERIES_VARIABLES.map((variable, index) => {
    const xLabels: XAxisLabels = index === 0 ? 'top' : index === last ? 'bottom' : 'hidden';
    return buildVariableChart(variable, series, unitsSettings, opts, xMin, xMax, xLabels);
  });
}
