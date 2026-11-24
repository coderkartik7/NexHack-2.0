import { clamp, median } from './stats';
import type { GestureDirection, GestureSampleRep, SignalSummaryStats } from './types';

export const THRESHOLD_CONFIG = {
  ENTER_FACTOR: 0.4,
  EXIT_FACTOR: 0.2,
  MIN_HOLD_RATIO: 0.4,
  MIN_HOLD_LOWER_BOUND: 120, // ms
  MIN_HOLD_UPPER_BOUND: 400, // ms
  COOLDOWN_OFFSET: 200,      // ms
  COOLDOWN_LOWER_BOUND: 300, // ms
  COOLDOWN_UPPER_BOUND: 600, // ms
} as const;

export interface CalibratedThresholds {
  enter: number;
  exit: number;
  minHoldMs: number;
  cooldownMs: number;
  gestureMedianPeak: number;
  restReference: number;
}

/**
 * Pure function to compute dynamic activation thresholds with hysteresis.
 * Works in the signal's active direction (flips sign if direction is 'low').
 */
export function computeThresholds(
  restStats: SignalSummaryStats,
  direction: GestureDirection,
  sampleReps: GestureSampleRep[]
): CalibratedThresholds {
  const isHigh = direction === 'high';

  // Use p99 if raw max is an outlier (> 1.5 * p99 from mean)
  const restMaxInActiveDir = isHigh
    ? (restStats.max - restStats.mean > 1.5 * (restStats.p99 - restStats.mean)
        ? restStats.p99
        : restStats.max)
    : (restStats.mean - restStats.min > 1.5 * (restStats.mean - restStats.p95)
        ? restStats.p95
        : -restStats.min); // For low direction, working in transformed coordinates

  // In active direction: higher is more active
  // Transform values: activeVal = isHigh ? val : -val
  const restRef = isHigh ? restMaxInActiveDir : -restStats.min;

  // Extract valid sample peaks and durations
  const validReps = sampleReps.filter((r) => r.isValid);
  const activePeaks = validReps.map((r) => (isHigh ? r.peak : -r.peak));
  const durations = validReps.map((r) => r.durationMs);

  const gestureMedianPeak = activePeaks.length > 0 ? median(activePeaks) : restRef + 0.1;
  const medianDuration = durations.length > 0 ? median(durations) : 500;

  // enter = restMax + 0.4 * (gestureMedianPeak - restMax)
  // exit = restMax + 0.2 * (gestureMedianPeak - restMax)
  const peakDelta = Math.max(0, gestureMedianPeak - restRef);
  const enterTransformed = restRef + THRESHOLD_CONFIG.ENTER_FACTOR * peakDelta;
  const exitTransformed = restRef + THRESHOLD_CONFIG.EXIT_FACTOR * peakDelta;

  // Back to raw signal units
  const enter = isHigh ? enterTransformed : -enterTransformed;
  const exit = isHigh ? exitTransformed : -exitTransformed;

  // Timing thresholds
  const minHoldMs = clamp(
    Math.round(THRESHOLD_CONFIG.MIN_HOLD_RATIO * medianDuration),
    THRESHOLD_CONFIG.MIN_HOLD_LOWER_BOUND,
    THRESHOLD_CONFIG.MIN_HOLD_UPPER_BOUND
  );

  const cooldownMs = clamp(
    Math.round(1.0 * minHoldMs + THRESHOLD_CONFIG.COOLDOWN_OFFSET),
    THRESHOLD_CONFIG.COOLDOWN_LOWER_BOUND,
    THRESHOLD_CONFIG.COOLDOWN_UPPER_BOUND
  );

  return {
    enter,
    exit,
    minHoldMs,
    cooldownMs,
    gestureMedianPeak: isHigh ? gestureMedianPeak : -gestureMedianPeak,
    restReference: isHigh ? restRef : -restRef,
  };
}

/**
 * Pure function: Drift handling hook to slowly re-center the cursor offset
 * with an exponential moving average (EMA) when resting.
 */
export function updateNeutral(
  profile: { cursorMapping: { gainX: number; gainY: number; offsetX: number; offsetY: number } },
  currentCoords: { x: number; y: number },
  alpha = 0.01
): { gainX: number; gainY: number; offsetX: number; offsetY: number } {
  const newOffsetX = (1 - alpha) * profile.cursorMapping.offsetX + alpha * currentCoords.x;
  const newOffsetY = (1 - alpha) * profile.cursorMapping.offsetY + alpha * currentCoords.y;

  return {
    ...profile.cursorMapping,
    offsetX: newOffsetX,
    offsetY: newOffsetY,
  };
}
