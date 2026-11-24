import { describe, it, expect } from 'vitest';
import { computeSignalStats, getPercentile, median, clamp } from '../src/calibration/stats';

describe('stats.ts unit tests', () => {
  it('computes mean, std, min, max correctly for known dataset', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const stats = computeSignalStats(data);

    expect(stats.mean).toBe(5);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    // Sample std dev for this data is ~2.138
    expect(stats.std).toBeCloseTo(2.138, 2);
  });

  it('handles empty and single-element arrays gracefully', () => {
    const emptyStats = computeSignalStats([]);
    expect(emptyStats.mean).toBe(0);
    expect(emptyStats.std).toBe(0);

    const singleStats = computeSignalStats([42]);
    expect(singleStats.mean).toBe(42);
    expect(singleStats.std).toBe(0);
    expect(singleStats.min).toBe(42);
    expect(singleStats.max).toBe(42);
  });

  it('computes percentiles and median correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(median(values)).toBe(5.5);
    expect(median([1, 2, 3])).toBe(2);

    const sortedAsc = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(getPercentile(sortedAsc, 0.5)).toBe(50);
    expect(getPercentile(sortedAsc, 0.9)).toBe(90);
  });

  it('clamps values correctly', () => {
    expect(clamp(150, 100, 200)).toBe(150);
    expect(clamp(50, 100, 200)).toBe(100);
    expect(clamp(250, 100, 200)).toBe(200);
  });
});
