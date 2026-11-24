import { fitRidgeRegression, predictRidge } from './regression';
import type { GazeModel } from './types';
import { GAZE_FEATURE_NAMES } from '../vision/gazeFeatures';

export interface CalibrationSample {
  features: number[]; // length 12
  screenX: number;    // target coordinate in pixels
  screenY: number;    // target coordinate in pixels
}

export interface ModelFitOptions {
  includeSecondOrder?: boolean;
  lambdas?: number[]; // grid for cross-validation
  kFolds?: number;
}

export const DEFAULT_LAMBDA_GRID = [0.001, 0.01, 0.1, 1.0, 10.0, 100.0];

/**
 * Expands raw features (length 12) with 2nd-order iris terms:
 * irisX_L^2, irisY_L^2, irisX_L * irisY_L, irisX_R^2, irisY_R^2, irisX_R * irisY_R
 */
export function expandFeatures(rawFeatures: number[], includeSecondOrder: boolean): number[] {
  if (!includeSecondOrder) {
    return [...rawFeatures];
  }
  const [xL, yL, xR, yR] = rawFeatures;
  return [
    ...rawFeatures,
    xL * xL,
    yL * yL,
    xL * yL,
    xR * xR,
    yR * yR,
    xR * yR,
  ];
}

/**
 * K-fold cross validation to evaluate a candidate lambda.
 * Returns Mean Squared Error (MSE) across all folds.
 */
export function crossValidateLambda(
  X: number[][],
  y: number[],
  lambda: number,
  kFolds = 5
): number {
  const n = X.length;
  const folds = Math.min(kFolds, n);
  if (folds < 2) return 0;

  const foldSize = Math.floor(n / folds);
  let totalError = 0;
  let testCount = 0;

  for (let f = 0; f < folds; f++) {
    const testStart = f * foldSize;
    const testEnd = f === folds - 1 ? n : (f + 1) * foldSize;

    const trainX: number[][] = [];
    const trainY: number[] = [];
    const testX: number[][] = [];
    const testY: number[] = [];

    for (let i = 0; i < n; i++) {
      if (i >= testStart && i < testEnd) {
        testX.push(X[i]);
        testY.push(y[i]);
      } else {
        trainX.push(X[i]);
        trainY.push(y[i]);
      }
    }

    if (trainX.length <= trainX[0].length) {
      // Degenerate fold partition: skip or return high error
      return Infinity;
    }

    try {
      const fit = fitRidgeRegression(trainX, trainY, lambda);
      for (let i = 0; i < testX.length; i++) {
        const pred = predictRidge(testX[i], fit.weights, fit.mean, fit.std);
        const err = pred - testY[i];
        totalError += err * err;
        testCount++;
      }
    } catch {
      return Infinity;
    }
  }

  return testCount > 0 ? totalError / testCount : Infinity;
}

/**
 * Fit GazeModel from calibration samples.
 * Automatically chooses lambda using cross-validation over the grid.
 */
export function fitGazeModel(
  samples: CalibrationSample[],
  options: ModelFitOptions = {}
): GazeModel {
  const includeSecondOrder = options.includeSecondOrder ?? false;
  const lambdas = options.lambdas ?? DEFAULT_LAMBDA_GRID;
  const kFolds = options.kFolds ?? 5;

  if (samples.length < 9) {
    throw new Error(`Insufficient calibration samples: received ${samples.length}, minimum required is 9.`);
  }

  // Feature expansion
  const X = samples.map((s) => expandFeatures(s.features, includeSecondOrder));
  const yX = samples.map((s) => s.screenX);
  const yY = samples.map((s) => s.screenY);

  const numFeatures = X[0].length;
  if (samples.length <= numFeatures) {
    throw new Error(
      `Insufficient points (${samples.length}) for ${numFeatures} features. Collect more calibration points.`
    );
  }

  // Check variance in features to reject degenerate training sets
  for (let col = 0; col < numFeatures; col++) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += X[i][col];
    }
    const m = sum / samples.length;
    let varSum = 0;
    for (let i = 0; i < samples.length; i++) {
      varSum += (X[i][col] - m) ** 2;
    }
    // Only check basic features, not optional constant terms
    if (col < 4 && varSum / samples.length < 1e-10) {
      throw new Error(`Degenerate calibration data: feature index ${col} has near-zero variance.`);
    }
  }

  // Find best lambda via CV (summed MSE for X and Y)
  let bestLambda = lambdas[0];
  let minError = Infinity;

  for (const lam of lambdas) {
    const errX = crossValidateLambda(X, yX, lam, kFolds);
    const errY = crossValidateLambda(X, yY, lam, kFolds);
    const combined = errX + errY;
    if (combined < minError) {
      minError = combined;
      bestLambda = lam;
    }
  }

  // Fit final models with bestLambda
  const fitX = fitRidgeRegression(X, yX, bestLambda);
  const fitY = fitRidgeRegression(X, yY, bestLambda);

  const featureNames = [...GAZE_FEATURE_NAMES];
  if (includeSecondOrder) {
    featureNames.push(
      'irisX_L_sq' as any,
      'irisY_L_sq' as any,
      'iris_L_xy' as any,
      'irisX_R_sq' as any,
      'irisY_R_sq' as any,
      'iris_R_xy' as any
    );
  }

  return {
    version: 1,
    featureNames,
    featureMean: fitX.mean,
    featureStd: fitX.std,
    weightsX: fitX.weights,
    weightsY: fitY.weights,
    lambda: bestLambda,
    trainPoints: samples.length,
    validation: null,
    includeSecondOrder,
  };
}

/**
 * Predict on-screen (x, y) coordinates from feature vector, clamped to viewport.
 */
export function predictGaze(
  model: GazeModel,
  rawFeatures: number[],
  viewportWidth = window?.innerWidth || 1024,
  viewportHeight = window?.innerHeight || 768
): { x: number; y: number } {
  const expanded = expandFeatures(rawFeatures, !!model.includeSecondOrder);
  const rawX = predictRidge(expanded, model.weightsX, model.featureMean, model.featureStd);
  const rawY = predictRidge(expanded, model.weightsY, model.featureMean, model.featureStd);

  // Clamp to viewport
  const clampedX = Math.max(0, Math.min(viewportWidth, rawX));
  const clampedY = Math.max(0, Math.min(viewportHeight, rawY));

  return { x: clampedX, y: clampedY };
}
