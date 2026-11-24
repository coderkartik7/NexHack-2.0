import { describe, it, expect } from 'vitest';
import { computeSeparability } from '../src/calibration/separability';
import type { GestureSampleRep, SignalSummaryStats } from '../src/calibration/types';

describe('separability.ts unit tests', () => {
  it('rates distinct gesture as reliable (dPrime >= 3, overlap < 0.5%)', () => {
    const restStats: SignalSummaryStats = {
      mean: 0.05,
      std: 0.01,
      min: 0.02,
      max: 0.08,
      p95: 0.07,
      p99: 0.08,
    };

    // 100 resting samples, none above 0.1
    const restSamples = Array.from({ length: 100 }, () => 0.05 + (Math.random() - 0.5) * 0.02);

    // Distinct gesture peaks around 0.6 (jaw open or brow raise)
    const sampleReps: GestureSampleRep[] = [
      { peak: 0.58, durationMs: 400, isValid: true },
      { peak: 0.62, durationMs: 420, isValid: true },
      { peak: 0.60, durationMs: 410, isValid: true },
      { peak: 0.59, durationMs: 390, isValid: true },
      { peak: 0.61, durationMs: 430, isValid: true },
    ];

    const enterThreshold = 0.28;
    const result = computeSeparability(restStats, restSamples, 'high', sampleReps, enterThreshold);

    expect(result.rating).toBe('reliable');
    expect(result.dPrime).toBeGreaterThanOrEqual(3.0);
    expect(result.overlap).toBe(0);
  });

  it('rates gesture overlapping with resting twitch as unreliable', () => {
    const restStats: SignalSummaryStats = {
      mean: 0.15,
      std: 0.08,
      min: 0.05,
      max: 0.35,
      p95: 0.30,
      p99: 0.33,
    };

    // Rest samples with noticeable noise
    const restSamples = Array.from({ length: 100 }, (_, i) => 0.1 + (i % 25) * 0.01);

    // Weak gesture peak too close to rest baseline
    const sampleReps: GestureSampleRep[] = [
      { peak: 0.22, durationMs: 300, isValid: true },
      { peak: 0.25, durationMs: 320, isValid: true },
      { peak: 0.20, durationMs: 310, isValid: true },
      { peak: 0.23, durationMs: 290, isValid: true },
      { peak: 0.21, durationMs: 300, isValid: true },
    ];

    const enterThreshold = 0.20;
    const result = computeSeparability(restStats, restSamples, 'high', sampleReps, enterThreshold);

    expect(result.rating).toBe('unreliable');
    expect(result.dPrime).toBeLessThan(2.0);
    expect(result.overlap).toBeGreaterThan(0.05);
    expect(result.message).toContain('overlap');
  });
});
