import type { ProtocolStage, Condition } from './types';

export interface ProtocolState {
  participantId: string;
  profileId: string;
  source: 'live' | 'mouse_sim' | 'replay';
  currentStage: ProtocolStage;
  condition: Condition;
  activeSessionId: string | null;
  history: {
    stage: ProtocolStage;
    condition: Condition;
    sessionId: string;
    quality: 'complete' | 'incomplete';
  }[];
}

export type ProtocolAction =
  | { type: 'START_STAGE'; stage: ProtocolStage; sessionId: string }
  | { type: 'COMPLETE_STAGE' }
  | { type: 'SKIP_STAGE' }
  | { type: 'ABORT_STAGE'; reason?: string }
  | { type: 'TRANSITION_TO_RECALIBRATION' };

export const STAGE_SEQUENCE: ProtocolStage[] = [
  'calibration_check',
  'practice',
  'activity',
  'rest_test',
  'recalibrate_and_repeat',
  'complete',
];

export function createInitialProtocolState(
  participantId: string,
  profileId: string,
  source: 'live' | 'mouse_sim' | 'replay' = 'live'
): ProtocolState {
  return {
    participantId,
    profileId,
    source,
    currentStage: 'calibration_check',
    condition: 'baseline',
    activeSessionId: null,
    history: [],
  };
}

/**
 * Pure protocol transition function
 */
export function stepProtocol(
  state: ProtocolState,
  action: ProtocolAction
): ProtocolState {
  switch (action.type) {
    case 'START_STAGE': {
      return {
        ...state,
        currentStage: action.stage,
        activeSessionId: action.sessionId,
      };
    }

    case 'COMPLETE_STAGE': {
      const currentIdx = STAGE_SEQUENCE.indexOf(state.currentStage);
      const nextStage = currentIdx < STAGE_SEQUENCE.length - 1 ? STAGE_SEQUENCE[currentIdx + 1] : 'complete';

      const nextHistory = state.activeSessionId
        ? [
            ...state.history,
            {
              stage: state.currentStage,
              condition: state.condition,
              sessionId: state.activeSessionId,
              quality: 'complete' as const,
            },
          ]
        : state.history;

      return {
        ...state,
        currentStage: nextStage,
        activeSessionId: null,
        history: nextHistory,
      };
    }

    case 'SKIP_STAGE': {
      const currentIdx = STAGE_SEQUENCE.indexOf(state.currentStage);
      const nextStage = currentIdx < STAGE_SEQUENCE.length - 1 ? STAGE_SEQUENCE[currentIdx + 1] : 'complete';

      return {
        ...state,
        currentStage: nextStage,
        activeSessionId: null,
      };
    }

    case 'ABORT_STAGE': {
      const nextHistory = state.activeSessionId
        ? [
            ...state.history,
            {
              stage: state.currentStage,
              condition: state.condition,
              sessionId: state.activeSessionId,
              quality: 'incomplete' as const,
            },
          ]
        : state.history;

      return {
        ...state,
        activeSessionId: null,
        history: nextHistory,
      };
    }

    case 'TRANSITION_TO_RECALIBRATION': {
      return {
        ...state,
        condition: 'after_recalibration',
        currentStage: 'activity', // Repeat activity and rest test after recalibration
        activeSessionId: null,
      };
    }
  }
}
