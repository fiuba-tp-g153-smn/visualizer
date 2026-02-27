/**
 * Default values for layer controls (opacity, speed, periods, etc.)
 * These defaults are used when initializing layer controls.
 */
export const DEFAULT_LAYER_CONTROLS = {
  /**
   * Default opacity percentage for layers (0-100).
   * Used when no specific opacity is set in layer controls.
   */
  opacity: 100,

  /**
   * Default playback speed in seconds per frame.
   * Used for tile layer animations.
   */
  playbackSpeed: 1,

  /**
   * Default number of recent images to display.
   * Used when initializing tile layer playback.
   */
  lastImagesCount: 1,
} as const;
