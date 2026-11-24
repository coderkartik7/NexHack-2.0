/**
 * Drift Correction module for gaze tracking.
 * Pure deterministic module.
 * Provides:
 * 1. Automatic mild EMA correction towards target center when select gesture succeeds
 * 2. Manual Re-center control (resets offset or snaps center to target)
 */

export interface DriftCorrectionOptions {
  alpha?: number;      // EMA rate (default 0.08)
  maxOffsetPx?: number; // Cap on total drift correction (default 120px)
}

export class DriftCorrector {
  private options: Required<DriftCorrectionOptions>;
  private offsetX = 0;
  private offsetY = 0;

  constructor(options: DriftCorrectionOptions = {}) {
    this.options = {
      alpha: options.alpha ?? 0.08,
      maxOffsetPx: options.maxOffsetPx ?? 120,
    };
  }

  public getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  public setOffset(x: number, y: number): void {
    const dist = Math.hypot(x, y);
    if (dist > this.options.maxOffsetPx) {
      const scale = this.options.maxOffsetPx / dist;
      this.offsetX = x * scale;
      this.offsetY = y * scale;
    } else {
      this.offsetX = x;
      this.offsetY = y;
    }
  }

  public reset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Called on successful target selection:
   * nudges offset so predicted gaze shifts slightly closer to target center.
   * predictedPt is without current drift correction (or with current drift correction).
   * delta = targetCenter - (predictedPt + offset)
   */
  public onTargetSelected(
    predictedX: number,
    predictedY: number,
    targetCenterX: number,
    targetCenterY: number
  ): { x: number; y: number } {
    const errorX = targetCenterX - (predictedX + this.offsetX);
    const errorY = targetCenterY - (predictedY + this.offsetY);

    const newX = this.offsetX + this.options.alpha * errorX;
    const newY = this.offsetY + this.options.alpha * errorY;

    this.setOffset(newX, newY);
    return this.getOffset();
  }

  /**
   * Apply drift correction to a point: returns corrected (x, y).
   */
  public apply(x: number, y: number): { x: number; y: number } {
    return {
      x: x + this.offsetX,
      y: y + this.offsetY,
    };
  }
}
