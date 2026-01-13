import { LayerSubgroup, LayerType, LayerCategory } from '../../../models';

const GLM_DEFAULTS = {
  visible: false,
  opacity: 80,
} as const;

export const GLM_SUBGROUP: LayerSubgroup = {
  id: 'glm',
  name: 'GLM',
  description: 'Geostationary Lightning Mapper',
  expanded: true,
  layers: [
    {
      id: 'glm-ch2',
      name: 'Canal 2 (Visible)',
      description: 'Banda visible (0.64 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_GLM,
      ...GLM_DEFAULTS,
    },
    {
      id: 'glm-ch9',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_GLM,
      ...GLM_DEFAULTS,
    },
    {
      id: 'glm-ch13',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_GLM,
      ...GLM_DEFAULTS,
    },
  ],
};
