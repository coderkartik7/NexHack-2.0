import type { LearnerProfile } from '../calibration/types';
import type { SignalFrame } from '../types/signals';
import { OneEuroFilter } from '../vision/oneEuro';
import { predictGaze } from './model';
import { FixationDetector } from './fixation';
import { DriftCorrector } from './drift';
import type { CursorState, MachineContext } from '../intent/types';
import type { GazeModel } from './types';

export interface GazeCursorOptions {
  viewportWidth: number;
  viewportHeight: number;
  freezeLookbackMs?: number; // ~150 ms for click stabilization
  minCutoff?: number;        // low cutoff for stationary gaze (default 0.7)
  beta?: number;             // beta for saccades (default 0.02)
  maxInvalidHoldMs?: number; // hold last valid cursor position for max 300ms
  dispersionThresholdPx?: number;
  minFixationMs?: number;
}

export interface GazeCursorHistoryRecord {
  t: number;
  screenX: number;
  screenY: number;
}

export class GazeCursor {
  private profile: LearnerProfile | null = null;
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private fixationDetector: FixationDetector;
  private driftCorrector: DriftCorrector;

  private viewportWidth: number;
  private viewportHeight: number;
  private freezeLookbackMs: number;
  private maxInvalidHoldMs: number;

  private lastValidT: number | null = null;
  private lastValidPos: { x: number; y: number } | null = null;
  private isTrackingLost = false;
  private isStale = false;

  private history: GazeCursorHistoryRecord[] = [];
  private frozen = false;
  private frozenPosition: { x: number; y: number } | null = null;

  // Latest calculated state
  private currentState: CursorState & {
    isStale: boolean;
    isFixating: boolean;
    rawPredictedX: number;
    rawPredictedY: number;
    driftOffsetX: number;
    driftOffsetY: number;
  } = {
    rawX: 0.5,
    rawY: 0.5,
    screenX: 0,
    screenY: 0,
    frozen: false,
    viewportWidth: 1024,
    viewportHeight: 768,
    isStale: false,
    isFixating: false,
    rawPredictedX: 512,
    rawPredictedY: 384,
    driftOffsetX: 0,
    driftOffsetY: 0,
  };

