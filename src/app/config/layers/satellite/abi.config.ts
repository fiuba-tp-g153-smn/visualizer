import {
  LayerSubgroup,
  LayerType,
  LayerCategory,
  ActiveLayerGroup,
  TileLayer,
} from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas ABI
 * Sin repetir el mismo número en cada capa
 */
const ABI_DEFAULTS = {
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroup.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  category: LayerCategory.SATELLITE_ABI,

  type: LayerType.TILE,
};

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
      ...ABI_DEFAULTS,
      id: 'abi-ch2',
      name: 'Canal 2 (Visible)',
      description: 'Banda visible (0.64 μm)',
    } as TileLayer,
    {
      ...ABI_DEFAULTS,
      id: 'abi-ch9',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
    } as TileLayer,
    {
      ...ABI_DEFAULTS,
      id: 'abi-ch13',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
    } as TileLayer,
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
