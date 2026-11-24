import type { GazeValidationStats } from './types';

export type GazeAccuracyRating = 'good' | 'fair' | 'poor';

export interface ValidationEvaluation {
  stats: GazeValidationStats;
  rating: GazeAccuracyRating;
  advice: string;
}

/**
 * Computes mean and P90 Euclidean error across validation samples.
 */
export function computeValidationAccuracy(
  predictions: { x: number; y: number }[],
  targets: { x: number; y: number }[],
  screenW: number,
  screenH: number
): ValidationEvaluation {
  const n = Math.min(predictions.length, targets.length);
  if (n === 0) {
    return {
      stats: { meanErrorPx: 0, p90ErrorPx: 0, n: 0, screenW, screenH },
      rating: 'poor',
      advice: 'No validation samples collected. Re-do calibration.',
    };
  }

  const errors: number[] = [];
  let sumError = 0;

  for (let i = 0; i < n; i++) {
    const dx = predictions[i].x - targets[i].x;
    const dy = predictions[i].y - targets[i].y;
    const err = Math.hypot(dx, dy);
    errors.push(err);
    sumError += err;
  }

  errors.sort((a, b) => a - b);
  const meanErrorPx = Math.round(sumError / n);
  const p90Index = Math.min(n - 1, Math.floor(0.9 * n));
  const p90ErrorPx = Math.round(errors[p90Index]);

  let rating: GazeAccuracyRating = 'good';
  let advice = 'Tracking is optimal for interaction.';

  if (meanErrorPx < 120) {
    rating = 'good';
    advice = 'Great tracking quality! Ready to interact with standard targets.';
  } else if (meanErrorPx <= 200) {
    rating = 'fair';
    advice = 'Acceptable accuracy. Move a bit closer and avoid backlighting for better results.';
  } else {
    rating = 'poor';
    advice = 'Higher tracking error. Consider re-doing calibration, moving closer, or using large-target mode.';
  }

  return {
    stats: {
      meanErrorPx,
      p90ErrorPx,
      n,
      screenW,
      screenH,
    },
    rating,
    advice,
  };
}
