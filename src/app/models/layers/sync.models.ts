export interface FrameInfo {
  avgTime: Date;
  deviationMs: number;
  label: string; // Human-readable label, e.g. "10:51 ± 3min"
}

export interface SyncState {
  selectedLayerIds: string[];
  frameCount: number; // N – the animation window size
  frameIndex: number; // 0 to frameCount-1
  speed: number; // seconds per frame (0.1–10, same units as individual playback)
  isPlaying: boolean;
}
