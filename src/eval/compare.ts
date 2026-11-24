import type { SessionMetrics } from './types';
import type { LearnerProfile } from '../calibration/types';

export interface ParticipantComparison {
  participantId: string;
  baseline: SessionMetrics | null;
  afterRecalibration: SessionMetrics | null;
  recalibrationDelta: {
    medianResponseTimeDeltaMs: number | null;
    p90ResponseTimeDeltaMs: number | null;
    accidentalActivityDelta: number | null;
    accidentalRestDelta: number | null;
    taskTotalTimeDeltaMs: number | null;
    description: string;
  } | null;
}

export interface BetweenParticipantsComparison {
  userA: {
    participantId: string;
    profile: LearnerProfile | null;
    metrics: SessionMetrics | null;
  };
  userB: {
    participantId: string;
    profile: LearnerProfile | null;
    metrics: SessionMetrics | null;
  };
  deltas: {
    medianResponseTimeDiffMs: number | null;
    p90ResponseTimeDiffMs: number | null;
    accidentalTotalDiff: number | null;
    tasksTotalTimeDiffMs: number | null;
  };
  disclaimer: string;
}

/**
 * Pure comparison function for before vs after recalibration
 */
export function compareConditions(
  baseline: SessionMetrics | null,
  afterRecal: SessionMetrics | null
): ParticipantComparison['recalibrationDelta'] | null {
  if (!baseline || !afterRecal) return null;

  const medianBaseline = baseline.responseTime.medianMs;
  const medianAfter = afterRecal.responseTime.medianMs;
  const medianResponseTimeDeltaMs =
    medianBaseline !== null && medianAfter !== null ? Number((medianAfter - medianBaseline).toFixed(1)) : null;

  const p90Baseline = baseline.responseTime.p90Ms;
  const p90After = afterRecal.responseTime.p90Ms;
  const p90ResponseTimeDeltaMs =
    p90Baseline !== null && p90After !== null ? Number((p90After - p90Baseline).toFixed(1)) : null;

  const accidentalActivityDelta = afterRecal.accidental.total - baseline.accidental.total;
  const accidentalRestDelta = afterRecal.accidental.duringRest - baseline.accidental.duringRest;

  const tBase = baseline.tasks.taskTimesMs.total;
  const tAfter = afterRecal.tasks.taskTimesMs.total;
  const taskTotalTimeDeltaMs = tBase !== null && tAfter !== null ? tAfter - tBase : null;

  let description = '';
  if (medianResponseTimeDeltaMs !== null) {
    if (medianResponseTimeDeltaMs < 0) {
      description = `Median response time improved by ${Math.abs(medianResponseTimeDeltaMs)} ms after recalibration (${medianBaseline} ms -> ${medianAfter} ms).`;
    } else if (medianResponseTimeDeltaMs > 0) {
      description = `Median response time changed by +${medianResponseTimeDeltaMs} ms after recalibration (${medianBaseline} ms -> ${medianAfter} ms).`;
    } else {
      description = `Median response time remained identical at ${medianBaseline} ms after recalibration.`;
    }
  } else {
    description = 'Insufficient response time samples to compute latency delta.';
  }

  return {
    medianResponseTimeDeltaMs,
    p90ResponseTimeDeltaMs,
    accidentalActivityDelta,
    accidentalRestDelta,
    taskTotalTimeDeltaMs,
    description,
  };
}

/**
 * Pure between-participants comparison (User A vs User B)
 */
