import { TEMPERATURE_UNITS, WEATHER_STATION_UNITS } from '../../constants';

/**
 * One station's 48 h history. The data-service bundles everything in a single
 * payload (every variable across every reading — including the server-computed
 * dew point — plus name/province and the latest point), so the frontend makes
 * exactly one request and feeds both the current values and the chart from it.
 */

// ----------------------------------------------------------- backend payload

export interface BackendStationSeriesPoint {
  observed_at: string;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  dew_point: number | null;
  wind_speed: number | null;
  wind_deg: number | null;
  wind_direction: string | null;
}

export interface BackendStationSeries {
  station_id: number;
  station_name: string | null;
  province: string | null;
  hours: number;
  points: readonly BackendStationSeriesPoint[];
  latest: BackendStationSeriesPoint | null;
}

// ------------------------------------------------------------ frontend view

export interface StationSeriesPoint {
  /** Epoch ms — the x value for ApexCharts' datetime axis. */
  t: number;
  observedAt: string;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  dewPoint: number | null;
  windSpeed: number | null;
  windDeg: number | null;
  windDirection: string | null;
}

export interface StationSeries {
  stationId: number;
  stationName: string | null;
  province: string | null;
  hours: number;
  points: readonly StationSeriesPoint[];
  latest: StationSeriesPoint | null;
}

/** A chartable variable: its label, source unit (for conversion) and accessor. */
export interface SeriesVariable {
  id: 'temperature' | 'feelsLike' | 'humidity' | 'pressure' | 'visibility' | 'windSpeed';
  label: string;
  /** Unit token understood by `convertValueForDisplay`/`getDisplayUnit`. */
  sourceUnit: string;
  color: string;
  decimals: number;
  accessor: (point: StationSeriesPoint) => number | null;
}

/**
 * The six variables for the full-screen all-graphs view, in a fixed order, each
 * with its colour from the shared palette.
 */
export const SERIES_VARIABLES: readonly SeriesVariable[] = [
  {
    id: 'temperature',
    label: 'Temperatura',
    sourceUnit: TEMPERATURE_UNITS.CELSIUS,
    color: '#ff6b59',
    decimals: 1,
    accessor: (p) => p.temperature,
  },
  {
    id: 'feelsLike',
    label: 'Sensación térmica',
    sourceUnit: TEMPERATURE_UNITS.CELSIUS,
    color: '#ffa600',
    decimals: 1,
    accessor: (p) => p.feelsLike,
  },
  {
    id: 'humidity',
    label: 'Humedad',
    sourceUnit: WEATHER_STATION_UNITS.HUMIDITY,
    color: '#003d5c',
    decimals: 0,
    accessor: (p) => p.humidity,
  },
  {
    id: 'pressure',
    label: 'Presión',
    sourceUnit: WEATHER_STATION_UNITS.PRESSURE,
    color: '#464c89',
    decimals: 1,
    accessor: (p) => p.pressure,
  },
  {
    id: 'visibility',
    label: 'Visibilidad',
    sourceUnit: WEATHER_STATION_UNITS.VISIBILITY,
    color: '#954e9b',
    decimals: 1,
    accessor: (p) => p.visibility,
  },
  {
    id: 'windSpeed',
    label: 'Viento',
    sourceUnit: WEATHER_STATION_UNITS.WIND_SPEED,
    color: '#dd4d88',
    decimals: 0,
    accessor: (p) => p.windSpeed,
  },
];

function adaptPoint(raw: BackendStationSeriesPoint): StationSeriesPoint {
  return {
    t: Date.parse(raw.observed_at),
    observedAt: raw.observed_at,
    temperature: raw.temperature,
    feelsLike: raw.feels_like,
    humidity: raw.humidity,
    pressure: raw.pressure,
    visibility: raw.visibility,
    dewPoint: raw.dew_point,
    windSpeed: raw.wind_speed,
    windDeg: raw.wind_deg,
    windDirection: raw.wind_direction,
  };
}

/** Map the backend payload to the frontend view, dropping unparseable timestamps. */
export function adaptStationSeries(raw: BackendStationSeries): StationSeries {
  const points = (raw.points ?? []).map(adaptPoint).filter((p) => !Number.isNaN(p.t));
  return {
    stationId: raw.station_id,
    stationName: raw.station_name ?? null,
    province: raw.province ?? null,
    hours: raw.hours,
    points,
    latest: raw.latest ? adaptPoint(raw.latest) : (points[points.length - 1] ?? null),
  };
}
