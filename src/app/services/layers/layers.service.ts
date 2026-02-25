import { Injectable } from '@angular/core';
import { Layer, LayerGroup, LayerType, LayerCategory } from '../../models';
import { LAYER_DEFINITIONS } from '../../config/layers/layer-definitions';
import { filterDisabledLayers } from '../../config/layers/filter-layers.util';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LayersService {
  private readonly layerDefinitions: LayerGroup[];

  constructor() {
    this.layerDefinitions = filterDisabledLayers(LAYER_DEFINITIONS, environment.ui.disabledLayers);
  }

  getLayerGroups(): LayerGroup[] {
    return this.layerDefinitions;
  }

  getAllLayers(): Layer[] {
    const layers: Layer[] = [];
    for (const group of this.layerDefinitions) {
      for (const subgroup of group.subgroups) {
        layers.push(...subgroup.layers);
      }
    }
    return layers;
  }

  getLayerById(layerId: string): Layer | null {
    return this.getAllLayers().find((layer: Layer) => layer.id === layerId) ?? null;
  }

  getLayerDisplayName(layerId: string): string {
    const layer = this.getLayerById(layerId);
    return layer?.name ?? layerId;
  }

  buildProductPath(layer: Layer): string {
    switch (layer.type) {
      case LayerType.TILE:
        switch (layer.category) {
          case LayerCategory.GOES_19: {
            const [instrument, channelPart] = layer.id.split('-');
            const channel = channelPart.replace('ch', 'ch-').padStart(5, '0');
            return `goes-19/${instrument}/${channel}`;
          }
          case LayerCategory.RADAR: {
            const [radarPart, variable] = layer.id.split('-');
            const radarId = radarPart.toUpperCase();
            const variableId = variable.toUpperCase();
            return `radar/${radarId}/${variableId}`;
          }
          default: {
            throw new Error(`Layer category does not have a defined product path template`);
          }
        }
      default:
        throw new Error(`Layer type ${layer.type} does not require tileset configuration`);
    }
  }
}
