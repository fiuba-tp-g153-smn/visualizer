import { WRF_UNITS } from '../../../constants';
import { ScaleToolGroupKey } from '../../../constants/scale-tools.constants';
import { LayerScale, ScaleType } from '../../../models';
import { buildScaleFromThresholds, buildScaleFromUniformThresholds } from '../scale-builders';

/**
 * Escalas legend para los productos WRF-ARG4K.
 * Los colores aquí solo se usan para la leyenda; el render del tile lo hace
 * tiles-processor (palettes definidas en `wrf_processor.py`).
 *
 * Todas las paletas WRF son discretas por bandas: cada `value` es el umbral
 * inferior de la banda y su `color` la pinta. `buildScaleFromThresholds` empareja
 * `bounds[i]` con `colors[i]` para producir las `entries` del modelo nuevo.
 */

export const WRF_RAFAGAS_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.WIND_SPEED,
  scaleDisplayName: 'Ráfagas',
  specialPoints: [
    {
      value: 35,
      label: 'Umbral',
      color: '#0000FF',
    },
  ],
  stops: [
    { value: 25, color: '#b3b2aa' },
    { value: 30, color: '#fee779' },
    { value: 35, color: '#fec03d' },
    { value: 40, color: '#fea001' },
    { value: 45, color: '#fe6101' },
    { value: 50, color: '#ff3200' },
    { value: 60, color: '#e11400' },
    { value: 70, color: '#c00000' },
    { value: 80, color: '#c00000' },
  ] as const,
});

export const WRF_CAMPO900_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.SPECIFIC_HUMIDITY,
  scaleDisplayName: 'Humedad específica en 900 hPa',
  min: 0,
  max: 19,
  colors: [
    '#84cff4',
    '#acedfb',
    '#c4fbfb',
    '#f6fbf4',
    '#c4fba8',
    '#b1f6a8',
    '#fbf6a8',
    '#fbe47a',
    '#fbbd40',
    '#fb9d0f',
    '#fb5f06',
    '#fb3203',
    '#dd1402',
    '#bd0201',
    '#a20100',
    '#7060da',
    '#493dc6',
    '#3b28af',
    '#2e20a3',
  ],
});

const WRF_PRECIPITACION1H_BOUNDS = [
  0.1, 1.0, 5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 80.0, 100.0, 120.0, 150.0,
  180.0, 220.0, 260.0,
];

export const WRF_PRECIPITACION1H_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.PRECIPITATION,
  scaleDisplayName: 'Precipitación en 1 h',
  stops: [
    { value: 0.1, color: '#006736' },
    { value: 1.0, color: '#31a154' },
    { value: 5.0, color: '#77c479' },
    { value: 10.0, color: '#c1e498' },
    { value: 15.0, color: '#fefe9c' },
    { value: 20.0, color: '#055a8d' },
    { value: 25.0, color: '#358fbf' },
    { value: 30.0, color: '#a6bcda' },
    { value: 35.0, color: '#e2e1e4' },
    { value: 40.0, color: '#a63603' },
    { value: 50.0, color: '#f06813' },
    { value: 60.0, color: '#fdae6b' },
    { value: 80.0, color: '#770074' },
    { value: 100.0, color: '#c51b8a' },
    { value: 120.0, color: '#f768a1' },
    { value: 150.0, color: '#fbb4b9' },
    { value: 180.0, color: '#636363' },
    { value: 220.0, color: '#bbbbbb' },
    { value: 260.0, color: '#bbbbbb' },
  ] as const,
  // Una etiqueta por umbral (sin esto, el default de 10 decima y oculta varias).
  labelCount: WRF_PRECIPITACION1H_BOUNDS.length,
});

const SHARED_WRF_CAPE_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.MUCAPE,
  scaleRoutingKey: ScaleToolGroupKey.SHARED_WRF_CAPE,
  stops: [
    { value: 100, color: '#b2f8a9' },
    { value: 250, color: '#77f373' },
    { value: 750, color: '#37d13c' },
    { value: 1000, color: '#fdf8a9' },
    { value: 1500, color: '#fde678' },
    { value: 2000, color: '#ffc03c' },
    { value: 2500, color: '#ff6000' },
    { value: 3000, color: '#ff3200' },
    { value: 3500, color: '#ff3200' },
  ] as const,
});

export const WRF_MUCAPE_SCALE: LayerScale = {
  ...SHARED_WRF_CAPE_SCALE,
  scaleDisplayName: 'CAPE máximo',
};

export const WRF_AGUAPRECIPITABLE_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.PRECIPITATION,
  scaleDisplayName: 'Agua precipitable',
  min: 20,
  max: 70,
  colors: ['#cecfe4', '#a5bbd8', '#74a8cd', '#358fbf', '#0570b0'],
});

export const WRF_JETCAPASBAJAS_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.WIND_SPEED,
  scaleDisplayName: 'Viento meridional en 850 hPa',
  min: -48,
  max: -24,
  colors: ['#df1400', '#fd3200', '#fd6000', '#fd9f00', '#fdbf3c', '#fdf8a9'],
});

export const WRF_CORTANTE_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.WIND_SPEED,
  scaleDisplayName: 'Cortante en niveles bajos',
  min: 10,
  max: 50,
  colors: ['#fdf8a8', '#ffc03c', '#ff6000', '#e11400'],
});

export const WRF_CAPE_BRN_SCALE: LayerScale = {
  ...SHARED_WRF_CAPE_SCALE,
  scaleDisplayName: 'CAPE + BRN',
};

export const WRF_GRANIZO_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.DIMENSIONLESS,
  scaleDisplayName: 'Granizo (SHIP)',
  stops: [
    { value: 0.1, color: '#fdf8a9' },
    { value: 1.0, color: '#ffc03c' },
    { value: 2.0, color: '#ff6000' },
    { value: 3.0, color: '#e11400' },
    { value: 4.0, color: '#e11400' },
  ] as const,
});
