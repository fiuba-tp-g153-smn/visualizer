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
  value: number;
  unit: string;
}

export interface ScaleRangeInfo {
  min: number;
  max: number;
  totalSteps: number;
}

// Discriminated union by status for type safety

export interface PointQueryValueData {
  layerId: string;
  layerName: string;
  value: number;
  unit: string;
  status: PointQueryStatus.VALUE;
  scaleRange?: ScaleRangeInfo; // Absent for layers without scale definition (e.g. ECMWF)
  elevationId?: string; // Present only for radar layers
}

export interface PointQueryNoDataResult {
  layerId: string;
  layerName: string;
  status: PointQueryStatus.NO_DATA;
  elevationId?: string;
}

export interface PointQueryErrorResult {
  layerId: string;
  layerName: string;
  status: PointQueryStatus.ERROR;
  elevationId?: string;
}

export interface PointQueryLoadingState {
  layerId: string;
  layerName: string;
  status: PointQueryStatus.LOADING;
  elevationId?: string;
}

export type PointQueryDisplayData =
  | PointQueryValueData
  | PointQueryNoDataResult
  | PointQueryErrorResult
  | PointQueryLoadingState;
