export interface LowPassFilterConfig {
  alpha: number;
}

export class LowPassFilter {
  private hatXPrev: number | null = null;

  constructor(public alpha: number) {}

  filter(x: number, alpha: number): number {
    this.alpha = alpha;
    if (this.hatXPrev === null) {
      this.hatXPrev = x;
      return x;
    }
    const hatX = alpha * x + (1.0 - alpha) * this.hatXPrev;
    this.hatXPrev = hatX;
    return hatX;
  }

  last(): number | null {
    return this.hatXPrev;
  }

  reset(): void {
    this.hatXPrev = null;
  }
}

export interface OneEuroConfig {
  minCutoff?: number; // Minimum cutoff frequency (Hz)
  beta?: number;      // Speed coefficient
  dCutoff?: number;   // Cutoff frequency for derivative (Hz)
}

/**
 * 1€ Filter (Casiez et al., CHI 2012)
 * Precise and responsive filter for noisy signals.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private tPrev: number | null = null;

  constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 }: OneEuroConfig = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter(this.alpha(minCutoff, 1.0 / 30));
    this.dxFilter = new LowPassFilter(this.alpha(dCutoff, 1.0 / 30));
  }

  private alpha(cutoff: number, te: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(x: number, timestampMs: number): number {
    if (this.tPrev === null) {
      this.tPrev = timestampMs;
      return this.xFilter.filter(x, 1.0);
    }

    // Convert time elapsed to seconds
    const te = Math.max((timestampMs - this.tPrev) / 1000.0, 1e-4);
    this.tPrev = timestampMs;

    // Estimate derivative (rate of change)
    const prevX = this.xFilter.last();
    const dx = prevX === null ? 0 : (x - prevX) / te;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff, te));

    // Dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(cutoff, te));
  }

  reset(): void {
    this.tPrev = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}
