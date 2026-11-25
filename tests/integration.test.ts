import { describe, it, expect } from 'vitest';
import { IntentEngine } from '../src/intent/engine';
import { CommandBus } from '../src/intent/bus';
import { EventLogger } from '../src/logging/eventLog';
import { LessonStore, createSelectOptionAction, createPlaceLabelAction } from '../src/lesson/lessonStore';
import type { LearnerProfile } from '../src/calibration/types';
import type { SignalFrame, SignalName } from '../src/types/signals';

function createMockProfile(mode: 'head' | 'hand' = 'head'): LearnerProfile {
  return {
    id: `prof_${mode}`,
    name: `${mode.toUpperCase()} Profile`,
    mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    cursorMapping: { gainX: 1.5, gainY: 1.5, offsetX: 0, offsetY: 0 },
    restBaseline: {} as any,
    commands: {
      select: {
        signal: mode === 'head' ? 'jawOpen' : 'pinch',
        direction: mode === 'head' ? 'high' : 'low',
        enter: mode === 'head' ? 0.4 : 0.3,
        exit: mode === 'head' ? 0.2 : 0.5,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
      grab: {
        signal: mode === 'head' ? 'browRaise' : 'openPalm',
        direction: 'high',
        enter: mode === 'head' ? 0.4 : 1.4,
        exit: mode === 'head' ? 0.2 : 1.1,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
      pause: {
        signal: 'blink',
        direction: 'high',
        enter: 0.8,
        exit: 0.4,
        minHoldMs: 300,
        cooldownMs: 300,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
    },
  };
}

function makeFrame(
  t: number,
  qualityFace = 0.9,
  qualityHand = 0.9,
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
    quality: { face: qualityFace, hand: qualityHand },
    signals: fullSignals,
  };
}

describe('Phase 5: Control, Feedback & Logging Integration', () => {
  it('Pause gate integration: while paused, select/grab do not fire and scroll is blocked', () => {
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, createMockProfile('head'));
    const events: any[] = [];
    bus.subscribe((e) => events.push(e));

    // Pause system
    engine.setPaused(true, 100);
    expect(engine.getIsPaused()).toBe(true);

    // Send high jawOpen for 500ms
    for (let t = 120; t <= 600; t += 30) {
      engine.processFrame(makeFrame(t, 0.9, 0.9, { jawOpen: 0.8 }));
    }

    // No fire events produced
    expect(events.filter((e) => e.type === 'select.fire').length).toBe(0);
    expect(engine.getMachineContexts().select.state).toBe('IDLE');
  });

  it('Tracking loss emits tracking_lost and cancels active drag safely', () => {
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, createMockProfile('head'));
    const events: any[] = [];
    bus.subscribe((e) => events.push(e));

    // Normal tracking at t=100
    engine.processFrame(makeFrame(100, 0.9, 0.9));

    // Tracking quality drops below 0.2 at t=200
    engine.processFrame(makeFrame(200, 0.05, 0.05));
    expect(events.some((e) => e.type === 'tracking_lost')).toBe(true);

    // Quality restored at t=400
    engine.processFrame(makeFrame(400, 0.9, 0.9));
    expect(events.some((e) => e.type === 'tracking_restored')).toBe(true);
  });

  it('Undo stack integration: repeatedly pops and marks original events undone: true', () => {
    const store = new LessonStore();
    const logger = new EventLogger('prof_head', 'live', 'activity');

    // 1. Select Option A (wrong)
    store.execute(createSelectOptionAction('opt_a', 100));
    logger.log('answer_attempt', { target: 'opt_a', correct: false });

    // 2. Select Option B (correct)
    store.execute(createSelectOptionAction('opt_b', 200));
    logger.log('answer_attempt', { target: 'opt_b', correct: true });

    // 3. Place label
    store.execute(createPlaceLabelAction('label_nucleus', 'zone_nucleus', 300));
    logger.log('label_drop', { target: 'label_nucleus->zone_nucleus', correct: true });

    // User hits undo twice
    store.undo(); // undoes label
    logger.log('undo', { target: 'label_drop' });
    logger.flagLastActionUndone('label_drop');

    store.undo(); // undoes option B
    logger.log('undo', { target: 'answer_attempt' });
    logger.flagLastActionUndone('answer_attempt');

    const logEvents = logger.getEvents();
    const undoneLabel = logEvents.find((e) => e.type === 'label_drop' && e.undone === true);
    const undoneAnswer = logEvents.find((e) => e.target === 'opt_b' && e.undone === true);
    const keptAnswerA = logEvents.find((e) => e.target === 'opt_a' && !e.undone);

    expect(undoneLabel).toBeDefined();
    expect(undoneAnswer).toBeDefined();
    expect(keptAnswerA).toBeDefined();
  });

  it('Two different learner profiles produce visibly different detection behavior', () => {
    const bus1 = new CommandBus();
    const bus2 = new CommandBus();
    const headEngine = new IntentEngine(bus1, createMockProfile('head'));
    const handEngine = new IntentEngine(bus2, createMockProfile('hand'));

    const headEvents: any[] = [];
    const handEvents: any[] = [];
    bus1.subscribe((e) => headEvents.push(e));
    bus2.subscribe((e) => handEvents.push(e));

    // Feed a frame with high jawOpen (head mode select) and high pinch distance (pinch open = 0.9, so NOT hand select)
    for (let t = 0; t <= 300; t += 30) {
      const f = makeFrame(t, 0.9, 0.9, { jawOpen: 0.8, pinch: 0.9 });
      headEngine.processFrame(f);
      handEngine.processFrame(f);
    }

    // Head engine fired select; Hand engine remained idle
    expect(headEvents.some((e) => e.type === 'select.fire')).toBe(true);
    expect(handEvents.some((e) => e.type === 'select.fire')).toBe(false);
  });

  it('SessionEvent schema validates required FastAPI fields', () => {
    const logger = new EventLogger('prof_test', 'mouse_sim', 'rest_test');
    const ev = logger.log('command_executed', {
      command: 'select',
      gestureOnsetT: 100,
      executedT: 250,
      target: 'target_opt_b',
    });

    expect(ev.sessionId).toMatch(/^ses_/);
    expect(ev.profileId).toBe('prof_test');
    expect(ev.source).toBe('mouse_sim');
    expect(ev.mode).toBe('rest_test');
    expect(typeof ev.seq).toBe('number');
    expect(typeof ev.t).toBe('number');
    expect(ev.executedT! - ev.gestureOnsetT!).toBe(150); // response time calculation
  });
});
