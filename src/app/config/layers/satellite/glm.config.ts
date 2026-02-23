import {
  LayerSubgroup,
  LayerType,
  LayerCategory,
  ActiveLayerGroup,
  TileLayer,
} from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroup.BASE, // Capas de datos
  // Configuración de control temporal (común para todas las capas GLM)
  availablePeriods: [1, 6, 12, 24] as const, // Image count options: show last 1, 6, 12, or 24 images
};

/**
 * Definición de capas GLM (Geostationary Lightning Mapper) - GOES-19
 * Solo información de UI y estado inicial
 */
export const GLM_SUBGROUP: LayerSubgroup = {
  id: 'glm',
  name: 'GLM',
  description: 'Geostationary Lightning Mapper',
  expanded: false,
  layers: [
    {
      ...GLM_DEFAULTS,
      id: 'glm-fed',
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
      type: LayerType.TILE,
      category: LayerCategory.SATELLITE_ABI, // Usa misma categoría para reutilizar lógica de renderizado
    } as TileLayer,
    {
      ...GLM_DEFAULTS,
      id: 'glm-toe',
      name: 'Total Optical Energy',
      description: 'Energía óptica total radiada por rayos',
      type: LayerType.TILE,
      category: LayerCategory.SATELLITE_ABI,
    } as TileLayer,
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
