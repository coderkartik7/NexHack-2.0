import type { SignalSummaryStats } from './types';

/**
 * Calculates mean, sample standard deviation, min, max, and percentiles for an array of numbers.
 */
export function computeSignalStats(values: number[]): SignalSummaryStats {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, p95: 0, p99: 0 };
  }

  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  let variance = 0;
  if (n > 1) {
    const sumSqDiff = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
    variance = sumSqDiff / (n - 1);
  }
  const std = Math.sqrt(variance);

  // Percentiles using linear interpolation
  const p95 = getPercentile(sorted, 0.95);
  const p99 = getPercentile(sorted, 0.99);

  return { mean, std, min, max, p95, p99 };
}

export function getPercentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];

  const index = p * (sortedAsc.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedAsc[lower];
  }
  return (1 - weight) * sortedAsc[lower] + weight * sortedAsc[upper];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
