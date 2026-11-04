/**
 * Groups of layers that can share a timeline. Layers only sync with layers of
 * their own group: observations (radar + satellite) and numerical models.
 */
export type SyncGroupId = 'observations' | 'models';

/**
 * A frame drawn by hand: the image (its timestamp) of each layer it joins, from one up to
 * every layer of the group. Layers left out keep showing the image they had.
 */
export type SyncFrameSpec = Readonly<Record<string, number>>;

/** User edits of a group's frames. */
export interface SyncCustomization {
  /** The frames, drawn by hand in the timeline dialog; null plays the automatic ones. */
  readonly frames: readonly SyncFrameSpec[] | null;
}

export const DEFAULT_SYNC_CUSTOMIZATION: SyncCustomization = { frames: null };

export interface SyncGroupState {
  /**
   * Layers the user opted out of. Every other active layer of the group is enrolled
   * automatically, so a newly enabled layer joins the group without manual selection.
   */
  excludedLayerIds: string[];
  /** Requested window size, in frames. `null` picks the group's default. */
  frameCount: number | null;
  frameIndex: number;
  speed: number; // seconds per frame (0.1–10, same units as individual playback)
  isPlaying: boolean;
  /** How the frames are built, edited from the timeline dialog. */
  custom: SyncCustomization;
}

export type SyncState = Readonly<Record<SyncGroupId, SyncGroupState>>;

/**
 * Whether a layer of a group follows the group's timeline.
 * - `enrolled`: it does.
 * - `excluded`: the user unchecked it, or detached it from its own controls.
 * - `waiting`: its images are still loading, or no other layer of the group is on yet.
 * - `unaligned`: none of its images fall near the group's instants.
 */
export type SyncLayerStatus = 'enrolled' | 'excluded' | 'waiting' | 'unaligned';
