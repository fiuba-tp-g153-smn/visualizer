import { Layer } from './models';

export enum LayerSelectionMode {
  MULTIPLE = 'multiple',
  SINGLE = 'single',
}

/**
 * Grupos de capas activas para organizar por niveles
 * Las capas solo se pueden reordenar dentro de su propio grupo
 */
export enum ActiveLayerGroupId {
  BASE = 'base',
  OVERLAY = 'overlay',
}

export interface ActiveLayerGroup {
  id: ActiveLayerGroupId;
  name: string;
  subtitle: string;
  description?: string;
  icon: string;
  zIndexRange: { min: number; max: number };
}

export interface LayerGroup {
  id: string;
  name: string;
  description?: string;
  icon: string; // Material icon name
  subgroups: LayerSubgroup[];
  expanded: boolean;
}

export interface LayerSubgroup {
  id: string;
  name: string;
  description?: string;
  layers: Layer[];
  expanded: boolean;
  selectionMode?: LayerSelectionMode;
}
