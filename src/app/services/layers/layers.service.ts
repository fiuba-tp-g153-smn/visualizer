import { Injectable } from '@angular/core';
import { Layer, LayerGroup } from '../../models';
import { LAYER_DEFINITIONS, filterDisabledLayers } from '../../config/layers';
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
    this.layerDefinitions = filterDisabledLayers(LAYER_DEFINITIONS, environment.ui.disabledLayers);
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
   * Returns null if no layer with the given ID exists.
   */
  getLayerById(layerId: string): Layer | null {
    return this.getAllLayers().find((layer) => layer.id === layerId) ?? null;
  }

  /**
   * Gets the user-friendly display name for a layer.
   * Falls back to the layer ID if the layer is not found.
   */
  getLayerDisplayName(layerId: string): string {
    const layer = this.getLayerById(layerId);
    return layer?.name ?? layerId;
  }
}
