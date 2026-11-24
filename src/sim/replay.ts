import type { SignalFrame } from '../types/signals';
import type { RecordedTrace } from './recorder';
import type { SignalFrameListener, SignalSource } from './signalSource';

export class ReplaySource implements SignalSource {
  readonly id = 'replay';
  readonly label = 'Recorded Trace Replay';
  private listeners: Set<SignalFrameListener> = new Set();
  private trace: RecordedTrace | null = null;
  private running = false;
  private timerId: number | null = null;
  private speedMultiplier = 1.0;
  private currentIndex = 0;
  private startPlaybackWallT = 0;

  constructor(trace: RecordedTrace | null = null, speed = 1.0) {
    this.trace = trace;
    this.speedMultiplier = speed;
  }

  public setTrace(trace: RecordedTrace): void {
    this.trace = trace;
    this.currentIndex = 0;
  }

  public setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(10.0, speed));
  }

  public subscribe(listener: SignalFrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.running || !this.trace || this.trace.frames.length === 0) return;
    this.running = true;
    this.currentIndex = 0;
    this.startPlaybackWallT = performance.now();

    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (!this.running || !this.trace || this.currentIndex >= this.trace.frames.length) {
      this.running = false;
      return;
    }

    const frame = this.trace.frames[this.currentIndex];
    const targetRelativeMs = frame.t / this.speedMultiplier;
    const elapsedWallMs = performance.now() - this.startPlaybackWallT;
    const delay = Math.max(0, targetRelativeMs - elapsedWallMs);

    this.timerId = window.setTimeout(() => {
      if (!this.running || !this.trace) return;
      // Re-emit with updated playback timestamp
      const emittedFrame: SignalFrame = {
        ...frame,
        t: Math.round(performance.now()),
      };
      for (const l of this.listeners) {
        l(emittedFrame);
      }
      this.currentIndex++;
      this.scheduleNext();
    }, delay);
  }

  public stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public isActive(): boolean {
    return this.running;
  }

  /**
   * Deterministic step-through for unit tests without wall clocks
   */
  public stepOne(): SignalFrame | null {
    if (!this.trace || this.currentIndex >= this.trace.frames.length) return null;
    const frame = this.trace.frames[this.currentIndex++];
    for (const l of this.listeners) {
      l(frame);
    }
    return frame;
  }
}
