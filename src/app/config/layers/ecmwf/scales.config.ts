import { PRECIPITATION_UNITS } from '../../../constants';
import { LayerScale, ScaleType } from '../../../models';
import { buildScaleFromThresholds } from '../scale-builders';

/**
 * TOTAL PRECIPITATION SCALE — discrete thresholds (ECMWF Total Precipitation).
 * Must match PRECIPITATION_THRESHOLDS / PRECIPITATION_COLORS in tiles-processor.
 */
export const ECMWF_TP_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: PRECIPITATION_UNITS.MILLIMETERS,
  scaleDisplayName: 'Precipitacion total',
  stops: [
    { value: 0.5, color: '#00FFFF' },
    { value: 2, color: '#007FFF' },
    { value: 4, color: '#0000FF' },
    { value: 10, color: '#D900FF' },
    { value: 25, color: '#FF00FF' },
    { value: 50, color: '#FF7F00' },
    { value: 100, color: '#FF0000' },
    { value: 250, color: '#FF0000' },
  ] as const,
});
