import { describe, it, expect } from 'vitest';
import { IntentCursor } from '../src/intent/cursor';
import { createInitialContext } from '../src/intent/machine';
import type { LearnerProfile } from '../src/calibration/types';
import type { SignalFrame, SignalName } from '../src/types/signals';

function createMockProfile(): LearnerProfile {
  return {
    id: 'test_prof',
    name: 'Test Profile',
    mode: 'head',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    cursorMapping: { gainX: 2.0, gainY: 2.0, offsetX: 0, offsetY: 0 },
    restBaseline: {} as any,
    commands: {} as any,
  };
}

function makeFrame(t: number, headX: number, headY: number): SignalFrame {
  const signals: Record<SignalName, number | null> = {
    headX,
    headY,
    headRoll: 0,
    jawOpen: 0,
    browRaise: 0,
    blink: 0,
    handX: 0.5,
    handY: 0.5,
    pinch: 0.8,
    openPalm: 1.0,
  };
  return {
    t,
    quality: { face: 0.9, hand: 0.9 },
    signals,
  };
}

describe('Intent Cursor & Click Stabilization', () => {
  it('maps head coordinates to screen pixels within viewport', () => {
    const cursor = new IntentCursor({ viewportWidth: 1000, viewportHeight: 800 }, createMockProfile());
    const idleMachines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
    };

    // Center is (0, 0) in head coords -> mapped to screen center (500, 400)
    const state = cursor.update(makeFrame(100, 0, 0), idleMachines);
    expect(state.screenX).toBeCloseTo(500, -1);
    expect(state.screenY).toBeCloseTo(400, -1);
  });

  it('freezes cursor position from ~150ms before onset during candidate state', () => {
    const cursor = new IntentCursor(
      { viewportWidth: 1000, viewportHeight: 800, freezeLookbackMs: 150 },
      createMockProfile()
    );
    const machines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
    };

    // Feed frames while IDLE from t=0 to t=200
    // Cursor starts around screen center (headX = 0)
    for (let t = 0; t <= 200; t += 20) {
      cursor.update(makeFrame(t, 0, 0), machines);
    }
    const preOnsetScreenX = cursor.getState().screenX;

    // Head moves rapidly as gesture starts at onsetT = 200
    machines.select.state = 'CANDIDATE';
    machines.select.onsetT = 200;

    // At t=220, headX has shifted to 0.2 (which would normally move cursor to right)
    const stateCandidate1 = cursor.update(makeFrame(220, 0.2, 0), machines);
    expect(stateCandidate1.frozen).toBe(true);
    // Cursor frozen near pre-onset position (around lookback 200 - 150 = 50ms)
    expect(Math.abs(stateCandidate1.screenX - preOnsetScreenX)).toBeLessThan(15);

    // At t=300, head shifts further to 0.4, but cursor is still frozen
    const stateCandidate2 = cursor.update(makeFrame(300, 0.4, 0), machines);
    expect(stateCandidate2.screenX).toBe(stateCandidate1.screenX);

    // Gesture fires and releases back to IDLE
    machines.select.state = 'IDLE';
    machines.select.onsetT = null;

    const stateReleased = cursor.update(makeFrame(350, 0.4, 0), machines);
    expect(stateReleased.frozen).toBe(false);
  });
});