  constructor(options: GazeCursorOptions, profile: LearnerProfile | null = null) {
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
    this.freezeLookbackMs = options.freezeLookbackMs ?? 150;
    this.maxInvalidHoldMs = options.maxInvalidHoldMs ?? 300;

    this.filterX = new OneEuroFilter({
      minCutoff: options.minCutoff ?? 0.7,
      beta: options.beta ?? 0.02,
      dCutoff: 1.0,
    });
    this.filterY = new OneEuroFilter({
      minCutoff: options.minCutoff ?? 0.7,
      beta: options.beta ?? 0.02,
      dCutoff: 1.0,
    });

    this.fixationDetector = new FixationDetector({
      dispersionThresholdPx: options.dispersionThresholdPx ?? 65,
      minDurationMs: options.minFixationMs ?? 120,
    });

    this.driftCorrector = new DriftCorrector();

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

  public getDriftCorrector(): DriftCorrector {
    return this.driftCorrector;
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.fixationDetector.reset();
    this.history = [];
    this.frozen = false;
    this.frozenPosition = null;
    this.lastValidT = null;
    this.lastValidPos = null;
    this.isTrackingLost = false;
    this.isStale = false;
  }

  public getState() {
    return { ...this.currentState };
  }

  /**
   * Update gaze cursor position deterministically.
   * `features` is the feature array from GazeFeatureExtractor (or null if frame was invalid/blink).
   */
  public update(
    features: number[] | null,
    frame: SignalFrame,
    machines: { select: MachineContext; grab: MachineContext; pause?: MachineContext },
    now = frame.t
  ): CursorState & { isStale: boolean; isFixating: boolean } {
    const gazeModel: GazeModel | undefined = this.profile?.gaze;

    // Handle invalid frame or missing model
    if (!gazeModel || !features || features.length < 12) {
      if (this.lastValidPos && this.lastValidT !== null && now - this.lastValidT <= this.maxInvalidHoldMs) {
        // Hold last valid position, marked stale
        this.isStale = true;
        this.currentState = {
          ...this.currentState,
          isStale: true,
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
        };
        return this.currentState;
      }

      // Past 300ms hold -> mark tracking lost
      this.isTrackingLost = true;
      this.isStale = false;
      this.currentState = {
        ...this.currentState,
        isStale: false,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
      };
      return this.currentState;
    }

    // Valid frame
    this.lastValidT = now;
    this.isTrackingLost = false;
    this.isStale = false;

    // 1. Predict raw gaze point from features
    const rawGaze = predictGaze(gazeModel, features, this.viewportWidth, this.viewportHeight);

    // 2. Apply drift correction
    const driftOffset = this.driftCorrector.getOffset();
    const driftCorrected = this.driftCorrector.apply(rawGaze.x, rawGaze.y);

    // Clamp after drift to ensure within screen
    const clampedRawX = Math.max(0, Math.min(this.viewportWidth, driftCorrected.x));
    const clampedRawY = Math.max(0, Math.min(this.viewportHeight, driftCorrected.y));

    // 3. Smooth with One Euro filter
    const smoothedX = this.filterX.filter(clampedRawX, now);
    const smoothedY = this.filterY.filter(clampedRawY, now);

    // 4. Fixation detection (I-DT)
    const fixationState = this.fixationDetector.update({ x: smoothedX, y: smoothedY }, now);

    // Target position: centroid if fixating, else smoothed
    let targetX = fixationState.isFixating ? fixationState.centroidX : smoothedX;
    let targetY = fixationState.isFixating ? fixationState.centroidY : smoothedY;

    targetX = Math.max(0, Math.min(this.viewportWidth, targetX));
    targetY = Math.max(0, Math.min(this.viewportHeight, targetY));

    // Store in last valid position
    this.lastValidPos = { x: targetX, y: targetY };

    // Record into history buffer for click stabilization
    this.history.push({ t: now, screenX: targetX, screenY: targetY });
    while (this.history.length > 0 && now - this.history[0].t > 500) {
      this.history.shift();
    }

    // 5. Click stabilization check (freeze cursor from ~150ms before gesture onset)
    const candidateMachine =
      machines.select.state === 'CANDIDATE'
        ? machines.select
        : machines.grab.state === 'CANDIDATE'
        ? machines.grab
        : null;

    if (candidateMachine && candidateMachine.onsetT !== null) {
      if (!this.frozen) {
        this.frozen = true;
        const freezeTargetT = candidateMachine.onsetT - this.freezeLookbackMs;
        let bestRecord = this.history[this.history.length - 1];
        let minDiff = Infinity;
        for (const rec of this.history) {
          const diff = Math.abs(rec.t - freezeTargetT);
          if (diff < minDiff) {
            minDiff = diff;
            bestRecord = rec;
          }
        }
        this.frozenPosition = bestRecord ? { x: bestRecord.screenX, y: bestRecord.screenY } : { x: targetX, y: targetY };
      }
    } else {
      this.frozen = false;
      this.frozenPosition = null;
    }

    const finalScreenX = this.frozen && this.frozenPosition ? this.frozenPosition.x : targetX;
    const finalScreenY = this.frozen && this.frozenPosition ? this.frozenPosition.y : targetY;

    this.currentState = {
      rawX: frame.signals.gazeX ?? 0.5,
      rawY: frame.signals.gazeY ?? 0.5,
      screenX: finalScreenX,
      screenY: finalScreenY,
      frozen: this.frozen,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      isStale: false,
      isFixating: fixationState.isFixating,
      rawPredictedX: rawGaze.x,
      rawPredictedY: rawGaze.y,
      driftOffsetX: driftOffset.x,
      driftOffsetY: driftOffset.y,
    };

    return this.currentState;
  }
}
