import { Injectable, Signal, signal, WritableSignal } from '@angular/core';

interface EngineSession {
  frameCount: number;
  frameIndex: WritableSignal<number>;
  speed: number; // seconds per frame
  isPlaying: WritableSignal<boolean>;
  intervalId?: ReturnType<typeof setInterval>;
  onFrame?: (frameIndex: number) => void;
}

/**
 * Pure timer engine for frame-based animation playback.
 *
 * Manages named sessions so that both individual-layer playback (session ID = layerId)
 * and synchronized multi-layer playback (session ID = 'sync') can share the same
 * timer infrastructure.
 *
 * The engine knows nothing about layers or tilesets — callers provide an `onFrame`
 * callback that maps a frame index to whatever side effects they need.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackEngineService {
  private readonly sessions = new Map<string, EngineSession>();

  /**
   * Registers (or replaces) a session. Does not start playback.
   * Must be called before play()/setFrameIndex() etc.
   */
  register(sessionId: string, frameCount: number, speed: number): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.clearInterval(existing);
      existing.frameCount = frameCount;
      existing.speed = speed;
      existing.frameIndex.set(0);
      existing.isPlaying.set(false);
      existing.onFrame = undefined;
    } else {
      this.sessions.set(sessionId, {
        frameCount,
        speed,
        frameIndex: signal(0),
        isPlaying: signal(false),
      });
    }
  }

  /** Destroys a session and stops its timer. */
  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.clearInterval(session);
    this.sessions.delete(sessionId);
  }

  /**
   * Starts playback for a session.
   * @param onFrame Called on each tick with the current frame index (0-based).
   */
  play(sessionId: string, onFrame: (frameIndex: number) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.clearInterval(session);

    session.onFrame = onFrame;
    session.isPlaying.set(true);

    // Fire immediately for the starting frame, then on each interval
    onFrame(session.frameIndex());

    session.intervalId = setInterval(() => {
      const next = (session.frameIndex() + 1) % session.frameCount;
      session.frameIndex.set(next);
      onFrame(next);
    }, session.speed * 1000);
  }

  /** Pauses playback without resetting the frame index. */
  pause(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.clearInterval(session);
    session.isPlaying.set(false);
  }

  /** Manually sets the frame index. Fires onFrame if a callback is registered. */
  setFrameIndex(sessionId: string, index: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const clamped = Math.max(0, Math.min(index, session.frameCount - 1));
    session.frameIndex.set(clamped);
    session.onFrame?.(clamped);
  }

  /**
   * Updates the speed. If currently playing, restarts the interval immediately.
   */
  setSpeed(sessionId: string, speed: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.speed = speed;
    if (session.isPlaying() && session.onFrame) {
      this.play(sessionId, session.onFrame);
    }
  }

  /**
   * Updates the frame count and clamps the current frame index if needed.
   * If currently playing, restarts the interval.
   */
  setFrameCount(sessionId: string, frameCount: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.frameCount = frameCount;
    if (session.frameIndex() >= frameCount) {
      session.frameIndex.set(Math.max(0, frameCount - 1));
    }
    if (session.isPlaying() && session.onFrame) {
      this.play(sessionId, session.onFrame);
    }
  }

  /** Returns the reactive frame index signal for a session, or null if not found. */
  getFrameIndex(sessionId: string): Signal<number> | null {
    return this.sessions.get(sessionId)?.frameIndex.asReadonly() ?? null;
  }

  /** Returns the reactive isPlaying signal for a session, or null if not found. */
  isPlayingSignal(sessionId: string): Signal<boolean> | null {
    return this.sessions.get(sessionId)?.isPlaying.asReadonly() ?? null;
  }

  /** Returns true if the session exists and is currently playing. */
  isPlaying(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.isPlaying() ?? false;
  }

  private clearInterval(session: EngineSession): void {
    if (session.intervalId !== undefined) {
      clearInterval(session.intervalId);
      session.intervalId = undefined;
    }
  }
}
