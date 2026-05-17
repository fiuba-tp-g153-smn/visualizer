export interface SmnStationCoord {
  lat: number;
  lon: number;
}

export interface SmnStationReference {
  location_id: number;
}

export interface SmnStationDto {
  airport_code: string;
  coord: SmnStationCoord;
  height: number;
  id: number;
  name: string;
  province: string;
  ref: SmnStationReference;
  type: 'MANUAL' | 'AUTOMATICA';
}

export interface SmnWeatherPhenomenonDto {
  description: string;
  id: number;
}

export interface SmnWeatherWindDto {
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

export interface SmnCurrentWeatherStationDto {
  date: string;
  feels_like: number;
  humidity: number;
  pressure: number;
  station_id: number;
  temperature: number;
  visibility: number;
  weather: SmnWeatherPhenomenonDto;
  wind: SmnWeatherWindDto;
}

export interface SmnStationObservation {
  station: SmnStationDto;
  weather: SmnCurrentWeatherStationDto;
  // True when `weather.date` is within the requested tolerance window.
  // Always true in LATEST mode (no window). In SPECIFIC mode the renderer
  // uses this to apply the "no data for the requested period" styling.
  hasData: boolean;
}

export interface SmnStationSnapshot {
  observations: readonly SmnStationObservation[];
  fetchedAt: string;
  source: 'latest' | 'tileset';
}
