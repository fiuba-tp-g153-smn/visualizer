import { Injectable } from '@angular/core';
import { Layer, LayerGroup } from '../../models';
import { LAYER_DEFINITIONS } from '../../config/layers';
import { environment } from '../../../environments/environment';

/**
 * Service responsible for managing layer definitions and metadata.
 *
 * This service handles:
 * - Loading and filtering layer definitions based on environment configuration
 * - Providing access to layer groups and hierarchical structure
 * - Looking up individual layers by ID
 * - Retrieving layer display names for UI presentation
 *
 * Layer definitions are loaded from configuration and filtered based on
 * environment settings to enable/disable specific layers in different deployments.
 */
@Injectable({
  providedIn: 'root',
})
export class LayersService {
  private readonly layerDefinitions: LayerGroup[];

  constructor() {
    this.layerDefinitions = this.filterDisabledLayers(
      LAYER_DEFINITIONS,
      environment.ui.disabledLayers,
    );
  }

  // ============================================================================
  // Public Methods - Layer Access
  // ============================================================================

  /**
   * Gets all layer groups with their hierarchical structure.
   * Returns the complete layer definition tree with groups, subgroups, and layers.
   */
  getLayerGroups(): LayerGroup[] {
    return this.layerDefinitions;
  }

  /**
   * Gets a flat list of all available layers across all groups.
   * Flattens the hierarchical structure for easier iteration.
   */
  getAllLayers(): Layer[] {
    const layers: Layer[] = [];
    for (const group of this.layerDefinitions) {
      for (const subgroup of group.subgroups) {
        layers.push(...subgroup.layers);
      }
    }
    return layers;
  }

  /**
   * Finds a layer by its unique identifier.
   * Returns undefined if no layer with the given ID exists.
   */
  getLayerById(layerId: string): Layer | undefined {
    return this.getAllLayers().find((layer) => layer.id === layerId);
  }

  /**
   * Gets the user-friendly display name for a layer.
   * Falls back to the layer ID if the layer is not found.
   */
  getLayerDisplayName(layerId: string): string {
    const layer = this.getLayerById(layerId);
    return layer?.name ?? layerId;
  }

  // ============================================================================
  // Private Methods - Layer Filtering
  // ============================================================================

  /**
   * Recursively filters layer groups, subgroups, and layers based on disabled IDs.
   * Removes empty groups and subgroups after filtering.
   *
   * @param groups - Array of layer groups to filter
   * @param disabledIds - Array of IDs (groups, subgroups, or layers) to exclude
   * @returns Filtered array of groups, without empty groups or subgroups
   */
  private filterDisabledLayers(groups: LayerGroup[], disabledIds: string[]): LayerGroup[] {
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
}
