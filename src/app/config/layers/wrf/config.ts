import {
  ActiveLayerGroupId,
  BarbTileRender,
  LayerCategory,
  LayerType,
  SecondaryVectorRender,
  WrfTileLayer,
} from '../../../models';
import { WRF_UNITS } from '../../../constants';
import { LayerSubgroup } from '../../../models/layers/groups.models';
import { buildWrfGeojsonUrl } from '../../backend.config';
import {
  WRF_AGUAPRECIPITABLE_SCALE,
  WRF_CAMPO900_SCALE,
  WRF_CAPE_BRN_SCALE,
  WRF_CORTANTE_SCALE,
  WRF_GRANIZO_SCALE,
  WRF_JETCAPASBAJAS_SCALE,
  WRF_MUCAPE_SCALE,
  WRF_PRECIPITACION1H_SCALE,
  WRF_RAFAGAS_SCALE,
} from './scales.config';
import {
  BRN_TEXTPATH_OPTIONS,
  GUST_TEXTPATH_OPTIONS,
  HAILDIAM_TEXTPATH_OPTIONS,
  SHEAR_850_500_TEXTPATH_OPTIONS,
  SHEAR_850_700_TEXTPATH_OPTIONS,
  SLP_TEXTPATH_OPTIONS,
  brnStyleFor,
  gustThresholdStyleFor,
  haildiamLabelFor,
  haildiamStyleFor,
  numericLabelFor,
  shear850_500StyleFor,
  shear850_700StyleFor,
  slpLabelFor,
  slpStyleFor,
} from './wrf-overlay-styles';
import { SHARED_DBZH_SCALE } from '../shared-scales.config';

const WRF_DEFAULTS = {
  type: LayerType.TILE,
  category: LayerCategory.WRF,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [6, 12, 24, 48, 72] as const,
  minNativeZoom: 4,
  maxNativeZoom: 9,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
  isForecast: true,
} as const;

// ============================================================================
// Secondary renders factories — backend GeoJSON layer names mapped to
// `SecondaryVectorRender` configs. The `id` is used as a stable cache key.
// ============================================================================

// Variable de viento (magnitud de las barbas), consultable en el dato puntual.
// `variable: 'wind'` matchea el COG secundario del backend.
const WIND_POINT_QUERY = {
  variable: 'wind',
  name: 'Viento',
  unit: WRF_UNITS.WIND_SPEED,
  scaleRange: { min: 0, max: 80, totalSteps: 80 },
} as const;

// `withWindPointQuery=false` para productos cuyas barbas no son viento real
// (ej. CortanteNivelesBajos usa el vector de cizalladura = igual al primary).
const barbsRender = (productId: string, withWindPointQuery = true): BarbTileRender => ({
  kind: 'barb-tile',
  id: `wrf-${productId}-barbs`,
  ...(withWindPointQuery ? { pointQuery: { ...WIND_POINT_QUERY } } : {}),
});

const slpRender = (productId: string): SecondaryVectorRender => ({
  id: `wrf-${productId}-slp`,
  buildUrl: (initTag, fxxx) => buildWrfGeojsonUrl(productId, initTag, fxxx, 'slp'),
  valueProperty: 'value',
  styleFor: slpStyleFor,
  labelFor: slpLabelFor,
  textpathOptions: SLP_TEXTPATH_OPTIONS,
  prefetchWindow: 4,
  pointQuery: {
    variable: 'slp',
    name: 'Presión a nivel del mar',
    unit: WRF_UNITS.SEA_LEVEL_PRESSURE,
    scaleRange: { min: 950, max: 1050, totalSteps: 100 },
  },
});

interface ContourRenderOptions {
  styleFor: SecondaryVectorRender['styleFor'];
  textpathOptions: SecondaryVectorRender['textpathOptions'];
  labelFor?: SecondaryVectorRender['labelFor'];
  minLabelLengthDeg?: SecondaryVectorRender['minLabelLengthDeg'];
  pointQuery?: SecondaryVectorRender['pointQuery'];
}

const contourRender = (
  productId: string,
  layerName: string,
  opts: ContourRenderOptions,
): SecondaryVectorRender => ({
  id: `wrf-${productId}-${layerName}`,
  buildUrl: (initTag, fxxx) => buildWrfGeojsonUrl(productId, initTag, fxxx, layerName),
  valueProperty: 'value',
  styleFor: opts.styleFor,
  labelFor: opts.labelFor ?? numericLabelFor,
  textpathOptions: opts.textpathOptions,
  prefetchWindow: 4,
  minLabelLengthDeg: opts.minLabelLengthDeg,
  pointQuery: opts.pointQuery,
});

