export interface ScrollZoneConfig {
  topBandPx: number;      // Height of top scroll band (e.g. 90px)
  bottomBandPx: number;   // Height of bottom scroll band (e.g. 90px)
  deadZonePx: number;     // Dead margin before scrolling initiates (e.g. 20px)
  dwellTimeMs: number;    // Required dwell before scroll starts (250ms)
  maxSpeedPxPerFrame: number; // Max scroll speed (e.g. 14px)
}

export interface ScrollDecision {
  shouldScroll: boolean;
  deltaY: number; // positive = scroll down, negative = scroll up
  inBand: 'top' | 'bottom' | null;
  dwellProgress: number; // 0..1
}

export class ScrollController {
  private config: ScrollZoneConfig;
  private dwellStartT: number | null = null;
  private activeBand: 'top' | 'bottom' | null = null;

  constructor(config: Partial<ScrollZoneConfig> = {}) {
    this.config = {
      topBandPx: config.topBandPx ?? 90,
      bottomBandPx: config.bottomBandPx ?? 90,
      deadZonePx: config.deadZonePx ?? 20,
      dwellTimeMs: config.dwellTimeMs ?? 250,
      maxSpeedPxPerFrame: config.maxSpeedPxPerFrame ?? 14,
    };
  }

  public reset(): void {
    this.dwellStartT = null;
    this.activeBand = null;
  }

  /**
   * Evaluates cursor position relative to viewport height and returns scroll decision.
   * Pure deterministic calculation.
   */
  public evaluate(
    cursorY: number,
    viewportHeight: number,
    now: number,
    isPaused = false
  ): ScrollDecision {
    if (isPaused) {
      this.reset();
      return { shouldScroll: false, deltaY: 0, inBand: null, dwellProgress: 0 };
    }

    let detectedBand: 'top' | 'bottom' | null = null;

    if (cursorY <= this.config.topBandPx) {
      detectedBand = 'top';
    } else if (cursorY >= viewportHeight - this.config.bottomBandPx) {
      detectedBand = 'bottom';
    }

    if (!detectedBand) {
      this.reset();
      return { shouldScroll: false, deltaY: 0, inBand: null, dwellProgress: 0 };
    }

    // Band changed
    if (this.activeBand !== detectedBand) {
      this.activeBand = detectedBand;
      this.dwellStartT = now;
      return { shouldScroll: false, deltaY: 0, inBand: detectedBand, dwellProgress: 0 };
    }

    // Still in same band, check dwell time
    const elapsed = this.dwellStartT !== null ? now - this.dwellStartT : 0;
    const dwellProgress = Math.min(1.0, elapsed / this.config.dwellTimeMs);

    if (elapsed < this.config.dwellTimeMs) {
      return { shouldScroll: false, deltaY: 0, inBand: detectedBand, dwellProgress };
    }

    // Dwell reached -> calculate scroll speed proportional to penetration depth
    let depth = 0;
    if (detectedBand === 'top') {
      depth = Math.max(0, this.config.topBandPx - cursorY);
      if (depth < this.config.deadZonePx) {
        return { shouldScroll: false, deltaY: 0, inBand: detectedBand, dwellProgress: 1.0 };
      }
      const ratio = Math.min(1.0, (depth - this.config.deadZonePx) / (this.config.topBandPx - this.config.deadZonePx));
      const deltaY = -Math.round(ratio * this.config.maxSpeedPxPerFrame);
      return { shouldScroll: true, deltaY, inBand: detectedBand, dwellProgress: 1.0 };
    } else {
      depth = Math.max(0, cursorY - (viewportHeight - this.config.bottomBandPx));
      if (depth < this.config.deadZonePx) {
        return { shouldScroll: false, deltaY: 0, inBand: detectedBand, dwellProgress: 1.0 };
      }
      const ratio = Math.min(1.0, (depth - this.config.deadZonePx) / (this.config.bottomBandPx - this.config.deadZonePx));
      const deltaY = Math.round(ratio * this.config.maxSpeedPxPerFrame);
      return { shouldScroll: true, deltaY, inBand: detectedBand, dwellProgress: 1.0 };
    }
  }
}
