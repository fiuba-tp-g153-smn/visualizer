import {
  ActiveLayerGroupId,
  LayerCategory,
  LayerSubgroup,
  LayerType,
  RadarTileLayer,
} from '../../../models';

/**
 * Valores por defecto para capas RADAR
 */
const RADAR_DEFAULTS = {
  type: LayerType.TILE,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12] as const,
  availableElevations: [
    {
      id: 'elev0',
      name: '0.6°',
      activeByDefault: true,
    },
    // {
    //   id: 'elev1',
    //   name: '0.9°',
    //   activeByDefault: false,
    // },
    // {
    //   id: 'elev2',
    //   name: '1.3°',
    //   activeByDefault: false,
    // },
  ] as const,
  category: LayerCategory.RADAR,
  tms: true,
};

const satelitePrefix = 'radar';
const products = ['DBZH']; // 'KDP', 'VRAD', 'RHOHV', 'ZDR'
const MIN_ZOOM = 4;
const MAX_ZOOM = 10;

// Ubicaciones y configuraciones de los 17 radares de la red SINARAME (SMN/INTA)
const RADARES_SMN = [
  {
    id: 'rma1',
    number: 1,
    ubi: 'Córdoba',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-33.6, -66.78],
      [-29.26, -61.6],
    ] as const,
  },
  {
    id: 'rma2',
    number: 2,
    ubi: 'Ezeiza',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-36.96, -61.22],
      [-32.62, -55.82],
    ] as const,
  },
  {
    id: 'rma3',
    number: 3,
    ubi: 'Las Lomitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-26.89, -62.97],
      [-22.55, -58.13],
    ] as const,
  },
  {
    id: 'rma4',
    number: 4,
    ubi: 'Resistencia',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.61, -61.53],
      [-25.27, -56.57],
    ] as const,
  },
  {
    id: 'rma5',
    number: 5,
    ubi: 'Bernardo de Irigoyen',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-28.44, -56.12],
      [-24.1, -51.22],
    ] as const,
  },
  {
    id: 'rma6',
    number: 6,
    ubi: 'Mar del Plata',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-40.07, -60.35],
      [-35.72, -54.71],
    ] as const,
  },
  {
    id: 'rma7',
    number: 7,
    ubi: 'Neuquén',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-41.03, -71.0],
      [-36.69, -65.29],
    ] as const,
  },
  {
    id: 'rma8',
    number: 8,
    ubi: 'Mercedes',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-31.35, -60.57],
      [-27.02, -55.52],
    ] as const,
  },
  {
    id: 'rma9',
    number: 9,
    ubi: 'Río Grande',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-55.94, -71.59],
      [-51.57, -63.89],
    ] as const,
  },
  {
    id: 'rma10',
    number: 10,
    ubi: 'Bahía Blanca',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-40.89, -65.02],
      [-36.54, -59.31],
    ] as const,
  },
  {
    id: 'rma11',
    number: 11,
    ubi: 'Termas de Río Hondo',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.66, -67.39],
      [-25.32, -62.42],
    ] as const,
  },
  {
    id: 'rma12',
    number: 12,
    ubi: 'Villa Reynolds',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-42.93, -68.02],
      [-38.58, -62.13],
    ] as const,
  },
  {
    id: 'rma13',
    number: 13,
    ubi: 'Las Lajitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.78, -59.33],
      [-25.44, -54.36],
    ] as const,
  },
  {
    id: 'rma14',
    number: 14,
    ubi: 'Las Catitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-38.35, -63.82],
      [-34.0, -58.32],
    ] as const,
  },
  {
    id: 'rma15',
    number: 15,
    ubi: 'Bolívar',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-32.19, -69.43],
      [-27.85, -64.33],
    ] as const,
  },
  {
    id: 'rma16',
    number: 16,
    ubi: 'Tostado',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-35.88, -68.04],
      [-31.53, -62.71],
    ] as const,
  },
  {
    id: 'rma17',
    number: 17,
    ubi: 'Patquia',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-35.51, -66.35],
      [-31.17, -61.05],
    ] as const,
  },
];

export const RADAR_SUBGROUPS: LayerSubgroup[] = RADARES_SMN.map((radar) => ({
  id: radar.id,
  name: `Radar ${radar.number} - ${radar.ubi}`,
  description: `Capas del radar meteorológico ${radar.number} de ${radar.ubi}`,
  expanded: false,
  layers: products.map((product) => ({
    ...RADAR_DEFAULTS,
    id: `${satelitePrefix}/${radar.id.toUpperCase()}/${product}`,
    name: `${product} - ${radar.ubi}`,
    description: `Producto ${product} del radar meteorológico ${radar.number} de ${radar.ubi}`,
    minNativeZoom: radar.minNativeZoom,
    maxNativeZoom: radar.maxNativeZoom,
    boundingBox: radar.boundingBox,
  })) as RadarTileLayer[],
}));
