import { WRF_UNITS } from '../../../constants';
import { ScaleToolGroupKey } from '../../../constants/scale-tools.constants';
import { LayerScale, ScaleType } from '../../../models';
import { buildScaleFromThresholds, buildScaleFromUniformThresholds } from '../scale-builders';
import { SHARED_DBZH_SCALE } from '../shared-scales.config';

/**
 * Escalas legend para los productos WRF-ARG4K.
 * Los colores aquí solo se usan para la leyenda; el render del tile lo hace
 * tiles-processor (palettes definidas en `wrf_processor.py`).
 *
 * Todas las paletas WRF son discretas por bandas: cada `value` es el umbral
 * inferior de la banda y su `color` la pinta. `buildScaleFromThresholds` empareja
 * `bounds[i]` con `colors[i]` para producir las `entries` del modelo nuevo.
 */

export const WRF_COLMAX_SCALE: LayerScale = SHARED_DBZH_SCALE;

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
  bounds: [25, 30, 35, 40, 45, 50, 60, 70, 80],
  colors: [
    '#b3b2aa',
    '#fee779',
    '#fec03d',
    '#fea001',
    '#fe6101',
    '#ff3200',
    '#e11400',
    '#c00000',
    '#c00000',
  ],
});

export const WRF_CAMPO900_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.SPECIFIC_HUMIDITY,
  scaleDisplayName: 'Humedad específica en 900 hPa',
  min: 0,
  max: 17,
  colors: [
    '#85d0f6',
    '#aeeffd',
    '#c6fdfd',
    '#f8fdf6',
    '#c6fda8',
    '#b3f8a8',
    '#fdf8a8',
    '#fde678',
    '#fdbf3c',
    '#fd9f00',
    '#fd6000',
    '#fd3200',
    '#df1400',
    '#bf0000',
    '#a40000',
    '#7060dc',
    '#483cc8',
    '#3a27b1',
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
  bounds: WRF_PRECIPITACION1H_BOUNDS,
  // Una etiqueta por umbral (sin esto, el default de 10 decima y oculta varias).
  labelCount: WRF_PRECIPITACION1H_BOUNDS.length,
  colors: [
    '#006736',
    '#31a154',
    '#77c479',
    '#c1e498',
    '#fefe9c',
    '#055a8d',
    '#358fbf',
    '#a6bcda',
    '#e2e1e4',
    '#a63603',
    '#f06813',
    '#fdae6b',
    '#770074',
    '#c51b8a',
    '#f768a1',
    '#fbb4b9',
    '#636363',
    '#bbbbbb',
  ],
});

const SHARED_WRF_CAPE_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.MUCAPE,
  scaleRoutingKey: ScaleToolGroupKey.SHARED_WRF_CAPE,
  bounds: [100, 250, 750, 1000, 1500, 2000, 2500, 3000, 3500],
  colors: ['#b2f8a9', '#77f373', '#37d13c', '#fdf8a9', '#fde678', '#ffc03c', '#ff6000', '#ff3200'],
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

export const WRF_JETCAPASBAJAS_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.WIND_SPEED,
  scaleDisplayName: 'Viento meridional en 850 hPa',
  bounds: [-48, -44, -40, -36, -32, -28, -24],
  colors: ['#df1400', '#fd3200', '#fd6000', '#fd9f00', '#fdbf3c', '#fdf8a9', '#fdf8a9'],
});

export const WRF_CORTANTE_SCALE: LayerScale = buildScaleFromUniformThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.WIND_SPEED,
  scaleDisplayName: 'Cortante en niveles bajos',
  min: 10,
  max: 50,
  colors: ['#fdf8a8', '#ffc03c', '#ff6000', '#e11400', '#e11400'],
});

export const WRF_CAPE_BRN_SCALE: LayerScale = {
  ...SHARED_WRF_CAPE_SCALE,
  scaleDisplayName: 'CAPE + BRN',
};

export const WRF_GRANIZO_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: WRF_UNITS.DIMENSIONLESS,
  scaleDisplayName: 'Granizo (SHIP)',
  bounds: [0.1, 1.0, 2.0, 3.0, 4.0],
  colors: ['#fdf8a9', '#ffc03c', '#ff6000', '#e11400', '#e11400'],
});
