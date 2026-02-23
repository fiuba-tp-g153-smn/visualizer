import { ActiveLayerGroup, ActiveLayerGroupDefinition } from '../../models/layers/groups.models';

/**
 * Definiciones de los grupos de capas activas
 * Determina cómo se organizan las capas activas en el visualizador
 */
export const ACTIVE_LAYER_GROUP_DEFINITIONS: Record<ActiveLayerGroup, ActiveLayerGroupDefinition> =
  {
    [ActiveLayerGroup.BASE]: {
      id: ActiveLayerGroup.BASE,
      name: 'Capas de Datos',
      subtitle: '(Radar, modelos numéricos)',
      description:
        'Capas de datos científicos: radar meteorológico, salidas de modelos numéricos, imágenes satelitales, etc.',
      icon: 'satellite',
      zIndexRange: { min: 0, max: 999 },
    },
    [ActiveLayerGroup.OVERLAY]: {
      id: ActiveLayerGroup.OVERLAY,
      name: 'Capas de Referencia',
      subtitle: '(IGN, cartografía)',
      description:
        'Capas de referencia cartográfica del IGN. Siempre se muestran por encima de las capas de datos.',
      icon: 'layers',
      zIndexRange: { min: 1000, max: 1999 },
    },
  };
