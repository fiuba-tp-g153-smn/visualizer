import { LayerSubgroup, LayerType, LayerCategory } from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas ABI
 * Sin repetir el mismo número en cada capa
 */
const ABI_DEFAULTS = {
  visible: false,
  opacity: 80,
} as const;

/**
 * Definición de capas satelitales ABI (GOES-19)
 * Solo información de UI y estado inicial
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
      ...ABI_DEFAULTS,
    },
    {
      id: 'abi-ch9',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_ABI,
      ...ABI_DEFAULTS,
    },
    {
      id: 'abi-ch13',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
      type: LayerType.RASTER,
      category: LayerCategory.SATELLITE_ABI,
      ...ABI_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
