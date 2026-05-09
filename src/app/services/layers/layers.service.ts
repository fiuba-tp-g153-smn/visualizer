import { Injectable } from '@angular/core';
import { Layer, LayerCategory, LayerGroup, RadarTileLayer } from '../../models';
import { LAYER_DEFINITIONS } from '../../config/layers';
import { environment } from '../../../environments/environment';

const RADAR_ID_PATTERN = /radar\/([A-Z0-9]+)\//;

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
   * @throws Error if layer not found
   */
  getLayerDisplayName(layerId: string): string {
    const layer = this.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);
    return layer.name;
  }

  /**
   * Gets the full hierarchical name for a layer.
   * Format: "Group - Subgroup - LayerName - Elevation"
   * Examples:
   * - "GOES 19 - ABI - Canal 2 (Visible)"
   * - "RMA1 - DBZH - 0.5°"
   * - "IGN - Límites - Límite internacional"
   *
   * @param layer - Layer object to get the name for
   * @param elevationId - Optional elevation ID for radar layers
   * @returns Full hierarchical name, or layer.name if layer not found in definitions
   */
  getLayerFullName(layer: Layer, elevationId?: string): string {
    // Find group and subgroup for this layer
    for (const group of this.layerDefinitions) {
      for (const subgroup of group.subgroups) {
        if (subgroup.layers.some((l) => l.id === layer.id)) {
          const parts: string[] = [];

          // Build hierarchical name based on group type
          switch (layer.category) {
            case LayerCategory.GOES_19:
              parts.push('GOES 19');
              parts.push(subgroup.name); // ABI, GLM
              parts.push(layer.name);
              break;

            case LayerCategory.RADAR: {
              // Extract radar ID from layer.id (e.g., "radar/RMA1/DBZH" → "RMA1")
              const radarIdMatch = layer.id.match(RADAR_ID_PATTERN);
              parts.push(radarIdMatch ? radarIdMatch[1] : 'Radar');

              parts.push(layer.name);

              // Add elevation if provided
              if (elevationId) {
                const radarLayer = layer as RadarTileLayer;
                const elevation = radarLayer.availableElevations.find((e) => e.id === elevationId);
                if (elevation) {
                  parts.push(elevation.name);
                }
              }
              break;
            }

            case LayerCategory.IGN_WMS:
              parts.push('IGN');
              parts.push(subgroup.name);
              parts.push(layer.name);
              break;

            case LayerCategory.ECMWF_TP:
              parts.push('ECMWF');
              parts.push(layer.name);
              break;

            case LayerCategory.WRF:
              parts.push('WRF');
              parts.push(layer.name);
              break;

            default:
              throw new Error(`Unknown layer category`);
          }

          return parts.join(' - ');
        }
      }
    }

    // Fallback if not found in definitions
    return layer.name;
  }

  /**
   * Gets just the layer name (no group/subgroup hierarchy).
   * This is the same as layer.name.
   *
   * @param layer - Layer object
   * @returns Short name (just the layer's name property)
   */
  getLayerShortName(layer: Layer): string {
    return layer.name;
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
