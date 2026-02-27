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
      name: 'Elevación 0.6°',
    },
    {
      id: 'elev1',
      name: 'Elevación 0.9°',
    },
    {
      id: 'elev2',
      name: 'Elevación 1.3°',
    },
  ] as const,
  category: LayerCategory.RADAR,
};

const satelitePrefix = 'radar';

const products = ['DBZH', 'KDP', 'VRAD', 'RHOHV', 'ZDR'];

// Ubicaciones de los 17 radares de la red SINARAME (SMN/INTA)
const RADARES_SMN = [
  { id: 'rma1', number: 1, ubi: 'Córdoba' },
  { id: 'rma2', number: 2, ubi: 'Ezeiza' },
  { id: 'rma3', number: 3, ubi: 'Las Lomitas' },
  { id: 'rma4', number: 4, ubi: 'Resistencia' },
  { id: 'rma5', number: 5, ubi: 'Bernardo de Irigoyen' },
  { id: 'rma6', number: 6, ubi: 'Mar del Plata' },
  { id: 'rma7', number: 7, ubi: 'Neuquén' },
  { id: 'rma8', number: 8, ubi: 'Mercedes' },
  { id: 'rma9', number: 9, ubi: 'Termas de Río Hondo' },
  { id: 'rma10', number: 10, ubi: 'Paraná' },
  { id: 'rma11', number: 11, ubi: 'Pergamino' },
  { id: 'rma12', number: 12, ubi: 'Anguil' },
  { id: 'rma13', number: 13, ubi: 'Bahía Blanca' },
  { id: 'rma14', number: 14, ubi: 'Bariloche' },
  { id: 'rma15', number: 15, ubi: 'Río Grande' },
  { id: 'rma16', number: 16, ubi: 'Viedma' },
  { id: 'rma17', number: 17, ubi: 'Yuto' },
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
  })) as RadarTileLayer[],
}));
