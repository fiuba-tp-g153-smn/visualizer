import {
  ActiveLayerGroupId,
  BarbTileRender,
  ForecastModelTileLayer,
  LayerCategory,
  LayerType,
  ScaleRangeInfo,
  SecondaryVectorRender,
} from '../../../models';
import { GFS_UNITS } from '../../../constants';
import { LayerSubgroup } from '../../../models/layers/groups.models';
import { buildGfsGeojsonUrl } from '../../backend.config';
import { GFS_WIND_250_SCALE, GFS_WIND_500_SCALE } from './scales.config';
import {
  HEIGHTS_250_TEXTPATH_OPTIONS,
  HEIGHTS_500_TEXTPATH_OPTIONS,
  ISOBAR_TEXTPATH_OPTIONS,
  ISOTHERM_TEXTPATH_OPTIONS,
  THICKNESS_TEXTPATH_OPTIONS,
  heights250StyleFor,
  heights500StyleFor,
  integerLabelFor,
  isobarStyleFor,
  isothermLabelFor,
  isothermStyleFor,
  thicknessStyleFor,
} from './gfs-overlay-styles';

/**
 * Capas del modelo global GFS 0.25°.
 *
 * Los tres productos reproducen las cartas que el SMN genera con GrADS
 * (`slpb.gs`, `tgv500b.gs`, `250b.gs`). Comparten la misma maquinaria de
 * corridas y pasos que WRF: lo único propio es `modelId: 'gfs'`, que enruta
 * las URLs y el parseo de la etiqueta de corrida al adaptador correcto.
 */
const GFS_DEFAULTS = {
  type: LayerType.TILE,
  category: LayerCategory.WRF,
  modelId: 'gfs',
  zIndexGroup: ActiveLayerGroupId.BASE,
  // Cantidad de pasos a animar. La corrida trae 33: 3-horarios hasta +48h
  // (17 pasos) y 6-horarios hasta +144h. 17 cae justo en ese quiebre.
  availablePeriods: [8, 17, 25, 33] as const,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
  isForecast: true,
} as const;

const contourRender = (
  productId: string,
  layerName: string,
  opts: {
    styleFor: SecondaryVectorRender['styleFor'];
    labelFor: SecondaryVectorRender['labelFor'];
    textpathOptions: SecondaryVectorRender['textpathOptions'];
    valueProperty: string;
    minLabelLengthDeg?: number;
    pointQuery?: SecondaryVectorRender['pointQuery'];
  },
): SecondaryVectorRender => ({
  id: `gfs-${productId}-${layerName}`,
  buildUrl: (cycle, fxxx) => buildGfsGeojsonUrl(productId, cycle, fxxx, layerName),
  backendLayerName: layerName,
  valueProperty: opts.valueProperty,
  styleFor: opts.styleFor,
  labelFor: opts.labelFor,
  textpathOptions: opts.textpathOptions,
  minLabelLengthDeg: opts.minLabelLengthDeg,
  pointQuery: opts.pointQuery,
  prefetchWindow: 4,
});

/**
 * Variables secundarias consultables en el dato puntual. `variable` es la clave
 * del COG que tiles-processor sube junto al primario, y nombra el campo, no el
 * tipo de línea del overlay que espeja: el COG de `heights` es `geopotential` y
 * el de `isotherms` es `temperature`.
 *
 * `name` sí repite la etiqueta que el menú ya le da al overlay. No es
 * redundancia: `getForecastRenderName` prefiere este nombre sobre su propia
 * tabla, así que cualquier otro texto renombraría el item del menú de paso.
 *
 * Los rangos ubican el valor en la barra de escala y son los rangos físicos
 * habituales de cada campo, no los del COG concreto.
 */
const THICKNESS_POINT_QUERY = {
  variable: 'thickness',
  name: 'Espesores 1000/500',
  unit: GFS_UNITS.GEOPOTENTIAL,
  scaleRange: { min: 4800, max: 6000, totalSteps: 20 },
} as const;

const TEMPERATURE_500_POINT_QUERY = {
  variable: 'temperature',
  name: 'Isotermas',
  unit: GFS_UNITS.TEMPERATURE,
  scaleRange: { min: -50, max: 10, totalSteps: 12 },
} as const;

