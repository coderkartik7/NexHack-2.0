import type { SignalName, InputMode } from '../types/signals';

export type CommandName = 'select' | 'grab' | 'pause';
export type GestureDirection = 'high' | 'low';
export type ReliabilityRating = 'reliable' | 'marginal' | 'unreliable';

export interface CommandBinding {
  signal: SignalName;
  direction: GestureDirection;
  enter: number;
  exit: number;
  minHoldMs: number;
  cooldownMs: number;
  separability: {
    dPrime: number;
    overlap: number;
    rating: ReliabilityRating;
  };
}

export interface CursorMapping {
  gainX: number;
  gainY: number;
  offsetX: number;
  offsetY: number;
}

export interface SignalSummaryStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface LearnerProfile {
  id: string;
  name: string;
  mode: InputMode;
  createdAt: number;
  updatedAt: number;
  version: number;
  cursorMapping: CursorMapping;
  restBaseline: Record<SignalName, SignalSummaryStats>;
  commands: Record<CommandName, CommandBinding>;
}

export interface GestureOption {
  signal: SignalName;
  direction: GestureDirection;
  label: string;
  description: string;
}

export interface GestureSampleRep {
  peak: number;
  durationMs: number;
  isValid: boolean;
}
