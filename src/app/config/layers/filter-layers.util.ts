import { LayerGroup, LayerSubgroup } from '../../models';

/**
 * Filtra recursivamente grupos, subgrupos y capas basándose en una lista de IDs deshabilitados.
 * Elimina grupos vacíos y subgrupos vacíos después del filtrado.
 *
 * @param groups - Array de grupos de capas a filtrar
 * @param disabledIds - Array de IDs de grupos, subgrupos o capas a excluir
 * @returns Array de grupos filtrados, sin grupos ni subgrupos vacíos
 */
export function filterDisabledLayers(groups: LayerGroup[], disabledIds: string[]): LayerGroup[] {
  if (!disabledIds || disabledIds.length === 0) {
    return groups;
  }

  const disabledSet = new Set(disabledIds);

  return (
    groups
      // Filtrar grupos deshabilitados
      .filter((group) => !disabledSet.has(group.id))
      .map((group) => ({
        ...group,
        subgroups: group.subgroups
          // Filtrar subgrupos deshabilitados
          .filter((subgroup) => !disabledSet.has(subgroup.id))
          .map((subgroup) => ({
            ...subgroup,
            // Filtrar capas deshabilitadas
            layers: subgroup.layers.filter((layer) => !disabledSet.has(layer.id)),
          }))
          // Remover subgrupos vacíos
          .filter((subgroup) => subgroup.layers.length > 0),
      }))
      // Remover grupos vacíos
      .filter((group) => group.subgroups.length > 0)
  );
}
