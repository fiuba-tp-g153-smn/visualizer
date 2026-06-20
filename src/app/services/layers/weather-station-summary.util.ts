import { TEMPERATURE_UNITS, WEATHER_STATION_UNITS } from '../../constants';
import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { formatStationValue } from '../../utils/number-format.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import { StationSeries, StationSeriesPoint } from '../../models/geo/weather-station-series.model';

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryGroup {
  title: string;
  rows: SummaryRow[];
}

type Stat = 'max' | 'min' | 'avg';

interface MetricDef {
  title: string;
  sourceUnit: string;
  decimals: number;
  stats: readonly Stat[];
  accessor: (point: StationSeriesPoint) => number | null;
}

const STAT_LABELS: Record<Stat, string> = {
  max: 'Máxima',
  min: 'Mínima',
  avg: 'Promedio',
};

const METRICS: readonly MetricDef[] = [
  {
    title: 'Temperatura',
    sourceUnit: TEMPERATURE_UNITS.CELSIUS,
    decimals: 1,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.temperature,
  },
  {
    title: 'Sensación térmica',
    sourceUnit: TEMPERATURE_UNITS.CELSIUS,
    decimals: 1,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.feelsLike,
  },
  {
    title: 'Punto de rocío',
    sourceUnit: TEMPERATURE_UNITS.CELSIUS,
    decimals: 1,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.dewPoint,
  },
  {
    title: 'Humedad',
    sourceUnit: WEATHER_STATION_UNITS.HUMIDITY,
    decimals: 0,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.humidity,
  },
  {
    title: 'Presión',
    sourceUnit: WEATHER_STATION_UNITS.PRESSURE,
    decimals: 1,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.pressure,
  },
  {
    title: 'Visibilidad',
    sourceUnit: WEATHER_STATION_UNITS.VISIBILITY,
    decimals: 1,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.visibility,
  },
  {
    title: 'Viento',
    sourceUnit: WEATHER_STATION_UNITS.WIND_SPEED,
    decimals: 0,
    stats: ['max', 'min', 'avg'],
    accessor: (p) => p.windSpeed,
  },
];

function statValue(ys: number[], stat: Stat): number {
  if (stat === 'max') {
    return Math.max(...ys);
  }
  if (stat === 'min') {
    return Math.min(...ys);
  }
  return ys.reduce((sum, y) => sum + y, 0) / ys.length;
}

/**
 * Per-variable high/low/average over the series window, converted to the user's
 * units. Variables with no readings are dropped. (We have no historic/record data,
 * so the table is "actual" only.)
 */
export function buildSeriesSummary(
  series: StationSeries,
  unitsSettings: UnitsSettingsService,
): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  for (const metric of METRICS) {
    const ys = series.points
      .map((p) => metric.accessor(p))
      .filter((v): v is number => v !== null)
      .map((v) => convertValueForDisplay(v, metric.sourceUnit, unitsSettings));
    if (!ys.length) {
      continue;
    }
    const unit = getDisplayUnit(metric.sourceUnit, unitsSettings);
    groups.push({
      title: `${metric.title} (${unit})`,
      rows: metric.stats.map((stat) => ({
        label: STAT_LABELS[stat],
        value: formatStationValue(
          statValue(ys, stat),
          unitsSettings.decimalPrecision(),
          metric.decimals,
        ),
      })),
    });
  }
  return groups;
}
