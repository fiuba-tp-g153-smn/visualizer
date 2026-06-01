import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { TEMPERATURE_UNITS } from '../../constants';
import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import { StationSeries } from '../../models/geo/weather-station-series.model';

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

const TEMP_COLOR = '#e63946';
const DEW_COLOR = '#2a9d8f';

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
