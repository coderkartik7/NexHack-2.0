import { describe, it, expect } from 'vitest';
import { importProfileFromJson } from '../src/storage/profiles';
import { IntentEngine } from '../src/intent/engine';
import { CommandBus } from '../src/intent/bus';
import { computeThresholds } from '../src/calibration/thresholds';
import type { SignalFrame } from '../src/types/signals';
import type { LearnerProfile, SignalSummaryStats } from '../src/calibration/types';

describe('Profile Migrations and Eye Integration', () => {
  it('imports legacy head and hand profile JSON cleanly without breaking', () => {
    const legacyHeadJson = JSON.stringify({
      version: 1,
      name: 'Legacy Head Learner',
      mode: 'head',
      cursorMapping: { gainX: 1.2, gainY: 1.2, offsetX: 0, offsetY: 0 },
      commands: {
        select: {
          signal: 'jawOpen',
          direction: 'high',
          enter: 0.3,
          exit: 0.15,
          minHoldMs: 150,
          cooldownMs: 300,
          separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
        },
        grab: {
          signal: 'browRaise',
          direction: 'high',
          enter: 0.3,
          exit: 0.15,
          minHoldMs: 200,
          cooldownMs: 300,
          separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
        },
        pause: {
          signal: 'blink',
          direction: 'high',
          enter: 0.6,
          exit: 0.3,
          minHoldMs: 400,
          cooldownMs: 500,
          separability: { dPrime: 3, overlap: 0.01, rating: 'reliable' },
        },
      },
    });

    const imported = importProfileFromJson(legacyHeadJson);
    expect(imported.version).toBe(2);
    expect(imported.mode).toBe('head');
    expect(imported.name).toBe('Legacy Head Learner');
    expect(imported.largeTargetMode).toBe(false);
  });

  it('rejects an eye-mode profile without a fitted gaze model', () => {
    const invalidEyeJson = JSON.stringify({
      version: 1,
      name: 'Corrupt Eye Learner',
      mode: 'eye',
      cursorMapping: { gainX: 1, gainY: 1, offsetX: 0, offsetY: 0 },
      commands: {
        select: { signal: 'jawOpen', direction: 'high', enter: 0.3, exit: 0.15, minHoldMs: 150, cooldownMs: 300, separability: { dPrime: 3, overlap: 0, rating: 'reliable' } },
        grab: { signal: 'browRaise', direction: 'high', enter: 0.3, exit: 0.15, minHoldMs: 150, cooldownMs: 300, separability: { dPrime: 3, overlap: 0, rating: 'reliable' } },
        pause: { signal: 'blink', direction: 'high', enter: 0.6, exit: 0.3, minHoldMs: 400, cooldownMs: 500, separability: { dPrime: 3, overlap: 0, rating: 'reliable' } },
      },
    });

    expect(() => importProfileFromJson(invalidEyeJson)).toThrow(
      /Profile in 'eye' mode requires a valid fitted GazeModel/
    );
  });

  it('enforces blink-gesture minHoldMs strictly greater than natural blink duration', () => {
    const dummyStats: SignalSummaryStats = {
      mean: 0.05,
      std: 0.02,
      min: 0,
      max: 0.25,
      p95: 0.12,
      p99: 0.18,
    };

    // Measured natural blink duration is 320 ms
    const measuredBlinkDurationMs = 320;
    const sampleReps = [
      { peak: 0.85, durationMs: 600, isValid: true },
      { peak: 0.88, durationMs: 700, isValid: true },
    ];

    const thresholds = computeThresholds(
      dummyStats,
      'high',
      sampleReps,
      'blink',
      measuredBlinkDurationMs
    );

    // Calibrated minHoldMs must exceed measured natural blink + safety margin
    expect(thresholds.minHoldMs).toBeGreaterThan(measuredBlinkDurationMs);
    expect(thresholds.minHoldMs).toBeGreaterThanOrEqual(420);
  });

  it('replaying natural blinks in rest test never fires commands', () => {
    const bus = new CommandBus();
    const events: any[] = [];
    bus.subscribe((e) => events.push(e));

    const profile: LearnerProfile = {
      id: 'prof_test',
      name: 'Tester',
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
          enter: 0.4,
          exit: 0.2,
          minHoldMs: 250,
          cooldownMs: 300,
          separability: { dPrime: 3, overlap: 0, rating: 'reliable' },
        },
        grab: {
          signal: 'browRaise',
          direction: 'high',
          enter: 0.4,
          exit: 0.2,
          minHoldMs: 250,
          cooldownMs: 300,
          separability: { dPrime: 3, overlap: 0, rating: 'reliable' },
        },
        pause: {
          signal: 'blink',
          direction: 'high',
          enter: 0.7,
          exit: 0.3,
          minHoldMs: 500, // Long blink: requires 500ms
          cooldownMs: 600,
          separability: { dPrime: 3, overlap: 0, rating: 'reliable' },
        },
      },
    };

    const engine = new IntentEngine(bus, profile);

    // Simulate 60 natural blinks (each lasting 150-250 ms)
    for (let i = 0; i < 60; i++) {
      const startT = i * 1000;
      // Start blink
      for (let offset = 0; offset <= 200; offset += 33) {
        const frame: SignalFrame = {
          t: startT + offset,
          quality: { face: 1, hand: 0, eye: 1 },
          signals: {
            headX: 0, headY: 0, headRoll: 0, jawOpen: 0.02, browRaise: 0.02,
            blink: 0.8, handX: null, handY: null, pinch: null, openPalm: null,
            gazeX: 0.5, gazeY: 0.5, irisDistL: 0.5, irisDistR: 0.5, eyeOpenness: 0.05,
          },
        };
        engine.processFrame(frame);
      }
      // Return to open eyes
      const openFrame: SignalFrame = {
        t: startT + 250,
        quality: { face: 1, hand: 0, eye: 1 },
        signals: {
          headX: 0, headY: 0, headRoll: 0, jawOpen: 0.02, browRaise: 0.02,
          blink: 0.05, handX: null, handY: null, pinch: null, openPalm: null,
          gazeX: 0.5, gazeY: 0.5, irisDistL: 0.5, irisDistR: 0.5, eyeOpenness: 0.25,
        },
      };
      engine.processFrame(openFrame);
    }

    // Zero fire events should have been emitted
    const fireEvents = events.filter((e) => e.type === 'pause.toggle' || e.type === 'select.fire' || e.type === 'grab.start');
    expect(fireEvents.length).toBe(0);
  });
});
