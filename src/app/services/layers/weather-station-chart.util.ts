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
import { WeatherStationVariable } from '../../models/layers/models';
import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import {
  SERIES_VARIABLES,
  type SeriesVariable,
  type StationSeries,
  type StationSeriesPoint,
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

/** One line of the popover Graph-tab chart. */
interface OverlayLine {
  name: string;
  color: string;
  sourceUnit: string;
  decimals: number;
  accessor: (point: StationSeriesPoint) => number | null;
}

/**
 * Build the popover Graph-tab chart from one or more lines. Values are converted
 * to the user's units; the tooltip is shared (all lines at the hovered time) and
 * the y-range is tight over every line. Unit/decimals come from the first line.
 */
function buildOverlayChart(
  series: StationSeries,
  lines: readonly OverlayLine[],
  unitsSettings: UnitsSettingsService,
  opts: TempDewChartOptions,
): TempDewChartVm {
  const unit = getDisplayUnit(lines[0].sourceUnit, unitsSettings);
  const decimals = lines[0].decimals;

  const apexSeries = lines.map((line) => ({
    name: line.name,
    data: series.points.map((p) => {
      const raw = line.accessor(p);
      return {
        x: p.t,
        y:
          raw === null ? null : round1(convertValueForDisplay(raw, line.sourceUnit, unitsSettings)),
      };
    }),
  }));

  const ys = apexSeries
    .flatMap((s) => s.data)
    .map((d) => d.y)
    .filter((y): y is number => y !== null);
  const hasData = ys.length > 0;
  const minY = hasData ? Math.min(...ys) : 0;
  const maxY = hasData ? Math.max(...ys) : 0;
  const span = maxY - minY || Math.max(Math.abs(maxY) * 0.1, 1);

  return {
    hasData,
    unit,
    colors: lines.map((l) => l.color),
    series: apexSeries,
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
          val === null || val === undefined ? '—' : `${val.toFixed(decimals)} ${unit}`.trim(),
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

/** Temperatura (red) + Punto de rocío (green) overlaid — the Temperatura tab view. */
export function buildTempDewChart(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
  opts: TempDewChartOptions,
): TempDewChartVm {
  return buildOverlayChart(
    series,
    [
      {
        name: 'Temperatura',
        color: TEMP_COLOR,
        sourceUnit: TEMPERATURE_UNITS.CELSIUS,
        decimals: 1,
        accessor: (p) => p.temperature,
      },
      {
        name: 'Punto de rocío',
        color: DEW_COLOR,
        sourceUnit: TEMPERATURE_UNITS.CELSIUS,
        decimals: 1,
        accessor: (p) => p.dewPoint,
      },
    ],
    unitsSettings,
    opts,
  );
}

const SERIES_VARIABLE_BY_MAP: Record<WeatherStationVariable, SeriesVariable['id']> = {
  [WeatherStationVariable.TEMPERATURE]: 'temperature',
  [WeatherStationVariable.FEELS_LIKE]: 'feelsLike',
  [WeatherStationVariable.HUMIDITY]: 'humidity',
  [WeatherStationVariable.PRESSURE]: 'pressure',
  [WeatherStationVariable.VISIBILITY]: 'visibility',
  [WeatherStationVariable.WIND_SPEED]: 'windSpeed',
};

/**
 * The Graph-tab chart for the variable currently selected on the map. Temperatura
 * keeps the dew-point overlay; every other variable is shown as a single line.
 */
export function buildTabChart(
  series: StationSeries,
  mapVariable: WeatherStationVariable,
  unitsSettings: UnitsSettingsService,
  opts: TempDewChartOptions,
): TempDewChartVm {
  if (mapVariable === WeatherStationVariable.TEMPERATURE) {
    return buildTempDewChart(series, unitsSettings, opts);
  }
  const id = SERIES_VARIABLE_BY_MAP[mapVariable];
  const variable = SERIES_VARIABLES.find((v) => v.id === id) ?? SERIES_VARIABLES[0];
  return buildOverlayChart(
    series,
    [
      {
        name: variable.label,
        color: variable.color,
        sourceUnit: variable.sourceUnit,
        decimals: variable.decimals,
        accessor: variable.accessor,
      },
    ],
    unitsSettings,
    opts,
  );
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

/**
 * Best-effort: rotate each triangle wind marker to its point's bearing. Relies on
 * ApexCharts' rendered SVG (`.apexcharts-series-markers path`, one per non-null
 * point, in order) — guarded so a structure change just leaves the triangles
 * un-rotated rather than throwing.
 */
function rotateWindMarkers(
  chartContext: { el?: Element } | undefined,
  degrees: readonly (number | null)[],
): void {
  const markers = chartContext?.el?.querySelectorAll('.apexcharts-series-markers path');
  if (!markers) {
    return;
  }
  markers.forEach((marker, index) => {
    const deg = degrees[index];
    if (deg === null || deg === undefined || Number.isNaN(deg)) {
      return;
    }
    const box = (marker as SVGGraphicsElement).getBBox?.();
    if (!box) {
      return;
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // +180°: the Apex triangle marker points up by default, while the right-click
    // wind compass draws an inward (downward at N) arrow. Offset so both render the
    // same bearing the same way — otherwise the chart triangles read inverted.
    marker.setAttribute('transform', `rotate(${deg + 180} ${cx} ${cy})`);
  });
}

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
  const toData = (accessor: (point: StationSeriesPoint) => number | null) =>
    series.points.map((point) => {
      const raw = accessor(point);
      return {
        x: point.t,
        y:
          raw === null
            ? null
            : Math.round(convertValueForDisplay(raw, variable.sourceUnit, unitsSettings) * 10) / 10,
      };
    });
  const data = toData(variable.accessor);

  // The temperature chart overlays the dew point (same °C scale) so the full-screen
  // view matches the popover's Temperatura graph (Temperatura + Punto de rocío).
  const isTemperature = variable.id === 'temperature';
  const dewData = isTemperature ? toData((point) => point.dewPoint) : null;

  const ys = [...data, ...(dewData ?? [])].map((d) => d.y).filter((y): y is number => y !== null);
  const hasData = ys.length > 0;
  const yRange = tightYRange(ys);

  // The wind chart uses triangle markers rotated to each reading's bearing.
  const isWind = variable.id === 'windSpeed';
  const windDegrees = isWind
    ? series.points.filter((p) => p.windSpeed !== null).map((p) => p.windDeg)
    : [];
  const rotate = (chart: unknown): void =>
    rotateWindMarkers(chart as { el?: Element }, windDegrees);

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
    colors: dewData ? [variable.color, DEW_COLOR] : [variable.color],
    series: dewData
      ? [
          { name: variable.label, data },
          { name: 'Punto de rocío', data: dewData },
        ]
      : [{ name: variable.label, data }],
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
      ...(isWind ? { events: { mounted: rotate, updated: rotate, animationEnd: rotate } } : {}),
    },
    stroke: { curve: 'straight', width: 2 },
    dataLabels: { enabled: false },
    // Dots per data point; the wind chart uses direction-rotated triangles.
    markers: isWind
      ? { size: 6, shape: 'triangle', strokeWidth: 0 }
      : { size: 4, strokeWidth: 0, hover: { size: 6 } },
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
