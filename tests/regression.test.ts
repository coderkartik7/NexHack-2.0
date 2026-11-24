import { describe, it, expect } from 'vitest';
import { solveLinearSystem, fitRidgeRegression, predictRidge } from '../src/gaze/regression';
import { fitGazeModel, crossValidateLambda } from '../src/gaze/model';

describe('Ridge Regression Pure Logic', () => {
  it('solves linear systems with partial pivoting correctly', () => {
    // 2x + y = 5
    // x + 3y = 10
    // => x = 1, y = 3
    const A = [
      [2, 1],
      [1, 3],
    ];
    const b = [5, 10];
    const sol = solveLinearSystem(A, b);
    expect(sol[0]).toBeCloseTo(1, 5);
    expect(sol[1]).toBeCloseTo(3, 5);
  });

  it('recovers known linear coefficients from synthetic noiseless data', () => {
    // y = 2*x1 - 3*x2 + 5
    const N = 40;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < N; i++) {
      const x1 = i * 0.1;
      const x2 = (i % 5) * 0.4;
      X.push([x1, x2]);
      y.push(2 * x1 - 3 * x2 + 5);
    }

    const fit = fitRidgeRegression(X, y, 0.0001);
    const testPoint = [2.5, 1.2];
    const trueY = 2 * 2.5 - 3 * 1.2 + 5;
    const pred = predictRidge(testPoint, fit.weights, fit.mean, fit.std);
    expect(pred).toBeCloseTo(trueY, 1);
  });

  it('shrinks weights as lambda grows', () => {
    const N = 30;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < N; i++) {
      const x1 = Math.sin(i);
      const x2 = Math.cos(i);
      X.push([x1, x2]);
      y.push(4 * x1 + 2 * x2 + 1);
    }

    const fitSmall = fitRidgeRegression(X, y, 0.001);
    const fitLarge = fitRidgeRegression(X, y, 1000.0);

    const normSmall = Math.hypot(fitSmall.weights[0], fitSmall.weights[1]);
    const normLarge = Math.hypot(fitLarge.weights[0], fitLarge.weights[1]);
    expect(normLarge).toBeLessThan(normSmall);
  });

  it('handles collinear features without producing NaNs', () => {
    const N = 30;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < N; i++) {
      const x1 = i * 0.2;
      const x2 = x1 * 2; // perfectly collinear
      X.push([x1, x2]);
      y.push(3 * x1 + 4);
    }

    // Without lambda, X^T X is singular. With lambda > 0, ridge stays invertible.
    const fit = fitRidgeRegression(X, y, 0.1);
    expect(Number.isNaN(fit.weights[0])).toBe(false);
    expect(Number.isNaN(fit.weights[1])).toBe(false);
    expect(Number.isNaN(fit.weights[2])).toBe(false);
  });

  it('k-fold cross validation evaluates reasonable lambda', () => {
    const N = 35;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < N; i++) {
      const x = i * 0.2;
      X.push([x, Math.cos(x)]);
      y.push(5 * x + 2);
    }

    const mse = crossValidateLambda(X, y, 0.01, 5);
    expect(mse).toBeGreaterThan(0);
    expect(Number.isFinite(mse)).toBe(true);
  });

  it('rejects degenerate input with too few points or zero variance', () => {
    // Too few samples (< 9)
    const fewSamples = Array.from({ length: 5 }, (_, i) => ({
      features: new Array(12).fill(0.5),
      screenX: i * 100,
      screenY: i * 50,
    }));
    expect(() => fitGazeModel(fewSamples)).toThrow(/Insufficient calibration samples/);

    // Near zero variance in features
    const zeroVarSamples = Array.from({ length: 15 }, (_, i) => ({
      features: new Array(12).fill(0.5), // identical features
      screenX: i * 50,
      screenY: i * 40,
    }));
    expect(() => fitGazeModel(zeroVarSamples)).toThrow(/Degenerate calibration data/);
  });
});
