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
    {
      id: 'elev1',
      name: '0.9°',
      activeByDefault: false,
    },
    {
      id: 'elev2',
      name: '1.3°',
      activeByDefault: false,
    },
  ] as const,
  category: LayerCategory.RADAR,
};

const satelitePrefix = 'radar';
const products = ['DBZH', 'KDP', 'VRAD', 'RHOHV', 'ZDR'];
const MIN_ZOOM = 4;
const MAX_ZOOM = 7;

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
      [-36.0, -60.0],
      [-33.0, -57.0],
    ] as const,
  },
  {
    id: 'rma3',
    number: 3,
    ubi: 'Las Lomitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-26.0, -62.0],
      [-23.0, -59.0],
    ] as const,
  },
  {
    id: 'rma4',
    number: 4,
    ubi: 'Resistencia',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.0, -61.0],
      [-26.0, -58.0],
    ] as const,
  },
  {
    id: 'rma5',
    number: 5,
    ubi: 'Bernardo de Irigoyen',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-28.0, -55.0],
      [-25.0, -52.0],
    ] as const,
  },
  {
    id: 'rma6',
    number: 6,
    ubi: 'Mar del Plata',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-40.0, -60.0],
      [-37.0, -57.0],
    ] as const,
  },
  {
    id: 'rma7',
    number: 7,
    ubi: 'Neuquén',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-41.0, -72.0],
      [-38.0, -69.0],
    ] as const,
  },
  {
    id: 'rma8',
    number: 8,
    ubi: 'Mercedes',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-31.0, -60.0],
      [-28.0, -57.0],
    ] as const,
  },
  {
    id: 'rma9',
    number: 9,
    ubi: 'Termas de Río Hondo',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-30.0, -66.0],
      [-27.0, -63.0],
    ] as const,
  },
  {
    id: 'rma10',
    number: 10,
    ubi: 'Paraná',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-33.0, -62.0],
      [-30.0, -59.0],
    ] as const,
  },
  {
    id: 'rma11',
    number: 11,
    ubi: 'Pergamino',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-35.0, -62.0],
      [-32.0, -59.0],
    ] as const,
  },
  {
    id: 'rma12',
    number: 12,
    ubi: 'Anguil',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-38.0, -66.0],
      [-35.0, -63.0],
    ] as const,
  },
  {
    id: 'rma13',
    number: 13,
    ubi: 'Bahía Blanca',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-41.0, -64.0],
      [-38.0, -61.0],
    ] as const,
  },
  {
    id: 'rma14',
    number: 14,
    ubi: 'Bariloche',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-43.0, -73.0],
      [-40.0, -70.0],
    ] as const,
  },
  {
    id: 'rma15',
    number: 15,
    ubi: 'Río Grande',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-55.0, -69.0],
      [-52.0, -66.0],
    ] as const,
  },
  {
    id: 'rma16',
    number: 16,
    ubi: 'Viedma',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-42.0, -65.0],
      [-39.0, -62.0],
    ] as const,
  },
  {
    id: 'rma17',
    number: 17,
    ubi: 'Yuto',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-25.0, -66.0],
      [-22.0, -63.0],
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
