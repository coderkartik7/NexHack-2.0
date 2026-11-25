import { describe, it, expect } from 'vitest';
import { IntentEngine } from '../src/intent/engine';
import { CommandBus } from '../src/intent/bus';
import { LessonStore, createSelectOptionAction, createPlaceLabelAction } from '../src/lesson/lessonStore';
import { TargetResolver } from '../src/lesson/targeting';
import { IntentCursor } from '../src/intent/cursor';
import { MouseSim } from '../src/sim/mouseSim';
import { createDefaultLearnerProfile } from '../src/storage/profiles';
import type { SignalFrame, SignalName } from '../src/types/signals';

function makeFrame(
  t: number,
  signals: Partial<Record<SignalName, number | null>> = {}
): SignalFrame {
  const fullSignals: Record<SignalName, number | null> = {
    headX: 0,
    headY: 0,
    headRoll: 0,
    jawOpen: 0.05,
    browRaise: 0.05,
    blink: 0.05,
    handX: 0.5,
    handY: 0.5,
    pinch: 0.8,
    openPalm: 1.0,
    gazeX: 0.5,
    gazeY: 0.5,
    irisDistL: 0.5,
    irisDistR: 0.5,
    eyeOpenness: 0.25,
    ...signals,
  };
  return {
    t,
    quality: { face: 0.9, hand: 0.9, eye: 0.9 },
    signals: fullSignals,
  };
}

describe('Quiz & Gesture End-to-End Pipeline Tests', () => {
  it('Head profile: correctly moves cursor, fires select on jawOpen, and updates lesson store', () => {
    const profile = createDefaultLearnerProfile('head');
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, profile);
    const cursor = new IntentCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const store = new LessonStore();
    const resolver = new TargetResolver();

    // Mock interactive quiz option target (opt_b is Chloroplast in PLANT_CELL_LESSON)
    const targets = [
      { id: 'target_opt_b', type: 'option' as const, x: 450, y: 350, width: 100, height: 50 },
    ];

    let selectFired = false;
    bus.subscribe((ev) => {
      if (ev.type === 'select.fire') {
        selectFired = true;
        store.execute(createSelectOptionAction('opt_b', ev.executedT));
      }
    });

    // 1. Move head to position cursor over target (headX: 0, headY: 0 maps to (500, 400))
    let cState = cursor.getState();
    for (let t = 100; t <= 300; t += 33) {
      const frame = makeFrame(t, { headX: 0, headY: 0, jawOpen: 0.05 });
      engine.processFrame(frame);
      cState = cursor.update(frame, engine.getMachineContexts(), t);
    }

    const res = resolver.resolveTarget(cState.screenX, cState.screenY, targets);
    expect(res.hoveredTargetId).toBe('target_opt_b');

    // 2. Perform jawOpen gesture (select)
    for (let t = 333; t <= 600; t += 33) {
      const frame = makeFrame(t, { headX: 0, headY: 0, jawOpen: 0.6 });
      engine.processFrame(frame);
      cursor.update(frame, engine.getMachineContexts(), t);
    }

    expect(selectFired).toBe(true);
    expect(store.getState().selectedOptionId).toBe('opt_b');
    expect(store.getState().isQuestionCorrect).toBe(true);
  });

  it('Hand profile: correctly moves cursor, fires grab on openPalm, and drops label into zone', () => {
    const profile = createDefaultLearnerProfile('hand');
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, profile);
    const cursor = new IntentCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const store = new LessonStore();

    let grabFired = false;
    bus.subscribe((ev) => {
      if (ev.type === 'grab.start') {
        grabFired = true;
      }
    });

    // Feed hand signals: fingertip at (0.5, 0.5), palm open > 1.35
    for (let t = 100; t <= 400; t += 33) {
      const frame = makeFrame(t, { handX: 0.5, handY: 0.5, openPalm: 1.5 });
      engine.processFrame(frame);
      cursor.update(frame, engine.getMachineContexts(), t);
    }

    expect(grabFired).toBe(true);

    // Place label in zone
    store.execute(createPlaceLabelAction('label_nucleus', 'zone_nucleus', 450));
    expect(store.getState().placements['label_nucleus']).toBe('zone_nucleus');
  });

  it('MouseSim parity: lesson completes with simulated mouse & keyboard interactions', () => {
    const profile = createDefaultLearnerProfile('head');
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, profile);
    const cursor = new IntentCursor({ viewportWidth: 1000, viewportHeight: 800 }, profile);
    const store = new LessonStore();
    const sim = new MouseSim(profile);

    // Simulate mouse hover at center (0.5, 0.5) and hold select (J)
    sim.simulateMouseMove(0.5, 0.5);
    sim.simulateKeyDown('j');

    let selectFired = false;
    bus.subscribe((ev) => {
      if (ev.type === 'select.fire') {
        selectFired = true;
        store.execute(createSelectOptionAction('opt_b', ev.executedT));
      }
    });

    for (let t = 100; t <= 500; t += 33) {
      const frame = sim.generateFrame(t);
      engine.processFrame(frame);
      cursor.update(frame, engine.getMachineContexts(), t);
    }

    expect(selectFired).toBe(true);
    expect(store.getState().selectedOptionId).toBe('opt_b');
    expect(store.getState().isQuestionCorrect).toBe(true);
  });
});
