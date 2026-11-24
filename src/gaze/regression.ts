/**
 * Small pure numerical linear solver and Ridge Regression implementation.
 * Solves (XᵀX + λI)w = Xᵀy
 * Uses Gaussian elimination with partial pivoting.
 */

export interface LinearSystemResult {
  weights: number[]; // includes intercept/bias if aug term was in X
}

/**
 * Solve A * x = b for x using Gaussian elimination with partial pivoting.
 * A is N x N matrix, b is length N.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Clone to avoid mutating input
  const M: number[][] = A.map((row) => [...row]);
  const y: number[] = [...b];

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    if (maxVal < 1e-12) {
      throw new Error(`Singular or degenerate matrix at row ${i}`);
    }

    // Swap rows in M and y
    if (maxRow !== i) {
      const tempRow = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tempRow;

      const tempVal = y[i];
      y[i] = y[maxRow];
      y[maxRow] = tempVal;
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < n; j++) {
        M[k][j] -= factor * M[i][j];
      }
      y[k] -= factor * y[i];
    }
  }

  // Back substitution
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

export interface RidgeFitResult {
  weights: number[]; // length D + 1 (last element is intercept)
  mean: number[];    // feature means (length D)
  std: number[];     // feature stds (length D)
}

/**
 * Fit Ridge Regression:
 * X is N x D
 * y is N (scalar targets)
 * lambda is L2 penalty
 * Standardizes features first: (X - mean) / std.
 * Bias (intercept) is NOT regularized.
 */
export function fitRidgeRegression(
  X: number[][],
  y: number[],
  lambda: number
): RidgeFitResult {
  const n = X.length;
  if (n === 0) {
    throw new Error('Training set is empty');
  }
  const d = X[0].length;
  if (n < d + 1) {
    throw new Error(`Insufficient training samples (${n}) for ${d} features.`);
  }

  // 1. Compute means and stds for standardization
  const mean = new Array<number>(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      mean[j] += X[i][j];
    }
  }
  for (let j = 0; j < d; j++) {
    mean[j] /= n;
  }

  const std = new Array<number>(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      const diff = X[i][j] - mean[j];
      std[j] += diff * diff;
    }
  }
  for (let j = 0; j < d; j++) {
    std[j] = Math.sqrt(std[j] / (n - 1));
    if (std[j] < 1e-8) {
      // Near-zero variance
      std[j] = 1.0; // fallback so division doesn't produce NaN
    }
  }

  // 2. Build standardized design matrix with intercept term (last column = 1)
  const X_aug: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(d + 1);
    for (let j = 0; j < d; j++) {
      row[j] = (X[i][j] - mean[j]) / std[j];
    }
    row[d] = 1.0; // Intercept
    X_aug[i] = row;
  }

  // 3. Compute A = X_augᵀ * X_aug + λI (where λ is NOT applied to intercept)
  const cols = d + 1;
  const A: number[][] = Array.from({ length: cols }, () => new Array<number>(cols).fill(0));
  const b: number[] = new Array<number>(cols).fill(0);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X_aug[k][i] * X_aug[k][j];
      }
      A[i][j] = sum;
    }
    // Regularize feature weights, but NOT intercept
    if (i < d) {
      A[i][i] += lambda;
    }

    let bSum = 0;
    for (let k = 0; k < n; k++) {
      bSum += X_aug[k][i] * y[k];
    }
    b[i] = bSum;
  }

  // 4. Solve A * w = b
  const weights = solveLinearSystem(A, b);

  return {
    weights,
    mean,
    std,
  };
}

/**
 * Predict scalar for standardized features using learned weights.
 * features is raw length D (standardized inside).
 */
export function predictRidge(
  features: number[],
  weights: number[],
  mean: number[],
  std: number[]
): number {
  const d = features.length;
  let val = weights[d]; // intercept
  for (let j = 0; j < d; j++) {
    const norm = (features[j] - mean[j]) / std[j];
    val += norm * weights[j];
  }
  return val;
}
