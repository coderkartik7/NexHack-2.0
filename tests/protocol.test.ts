import { describe, it, expect } from 'vitest';
import {
  createInitialProtocolState,
  stepProtocol,
} from '../src/eval/protocol';

describe('Protocol State Machine (Pure)', () => {
  it('guides through ordered stages: calibration -> practice -> activity -> rest_test -> complete', () => {
    let state = createInitialProtocolState('P1', 'prof_1', 'live');
    expect(state.currentStage).toBe('calibration_check');

    // Start calibration check
    state = stepProtocol(state, { type: 'START_STAGE', stage: 'calibration_check', sessionId: 's0' });
    expect(state.activeSessionId).toBe('s0');

    // Complete calibration check -> practice
    state = stepProtocol(state, { type: 'COMPLETE_STAGE' });
    expect(state.currentStage).toBe('practice');
    expect(state.history.length).toBe(1);

    // Skip practice -> activity
    state = stepProtocol(state, { type: 'SKIP_STAGE' });
    expect(state.currentStage).toBe('activity');

    // Run activity
    state = stepProtocol(state, { type: 'START_STAGE', stage: 'activity', sessionId: 's1' });
    state = stepProtocol(state, { type: 'COMPLETE_STAGE' });
    expect(state.currentStage).toBe('rest_test');

    // Run rest test
    state = stepProtocol(state, { type: 'START_STAGE', stage: 'rest_test', sessionId: 's2' });
    state = stepProtocol(state, { type: 'COMPLETE_STAGE' });
    expect(state.currentStage).toBe('recalibrate_and_repeat');
  });

  it('records aborted stage as incomplete without losing history', () => {
    let state = createInitialProtocolState('P2', 'prof_2', 'live');
    state = stepProtocol(state, { type: 'START_STAGE', stage: 'activity', sessionId: 's_abort' });

    state = stepProtocol(state, { type: 'ABORT_STAGE', reason: 'Participant fatigue' });
    expect(state.activeSessionId).toBeNull();
    expect(state.history.length).toBe(1);
    expect(state.history[0].quality).toBe('incomplete');
    expect(state.history[0].sessionId).toBe('s_abort');
  });

  it('transitions to recalibration and marks condition as after_recalibration', () => {
    let state = createInitialProtocolState('P1', 'prof_1', 'live');
    expect(state.condition).toBe('baseline');

    state = stepProtocol(state, { type: 'TRANSITION_TO_RECALIBRATION' });
    expect(state.condition).toBe('after_recalibration');
    expect(state.currentStage).toBe('activity');
  });
});
