import type { SignalFrame } from '../types/signals';

export interface RecordedTrace {
  version: 1;
  recordedAt: number;
  durationMs: number;
  frameCount: number;
  frames: SignalFrame[];
}

export class SignalRecorder {
  private isRecording = false;
  private frames: SignalFrame[] = [];
  private startT: number | null = null;

  public start(): void {
    this.isRecording = true;
    this.frames = [];
    this.startT = null;
  }

  public record(frame: SignalFrame): void {
    if (!this.isRecording) return;
    if (this.startT === null) {
      this.startT = frame.t;
    }
    // Normalize timestamps relative to start of recording (offset 0)
    this.frames.push({
      ...frame,
      t: Math.round(frame.t - this.startT),
    });
  }

  public stop(): RecordedTrace {
    this.isRecording = false;
    const durationMs = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    return {
      version: 1,
      recordedAt: Date.now(),
      durationMs,
      frameCount: this.frames.length,
      frames: [...this.frames],
    };
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getFrameCount(): number {
    return this.frames.length;
  }
}
