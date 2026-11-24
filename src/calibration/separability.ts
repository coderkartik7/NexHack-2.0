import type { GestureDirection, GestureSampleRep, ReliabilityRating, SignalSummaryStats } from './types';

export interface SeparabilityResult {
  dPrime: number;
  overlap: number;
  rating: ReliabilityRating;
  message: string;
}

/**
 * Computes d-prime separation score and rest overlap share against enter threshold.
 *
 * d' = (mean_gesture - mean_rest) / sqrt((var_gesture + var_rest) / 2)
 * overlap = share of rest samples past 'enter' threshold
 *
 * Rating:
 * - 'reliable': d' >= 3.0 and overlap < 0.005 (0.5%)
 * - 'marginal': d' >= 1.8 and overlap < 0.05
 * - 'unreliable': otherwise
 */
export function computeSeparability(
  restStats: SignalSummaryStats,
  restSamples: number[],
  direction: GestureDirection,
  sampleReps: GestureSampleRep[],
  enterThreshold: number
): SeparabilityResult {
  const isHigh = direction === 'high';
  const validReps = sampleReps.filter((r) => r.isValid);

  // Gesture peaks in active direction
  const gesturePeaks = validReps.map((r) => (isHigh ? r.peak : -r.peak));

  // If insufficient sample data
  if (gesturePeaks.length < 2 || restSamples.length === 0) {
    return {
      dPrime: 0,
      overlap: 1.0,
      rating: 'unreliable',
      message: 'Insufficient gesture samples to evaluate reliability.',
    };
  }

  // Gesture mean and variance
  const meanGesture = gesturePeaks.reduce((a, b) => a + b, 0) / gesturePeaks.length;
  const varGesture =
    gesturePeaks.reduce((a, b) => a + Math.pow(b - meanGesture, 2), 0) /
    (gesturePeaks.length - 1 || 1);

  // Rest mean and variance in active direction
  const meanRest = isHigh ? restStats.mean : -restStats.mean;
  const varRest = Math.pow(restStats.std, 2);

  // Pooled standard deviation
  const pooledVar = (varGesture + varRest) / 2.0;
  const pooledStd = Math.sqrt(Math.max(pooledVar, 1e-6));

  const dPrime = (meanGesture - meanRest) / pooledStd;

  // Overlap fraction: share of rest samples that cross enterThreshold
  let overlapCount = 0;
  for (const s of restSamples) {
    if (isHigh ? s >= enterThreshold : s <= enterThreshold) {
      overlapCount++;
    }
  }
  const overlap = overlapCount / restSamples.length;

  let rating: ReliabilityRating = 'unreliable';
  let message = '';

  if (dPrime >= 3.0 && overlap < 0.005) {
    rating = 'reliable';
    message = 'Gesture is distinct and clearly separated from resting movement.';
  } else if (dPrime >= 1.8 && overlap < 0.05) {
    rating = 'marginal';
    message =
      'Gesture is slightly close to natural resting fidgets. Try a more deliberate movement or pick a different gesture.';
  } else {
    rating = 'unreliable';
    message =
      'Significant overlap with resting movement. Resting twitches or blinks may falsely trigger this command. Consider choosing an alternate gesture or re-recording.';
  }

  return {
    dPrime: Number(dPrime.toFixed(2)),
    overlap: Number(overlap.toFixed(4)),
    rating,
    message,
  };
}
