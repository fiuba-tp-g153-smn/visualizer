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
import { LAYER_NAMES } from '../../../texts';

const WRF_DEFAULTS = {
  type: LayerType.TILE,
  category: LayerCategory.WRF,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [6, 12, 24, 48, 72] as const,
  minNativeZoom: 4,
  maxNativeZoom: 6,
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
  name: LAYER_NAMES.wrf.viento.name,
  unit: WRF_UNITS.WIND_SPEED,
  scaleRange: { min: 0, max: 80, totalSteps: 80 },
} as const;

// `withWindPointQuery=false` para productos cuyas barbas no son viento real
// (ej. CortanteNivelesBajos usa el vector de cizalladura = igual al primary).
const barbsRender = (productId: string, withWindPointQuery = true): BarbTileRender => ({
  kind: 'barb-tile',
  id: `wrf-arg4k-${productId}-barbs`,
  ...(withWindPointQuery ? { pointQuery: { ...WIND_POINT_QUERY } } : {}),
});

const slpRender = (productId: string): SecondaryVectorRender => ({
  id: `wrf-arg4k-${productId}-slp`,
  buildUrl: (initTag, fxxx) => buildWrfGeojsonUrl(productId, initTag, fxxx, 'slp'),
  backendLayerName: 'slp',
  valueProperty: 'value',
  styleFor: slpStyleFor,
  labelFor: slpLabelFor,
  textpathOptions: SLP_TEXTPATH_OPTIONS,
  prefetchWindow: 4,
  pointQuery: {
    variable: 'slp',
    name: LAYER_NAMES.wrf.presionANivelDelMar.name,
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
  id: `wrf-arg4k-${productId}-${layerName}`,
  buildUrl: (initTag, fxxx) => buildWrfGeojsonUrl(productId, initTag, fxxx, layerName),
  backendLayerName: layerName,
  valueProperty: 'value',
  styleFor: opts.styleFor,
  labelFor: opts.labelFor ?? numericLabelFor,
  textpathOptions: opts.textpathOptions,
  prefetchWindow: 4,
  minLabelLengthDeg: opts.minLabelLengthDeg,
  pointQuery: opts.pointQuery,
});

export const WRF_SUBGROUP: LayerSubgroup = {
  id: 'wrf-arg4k',
  name: LAYER_NAMES.wrf.wrfArg4k.name,
  description: LAYER_NAMES.wrf.wrfArg4k.description,
  expanded: false,
  layers: [
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/colmax',
      productId: 'colmax',
      name: LAYER_NAMES.wrf.wrfArg4kColmax.name,
      description: LAYER_NAMES.wrf.wrfArg4kColmax.description,
      scale: SHARED_DBZH_SCALE,
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/rafagas',
      productId: 'rafagas',
      name: LAYER_NAMES.wrf.wrfArg4kRafagas.name,
      description: LAYER_NAMES.wrf.wrfArg4kRafagas.description,
      scale: WRF_RAFAGAS_SCALE,
      secondaryRenders: [
        barbsRender('rafagas'),
        contourRender('rafagas', 'gust_threshold', {
          styleFor: gustThresholdStyleFor,
          textpathOptions: GUST_TEXTPATH_OPTIONS,
          minLabelLengthDeg: 5.0,
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/campo-900hpa',
      productId: 'campo-900hpa',
      name: LAYER_NAMES.wrf.wrfArg4kCampo900hpa.name,
      description: LAYER_NAMES.wrf.wrfArg4kCampo900hpa.description,
      scale: WRF_CAMPO900_SCALE,
      secondaryRenders: [barbsRender('campo-900hpa')],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/precipitacion-1h',
      productId: 'precipitacion-1h',
      name: LAYER_NAMES.wrf.wrfArg4kPrecipitacion1h.name,
      pointQueryLabel: LAYER_NAMES.wrf.wrfArg4kPrecipitacion1h.pointQueryLabel,
      description: LAYER_NAMES.wrf.wrfArg4kPrecipitacion1h.description,
      scale: WRF_PRECIPITACION1H_SCALE,
      secondaryRenders: [barbsRender('precipitacion-1h'), slpRender('precipitacion-1h')],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/mucape',
      productId: 'mucape',
      name: LAYER_NAMES.wrf.wrfArg4kMucape.name,
      description: LAYER_NAMES.wrf.wrfArg4kMucape.description,
      scale: WRF_MUCAPE_SCALE,
      secondaryRenders: [
        contourRender('mucape', 'shear_850_500', {
          styleFor: shear850_500StyleFor,
          textpathOptions: SHEAR_850_500_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'shear_850_500',
            name: LAYER_NAMES.wrf.cortante850500Hpa.name,
            unit: WRF_UNITS.WIND_SPEED,
            scaleRange: { min: 0, max: 60, totalSteps: 60 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/agua-precipitable',
      productId: 'agua-precipitable',
      name: LAYER_NAMES.wrf.wrfArg4kAguaPrecipitable.name,
      description: LAYER_NAMES.wrf.wrfArg4kAguaPrecipitable.description,
      scale: WRF_AGUAPRECIPITABLE_SCALE,
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/jet-capas-bajas',
      productId: 'jet-capas-bajas',
      name: LAYER_NAMES.wrf.wrfArg4kJetCapasBajas.name,
      pointQueryLabel: LAYER_NAMES.wrf.wrfArg4kJetCapasBajas.pointQueryLabel,
      description: LAYER_NAMES.wrf.wrfArg4kJetCapasBajas.description,
      scale: WRF_JETCAPASBAJAS_SCALE,
      secondaryRenders: [
        barbsRender('jet-capas-bajas'),
        contourRender('jet-capas-bajas', 'shear_850_700', {
          styleFor: shear850_700StyleFor,
          textpathOptions: SHEAR_850_700_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'shear_850_700',
            name: LAYER_NAMES.wrf.cortante850700Hpa.name,
            unit: WRF_UNITS.WIND_SPEED,
            scaleRange: { min: 0, max: 30, totalSteps: 30 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/cortante-niveles-bajos',
      productId: 'cortante-niveles-bajos',
      name: LAYER_NAMES.wrf.wrfArg4kCortanteNivelesBajos.name,
      pointQueryLabel: LAYER_NAMES.wrf.wrfArg4kCortanteNivelesBajos.pointQueryLabel,
      description: LAYER_NAMES.wrf.wrfArg4kCortanteNivelesBajos.description,
      scale: WRF_CORTANTE_SCALE,
      secondaryRenders: [barbsRender('cortante-niveles-bajos', false)],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/cape-brn',
      productId: 'cape-brn',
      name: LAYER_NAMES.wrf.wrfArg4kCapeBrn.name,
      pointQueryLabel: LAYER_NAMES.wrf.wrfArg4kCapeBrn.pointQueryLabel,
      description: LAYER_NAMES.wrf.wrfArg4kCapeBrn.description,
      scale: WRF_CAPE_BRN_SCALE,
      secondaryRenders: [
        contourRender('cape-brn', 'brn', {
          styleFor: brnStyleFor,
          textpathOptions: BRN_TEXTPATH_OPTIONS,
          pointQuery: {
            variable: 'brn',
            name: LAYER_NAMES.wrf.bulkRichardsonNumber.name,
            unit: WRF_UNITS.DIMENSIONLESS,
            scaleRange: { min: 0, max: 100, totalSteps: 100 },
          },
        }),
      ],
    },
    {
      ...WRF_DEFAULTS,
      id: 'wrf-arg4k/granizo',
      productId: 'granizo',
      name: LAYER_NAMES.wrf.wrfArg4kGranizo.name,
      pointQueryLabel: LAYER_NAMES.wrf.wrfArg4kGranizo.pointQueryLabel,
      description: LAYER_NAMES.wrf.wrfArg4kGranizo.description,
      scale: WRF_GRANIZO_SCALE,
      secondaryRenders: [
        contourRender('granizo', 'haildiammax', {
          styleFor: haildiamStyleFor,
          textpathOptions: HAILDIAM_TEXTPATH_OPTIONS,
          labelFor: haildiamLabelFor,
          pointQuery: {
            variable: 'haildiammax',
            name: LAYER_NAMES.wrf.diametroMaximoDeGranizo.name,
            unit: WRF_UNITS.HAIL_DIAMETER,
            scaleRange: { min: 0, max: 100, totalSteps: 100 },
          },
        }),
      ],
    },
  ] as WrfTileLayer[],
};
