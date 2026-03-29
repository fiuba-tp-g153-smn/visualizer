export interface SatellitePointQueryResponse {
  product: string;
  instrument: string;
  channel: string;
  tileset_id: string;
  lat: number;
  lon: number;
  value: number;
  unit: string;
}

export interface RadarPointQueryResponse {
  radar: string;
  variable: string;
  elevation: string;
  tileset_id: string;
  lat: number;
  lon: number;
  value: number;
  unit: string;
}

export interface EcmwfPointQueryResponse {
  forecast_ts: string;
  period_ts: string;
  lat: number;
  lon: number;
  value: number;
  unit: string;
}

export type PointQueryResponse = SatellitePointQueryResponse | RadarPointQueryResponse | EcmwfPointQueryResponse;

export interface PointQueryDisplayData {
  layerId: string;
  layerName: string;
  value: number | null;
  unit: string | null;
  status: 'loading' | 'value' | 'no-data' | 'error';
}
