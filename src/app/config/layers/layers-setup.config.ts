import { LayerGroup } from '../../models';

/**
 * Layer Setup Configuration
 *
 * This file contains configuration for initial layer setup:
 * - Default active layers for new users
 * - Filtering logic for disabled layers based on environment
 */

/**
 * Array of layer IDs that should be active by default
 * when a user loads the app for the first time (no saved configuration).
 */
export const DEFAULT_ACTIVE_LAYERS: string[] = ['ign-provincia'];

/**
 * Recursively filters layer groups, subgroups, and layers based on disabled IDs.
 * Removes empty groups and subgroups after filtering.
 *
 * @param groups - Array of layer groups to filter
 * @param disabledIds - Array of IDs (groups, subgroups, or layers) to exclude
 * @returns Filtered array of groups, without empty groups or subgroups
 */
export function filterDisabledLayers(groups: LayerGroup[], disabledIds: string[]): LayerGroup[] {
  if (!disabledIds || disabledIds.length === 0) {
    return groups;
  }

  const disabledSet = new Set(disabledIds);

  return (
    groups
      // Filter disabled groups
      .filter((group) => !disabledSet.has(group.id))
      .map((group) => ({
        ...group,
        subgroups: group.subgroups
          // Filter disabled subgroups
          .filter((subgroup) => !disabledSet.has(subgroup.id))
          .map((subgroup) => ({
            ...subgroup,
            // Filter disabled layers
            layers: subgroup.layers.filter((layer) => !disabledSet.has(layer.id)),
          }))
          // Remove empty subgroups
          .filter((subgroup) => subgroup.layers.length > 0),
      }))
      // Remove empty groups
      .filter((group) => group.subgroups.length > 0)
  );
}
