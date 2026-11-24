import type { LearnerProfile } from '../calibration/types';
import type { SignalFrame } from '../types/signals';
import { OneEuroFilter } from '../vision/oneEuro';
import { updateNeutral } from '../calibration/thresholds';
import type { CursorState, MachineContext } from './types';

export interface CursorOptions {
  viewportWidth: number;
  viewportHeight: number;
  freezeLookbackMs?: number; // ~150 ms
  minCutoff?: number;
  beta?: number;
}

export interface PositionRecord {
  t: number;
  screenX: number;
  screenY: number;
}

export class IntentCursor {
  private profile: LearnerProfile | null = null;
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private viewportWidth: number;
  private viewportHeight: number;
  private freezeLookbackMs: number;

  // History buffer for click stabilization freeze (~300ms window)
  private history: PositionRecord[] = [];
  private frozen = false;
  private frozenPosition: { x: number; y: number } | null = null;

  // Latest calculated state
  private currentState: CursorState = {
    rawX: 0.5,
    rawY: 0.5,
    screenX: 0,
    screenY: 0,
    frozen: false,
    viewportWidth: 1024,
    viewportHeight: 768,
  };

  constructor(options: CursorOptions, profile: LearnerProfile | null = null) {
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
    this.freezeLookbackMs = options.freezeLookbackMs ?? 150;

    // Light One Euro smoothing on screen coords
    this.filterX = new OneEuroFilter({ minCutoff: options.minCutoff ?? 1.2, beta: options.beta ?? 0.015 });
    this.filterY = new OneEuroFilter({ minCutoff: options.minCutoff ?? 1.2, beta: options.beta ?? 0.015 });

    if (profile) {
      this.setProfile(profile);
    }
  }

  public setProfile(profile: LearnerProfile): void {
    this.profile = profile;
    this.reset();
  }

  public setViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(100, width);
    this.viewportHeight = Math.max(100, height);
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.history = [];
    this.frozen = false;
    this.frozenPosition = null;
  }

  public getState(): CursorState {
    return { ...this.currentState };
  }

  /**
   * Update cursor position based on frame, profile mapping, and candidate machine state.
   */
  public update(
    frame: SignalFrame,
    machines: { select: MachineContext; grab: MachineContext; pause?: MachineContext },
    now = frame.t
  ): CursorState {
    if (!this.profile) return this.currentState;

    const isHead = this.profile.mode === 'head';
    const rawX = isHead ? frame.signals.headX : frame.signals.handX;
    const rawY = isHead ? frame.signals.headY : frame.signals.handY;

    // If tracker lost, preserve previous position
    if (rawX === null || rawY === null || isNaN(rawX) || isNaN(rawY)) {
      this.currentState = {
        ...this.currentState,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
      };
      return this.currentState;
    }

    const mapping = this.profile.cursorMapping;

    // Map through cursorMapping:
    // head mode is centered around 0 with range approx [-0.5, 0.5]
    // hand mode is in [0, 1] with center around 0.5
    let normX = 0.5;
    let normY = 0.5;

    if (isHead) {
      normX = 0.5 + (rawX - mapping.offsetX) * mapping.gainX;
      normY = 0.5 + (rawY - mapping.offsetY) * mapping.gainY;
    } else {
      normX = 0.5 + (rawX - (mapping.offsetX || 0.5)) * mapping.gainX;
      normY = 0.5 + (rawY - (mapping.offsetY || 0.5)) * mapping.gainY;
    }

    // Clamp normalized to [0, 1]
    const clampedNormX = Math.max(0, Math.min(1, normX));
    const clampedNormY = Math.max(0, Math.min(1, normY));

    // Convert to screen pixels
    const targetScreenX = clampedNormX * this.viewportWidth;
    const targetScreenY = clampedNormY * this.viewportHeight;

    // Apply light 1€ smoothing
    const smoothedX = this.filterX.filter(targetScreenX, now);
    const smoothedY = this.filterY.filter(targetScreenY, now);

    // Record into history
    this.history.push({ t: now, screenX: smoothedX, screenY: smoothedY });
    // Keep max 500ms history
    while (this.history.length > 0 && now - this.history[0].t > 500) {
      this.history.shift();
    }

    // Click Stabilization Check:
    // While select or grab is in CANDIDATE, freeze cursor at position from ~150ms before onset
    const candidateMachine =
      machines.select.state === 'CANDIDATE'
        ? machines.select
        : machines.grab.state === 'CANDIDATE'
        ? machines.grab
        : null;

    if (candidateMachine && candidateMachine.onsetT !== null) {
      if (!this.frozen) {
        this.frozen = true;
        const targetLookbackT = candidateMachine.onsetT - this.freezeLookbackMs;
        // Find position in history closest to targetLookbackT
        let bestPos = { x: smoothedX, y: smoothedY };
        let minDiff = Infinity;
        for (const rec of this.history) {
          const diff = Math.abs(rec.t - targetLookbackT);
          if (diff < minDiff) {
            minDiff = diff;
            bestPos = { x: rec.screenX, y: rec.screenY };
          }
        }
        this.frozenPosition = bestPos;
      }
    } else {
      // Unfreeze when no longer in candidate
      this.frozen = false;
      this.frozenPosition = null;
    }

    // Determine final screen coordinate
    const finalScreenX = this.frozen && this.frozenPosition ? this.frozenPosition.x : smoothedX;
    const finalScreenY = this.frozen && this.frozenPosition ? this.frozenPosition.y : smoothedY;

    // Drift Compensation EMA (updateNeutral):
    // Only applied while all machines are IDLE and cursor is not moving rapidly
    const allIdle =
      machines.select.state === 'IDLE' &&
      machines.grab.state === 'IDLE' &&
      (!machines.pause || machines.pause.state === 'IDLE');

    if (allIdle && this.history.length >= 2) {
      const prev = this.history[this.history.length - 2];
      const dist = Math.hypot(smoothedX - prev.screenX, smoothedY - prev.screenY);
      if (dist < 4) {
        // Subtle drift compensation
        const updated = updateNeutral(
          this.profile,
          { x: rawX, y: rawY },
          0.002 // slow neutral drift adjustment
        );
        this.profile.cursorMapping = updated;
      }
    }

    this.currentState = {
      rawX,
      rawY,
      screenX: Math.round(finalScreenX),
      screenY: Math.round(finalScreenY),
      frozen: this.frozen,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };

    return this.currentState;
  }
}
