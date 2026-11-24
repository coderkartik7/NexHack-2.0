import { describe, it, expect } from 'vitest';
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
    cursorMapping: { gainX: 1.5, gainY: 1.5, offsetX: 0, offsetY: 0 },
    restBaseline: {} as any,
    commands: {
      select: {
        signal: 'jawOpen',
        direction: 'high',
        enter: 0.4,
        exit: 0.2,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
      grab: {
        signal: 'browRaise',
        direction: 'high',
        enter: 0.4,
        exit: 0.2,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
      pause: {
        signal: 'blink',
        direction: 'high',
        enter: 0.8,
        exit: 0.4,
        minHoldMs: 300,
        cooldownMs: 300,
        separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
      },
    },
  };
}

function makeFrame(t: number, signals: Partial<Record<SignalName, number | null>> = {}): SignalFrame {
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
    ...signals,
  };
  return {
    t,
    quality: { face: 0.9, hand: 0.9 },
    signals: fullSignals,
  };
}

describe('Intent Engine', () => {
  it('paused gate blocks select/grab but still processes pause to resume', () => {
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, createMockProfile());
    const events: any[] = [];
    bus.subscribe((e) => events.push(e));

    // Manually pause
    engine.setPaused(true, 0);
    expect(engine.getIsPaused()).toBe(true);

    // Send high jawOpen (select) for 500ms -> should NOT fire
    for (let t = 10; t <= 500; t += 30) {
      engine.processFrame(makeFrame(t, { jawOpen: 0.8 }));
    }
    expect(events.filter((e) => e.type === 'select.fire').length).toBe(0);

    // Send blink (pause command) for 350ms -> should toggle pause back to false
    for (let t = 600; t <= 1000; t += 30) {
      engine.processFrame(makeFrame(t, { blink: 0.9 }));
    }
    expect(engine.getIsPaused()).toBe(false);
  });

  it('select and grab are mutually exclusive (first wins, second suppressed)', () => {
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, createMockProfile());
    const events: any[] = [];
    bus.subscribe((e) => events.push(e));

    // At t=100, select becomes candidate (jawOpen = 0.6)
    engine.processFrame(makeFrame(100, { jawOpen: 0.6, browRaise: 0.05 }));
    expect(engine.getMachineContexts().select.state).toBe('CANDIDATE');

    // At t=120, browRaise also crosses enter (0.6), but select is already candidate
    engine.processFrame(makeFrame(120, { jawOpen: 0.6, browRaise: 0.6 }));
    expect(engine.getMachineContexts().grab.state).toBe('IDLE'); // grab is suppressed

    // Hold both until t=300
    for (let t = 150; t <= 300; t += 30) {
      engine.processFrame(makeFrame(t, { jawOpen: 0.6, browRaise: 0.6 }));
    }

    const selectFires = events.filter((e) => e.type === 'select.fire');
    const grabFires = events.filter((e) => e.type === 'grab.start');

    expect(selectFires.length).toBe(1);
    expect(grabFires.length).toBe(0);
  });

  it('hot-swapping profile resets all machines', () => {
    const bus = new CommandBus();
    const engine = new IntentEngine(bus, createMockProfile());

    // Make select candidate
    engine.processFrame(makeFrame(100, { jawOpen: 0.6 }));
    expect(engine.getMachineContexts().select.state).toBe('CANDIDATE');

    // Hot-swap
    const newProf = createMockProfile();
    newProf.name = 'Swapped';
    engine.setProfile(newProf);

    expect(engine.getMachineContexts().select.state).toBe('IDLE');
    expect(engine.getProfile()?.name).toBe('Swapped');
  });
});
