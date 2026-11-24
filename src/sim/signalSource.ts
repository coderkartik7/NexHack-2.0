import type { SignalFrame } from '../types/signals';

export type SignalFrameListener = (frame: SignalFrame) => void;

export interface SignalSource {
  readonly id: string;
  readonly label: string;
  subscribe(listener: SignalFrameListener): () => void;
  start(): Promise<void>;
  stop(): void;
  isActive(): boolean;
}