const geopotentialPointQuery = (scaleRange: ScaleRangeInfo) =>
  ({
    variable: 'geopotential',
    name: 'Geopotencial',
    unit: GFS_UNITS.GEOPOTENTIAL,
    scaleRange,
  }) as const;

export const GFS_SUBGROUP: LayerSubgroup = {
  id: 'gfs',
  name: 'GFS',
  description: 'Modelo global GFS 0.25° del NCEP',
  expanded: false,
  layers: [
    {
      ...GFS_DEFAULTS,
      id: 'gfs/mslp',
      productId: 'mslp',
      name: 'Presión a nivel del mar',
      pointQueryLabel: 'Presión a nivel del mar',
      description:
        'Presión a nivel del mar (isobaras cada 3 hPa) y espesores 1000/500 cada 60 m — GFS. ' +
        'Los espesores de 5280, 5400, 5580 y 5700 m se resaltan en color.',
      // Carta de puro contorno: `slpb.gs` no sombrea nada, así que
      // tiles-processor no genera pirámide raster para este producto.
      hasRaster: false,
      // Sin raster no hay leyenda de colores, pero el COG existe y el dato
      // puntual funciona: este rango es el que lo ubica en la barra.
      pointQueryScaleRange: { min: 950, max: 1050, totalSteps: 100 },
      secondaryRenders: [
        contourRender('mslp', 'thickness', {
          valueProperty: 'thickness_gpm',
          styleFor: thicknessStyleFor,
          labelFor: integerLabelFor,
          textpathOptions: THICKNESS_TEXTPATH_OPTIONS,
          minLabelLengthDeg: 6.0,
          pointQuery: THICKNESS_POINT_QUERY,
        }),
        contourRender('mslp', 'isobars', {
          valueProperty: 'pressure_hpa',
          styleFor: isobarStyleFor,
          labelFor: integerLabelFor,
          textpathOptions: ISOBAR_TEXTPATH_OPTIONS,
          minLabelLengthDeg: 6.0,
        }),
      ],
    },
    {
      ...GFS_DEFAULTS,
      id: 'gfs/500hpa',
      productId: '500hpa',
      name: '500 hPa',
      pointQueryLabel: 'Intensidad del viento en 500 hPa',
      description:
        'Viento en 500 hPa (kt) — GFS. Geopotencial cada 60 m, isotermas cada 5 °C y barbas de viento.',
      scale: GFS_WIND_500_SCALE,
      secondaryRenders: [
        contourRender('500hpa', 'isotherms', {
          valueProperty: 'temp_c',
          styleFor: isothermStyleFor,
          labelFor: isothermLabelFor,
          textpathOptions: ISOTHERM_TEXTPATH_OPTIONS,
          pointQuery: TEMPERATURE_500_POINT_QUERY,
        }),
        contourRender('500hpa', 'heights', {
          valueProperty: 'height_gpm',
          styleFor: heights500StyleFor,
          labelFor: integerLabelFor,
          textpathOptions: HEIGHTS_500_TEXTPATH_OPTIONS,
          pointQuery: geopotentialPointQuery({ min: 4800, max: 6000, totalSteps: 20 }),
        }),
        // Último para que las barbas queden por encima de los contornos.
        { kind: 'barb-tile', id: 'gfs-500hpa-barbs' } as BarbTileRender,
      ],
    },
    {
      ...GFS_DEFAULTS,
      id: 'gfs/250hpa',
      productId: '250hpa',
      name: '250 hPa',
      pointQueryLabel: 'Intensidad del viento en 250 hPa',
      description: 'Viento en 250 hPa (kt) — GFS. Geopotencial cada 60 m.',
      scale: GFS_WIND_250_SCALE,
      secondaryRenders: [
        contourRender('250hpa', 'heights', {
          valueProperty: 'height_gpm',
          styleFor: heights250StyleFor,
          labelFor: integerLabelFor,
          textpathOptions: HEIGHTS_250_TEXTPATH_OPTIONS,
          pointQuery: geopotentialPointQuery({ min: 9600, max: 11200, totalSteps: 16 }),
        }),
      ],
    },
  ] as ForecastModelTileLayer[],
};
