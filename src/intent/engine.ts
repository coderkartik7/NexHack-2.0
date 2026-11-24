import type { LearnerProfile, CommandName } from '../calibration/types';
import type { SignalFrame } from '../types/signals';
import { createInitialContext, stepMachine } from './machine';
import type { MachineContext } from './types';
import { CommandBus, commandBus } from './bus';

export class IntentEngine {
  private profile: LearnerProfile | null = null;
  private isPaused = false;
  private machines: Record<CommandName, MachineContext> = {
    select: createInitialContext('select'),
    grab: createInitialContext('grab'),
    pause: createInitialContext('pause'),
  };
  private bus: CommandBus;
  private lastTrackingValid = true;
  public trackingLostSinceT: number | null = null;

  constructor(bus: CommandBus = commandBus, initialProfile: LearnerProfile | null = null) {
    this.bus = bus;
    if (initialProfile) {
      this.setProfile(initialProfile);
    }
  }

  public setProfile(profile: LearnerProfile): void {
    this.profile = profile;
    this.resetAllMachines();
  }

  public getProfile(): LearnerProfile | null {
    return this.profile;
  }

  public setPaused(paused: boolean, now = performance.now()): void {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
    if (paused) {
      // Release any active commands immediately
      this.resetAllMachines();
      this.bus.publish({ type: 'pause.toggle', onsetT: now, executedT: now });
    } else {
      this.bus.publish({ type: 'pause.toggle', onsetT: now, executedT: now });
    }
  }

  public togglePause(now = performance.now()): boolean {
    this.setPaused(!this.isPaused, now);
    return this.isPaused;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getMachineContexts(): Record<CommandName, MachineContext> {
    return { ...this.machines };
  }

  public resetAllMachines(): void {
    this.machines = {
      select: createInitialContext('select'),
      grab: createInitialContext('grab'),
      pause: createInitialContext('pause'),
    };
  }

  /**
   * Process an incoming SignalFrame deterministically
   */
  public processFrame(frame: SignalFrame): void {
    if (!this.profile) return;

    const now = frame.t;
    const mode = this.profile.mode;
    const trackingQuality =
      mode === 'head'
        ? frame.quality.face
        : mode === 'eye'
        ? (frame.quality.eye ?? frame.quality.face)
        : frame.quality.hand;
    const isTrackingLost = trackingQuality < 0.2;

    // Track transitions in tracking quality
    if (isTrackingLost) {
      if (this.lastTrackingValid) {
        this.trackingLostSinceT = now;
        this.lastTrackingValid = false;
        this.bus.publish({ type: 'tracking_lost', t: now });
      }
    } else {
      if (!this.lastTrackingValid) {
        this.lastTrackingValid = true;
        this.trackingLostSinceT = null;
        this.bus.publish({ type: 'tracking_restored', t: now });
      }
    }

    // 1. Process PAUSE command first (pause can be evaluated even while paused)
    const pauseBinding = this.profile.commands.pause;
    const pauseRawSignal = isTrackingLost ? null : frame.signals[pauseBinding.signal];
    const pauseRes = stepMachine(this.machines.pause, pauseRawSignal, pauseBinding, now, false);
    this.machines.pause = pauseRes.nextContext;

    for (const ev of pauseRes.events) {
      if (ev.type === 'candidate_progress') {
        this.bus.publish({
          type: 'candidate_progress',
          command: 'pause',
          progress: ev.progress,
          t: ev.t,
        });
      } else if (ev.type === 'fire') {
        const newPauseState = !this.isPaused;
        this.isPaused = newPauseState;
        this.bus.publish({
          type: 'pause.toggle',
          onsetT: ev.onsetT,
          executedT: ev.fireT,
        });
        if (newPauseState) {
          // Reset other machines on pausing
          this.resetAllMachines();
          return;
        }
      }
    }

    // If globally paused, suppress select and grab
    if (this.isPaused) {
      // Step select and grab as suppressed to flush their states
      this.stepSuppressed('select', now);
      this.stepSuppressed('grab', now);
      return;
    }

    // 2. Select & Grab Mutual Exclusion
    // First in CANDIDATE or ACTIVE locks out the other
    const selectState = this.machines.select.state;
    const grabState = this.machines.grab.state;

    const selectHasLock = selectState === 'CANDIDATE' || selectState === 'ACTIVE';
    const grabHasLock = grabState === 'CANDIDATE' || grabState === 'ACTIVE';

    let suppressSelect = false;
    let suppressGrab = false;

    if (selectHasLock && !grabHasLock) {
      suppressGrab = true;
    } else if (grabHasLock && !selectHasLock) {
      suppressSelect = true;
    }

    // Step Select
    const selectBinding = this.profile.commands.select;
    const selectRawSignal = isTrackingLost ? null : frame.signals[selectBinding.signal];
    const selectRes = stepMachine(
      this.machines.select,
      selectRawSignal,
      selectBinding,
      now,
      suppressSelect
    );
    this.machines.select = selectRes.nextContext;

    for (const ev of selectRes.events) {
      if (ev.type === 'candidate_progress') {
        this.bus.publish({
          type: 'candidate_progress',
          command: 'select',
          progress: ev.progress,
          t: ev.t,
        });
      } else if (ev.type === 'fire') {
        this.bus.publish({
          type: 'select.fire',
          onsetT: ev.onsetT,
          executedT: ev.fireT,
        });
      }
    }

    // Step Grab
    // If select became candidate or active during its step, lock out grab
    const selectNowLocked =
      this.machines.select.state === 'CANDIDATE' || this.machines.select.state === 'ACTIVE';
    if (selectNowLocked) {
      suppressGrab = true;
    }

    const grabBinding = this.profile.commands.grab;
    const grabRawSignal = isTrackingLost ? null : frame.signals[grabBinding.signal];
    const grabRes = stepMachine(
      this.machines.grab,
      grabRawSignal,
      grabBinding,
      now,
      suppressGrab
    );
    this.machines.grab = grabRes.nextContext;

    for (const ev of grabRes.events) {
      if (ev.type === 'candidate_progress') {
        this.bus.publish({
          type: 'candidate_progress',
          command: 'grab',
          progress: ev.progress,
          t: ev.t,
        });
      } else if (ev.type === 'fire') {
        this.bus.publish({
          type: 'grab.start',
          onsetT: ev.onsetT,
          executedT: ev.fireT,
        });
      } else if (ev.type === 'release') {
        this.bus.publish({
          type: 'grab.end',
          heldDurationMs: ev.heldDurationMs,
          reason: ev.reason,
          t: ev.t,
        });
      }
    }
  }

  private stepSuppressed(command: 'select' | 'grab', now: number): void {
    if (!this.profile) return;
    const binding = this.profile.commands[command];
    const res = stepMachine(this.machines[command], null, binding, now, true);
    this.machines[command] = res.nextContext;
    for (const ev of res.events) {
      if (ev.type === 'candidate_progress') {
        this.bus.publish({
          type: 'candidate_progress',
          command,
          progress: 0,
          t: now,
        });
      } else if (ev.type === 'release') {
        if (command === 'grab') {
          this.bus.publish({
            type: 'grab.end',
            heldDurationMs: ev.heldDurationMs,
            reason: ev.reason,
            t: ev.t,
          });
        }
      }
    }
  }
}
