import { describe, it, expect } from 'vitest';
import { GazeCursor } from '../src/gaze/gazeCursor';
import type { LearnerProfile } from '../src/calibration/types';
import type { SignalFrame } from '../src/types/signals';
import { createInitialContext } from '../src/intent/machine';

function createDummyProfile(): LearnerProfile {
  return {
    id: 'prof_test_eye',
    name: 'Eye Tester',
    mode: 'eye',
    createdAt: 1000,
    updatedAt: 1000,
    version: 2,
    cursorMapping: { gainX: 1, gainY: 1, offsetX: 0.5, offsetY: 0.5 },
    restBaseline: {} as any,
    commands: {
      select: {
        signal: 'jawOpen',
        direction: 'high',
        enter: 0.3,
        exit: 0.15,
        minHoldMs: 200,
        cooldownMs: 350,
        separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
      },
      grab: {
        signal: 'browRaise',
        direction: 'high',
        enter: 0.3,
        exit: 0.15,
        minHoldMs: 250,
        cooldownMs: 350,
        separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
      },
      pause: {
        signal: 'blink',
        direction: 'high',
        enter: 0.7,
        exit: 0.3,
        minHoldMs: 500,
        cooldownMs: 600,
        separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
      },
    },
    gaze: {
      version: 1,
      featureNames: ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11'],
      featureMean: new Array(12).fill(0.5),
      featureStd: new Array(12).fill(0.2),
      // Linear mapping: screenX = 500 + 1000 * norm(f0), screenY = 400 + 800 * norm(f1)
      weightsX: [500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 500],
      weightsY: [0, 400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 400],
      lambda: 0.01,
      trainPoints: 20,
      validation: null,
    },
  };
}

function makeDummyFrame(t: number): SignalFrame {
  return {
    t,
    quality: { face: 1, hand: 0, eye: 1 },
    signals: {
      headX: 0,
      headY: 0,
      headRoll: 0,
      jawOpen: 0,
      browRaise: 0,
      blink: 0,
      handX: null,
      handY: null,
      pinch: null,
      openPalm: null,
      gazeX: 0.5,
      gazeY: 0.5,
      irisDistL: 0.5,
      irisDistR: 0.5,
      eyeOpenness: 0.25,
    },
  };
}

describe('Gaze Cursor Pipeline', () => {
  it('clamps cursor strictly to viewport bounds', () => {
    const profile = createDummyProfile();
    const cursor = new GazeCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const machines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
    };

    // Extreme feature values that predict offscreen
    const extremeFeatures = [10.0, 10.0, ...new Array(10).fill(0.5)];
    const state = cursor.update(extremeFeatures, makeDummyFrame(100), machines, 100);

    expect(state.screenX).toBeLessThanOrEqual(1000);
    expect(state.screenY).toBeLessThanOrEqual(800);
    expect(state.screenX).toBeGreaterThanOrEqual(0);
    expect(state.screenY).toBeGreaterThanOrEqual(0);
  });

  it('holds last valid position for up to 300 ms on invalid / blink frames', () => {
    const profile = createDummyProfile();
    const cursor = new GazeCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const machines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
    };

    // Step 1: Valid frame
    const validFeatures = new Array(12).fill(0.5);
    const stateValid = cursor.update(validFeatures, makeDummyFrame(100), machines, 100);
    const savedX = stateValid.screenX;
    const savedY = stateValid.screenY;

    // Step 2: Blink frame at 200ms (+100ms delta <= 300ms)
    const stateBlink = cursor.update(null, makeDummyFrame(200), machines, 200);
    expect(stateBlink.isStale).toBe(true);
    expect(stateBlink.screenX).toBe(savedX);
    expect(stateBlink.screenY).toBe(savedY);

    // Step 3: Invalid frame past 300ms hold (at 500ms -> delta 400ms > 300ms)
    const stateLost = cursor.update(null, makeDummyFrame(500), machines, 500);
    expect(stateLost.isStale).toBe(false); // marked tracking lost, no longer stale hold
  });

  it('invalid frames never move the cursor', () => {
    const profile = createDummyProfile();
    const cursor = new GazeCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const machines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
    };

    cursor.update(new Array(12).fill(0.5), makeDummyFrame(100), machines, 100);
    const pos1 = { ...cursor.getState() };

    // Feed multiple null frames
    cursor.update(null, makeDummyFrame(133), machines, 133);
    const pos2 = { ...cursor.getState() };
    cursor.update(null, makeDummyFrame(166), machines, 166);
    const pos3 = { ...cursor.getState() };

    expect(pos2.screenX).toBe(pos1.screenX);
    expect(pos2.screenY).toBe(pos1.screenY);
    expect(pos3.screenX).toBe(pos1.screenX);
    expect(pos3.screenY).toBe(pos1.screenY);
  });
});
