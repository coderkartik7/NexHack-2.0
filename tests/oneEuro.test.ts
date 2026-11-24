import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../src/vision/oneEuro';

describe('OneEuroFilter', () => {
  it('reduces jitter on a noisy constant signal', () => {
    const filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 });
    const constantVal = 0.5;
    const dt = 33.3; // ~30 fps in ms

    const rawSamples: number[] = [];
    const filteredSamples: number[] = [];

    // Simulate 60 frames of a constant value with +/- 0.05 jitter
    for (let i = 0; i < 60; i++) {
      const noise = (Math.sin(i * 1.7) * 0.05); // deterministic pseudo-noise
      const val = constantVal + noise;
      const t = i * dt;
      rawSamples.push(val);
      filteredSamples.push(filter.filter(val, t));
    }

    // Calculate variance of raw vs filtered (excluding first 5 warm-up samples)
    const rawSlice = rawSamples.slice(5);
    const filteredSlice = filteredSamples.slice(5);

    const calcVar = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };

    const rawVar = calcVar(rawSlice);
    const filteredVar = calcVar(filteredSlice);

    expect(filteredVar).toBeLessThan(rawVar * 0.4); // Jitter reduced by >60%
  });

  it('adapts with low lag on a step input', () => {
    const filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 });
    const dt = 33.3;

    // Start at 0 for 20 frames
    let t = 0;
    for (let i = 0; i < 20; i++) {
      filter.filter(0, t);
      t += dt;
    }

    // Step jump to 1.0
    const stepVal = 1.0;
    let reached90Percent = false;
    let framesToConverge = 0;

    for (let i = 0; i < 30; i++) {
      t += dt;
      const out = filter.filter(stepVal, t);
      framesToConverge++;
      if (out >= 0.90) {
        reached90Percent = true;
        break;
      }
    }

    // Step should adapt swiftly (under 10 frames = ~300ms) thanks to velocity adaptation beta
    expect(reached90Percent).toBe(true);
    expect(framesToConverge).toBeLessThanOrEqual(10);
  });

  it('resets properly without carrying stale history', () => {
    const filter = new OneEuroFilter();
    filter.filter(10, 0);
    filter.filter(20, 33);
    filter.reset();

    // After reset, first sample should immediately pass through without lag
    const firstAfterReset = filter.filter(100, 1000);
    expect(firstAfterReset).toBe(100);
  });
});