export function compareParticipants(
  userA: { participantId: string; profile: LearnerProfile | null; metrics: SessionMetrics | null },
  userB: { participantId: string; profile: LearnerProfile | null; metrics: SessionMetrics | null }
): BetweenParticipantsComparison {
  const rtA = userA.metrics?.responseTime.medianMs ?? null;
  const rtB = userB.metrics?.responseTime.medianMs ?? null;
  const medianResponseTimeDiffMs = rtA !== null && rtB !== null ? Number((rtB - rtA).toFixed(1)) : null;

  const p90A = userA.metrics?.responseTime.p90Ms ?? null;
  const p90B = userB.metrics?.responseTime.p90Ms ?? null;
  const p90ResponseTimeDiffMs = p90A !== null && p90B !== null ? Number((p90B - p90A).toFixed(1)) : null;

  const accA = userA.metrics?.accidental.total ?? null;
  const accB = userB.metrics?.accidental.total ?? null;
  const accidentalTotalDiff = accA !== null && accB !== null ? accB - accA : null;

  const timeA = userA.metrics?.tasks.taskTimesMs.total ?? null;
  const timeB = userB.metrics?.tasks.taskTimesMs.total ?? null;
  const tasksTotalTimeDiffMs = timeA !== null && timeB !== null ? timeB - timeA : null;

  return {
    userA,
    userB,
    deltas: {
      medianResponseTimeDiffMs,
      p90ResponseTimeDiffMs,
      accidentalTotalDiff,
      tasksTotalTimeDiffMs,
    },
    disclaimer: 'n = 2 descriptive pilot comparison only. No inferential or generalized statistical claims.',
  };
}

/**
 * Rule-based factual findings narrative generator
 */
export function generateFindingsNarrative(
  _participantId: string,
  activityMetrics: SessionMetrics | null,
  restMetrics: SessionMetrics | null,
  profile: LearnerProfile | null
): string[] {
  const statements: string[] = [];

  // Rest test findings
  if (restMetrics) {
    const falseFires = restMetrics.accidental.duringRest;
    if (falseFires === 0) {
      statements.push(
        `During the ${Math.round(restMetrics.durationMs / 1000)} s rest test, 0 false commands fired, confirming resting posture and noise remained below entry thresholds.`
      );
    } else {
      statements.push(
        `During the ${Math.round(restMetrics.durationMs / 1000)} s rest test, ${falseFires} false activation(s) occurred (${restMetrics.accidental.perMinute ?? '--'} / min).`
      );
    }
  } else {
    statements.push('No rest test evaluation data available.');
  }

  // Activity findings
  if (activityMetrics) {
    const rt = activityMetrics.responseTime;
    if (rt.medianMs !== null) {
      statements.push(
        `Completed lesson with a median response time of ${rt.medianMs} ms (p90: ${rt.p90Ms ?? '--'} ms, N = ${rt.count}).`
      );
      if (rt.p90Ms !== null && rt.p90Ms > rt.medianMs * 1.8) {
        statements.push(
          `Notable latency tail observed (p90 of ${rt.p90Ms} ms is > 1.8x median of ${rt.medianMs} ms), indicating occasional deliberate gesture formation or hesitation.`
        );
      }
    }

    if (activityMetrics.accidental.total > 0) {
      statements.push(
        `Observed ${activityMetrics.accidental.total} accidental activation(s) (${activityMetrics.accidental.fromUndo} undone by user, ${activityMetrics.accidental.fromFacilitator} flagged by facilitator).`
      );
    } else {
      statements.push('Zero accidental activations or cancelled gestures recorded during lesson execution.');
    }

    if (activityMetrics.tracking.lostCount > 3) {
      statements.push(
        `Tracking was interrupted ${activityMetrics.tracking.lostCount} times for a total of ${(activityMetrics.tracking.totalLostMs / 1000).toFixed(1)} s.`
      );
    }
  }

  // Calibration separability warnings
  if (profile) {
    const commands = (['select', 'grab', 'pause'] as const);
    for (const cmd of commands) {
      const binding = profile.commands[cmd];
      if (binding?.separability?.rating === 'marginal' || binding?.separability?.rating === 'unreliable') {
        statements.push(
          `Calibrated gesture for '${cmd}' (${binding.signal}) has a ${binding.separability.rating.toUpperCase()} separability rating (d' = ${binding.separability.dPrime}).`
        );
      }
    }
  }

  return statements;
}
