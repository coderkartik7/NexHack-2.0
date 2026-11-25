import type { SignalFrame } from '../types/signals';
import { visionPipeline, usePipelineStore } from '../vision/pipeline';
import type { SignalFrameListener, SignalSource } from './signalSource';

export class LiveSource implements SignalSource {
  readonly id = 'live';
  readonly label = 'Live Camera Vision';
  private listeners: Set<SignalFrameListener> = new Set();
  private pipelineUnsubscribe: (() => void) | null = null;
  private running = false;

  public subscribe(listener: SignalFrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    usePipelineStore.getState().setSourceInfo('live', true);

    // Acquire vision pipeline
    await visionPipeline.acquire();

    this.pipelineUnsubscribe = visionPipeline.subscribe((frame: SignalFrame) => {
      for (const l of this.listeners) {
        l(frame);
      }
    });
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    usePipelineStore.getState().setSourceInfo('live', false);
    if (this.pipelineUnsubscribe) {
      this.pipelineUnsubscribe();
      this.pipelineUnsubscribe = null;
    }
    visionPipeline.release();
  }

  public isActive(): boolean {
    return this.running;
  }
}
