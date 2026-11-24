import { LayerCategory, SyncGroupId } from '../../models';
import { LAYER_NAMES } from '../../texts';

const MINUTE_MS = 60 * 1000;

export interface SyncGroupDefinition {
  readonly id: SyncGroupId;
  readonly label: string;
  /** Material icon, the same the layer catalog uses for the family. */
  readonly icon: string;
  readonly categories: readonly LayerCategory[];
  /**
   * How far a layer's image may be from the group's instant and still show in that frame.
   * Observations publish every few minutes; model steps are whole hours.
   */
  readonly toleranceMs: number;
  /** Window sizes offered, in frames of the group's densest layer. */
  readonly frameCounts: readonly number[];
  readonly defaultFrameCount: number;
}

/** Display order of the groups in the Sincronización tab. */
export const SYNC_GROUPS: readonly SyncGroupDefinition[] = [
  {
    id: 'observations',
    label: LAYER_NAMES.syncGroups.observations.label,
    icon: 'satellite_alt',
    categories: [LayerCategory.RADAR, LayerCategory.GOES_19, LayerCategory.WEATHER_STATIONS],
    toleranceMs: 5 * MINUTE_MS,
    frameCounts: [6, 12, 24],
    defaultFrameCount: 6,
  },
  {
    id: 'models',
    label: LAYER_NAMES.syncGroups.models.label,
    icon: 'insights',
    categories: [LayerCategory.WRF, LayerCategory.ECMWF_TP],
    toleranceMs: 30 * MINUTE_MS,
    frameCounts: [6, 12, 24, 48],
    defaultFrameCount: 12,
  },
] as const;

export function syncGroupForCategory(category: LayerCategory): SyncGroupId | null {
  return SYNC_GROUPS.find((group) => group.categories.includes(category))?.id ?? null;
}

export function syncGroupDefinition(id: SyncGroupId): SyncGroupDefinition {
  return SYNC_GROUPS.find((group) => group.id === id)!;
}
