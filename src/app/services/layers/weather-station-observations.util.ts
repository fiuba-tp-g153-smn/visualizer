import { TEMPERATURE_UNITS, WEATHER_STATION_UNITS } from '../../constants';
import { convertValueForDisplay, getDisplayUnit } from '../../utils/unit-conversion.utils';
import { formatDateTimeLocalized } from '../../utils/tileset-timestamp';
import { formatStationValue } from '../../utils/number-format.utils';
import { UnitsSettingsService } from '../settings/units-settings.service';
import { StationSeries } from '../../models/geo/weather-station-series.model';

export interface ObservationRow {
  time: string;
  temperature: string;
  dewPoint: string;
  humidity: string;
  wind: string;
  windSpeed: string;
  pressure: string;
  visibility: string;
  condition: string;
}

function fmt(
  value: number | null,
  sourceUnit: string,
  minDecimals: number,
  units: UnitsSettingsService,
): string {
  if (value === null) {
    return '—';
  }
  const unit = getDisplayUnit(sourceUnit, units);
  const displayValue = convertValueForDisplay(value, sourceUnit, units);
  return `${formatStationValue(displayValue, units.decimalPrecision(), minDecimals)} ${unit}`.trim();
}

/**
 * One formatted row per observation (newest first), in the user's units + timezone.
 * No precipitation / gust columns — SMN doesn't report them.
 */
export function buildObservationRows(
  series: StationSeries,
  units: UnitsSettingsService,
): ObservationRow[] {
  return [...series.points].reverse().map((p) => ({
    time: formatDateTimeLocalized(new Date(p.observedAt)),
    temperature: fmt(p.temperature, TEMPERATURE_UNITS.CELSIUS, 1, units),
    dewPoint: fmt(p.dewPoint, TEMPERATURE_UNITS.CELSIUS, 1, units),
    humidity: fmt(p.humidity, WEATHER_STATION_UNITS.HUMIDITY, 0, units),
    wind: p.windDirection ?? '—',
    windSpeed: fmt(p.windSpeed, WEATHER_STATION_UNITS.WIND_SPEED, 0, units),
    pressure: fmt(p.pressure, WEATHER_STATION_UNITS.PRESSURE, 1, units),
    visibility: fmt(p.visibility, WEATHER_STATION_UNITS.VISIBILITY, 1, units),
    condition: p.condition ?? '—',
  }));
}
