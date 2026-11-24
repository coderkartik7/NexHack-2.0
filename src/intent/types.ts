import type { CommandName } from '../calibration/types';

export type MachineState =
  | 'IDLE'
  | 'CANDIDATE'
  | 'ACTIVE'
  | 'RELEASE_WAIT'
  | 'COOLDOWN';

export interface MachineContext {
  command: CommandName;
  state: MachineState;
  onsetT: number | null;
  fireT: number | null;
  releaseT: number | null;
  cooldownEndT: number | null;
  lastProgress: number;
}

export type MachineEvent =
  | {
      type: 'candidate_progress';
      command: CommandName;
      progress: number; // 0..1
      t: number;
    }
  | {
      type: 'fire';
      command: CommandName;
      onsetT: number;
      fireT: number;
    }
  | {
      type: 'release';
      command: CommandName;
      heldDurationMs: number;
      reason: 'natural' | 'tracking_lost';
      t: number;
    };

export interface DetectorResult {
  rawSignal: number | null;
  activeVal: number | null; // Transformed into active space (higher = more active)
  enterActive: number;
  exitActive: number;
  isAboveEnter: boolean;
  isAboveExit: boolean;
  isUnknown: boolean;
}

export interface CursorState {
  rawX: number;
  rawY: number;
  screenX: number;
  screenY: number;
  frozen: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export type BusEvent =
  | { type: 'select.fire'; onsetT: number; executedT: number; source?: 'gesture' | 'dwell' }
  | { type: 'grab.start'; onsetT: number; executedT: number }
  | { type: 'grab.end'; heldDurationMs: number; reason: 'natural' | 'tracking_lost'; t: number }
  | { type: 'pause.toggle'; onsetT: number; executedT: number }
  | { type: 'candidate_progress'; command: CommandName; progress: number; t: number }
  | { type: 'tracking_lost'; t: number }
  | { type: 'tracking_restored'; t: number };
