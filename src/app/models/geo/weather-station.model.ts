export interface WeatherStationCoord {
  lat: number;
  lon: number;
}

export interface WeatherStationReference {
  location_id: number;
}

export interface WeatherStationDto {
  airport_code: string;
  coord: WeatherStationCoord;
  height: number;
  id: number;
  name: string;
  province: string;
  ref: WeatherStationReference;
  type: 'MANUAL' | 'AUTOMATICA';
}

export interface WeatherPhenomenonDto {
  description: string;
  id: number;
}

export interface WeatherWindDto {
  deg: number;
  direction:
    | 'Calma'
    | 'Este'
    | 'Sur'
    | 'Oeste'
    | 'Norte'
    | 'Noreste'
    | 'Noroeste'
    | 'Sudeste'
    | 'Sudoeste'
    | 'Direcciones Variables';
  speed: number | null;
}

export interface CurrentWeatherStationDto {
  date: string;
  feels_like: number | null;
  humidity: number | null;
  pressure: number | null;
  station_id: number;
  temperature: number | null;
  visibility: number | null;
  weather: WeatherPhenomenonDto;
  wind: WeatherWindDto;
}

export interface WeatherStationObservation {
  station: WeatherStationDto;
  weather: CurrentWeatherStationDto;
  // True when `weather.date` is within the requested tolerance window.
  // Always true in LATEST mode (no window). In SPECIFIC mode the renderer
  // uses this to apply the "no data for the requested period" styling.
  hasData: boolean;
}

export interface WeatherStationSnapshot {
  observations: readonly WeatherStationObservation[];
  fetchedAt: string;
  source: 'latest' | 'tileset';
}
