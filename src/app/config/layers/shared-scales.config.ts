import { RADAR_UNITS, ScaleToolGroupKey } from '../../constants';
import { LayerScale, ScaleType } from '../../models';
import { buildScaleFromLinearGradient } from './scale-builders';

const DBZH_MIN = -18;
const DBZH_MAX = 76.5;

function buildDbzhLabelValues(): readonly number[] {
  const firstMultiple = Math.ceil(DBZH_MIN / 5) * 5;
  const lastMultiple = Math.floor(DBZH_MAX / 5) * 5;
  return firstMultiple <= lastMultiple
    ? Array.from(
        { length: Math.floor((lastMultiple - firstMultiple) / 5) + 1 },
        (_, index) => firstMultiple + index * 5,
      )
    : [];
}

const DBZH_LABEL_VALUES = buildDbzhLabelValues();

const DBZH_BASE_SCALE_CONFIG = {
  labelValues: DBZH_LABEL_VALUES,
  subTickCount: 4,
  type: ScaleType.CONTINUOUS,
} as const;

/**
 * Reflectividad DBZ compartida entre productos que usan la misma paleta.
 * Rango: -18 a ~76 dBZ
 */
export const SHARED_DBZH_SCALE: LayerScale = buildScaleFromLinearGradient({
  ...DBZH_BASE_SCALE_CONFIG,
  min: DBZH_MIN,
  max: DBZH_MAX,
  unit: RADAR_UNITS.REFLECTIVITY,
  scaleDisplayName: 'Reflectividad',
  scaleRoutingKey: ScaleToolGroupKey.SHARED_REFLECTIVITY_DBZ,
  colors: [
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
    '#87DFBE',
  ] as const,
});
