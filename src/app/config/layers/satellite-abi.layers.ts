import { LayerSubgroup, LayerType, LayerCategory } from '../../models';

/**
 * Definición de capas satelitales ABI (GOES-16)
 */
export const ABI_SUBGROUP: LayerSubgroup = {
  id: 'abi',
  name: 'ABI',
  description: 'Advanced Baseline Imager',
  expanded: true,
  layers: [
    {
      id: 'abi-ch2',
      name: 'Canal 2 (Visible)',
      description: 'Banda visible (0.64 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_ABI,
      visible: false,
      opacity: 80,
    },
    {
      id: 'abi-ch9',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_ABI,
      visible: false,
      opacity: 80,
    },
    {
      id: 'abi-ch13',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_ABI,
      visible: false,
      opacity: 80,
    },
  ],
};
