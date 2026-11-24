import { describe, it, expect } from 'vitest';
import { computeThresholds, updateNeutral, THRESHOLD_CONFIG } from '../src/calibration/thresholds';
import type { GestureSampleRep, SignalSummaryStats } from '../src/calibration/types';

describe('thresholds.ts unit tests', () => {
  const dummyRestStats: SignalSummaryStats = {
    mean: 0.05,
    std: 0.02,
    min: 0.01,
    max: 0.10,
    p95: 0.08,
    p99: 0.09,
  };

  it('computes high-is-active thresholds with hysteresis (enter > exit)', () => {
    const sampleReps: GestureSampleRep[] = [
      { peak: 0.60, durationMs: 400, isValid: true },
      { peak: 0.65, durationMs: 450, isValid: true },
      { peak: 0.62, durationMs: 420, isValid: true },
      { peak: 0.58, durationMs: 390, isValid: true },
      { peak: 0.61, durationMs: 410, isValid: true },
    ];

    const result = computeThresholds(dummyRestStats, 'high', sampleReps);

    // Median peak is 0.61, restMax is 0.10. Delta = 0.51
    // enter = 0.10 + 0.4 * 0.51 = 0.304
    // exit = 0.10 + 0.2 * 0.51 = 0.202
    expect(result.enter).toBeGreaterThan(result.exit);
    expect(result.enter).toBeCloseTo(0.10 + THRESHOLD_CONFIG.ENTER_FACTOR * (0.61 - 0.10), 3);
    expect(result.exit).toBeCloseTo(0.10 + THRESHOLD_CONFIG.EXIT_FACTOR * (0.61 - 0.10), 3);
    expect(result.minHoldMs).toBeGreaterThanOrEqual(120);
    expect(result.cooldownMs).toBeGreaterThan(result.minHoldMs);
  });

  it('computes low-is-active thresholds correctly for pinch gesture', () => {
    // Pinch: lower is active (e.g. resting pinch is 0.9, pinched is 0.15)
    const pinchRest: SignalSummaryStats = {
      mean: 0.85,
      std: 0.04,
      min: 0.75,
      max: 0.95,
      p95: 0.92,
      p99: 0.94,
    };

    const sampleReps: GestureSampleRep[] = [
      { peak: 0.15, durationMs: 300, isValid: true },
      { peak: 0.18, durationMs: 350, isValid: true },
      { peak: 0.12, durationMs: 320, isValid: true },
      { peak: 0.16, durationMs: 310, isValid: true },
      { peak: 0.14, durationMs: 330, isValid: true },
    ];

    const result = computeThresholds(pinchRest, 'low', sampleReps);

    // For low-is-active, entering requires dropping below enter, and exiting requires rising above exit
    // Hence enter < exit in raw values (or enter is more extreme)
    expect(result.enter).toBeLessThan(result.exit);
    expect(result.enter).toBeLessThan(pinchRest.min);
  });

  it('updateNeutral adapts cursor offset using exponential moving average', () => {
    const profile = {
      cursorMapping: {
        gainX: 2.0,
        gainY: 2.0,
        offsetX: 0.5,
        offsetY: 0.5,
      },
    };

    // Current coordinates slightly shifted to (0.6, 0.4)
    const updated = updateNeutral(profile, { x: 0.6, y: 0.4 }, 0.1);

    // offsetX: 0.9 * 0.5 + 0.1 * 0.6 = 0.45 + 0.06 = 0.51
    expect(updated.offsetX).toBeCloseTo(0.51, 4);
    // offsetY: 0.9 * 0.5 + 0.1 * 0.4 = 0.45 + 0.04 = 0.49
    expect(updated.offsetY).toBeCloseTo(0.49, 4);
  });
});
