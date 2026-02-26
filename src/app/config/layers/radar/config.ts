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
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12] as const,
  availableElevations: ['elev0', 'elev1', 'elev2'] as const,
  category: LayerCategory.RADAR,
};

const satelitePrefix = 'radar';

const radarCount = 17;
const products = ['DBZH', 'KDP', 'VRAD', 'RHOHV', 'ZDR'];

export const RADAR_SUBGROUPS: LayerSubgroup[] = Array.from({ length: radarCount }, (_, i) => ({
  id: `radar-${i + 1}`,
  name: `Radar ${i + 1}`,
  description: `Capas del radar meteorológico ${i + 1}`,
  expanded: false,
  layers: products.map((product) => ({
    ...RADAR_DEFAULTS,
    id: `${satelitePrefix}/rma${i + 1}-${product.toLowerCase()}`,
    name: `${product} - Radar ${i + 1}`,
    description: `Producto ${product} del radar meteorológico ${i + 1}`,
  })) as RadarTileLayer[],
}));

const a = (x: number) => x + 1;
