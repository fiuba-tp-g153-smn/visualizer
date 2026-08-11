import { WIND_SPEED_UNITS } from '../../../constants';
import { LayerScale, ScaleType } from '../../../models';
import { buildScaleFromThresholds } from '../scale-builders';

/**
 * Escalas de intensidad de viento para los niveles isobáricos de GFS.
 *
 * Los colores salen de los `ccols` de los scripts GrADS del SMN (`tgv500b.gs`
 * y `250b.gs`, resueltos contra las definiciones `set rgb` de `jaecol`) y son
 * los mismos que pinta el tile en tiles-processor (`models/gfs_palettes.py`).
 * Acá solo se usan para la leyenda.
 *
 * Cada `value` es el umbral inferior de su banda. El último stop repite el
 * color del anterior para cerrar el dominio: es el que pinta "> 200 kt".
 */

export const GFS_WIND_500_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WIND_SPEED_UNITS.KNOTS,
  scaleDisplayName: 'Viento en 500 hPa',
  stops: [
    { value: 80, color: '#82D2FF' },
    { value: 100, color: '#4BB4F0' },
    { value: 120, color: '#1E8CC8' },
    { value: 140, color: '#C0B4FF' },
    { value: 160, color: '#8070EB' },
    { value: 180, color: '#483CC8' },
    { value: 200, color: '#2800A0' },
    { value: 220, color: '#2800A0' },
  ] as const,
});

export const GFS_WIND_250_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WIND_SPEED_UNITS.KNOTS,
  scaleDisplayName: 'Viento en 250 hPa',
  stops: [
    { value: 80, color: '#FFFAAA' },
    { value: 90, color: '#FFE878' },
    { value: 100, color: '#FFC03C' },
    { value: 110, color: '#FFA000' },
    { value: 120, color: '#FF6000' },
    { value: 130, color: '#FF3200' },
    { value: 140, color: '#C0B4FF' },
    { value: 150, color: '#A08CFF' },
    { value: 160, color: '#8070EB' },
    { value: 170, color: '#7060DC' },
    { value: 180, color: '#483CC8' },
    { value: 190, color: '#3C28B4' },
    { value: 200, color: '#2D1EA5' },
    { value: 210, color: '#2D1EA5' },
  ] as const,
});
