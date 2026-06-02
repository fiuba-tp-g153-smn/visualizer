import { LayerScale, ScaleType } from '../../../models';
import { buildScaleFromThresholds } from '../scale-builders';

/**
 * Escalas legend para los productos WRF-ARG4K.
 * Los colores aquí solo se usan para la leyenda; el render del tile lo hace
 * tiles-processor (palettes definidas en `wrf_processor.py`).
 *
 * Todas las paletas WRF son discretas por bandas: cada `value` es el umbral
 * inferior de la banda y su `color` la pinta. `buildScaleFromThresholds` empareja
 * `bounds[i]` con `hexColors[i]` para producir las `entries` del modelo nuevo.
 */

// Original palette from `WRF/generar_wrf.py::RADAR_COLORS` (63 colors, -18 to 76.5 dBZ in 1.5-dBZ steps).
// Remapped to SMN scale: -20 to 75 dBZ in 5-dBZ steps (20 levels).
// Colors extracted from original palette at corresponding indices.
const WRF_COLMAX_ORIGINAL_COLORS = [
  '#3C426D',
  '#3C426D',
  '#3C426D',
  '#3C426D',
  '#3C426D',
  '#3D4E7B',
  '#3D4E7B',
  '#3D4E7B',
  '#3D5988',
  '#3D5988',
  '#3D5988',
  '#3C6596',
  '#3C6596',
  '#3C6596',
  '#3971A3',
  '#3971A3',
  '#3971A3',
  '#357DAF',
  '#357DAF',
  '#2F89BB',
  '#2F89BB',
  '#2897C6',
  '#2897C6',
  '#26A3D1',
  '#2BB0DA',
  '#53F337',
  '#4DE133',
  '#47D12F',
  '#40C02B',
  '#3AB027',
  '#34A022',
  '#2C891D',
  '#247217',
  '#EDEF3D',
  '#E1E439',
  '#D6DA34',
  '#CDD230',
  '#C0C62B',
  '#CEAD20',
  '#D69719',
  '#DB8115',
  '#EB0B2E',
  '#CB001B',
  '#C10015',
  '#B20009',
  '#9B0000',
  '#C2005F',
  '#D600A0',
  '#EA00EA',
  '#CB00CD',
  '#B300B7',
  '#9A00A0',
  '#FFFFFF',
  '#DFF6ED',
  '#C6F1E1',
  '#B7ECD8',
  '#A7ECCF',
  '#97E3C6',
  '#97E3C6',
  '#87DFBE',
  '#87DFBE',
  '#87DFBE',
  '#87DFBE',
];

const WRF_COLMAX_BOUNDS = Array.from({ length: 19 }, (_, i) => -15 + i * 5);

const WRF_COLMAX_COLORS = WRF_COLMAX_BOUNDS.map((bound) => {
  const originalIndex = Math.round((bound - -18) / 1.5);
  const clampedIndex = Math.max(0, Math.min(62, originalIndex));
  return WRF_COLMAX_ORIGINAL_COLORS[clampedIndex];
});

export const WRF_COLMAX_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'dBZ',
  bounds: WRF_COLMAX_BOUNDS,
  hexColors: WRF_COLMAX_COLORS,
});

export const WRF_RAFAGAS_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'kt',
  bounds: [25, 30, 35, 40, 45, 50, 60, 70, 80],
  hexColors: [
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

export const WRF_CAMPO900_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'g/kg',
  bounds: Array.from({ length: 19 }, (_, i) => i),
  hexColors: [
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
    '#3a27b1',
  ],
});

const WRF_PRECIPITACION1H_BOUNDS = [
  0.1, 1.0, 5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 80.0, 100.0, 120.0, 150.0,
  180.0, 220.0, 260.0,
];

export const WRF_PRECIPITACION1H_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'mm',
  bounds: WRF_PRECIPITACION1H_BOUNDS,
  // Una etiqueta por umbral (sin esto, el default de 10 decima y oculta varias).
  labelCount: WRF_PRECIPITACION1H_BOUNDS.length,
  hexColors: [
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

export const WRF_MUCAPE_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'J/kg',
  bounds: [100, 250, 750, 1000, 1500, 2000, 2500, 3000, 3500],
  hexColors: [
    '#b2f8a9',
    '#77f373',
    '#37d13c',
    '#fdf8a9',
    '#fde678',
    '#ffc03c',
    '#ff6000',
    '#ff3200',
  ],
});

export const WRF_AGUAPRECIPITABLE_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'mm',
  bounds: [20, 30, 40, 50, 60, 70],
  hexColors: ['#cecfe4', '#a5bbd8', '#74a8cd', '#358fbf', '#0570b0'],
});

export const WRF_JETCAPASBAJAS_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'kt',
  bounds: [-48, -44, -40, -36, -32, -28, -24],
  hexColors: ['#df1400', '#fd3200', '#fd6000', '#fd9f00', '#fdbf3c', '#fdf8a9', '#fdf8a9'],
});

export const WRF_CORTANTE_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: 'kt',
  bounds: [10, 20, 30, 40, 50],
  hexColors: ['#fdf8a8', '#ffc03c', '#ff6000', '#e11400', '#e11400'],
});

export const WRF_CAPE_BRN_SCALE: LayerScale = WRF_MUCAPE_SCALE;

export const WRF_GRANIZO_SCALE: LayerScale = buildScaleFromThresholds({
  type: ScaleType.DISCRETE,
  unit: '',
  bounds: [0.1, 1.0, 2.0, 3.0, 4.0],
  hexColors: ['#fdf8a9', '#ffc03c', '#ff6000', '#e11400', '#e11400'],
});
