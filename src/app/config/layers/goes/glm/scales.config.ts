import { GLM_UNITS } from '../../../../constants';
import { buildLogScale } from '../../scale-builders';

const baseLogScaleConfig = {
  subTickCount: 9,
};

// Colores de cmap generado con LinearSegmentedColormap; LogNorm(1, 128)
export const GLM_FED_SCALE = buildLogScale({
  ...baseLogScaleConfig,
  min: 1,
  max: 128,
  unit: GLM_UNITS.FLASH_DENSITY,
  colors: [
    '#0000b8',
    '#0702c1',
    '#0f05cb',
    '#1808d6',
    '#1f0bdf',
    '#280eeb',
    '#2f10f4',
    '#3813fe',
    '#2d49ff',
    '#1e92ff',
    '#12dfff',
    '#5bfdb6',
    '#d5ff3c',
    '#ffad12',
    '#f73611',
    '#cc0e4e',
    '#f9e5e7',
  ],
  labelValues: [1, 2, 5, 10, 20, 50, 100, 128],
});

// Colores de cmap magma; LogNorm(0.01, 1500)
export const GLM_TOE_SCALE = buildLogScale({
  ...baseLogScaleConfig,
  min: 0.01,
  max: 1500,
  unit: GLM_UNITS.ENERGY,
  colors: [
    '#000004',
    '#0a0822',
    '#1d1147',
    '#36106b',
    '#51127c',
    '#6a1c81',
    '#832681',
    '#9c2e7f',
    '#b73779',
    '#d0416f',
    '#e75263',
    '#f56b5c',
    '#fc8961',
    '#fea772',
    '#fec488',
    '#fde2a3',
    '#fcfdbf',
  ],
  labelValues: [0.01, 10, 50, 100, 250, 500, 1500],
});

// Colores de cmap viridis_r; LogNorm(64, 2500)
export const GLM_MFA_SCALE = buildLogScale({
  ...baseLogScaleConfig,
  min: 64,
  max: 2500,
  unit: GLM_UNITS.AREA,
  colors: [
    '#fde725',
    '#d5e21a',
    '#aadc32',
    '#81d34d',
    '#5cc863',
    '#3dbc74',
    '#27ad81',
    '#1f9f88',
    '#21908d',
    '#26818e',
    '#2c718e',
    '#33628d',
    '#3b518b',
    '#423f85',
    '#472c7a',
    '#481769',
    '#440154',
  ],
  labelValues: [64, 100, 250, 500, 1000, 2500],
});
