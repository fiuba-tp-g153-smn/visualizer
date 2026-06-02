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
  bounds: [0.5, 2, 4, 10, 25, 50, 100, 250],
  colors: ['#00FFFF', '#007FFF', '#0000FF', '#D900FF', '#FF00FF', '#FF7F00', '#FF0000'],
});
