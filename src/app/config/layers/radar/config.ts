import {
  LayerSubgroup,
  LayerType,
  LayerCategory,
  ActiveLayerGroupId,
  RadarTileLayer,
} from '../../../models';

/**
 * Valores por defecto para capas RADAR
 */
const RADAR_DEFAULTS = {
  type: LayerType.TILE,
  groupId: 'radar',
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12] as const,
  availableElevations: ['elev0', 'elev1', 'elev2'] as const,
  category: LayerCategory.RADAR,
};

const radarCount = 17;
const products = ['DBZH', 'KDP', 'VRAD', 'RHOHV', 'ZDR'];

export const RADAR_SUBGROUPS: LayerSubgroup[] = Array.from({ length: radarCount }, (_, i) => {
  const subgroupId = `rma${i + 1}`;
  return {
    id: subgroupId,
    name: `RADAR ${i + 1}`,
    description: `Capas del radar meteorológico ${i + 1}`,
    groupId: 'radar',
    expanded: false,
    layers: products.map((product) => ({
      ...RADAR_DEFAULTS,
      id: `rma${i + 1}-${product.toLowerCase()}`,
      subgroupId,
      name: `${product} - RADAR ${i + 1}`,
      description: `Producto ${product} del radar meteorológico ${i + 1}`,
    })) as RadarTileLayer[],
  };
});
