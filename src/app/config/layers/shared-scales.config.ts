import { RADAR_UNITS, ScaleToolGroupKey } from '../../constants';
import { LayerScale, ScaleType } from '../../models';
import { buildScaleFromThresholds } from './scale-builders';

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
export const SHARED_DBZH_SCALE: LayerScale = buildScaleFromThresholds({
  ...DBZH_BASE_SCALE_CONFIG,
  unit: RADAR_UNITS.REFLECTIVITY,
  scaleDisplayName: 'Reflectividad',
  scaleRoutingKey: ScaleToolGroupKey.SHARED_REFLECTIVITY_DBZ,
  stops: [
    { value: -18, color: '#3C426D' },
    { value: -16.5, color: '#3C426D' },
    { value: -15, color: '#3C426D' },
    { value: -13.5, color: '#3C426D' },
    { value: -12, color: '#3D4E7B' },
    { value: -10.5, color: '#3D4E7B' },
    { value: -9, color: '#3D4E7B' },
    { value: -7.5, color: '#3D5988' },
    { value: -6, color: '#3D5988' },
    { value: -4.5, color: '#3D5988' },
    { value: -3, color: '#3C6596' },
    { value: -1.5, color: '#3C6596' },
    { value: 0, color: '#3C6596' },
    { value: 1.5, color: '#3971A3' },
    { value: 3, color: '#3971A3' },
    { value: 4.5, color: '#3971A3' },
    { value: 6, color: '#357DAF' },
    { value: 7.5, color: '#357DAF' },
    { value: 9, color: '#2F89BB' },
    { value: 10.5, color: '#2F89BB' },
    { value: 12, color: '#2897C6' },
    { value: 13.5, color: '#2897C6' },
    { value: 15, color: '#26A3D1' },
    { value: 16.5, color: '#2BB0DA' },
    { value: 18, color: '#53F337', hardStop: true },
    { value: 19.5, color: '#4DE133' },
    { value: 21, color: '#47D12F' },
    { value: 22.5, color: '#40C02B' },
    { value: 24, color: '#3AB027' },
    { value: 25.5, color: '#34A022' },
    { value: 27, color: '#2C891D' },
    { value: 28.5, color: '#247217' },
    { value: 30, color: '#EDEF3D', hardStop: true },
    { value: 31.5, color: '#E1E439' },
    { value: 33, color: '#D6DA34' },
    { value: 34.5, color: '#CDD230' },
    { value: 36, color: '#C0C62B' },
    { value: 37.5, color: '#CEAD20' },
    { value: 39, color: '#D69719' },
    { value: 40.5, color: '#DB8115' },
    { value: 42, color: '#EB0B2E', hardStop: true },
    { value: 43.5, color: '#CB001B' },
    { value: 45, color: '#C10015' },
    { value: 46.5, color: '#B20009' },
    { value: 48, color: '#9B0000' },
    { value: 49.5, color: '#C2005F', hardStop: true },
    { value: 51, color: '#D600A0' },
    { value: 52.5, color: '#EA00EA' },
    { value: 54, color: '#CB00CD' },
    { value: 55.5, color: '#B300B7' },
    { value: 57, color: '#9A00A0' },
    { value: 58.5, color: '#FFFFFF', hardStop: true },
    { value: 60, color: '#DFF6ED' },
    { value: 61.5, color: '#C6F1E1' },
    { value: 63, color: '#B7ECD8' },
    { value: 64.5, color: '#A7ECCF' },
    { value: 66, color: '#97E3C6' },
    { value: 67.5, color: '#97E3C6' },
    { value: 69, color: '#87DFBE' },
    { value: 70.5, color: '#87DFBE' },
    { value: 72, color: '#87DFBE' },
    { value: 73.5, color: '#87DFBE' },
    { value: 75, color: '#87DFBE' },
    { value: 76.5, color: '#87DFBE' },
  ] as const,
});
