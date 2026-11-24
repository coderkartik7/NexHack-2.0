import type { CommandBinding, CommandName } from '../calibration/types';
import { detectSignal } from './detector';
import type { MachineContext, MachineEvent, MachineState } from './types';

export function createInitialContext(command: CommandName): MachineContext {
  return {
    command,
    state: 'IDLE',
    onsetT: null,
    fireT: null,
    releaseT: null,
    cooldownEndT: null,
    lastProgress: 0,
  };
}

export interface StepResult {
  nextContext: MachineContext;
  events: MachineEvent[];
}

/**
 * Pure state machine transition:
 * IDLE -> CANDIDATE -> ACTIVE -> RELEASE_WAIT -> COOLDOWN -> IDLE
 * 
 * Driven by injected timestamp `now`. Zero side effects.
 */
export function stepMachine(
  ctx: MachineContext,
  rawSignal: number | null | undefined,
  binding: Pick<CommandBinding, 'direction' | 'enter' | 'exit' | 'minHoldMs' | 'cooldownMs'>,
  now: number,
  isSuppressed = false
): StepResult {
  const events: MachineEvent[] = [];
  const det = detectSignal(rawSignal, binding);
  let nextState: MachineState = ctx.state;
  let onsetT = ctx.onsetT;
  let fireT = ctx.fireT;
  let releaseT = ctx.releaseT;
  let cooldownEndT = ctx.cooldownEndT;
  let lastProgress = ctx.lastProgress;

  // If externally suppressed (e.g. competitor command has lock or globally paused),
  // reset to IDLE or handle active release.
  if (isSuppressed) {
    if (ctx.state === 'ACTIVE') {
      const held = fireT !== null ? Math.max(0, now - fireT) : 0;
      events.push({
        type: 'release',
        command: ctx.command,
        heldDurationMs: held,
        reason: 'natural',
        t: now,
      });
      events.push({
        type: 'candidate_progress',
        command: ctx.command,
        progress: 0,
        t: now,
      });
    } else if (ctx.state === 'CANDIDATE' && lastProgress > 0) {
      events.push({
        type: 'candidate_progress',
        command: ctx.command,
        progress: 0,
        t: now,
      });
    }
    return {
      nextContext: {
        ...ctx,
        state: 'IDLE',
        onsetT: null,
        fireT: null,
        releaseT: null,
        cooldownEndT: null,
        lastProgress: 0,
      },
      events,
    };
  }

  switch (ctx.state) {
    case 'IDLE': {
      if (!det.isUnknown && det.isAboveEnter) {
        nextState = 'CANDIDATE';
        onsetT = now;
        lastProgress = 0;
        events.push({
          type: 'candidate_progress',
          command: ctx.command,
          progress: 0,
          t: now,
        });
      }
      break;
    }

    case 'CANDIDATE': {
      if (det.isUnknown || !det.isAboveExit) {
        // Dropped below exit or lost signal: reject twitch, return to IDLE
        nextState = 'IDLE';
        onsetT = null;
        lastProgress = 0;
        events.push({
          type: 'candidate_progress',
          command: ctx.command,
          progress: 0,
          t: now,
        });
      } else {
        // Signal stayed above exit
        const elapsed = onsetT !== null ? now - onsetT : 0;
        const progress = Math.min(1.0, binding.minHoldMs > 0 ? elapsed / binding.minHoldMs : 1.0);
        lastProgress = progress;

        events.push({
          type: 'candidate_progress',
          command: ctx.command,
          progress,
          t: now,
        });

        if (elapsed >= binding.minHoldMs) {
          nextState = 'ACTIVE';
          fireT = now;
          events.push({
            type: 'fire',
            command: ctx.command,
            onsetT: onsetT ?? now,
            fireT: now,
          });
        }
      }
      break;
    }

    case 'ACTIVE': {
      // Signal became null while ACTIVE: tracking lost mid-gesture
      if (det.isUnknown) {
        const held = fireT !== null ? Math.max(0, now - fireT) : 0;
        nextState = 'COOLDOWN';
        releaseT = now;
        cooldownEndT = now + binding.cooldownMs;
        lastProgress = 0;
        events.push({
          type: 'release',
          command: ctx.command,
          heldDurationMs: held,
          reason: 'tracking_lost',
          t: now,
        });
        events.push({
          type: 'candidate_progress',
          command: ctx.command,
          progress: 0,
          t: now,
        });
      } else if (!det.isAboveExit) {
        // Dropped below exit: natural release
        const held = fireT !== null ? Math.max(0, now - fireT) : 0;
        nextState = 'RELEASE_WAIT';
        releaseT = now;
        lastProgress = 0;
        events.push({
          type: 'release',
          command: ctx.command,
          heldDurationMs: held,
          reason: 'natural',
          t: now,
        });
        events.push({
          type: 'candidate_progress',
          command: ctx.command,
          progress: 0,
          t: now,
        });

        // Transition immediately to COOLDOWN
        nextState = 'COOLDOWN';
        cooldownEndT = now + binding.cooldownMs;
      }
      // While active and above exit, state persists with no extra fires
      break;
    }

    case 'RELEASE_WAIT': {
      nextState = 'COOLDOWN';
      cooldownEndT = now + binding.cooldownMs;
      break;
    }

    case 'COOLDOWN': {
      if (cooldownEndT === null || now >= cooldownEndT) {
        nextState = 'IDLE';
        onsetT = null;
        fireT = null;
        releaseT = null;
        cooldownEndT = null;
        // If signal is already active upon exiting cooldown, immediately consider it for candidate
        if (!det.isUnknown && det.isAboveEnter) {
          nextState = 'CANDIDATE';
          onsetT = now;
          lastProgress = 0;
          events.push({
            type: 'candidate_progress',
            command: ctx.command,
            progress: 0,
            t: now,
          });
        }
      }
      // While in cooldown, ignore inputs
      break;
    }
  }

  return {
    nextContext: {
      command: ctx.command,
      state: nextState,
      onsetT,
      fireT,
      releaseT,
      cooldownEndT,
      lastProgress,
    },
    events,
  };
}
