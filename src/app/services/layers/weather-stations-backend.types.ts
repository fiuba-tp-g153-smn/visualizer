import { SmnCurrentWeatherStationDto } from '../../models';

/**
 * Shape of an observation row in `/weather-stations/{latest,tilesetId}` as
 * returned by the data-service. Shared between the fetch path
 * (`LayerRefreshService`) and the snapshot cache
 * (`SmnStationsSnapshotCacheService`) so neither depends on the other.
 */
export interface BackendStationObservation {
  station_id: number;
  observed_at: string | null;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  weather: { id: number; description: string } | null;
  wind: SmnCurrentWeatherStationDto['wind'] | null;
}

/** One scrape cycle's snapshot (`/weather-stations/latest` or `/{tilesetId}`). */
export interface BackendSnapshot {
  scraped_at: string;
  source_url: string;
  stations: BackendStationObservation[];
}
