export enum PointQueryInteractionMode {
  OFF = 'off',
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
}

export enum PointQueryStatus {
  LOADING = 'loading',
  VALUE = 'value',
  NO_DATA = 'no-data',
  ERROR = 'error',
}

export interface PointQueryValueDto {
  value: number | null;
  unit: string | null;
}

export interface BasePointQueryDisplayData {
  layerId: string;
  layerName: string;
  value: number | null;
  unit: string | null;
  status: PointQueryStatus;
}

export interface SatellitePointQueryDisplayData extends BasePointQueryDisplayData {}

export interface RadarPointQueryDisplayData extends BasePointQueryDisplayData {
  elevationId: string;
}

export type PointQueryDisplayData = SatellitePointQueryDisplayData | RadarPointQueryDisplayData;
