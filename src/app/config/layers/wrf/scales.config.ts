import { LayerScale, ScaleType } from '../../../models';

/**
 * Escalas legend para los productos WRF-ARG4K.
 * Los colores aquí solo se usan para la leyenda; el render del tile lo hace
 * tiles-processor (palettes definidas en `wrf_processor.py`).
 */

export const WRF_COLMAX_SCALE: LayerScale = {
  type: ScaleType.PALETTE_CONFIG,
  unit: 'dBZ',
  hexColors: [
    '#3C426D', '#3D4E7B', '#3D5988', '#3C6596', '#3971A3', '#357DAF',
    '#2F89BB', '#2897C6', '#26A3D1', '#2BB0DA', '#53F337', '#47D12F',
    '#3AB027', '#2C891D', '#247217', '#EDEF3D', '#D6DA34', '#C0C62B',
    '#D69719', '#EB0B2E', '#C10015', '#9B0000', '#D600A0', '#EA00EA',
    '#9A00A0',
  ],
  bounds: [-18, -10.5, -3, 4.5, 12, 19.5, 27, 34.5, 42, 49.5, 57, 64.5, 76.5],
  useBoundaryNorm: true,
};

export const WRF_RAFAGAS_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'kt',
  steps: [
    { value: 25, color: '#b3b2aa' },
    { value: 30, color: '#fee779' },
    { value: 35, color: '#fec03d' },
    { value: 40, color: '#fea001' },
    { value: 45, color: '#fe6101' },
    { value: 50, color: '#ff3200' },
    { value: 60, color: '#e11400' },
    { value: 70, color: '#c00000' },
    { value: 80, color: '#c00000' },
  ],
};

export const WRF_CAMPO900_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'g/kg',
  steps: [
    { value: 0, color: '#85d0f6' },
    { value: 2, color: '#aeeffd' },
    { value: 4, color: '#c6fdfd' },
    { value: 6, color: '#f8fdf6' },
    { value: 8, color: '#c6fda8' },
    { value: 10, color: '#fdf8a8' },
    { value: 12, color: '#fdbf3c' },
    { value: 14, color: '#fd9f00' },
    { value: 16, color: '#fd6000' },
    { value: 18, color: '#bf0000' },
  ],
};

export const WRF_PRECIPITACION1H_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'mm',
  steps: [
    { value: 0.1, color: '#006736' },
    { value: 1, color: '#31a154' },
    { value: 5, color: '#77c479' },
    { value: 10, color: '#c1e498' },
    { value: 15, color: '#055a8d' },
    { value: 20, color: '#358fbf' },
    { value: 25, color: '#a5bbd9' },
    { value: 30, color: '#d2d1d4' },
    { value: 40, color: '#a63603' },
    { value: 60, color: '#fdae6b' },
    { value: 100, color: '#c51b8a' },
    { value: 150, color: '#fbb4b9' },
    { value: 220, color: '#bbbbbb' },
  ],
};

export const WRF_MUCAPE_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'J/kg',
  steps: [
    { value: 100, color: '#b2f8a9' },
    { value: 250, color: '#77f373' },
    { value: 750, color: '#37d13c' },
    { value: 1000, color: '#fdf8a9' },
    { value: 1500, color: '#fde678' },
    { value: 2000, color: '#ffc03c' },
    { value: 2500, color: '#ff6000' },
    { value: 3000, color: '#ff3200' },
    { value: 3500, color: '#e01300' },
  ],
};

export const WRF_AGUAPRECIPITABLE_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'mm',
  steps: [
    { value: 20, color: '#cecfe4' },
    { value: 30, color: '#a5bbd8' },
    { value: 40, color: '#74a8cd' },
    { value: 50, color: '#358fbf' },
    { value: 60, color: '#0570b0' },
  ],
};

export const WRF_JETCAPASBAJAS_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'kt',
  steps: [
    { value: -48, color: '#df1400' },
    { value: -44, color: '#fd3200' },
    { value: -40, color: '#fd6000' },
    { value: -36, color: '#fd9f00' },
    { value: -32, color: '#fdbf3c' },
    { value: -28, color: '#fdf8a9' },
  ],
};

export const WRF_CORTANTE_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: 'kt',
  steps: [
    { value: 10, color: '#fdf8a8' },
    { value: 20, color: '#ffc03c' },
    { value: 30, color: '#ff6000' },
    { value: 40, color: '#e11400' },
  ],
};

export const WRF_CAPE_BRN_SCALE: LayerScale = WRF_MUCAPE_SCALE;

export const WRF_GRANIZO_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: '',
  steps: [
    { value: 0.1, color: '#fdf8a9' },
    { value: 1, color: '#ffc03c' },
    { value: 2, color: '#ff6000' },
    { value: 3, color: '#e11400' },
  ],
};
