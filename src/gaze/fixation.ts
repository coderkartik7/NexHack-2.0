/**
 * Pure deterministic Fixation Detector (I-DT: Identification by Dispersion-Threshold).
 * Snaps cursor to fixation centroid when dispersion is below threshold over minimum duration.
 * Releases immediately on saccade.
 */

export interface FixationPoint {
  x: number;
  y: number;
  t: number; // timestamp in ms
}

export interface FixationOptions {
  dispersionThresholdPx?: number; // max dispersion radius in px to be considered fixation (default 65px)
  minDurationMs?: number;         // min duration window to confirm fixation (default 120ms)
  maxWindowMs?: number;           // max history window to keep (default 400ms)
}

export interface FixationState {
  isFixating: boolean;
  centroidX: number;
  centroidY: number;
  dispersion: number;
  durationMs: number;
}

export class FixationDetector {
  private options: Required<FixationOptions>;
  private window: FixationPoint[] = [];
  private isCurrentlyFixating = false;
  private currentCentroid = { x: 0, y: 0 };

  constructor(options: FixationOptions = {}) {
    this.options = {
      dispersionThresholdPx: options.dispersionThresholdPx ?? 65,
      minDurationMs: options.minDurationMs ?? 120,
      maxWindowMs: options.maxWindowMs ?? 400,
    };
  }

  public reset(): void {
    this.window = [];
    this.isCurrentlyFixating = false;
    this.currentCentroid = { x: 0, y: 0 };
  }

  /**
   * Update with a new gaze point and timestamp.
   * Returns current fixation state and snapped/filtered point.
   */
  public update(point: { x: number; y: number }, nowMs: number): FixationState {
    this.window.push({ x: point.x, y: point.y, t: nowMs });

    // Prune points older than maxWindowMs
    while (this.window.length > 0 && nowMs - this.window[0].t > this.options.maxWindowMs) {
      this.window.shift();
    }

    if (this.window.length < 2) {
      this.isCurrentlyFixating = false;
      this.currentCentroid = { x: point.x, y: point.y };
      return {
        isFixating: false,
        centroidX: point.x,
        centroidY: point.y,
        dispersion: 0,
        durationMs: 0,
      };
    }

    // Compute duration in current window
    const duration = nowMs - this.window[0].t;

    // Compute bounding box / dispersion: D = [max(x) - min(x)] + [max(y) - min(y)]
    // or radial dispersion from mean
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;

    for (const p of this.window) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      sumX += p.x;
      sumY += p.y;
    }

    const n = this.window.length;
    const meanX = sumX / n;
    const meanY = sumY / n;
    const dispersion = Math.hypot(maxX - minX, maxY - minY);

    if (duration >= this.options.minDurationMs && dispersion <= this.options.dispersionThresholdPx) {
      this.isCurrentlyFixating = true;
      // Centroid is running average of the fixation window
      this.currentCentroid = { x: meanX, y: meanY };
    } else {
      // Saccade or dispersion exceeded: release fixation
      this.isCurrentlyFixating = false;
      this.currentCentroid = { x: point.x, y: point.y };
    }

    return {
      isFixating: this.isCurrentlyFixating,
      centroidX: this.currentCentroid.x,
      centroidY: this.currentCentroid.y,
      dispersion,
      durationMs: duration,
    };
  }
}
