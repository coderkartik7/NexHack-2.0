import { describe, it, expect } from 'vitest';
import { createInitialContext, stepMachine } from '../src/intent/machine';
import type { CommandBinding } from '../src/calibration/types';

describe('Intent State Machine (Pure)', () => {
  const binding: CommandBinding = {
    signal: 'jawOpen',
    direction: 'high',
    enter: 0.45,
    exit: 0.25,
    minHoldMs: 200,
    cooldownMs: 300,
    separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
  };

  it('held gesture for 5s fires exactly one fire and one release', () => {
    let ctx = createInitialContext('select');
    let fires = 0;
    let releases = 0;

    // t = 0 to 5000ms at 30Hz (~33ms steps)
    for (let t = 0; t <= 5000; t += 33) {
      const signal = t >= 100 && t <= 4500 ? 0.6 : 0.05;
      const res = stepMachine(ctx, signal, binding, t);
      ctx = res.nextContext;
      for (const ev of res.events) {
        if (ev.type === 'fire') fires++;
        if (ev.type === 'release') releases++;
      }
    }

    expect(fires).toBe(1);
    expect(releases).toBe(1);
  });

  it('noise below enter never fires', () => {
    let ctx = createInitialContext('select');
    let fires = 0;

    for (let t = 0; t <= 2000; t += 33) {
      const signal = 0.40; // below enter of 0.45
      const res = stepMachine(ctx, signal, binding, t);
      ctx = res.nextContext;
      for (const ev of res.events) {
        if (ev.type === 'fire') fires++;
      }
    }

    expect(fires).toBe(0);
    expect(ctx.state).toBe('IDLE');
  });

  it('spike shorter than minHoldMs never fires', () => {
    let ctx = createInitialContext('select');
    let fires = 0;

    // Spike for 100ms (minHoldMs is 200ms)
    for (let t = 0; t <= 500; t += 20) {
      const signal = t >= 100 && t <= 200 ? 0.7 : 0.05;
      const res = stepMachine(ctx, signal, binding, t);
      ctx = res.nextContext;
      for (const ev of res.events) {
        if (ev.type === 'fire') fires++;
      }
    }

    expect(fires).toBe(0);
    expect(ctx.state).toBe('IDLE');
  });

  it('signal jittering around enter (between exit and enter) does not flicker', () => {
    let ctx = createInitialContext('select');
    
    // Cross enter at t=100
    let res = stepMachine(ctx, 0.50, binding, 100);
    ctx = res.nextContext;
    expect(ctx.state).toBe('CANDIDATE');

    // Jitter down to 0.35 (below enter 0.45, but above exit 0.25)
    res = stepMachine(ctx, 0.35, binding, 150);
    ctx = res.nextContext;
    expect(ctx.state).toBe('CANDIDATE'); // remains candidate

    res = stepMachine(ctx, 0.42, binding, 200);
    ctx = res.nextContext;
    expect(ctx.state).toBe('CANDIDATE');

    // Reaches minHoldMs threshold at t=300
    res = stepMachine(ctx, 0.35, binding, 300);
    ctx = res.nextContext;
    expect(ctx.state).toBe('ACTIVE');
    expect(res.events.some((e) => e.type === 'fire')).toBe(true);

    // Still stays active while jittering above exit 0.25
    res = stepMachine(ctx, 0.28, binding, 350);
    ctx = res.nextContext;
    expect(ctx.state).toBe('ACTIVE');

    // Drops below exit 0.25 -> natural release
    res = stepMachine(ctx, 0.15, binding, 400);
    ctx = res.nextContext;
    expect(res.events.some((e) => e.type === 'release' && e.reason === 'natural')).toBe(true);
    expect(ctx.state).toBe('COOLDOWN');
  });

  it('cooldown blocks a second trigger; after cooldown a new one works', () => {
    let ctx = createInitialContext('select');

    // Enter candidate at t=0
    ctx = stepMachine(ctx, 0.6, binding, 0).nextContext;
    expect(ctx.state).toBe('CANDIDATE');

    // Hold to fire at t=200 -> ACTIVE
    ctx = stepMachine(ctx, 0.6, binding, 200).nextContext;
    expect(ctx.state).toBe('ACTIVE');

    // Drop below exit at t=300 -> releases -> COOLDOWN (ends at 300 + 300 = 600)
    ctx = stepMachine(ctx, 0.1, binding, 300).nextContext;
    expect(ctx.state).toBe('COOLDOWN');

    // Try triggering at t=450 (during cooldown)
    let res = stepMachine(ctx, 0.7, binding, 450);
    ctx = res.nextContext;
    expect(ctx.state).toBe('COOLDOWN');
    expect(res.events.length).toBe(0);

    // At t=601 (cooldown expired), signal is still high, triggers new candidate
    res = stepMachine(ctx, 0.7, binding, 601);
    ctx = res.nextContext;
    expect(ctx.state).toBe('CANDIDATE');
  });

  it('null mid-gesture releases safely and never fires from unknown data', () => {
    let ctx = createInitialContext('select');

    // Enter candidate at t=0
    ctx = stepMachine(ctx, 0.6, binding, 0).nextContext;
    // Hold to fire at t=200 -> ACTIVE
    ctx = stepMachine(ctx, 0.6, binding, 200).nextContext;
    expect(ctx.state).toBe('ACTIVE');

    // Signal becomes null mid-gesture at t=300
    const res = stepMachine(ctx, null, binding, 300);
    ctx = res.nextContext;
    expect(ctx.state).toBe('COOLDOWN');
    const releaseEv = res.events.find((e) => e.type === 'release');
    expect(releaseEv).toBeDefined();
    expect(releaseEv?.reason).toBe('tracking_lost');
  });

  it('low direction gesture (such as pinch) inverts correctly', () => {
    const lowBinding: CommandBinding = {
      signal: 'pinch',
      direction: 'low',
      enter: 0.3,
      exit: 0.5,
      minHoldMs: 150,
      cooldownMs: 200,
      separability: { dPrime: 2.0, overlap: 0.05, rating: 'reliable' },
    };

    let ctx = createInitialContext('select');
    // For low direction, activeVal = -rawVal.
    // enterActive = -0.3, exitActive = -0.5.
    // High pinch raw (e.g. 0.8) => activeVal = -0.8 (< -0.3) => inactive
    let res = stepMachine(ctx, 0.8, lowBinding, 0);
    ctx = res.nextContext;
    expect(ctx.state).toBe('IDLE');

    // Pinch closed: raw = 0.2 => activeVal = -0.2 (>= -0.3) => candidate!
    res = stepMachine(ctx, 0.2, lowBinding, 50);
    ctx = res.nextContext;
    expect(ctx.state).toBe('CANDIDATE');

    // Hold for 150ms
    res = stepMachine(ctx, 0.2, lowBinding, 200);
    ctx = res.nextContext;
    expect(ctx.state).toBe('ACTIVE');
    expect(res.events.some((e) => e.type === 'fire')).toBe(true);
  });
});
