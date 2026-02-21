import {
  LayerSubgroup,
  LayerType,
  LayerCategory,
  ActiveLayerGroup,
  TileLayer,
} from '../../../models';

/**
 * Valores por defecto para capas RADAR
 */
const RADAR_DEFAULTS = {
  type: LayerType.TILE,
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroup.BASE,
  availablePeriods: [1, 6, 12] as const,
  availableElevations: ['elev0', 'elev1', 'elev2'] as const,
  elevationIndex: 0, // Por defecto elev0
  category: LayerCategory.RADAR,
};

const radarCount = 17;
const products = ['DBZH', 'KDP', 'VRAD', 'RHOHV', 'ZDR'];

export const RADAR_SUBGROUPS: LayerSubgroup[] = Array.from({ length: radarCount }, (_, i) => {
  return {
    id: `rma${i + 1}`,
    name: `RADAR ${i + 1}`,
    description: `Capas del radar meteorológico ${i + 1}`,
    expanded: false,
    layers: products.map((product) => ({
      ...RADAR_DEFAULTS,
      id: `rma${i + 1}-${product.toLowerCase()}`,
      name: `${product} - RADAR ${i + 1}`,
      description: `Producto ${product} del radar meteorológico ${i + 1}`,
    })) as TileLayer[],
  };
});