export const WRF_SUBGROUP: LayerSubgroup = {
  id: 'wrf',
  name: 'WRF',
  description: 'Modelo numérico WRF-ARG4K del Servicio Meteorológico Nacional',
  expanded: false,
  layers: [
    {
      ...WRF_DEFAULTS,
      id: 'wrf/Colmax',
      productId: 'Colmax',
      name: 'Reflectividad máxima columna',
      description: 'Reflectividad máxima en la columna (dBZ) — WRF-ARG4K',
      scale: SHARED_DBZH_SCALE,
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/Rafagas',
      productId: 'Rafagas',
      name: 'Ráfagas en superficie',
      description:
        'Ráfagas viento 10 m (kt) — WRF-ARG4K. Barbas de viento. Contorno azul en 35 kt.',
      scale: WRF_RAFAGAS_SCALE,
      secondaryRenders: [
        barbsRender('Rafagas'),
        contourRender('Rafagas', 'gust_threshold', {
          styleFor: gustThresholdStyleFor,
          textpathOptions: GUST_TEXTPATH_OPTIONS,
          minLabelLengthDeg: 5.0,
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/Campo900hPa',
      productId: 'Campo900hPa',
      name: 'Humedad específica 900 hPa',
      description:
        'Humedad específica 900 hPa (g/kg) — WRF-ARG4K. Barbas de viento. Máscara marrón en cordillera y zona sur.',
      scale: WRF_CAMPO900_SCALE,
      secondaryRenders: [barbsRender('Campo900hPa')],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/Precipitacion1h',
      productId: 'Precipitacion1h',
      name: 'Precipitación 1h',
      description:
        'Precipitación acumulada 1 hora (mm) — WRF-ARG4K. Barbas de viento. Isobaras de presión a nivel del mar (976/984/992/1000/1008/1016 hPa).',
      scale: WRF_PRECIPITACION1H_SCALE,
      secondaryRenders: [barbsRender('Precipitacion1h'), slpRender('Precipitacion1h')],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/MUCAPE',
      productId: 'MUCAPE',
      name: 'MUCAPE',
      description: 'CAPE máximo (J/kg) — WRF-ARG4K',
      scale: WRF_MUCAPE_SCALE,
      secondaryRenders: [
        contourRender('MUCAPE', 'shear_850_500', {
          styleFor: shear850_500StyleFor,
          textpathOptions: SHEAR_850_500_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'shear_850_500',
            name: 'Cortante 850-500 hPa',
            unit: WRF_UNITS.WIND_SPEED,
            scaleRange: { min: 0, max: 60, totalSteps: 60 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/AguaPrecipitable',
      productId: 'AguaPrecipitable',
      name: 'Agua precipitable',
      description: 'Agua precipitable (mm) — WRF-ARG4K',
      scale: WRF_AGUAPRECIPITABLE_SCALE,
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/JetCapasBajas',
      productId: 'JetCapasBajas',
      name: 'Jet capas bajas',
      description:
        'Componente meridional del viento 850 hPa (kt) — WRF-ARG4K. Barbas de viento. Contornos de cizalladura 850–700 hPa (6/10/14 kt). Máscara marrón en cordillera y zona sur.',
      scale: WRF_JETCAPASBAJAS_SCALE,
      secondaryRenders: [
        barbsRender('JetCapasBajas'),
        contourRender('JetCapasBajas', 'shear_850_700', {
          styleFor: shear850_700StyleFor,
          textpathOptions: SHEAR_850_700_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'shear_850_700',
            name: 'Cortante 850-700 hPa',
            unit: WRF_UNITS.WIND_SPEED,
            scaleRange: { min: 0, max: 30, totalSteps: 30 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/CortanteNivelesBajos',
      productId: 'CortanteNivelesBajos',
      name: 'Cortante niveles bajos',
      description: 'Cortante sigma1-sigma2 (kt) — WRF-ARG4K',
      scale: WRF_CORTANTE_SCALE,
      secondaryRenders: [barbsRender('CortanteNivelesBajos', false)],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/CAPE_BRN',
      productId: 'CAPE_BRN',
      name: 'CAPE + BRN',
      description:
        'CAPE máximo + Bulk Richardson Number — WRF-ARG4K. Contornos BRN (niveles 10 y 45).',
      scale: WRF_CAPE_BRN_SCALE,
      secondaryRenders: [
        contourRender('CAPE_BRN', 'brn', {
          styleFor: brnStyleFor,
          textpathOptions: BRN_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'brn',
            name: 'Bulk Richardson Number',
            unit: WRF_UNITS.DIMENSIONLESS,
            scaleRange: { min: 0, max: 100, totalSteps: 100 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf/Granizo',
      productId: 'Granizo',
      name: 'Granizo (SHIP)',
      description:
        'Severe Hail Parameter + diámetro Hailcast — WRF-ARG4K. Contornos de diámetro de granizo (0.5/3/5 cm). Máscara marrón en cordillera y zona sur.',
      scale: WRF_GRANIZO_SCALE,
      secondaryRenders: [
        contourRender('Granizo', 'haildiammax', {
          styleFor: haildiamStyleFor,
          textpathOptions: HAILDIAM_TEXTPATH_OPTIONS,
          labelFor: haildiamLabelFor,
          pointQuery: {
            variable: 'haildiammax',
            name: 'Diámetro máximo de granizo',
            unit: WRF_UNITS.HAIL_DIAMETER,
            scaleRange: { min: 0, max: 100, totalSteps: 100 },
          },
        }),
      ],
    },
  ] as WrfTileLayer[],
};
