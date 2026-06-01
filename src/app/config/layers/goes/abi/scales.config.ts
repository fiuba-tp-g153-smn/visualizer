import { ABI_UNITS, TEMPERATURE_UNITS } from '../../../../constants';
import { buildScaleFromIndexedNodes, buildScaleFromLinearGradient } from '../../scale-builders';

const baseAbiThermalIndexedScaleConfig = {
  count: 256,
  unit: TEMPERATURE_UNITS.KELVIN,
  labelCount: 15,
};

// Reflectance: pure greyscale 0–1
export const ABI_CH2_SCALE = buildScaleFromLinearGradient({
  min: 0,
  max: 1,
  unit: ABI_UNITS.REFLECTANCE,
  colors: ['#000000', '#ffffff'],
  labelCount: 11,
});

export const ABI_CH9_SCALE = buildScaleFromIndexedNodes({
  ...baseAbiThermalIndexedScaleConfig,
  min: 161,
  max: 330,
  clipRange: [183.15, 323.15],
  nodes: [
    { index: 0, color: '#ffffff' },
    { index: 2, color: '#ffffff' },
    { index: 3, color: '#000032', hardStop: true },
    { index: 18, color: '#000032' },
    { index: 19, color: '#616161', hardStop: true },
    { index: 31, color: '#ffffff' },
    { index: 32, color: '#4f4f50', hardStop: true },
    { index: 33, color: '#4f4f50' },
    { index: 34, color: '#636347', hardStop: true },
    { index: 35, color: '#ffffff', hardStop: true },
    { index: 36, color: '#ffffff' },
    { index: 37, color: '#9b9b2d', hardStop: true },
    { index: 46, color: '#ffff00' },
    { index: 47, color: '#ef0000', hardStop: true },
    { index: 63, color: '#640000' },
    { index: 64, color: '#00ee00', hardStop: true },
    { index: 78, color: '#006400' },
    { index: 79, color: '#0000ff', hardStop: true },
    { index: 95, color: '#000064' },
    { index: 96, color: '#4d7fb1', hardStop: true },
    { index: 101, color: '#6496c8' },
    { index: 102, color: '#ebebeb', hardStop: true },
    { index: 132, color: '#232323' },
    { index: 133, color: '#4b0000', hardStop: true },
    { index: 134, color: '#4b0000' },
    { index: 144, color: '#ff7f00' },
    { index: 145, color: '#cb0000', hardStop: true },
    { index: 155, color: '#4b0000' },
    { index: 156, color: '#221313', hardStop: true },
    { index: 157, color: '#471d1d', hardStop: true },
    { index: 158, color: '#471d1d' },
    { index: 165, color: '#ff4b4b' },
    { index: 166, color: '#c8c800', hardStop: true },
    { index: 224, color: '#4b4b00' },
    { index: 225, color: '#000000', hardStop: true },
    { index: 232, color: '#000000' },
    { index: 233, color: '#313100', hardStop: true },
    { index: 255, color: '#000000' },
  ],
});
// Thermal IR (BD / Clean IR): 183.15–323.15 K
export const ABI_CH13_SCALE = buildScaleFromIndexedNodes({
  ...baseAbiThermalIndexedScaleConfig,
  min: 183.15,
  max: 323.15,
  nodes: [
    { index: 0, color: '#ffffff' },
    { index: 17, color: '#1b1b1b' },
    { index: 18, color: '#000000', hardStop: true },
    { index: 32, color: '#ee0000' },
    { index: 33, color: '#ff0b00', hardStop: true },
    { index: 54, color: '#fff300' },
    { index: 55, color: '#f0ff00', hardStop: true },
    { index: 69, color: '#10ff00' },
    { index: 70, color: '#00f007', hardStop: true },
    { index: 84, color: '#00106b' },
    { index: 85, color: '#000b79', hardStop: true },
    { index: 86, color: '#00177f', hardStop: true },
    { index: 105, color: '#00f3f8' },
    { index: 106, color: '#fafafa', hardStop: true },
    { index: 255, color: '#000000' },
  ],
});
