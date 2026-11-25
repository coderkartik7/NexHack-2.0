import { describe, it, expect } from 'vitest';
import { SignalRecorder, type RecordedTrace } from '../src/sim/recorder';
import { ReplaySource } from '../src/sim/replay';
import { IntentEngine } from '../src/intent/engine';
import { CommandBus } from '../src/intent/bus';
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
    cursorMapping: { gainX: 1, gainY: 1, offsetX: 0, offsetY: 0 },
    restBaseline: {} as any,
    commands: {
      select: {
        signal: 'jawOpen',
        direction: 'high',
        enter: 0.5,
        exit: 0.2,
        minHoldMs: 100,
        cooldownMs: 150,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
      grab: {
        signal: 'browRaise',
        direction: 'high',
        enter: 0.5,
        exit: 0.2,
        minHoldMs: 100,
        cooldownMs: 150,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
      pause: {
        signal: 'blink',
        direction: 'high',
        enter: 0.8,
        exit: 0.4,
        minHoldMs: 200,
        cooldownMs: 200,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
    },
  };
}

describe('Signal Recorder & Deterministic Replay', () => {
  it('replaying the same recorded trace twice through an engine yields identical events', () => {
    // 1. Record synthetic trace with a gesture
    const recorder = new SignalRecorder();
    recorder.start();

    const dummySignals: Record<SignalName, number | null> = {
      headX: 0, headY: 0, headRoll: 0, jawOpen: 0.05, browRaise: 0.05,
      blink: 0.05, handX: 0.5, handY: 0.5, pinch: 0.8, openPalm: 1.0,
      gazeX: 0.5, gazeY: 0.5, irisDistL: 0.5, irisDistR: 0.5, eyeOpenness: 0.25,
    };

    for (let t = 0; t <= 1000; t += 20) {
      const jaw = t >= 200 && t <= 500 ? 0.7 : 0.05;
      recorder.record({
        t,
        quality: { face: 0.9, hand: 0.9 },
        signals: { ...dummySignals, jawOpen: jaw },
      });
    }

    const trace = recorder.stop();
    expect(trace.frameCount).toBe(51);

    // 2. Play through Engine Run 1
    const runReplay = (tr: RecordedTrace) => {
      const bus = new CommandBus();
      const engine = new IntentEngine(bus, createMockProfile());
      const events: any[] = [];
      bus.subscribe((e) => events.push(e));

      const replay = new ReplaySource(tr);
      let f: SignalFrame | null;
      while ((f = replay.stepOne()) !== null) {
        engine.processFrame(f);
      }
      return events.filter((e) => e.type !== 'candidate_progress');
    };

    const run1 = runReplay(trace);
    const run2 = runReplay(trace);

    expect(run1.length).toBeGreaterThan(0);
    expect(run1).toEqual(run2);
  });
});
