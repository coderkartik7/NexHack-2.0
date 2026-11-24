/**
 * Pure statistical functions for evaluation and reporting.
 * Zero external dependencies, deterministic, handles n=0, n=1 gracefully.
 */

/**
 * Calculates percentile using linear interpolation between nearest ranks (R-7 / NIST standard).
 * Handles n=0 (returns null), n=1 (returns the single value).
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const clampedP = Math.max(0, Math.min(1, p));
  const rank = clampedP * (sorted.length - 1);
  const lowIndex = Math.floor(rank);
  const highIndex = Math.ceil(rank);
  const weight = rank - lowIndex;

  if (lowIndex === highIndex) {
    return sorted[lowIndex];
  }
  return Number((sorted[lowIndex] * (1 - weight) + sorted[highIndex] * weight).toFixed(2));
}

export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number((sum / values.length).toFixed(2));
}

export function min(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function max(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}
