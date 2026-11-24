import type { SessionEvent } from '../logging/eventLog';
import type { SessionMetrics, FacilitatorMark, Condition } from './types';
import { median, percentile, mean, min, max } from './stats';
import type { CommandName } from '../calibration/types';

export interface ComputeMetricsOptions {
  sessionId?: string;
  participantId?: string;
  profileId?: string;
  condition?: Condition;
  mode?: 'activity' | 'rest_test';
  source?: 'live' | 'mouse_sim' | 'replay';
  durationMs?: number;
  quality?: 'complete' | 'incomplete';
  facilitatorMarks?: FacilitatorMark[];
}

/**
 * Pure function: computes all evaluation metrics from an event array and facilitator marks.
 * Deterministic, no I/O, no Date.now().
 */
export function computeMetrics(
  events: SessionEvent[],
  options: ComputeMetricsOptions = {}
): SessionMetrics {
  const sessionId = options.sessionId ?? (events[0]?.sessionId || 'unknown_session');
  const participantId = options.participantId ?? (events[0]?.profileId || 'unknown_participant');
  const profileId = options.profileId ?? (events[0]?.profileId || 'unknown_profile');
  const condition = options.condition ?? 'baseline';
  const mode = options.mode ?? (events[0]?.mode === 'rest_test' ? 'rest_test' : 'activity');
  const source = options.source ?? (events[0]?.source || 'live');
  const facilitatorMarks = options.facilitatorMarks ?? [];

  // Duration: provided or computed from max t - min t
  let durationMs = options.durationMs ?? 0;
  if (!durationMs && events.length > 0) {
    const minT = Math.min(...events.map((e) => e.t));
    const maxT = Math.max(...events.map((e) => e.t));
    durationMs = Math.max(0, maxT - minT);
  }

  // Sample size tracking
  const n: Record<string, number> = {
    totalEvents: events.length,
    commandsExecuted: 0,
    validResponseTimes: 0,
    skippedResponseTimes: 0,
  };

  // 1. Response Time Metrics (per command_executed)
  const responseTimes: number[] = [];
  const commandResponseTimes: Record<CommandName, number[]> = {
    select: [],
    grab: [],
    pause: [],
  };
  const commandExecutedCounts: Record<CommandName, number> = {
    select: 0,
    grab: 0,
    pause: 0,
  };

  const executedCommandSeqs = new Set<number>();

  for (const ev of events) {
    if (ev.type === 'command_executed') {
      n.commandsExecuted++;
      executedCommandSeqs.add(ev.seq);

      if (ev.command && (ev.command === 'select' || ev.command === 'grab' || ev.command === 'pause')) {
        commandExecutedCounts[ev.command]++;
      }

      if (typeof ev.executedT === 'number' && typeof ev.gestureOnsetT === 'number') {
        const rt = Math.max(0, ev.executedT - ev.gestureOnsetT);
        responseTimes.push(rt);
        n.validResponseTimes++;
        if (ev.command && commandResponseTimes[ev.command]) {
          commandResponseTimes[ev.command].push(rt);
        }
      } else {
        n.skippedResponseTimes++;
      }
    }
  }

  const responseTimeStats = {
    count: responseTimes.length,
    medianMs: median(responseTimes),
    p90Ms: percentile(responseTimes, 0.9),
    meanMs: mean(responseTimes),
    minMs: min(responseTimes),
    maxMs: max(responseTimes),
  };

  const byCommand: Record<CommandName, { executed: number; responseMedianMs: number | null }> = {
    select: {
      executed: commandExecutedCounts.select,
      responseMedianMs: median(commandResponseTimes.select),
    },
    grab: {
      executed: commandExecutedCounts.grab,
      responseMedianMs: median(commandResponseTimes.grab),
    },
    pause: {
      executed: commandExecutedCounts.pause,
      responseMedianMs: median(commandResponseTimes.pause),
    },
  };

  // 2. Accidental Activations
  // In Activity mode: command_executed that was undone (undone: true) OR marked by facilitator.
  // Deduplicate: counted once even if both apply.
  let fromUndo = 0;
  let fromFacilitator = 0;
  let duringRest = 0;
  const accidentalSeqs = new Set<number>();

  if (mode === 'rest_test') {
    // In rest mode, every command_executed is accidental by definition
    for (const ev of events) {
      if (ev.type === 'command_executed') {
        accidentalSeqs.add(ev.seq);
        duringRest++;
      }
    }
  } else {
    // Activity mode
    const facilitatorMarkedSeqs = new Set(facilitatorMarks.map((m) => m.eventSeq));

    for (const ev of events) {
      if (ev.type === 'command_executed') {
        const isUndone = ev.undone === true;
        const isMarked = facilitatorMarkedSeqs.has(ev.seq);

        if (isUndone) fromUndo++;
        if (isMarked) fromFacilitator++;

        if (isUndone || isMarked) {
          accidentalSeqs.add(ev.seq);
        }
      }
    }
  }

  const totalAccidental = accidentalSeqs.size;
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 0;
  const perMinute = durationMinutes > 0 ? Number((totalAccidental / durationMinutes).toFixed(2)) : null;

  // 3. Task Performance Metrics
  let answerAttempts = 0;
  let answerCorrectOnAttempt: number | null = null;
  let labelDrops = 0;
  let labelsCorrect = 0;
  let dragCancelled = 0;
  let completed = false;

  const firstEventT = events.length > 0 ? events[0].t : 0;
  let selectCompleteT: number | null = null;
  let scrollCompleteT: number | null = null;
  let dragCompleteT: number | null = null;
  let overallCompleteT: number | null = null;

  for (const ev of events) {
    if (ev.type === 'answer_attempt') {
      answerAttempts++;
      if (ev.correct && answerCorrectOnAttempt === null) {
        answerCorrectOnAttempt = answerAttempts;
        selectCompleteT = ev.t;
      }
    } else if (ev.type === 'label_drop') {
      labelDrops++;
      if (ev.correct) {
        labelsCorrect++;
      }
    } else if (ev.type === 'drag_cancelled') {
      dragCancelled++;
    } else if (ev.type === 'task_complete') {
      completed = true;
      overallCompleteT = ev.t;
      if (ev.target === 'select') selectCompleteT = ev.t;
      if (ev.target === 'scroll') scrollCompleteT = ev.t;
      if (ev.target === 'drag') dragCompleteT = ev.t;
    }
  }

  // If labels placed >= 3 and question answered, drag is complete
  if (labelsCorrect >= 3 && !dragCompleteT && overallCompleteT) {
    dragCompleteT = overallCompleteT;
  }

  const taskTimesMs = {
    select: selectCompleteT !== null ? Math.max(0, selectCompleteT - firstEventT) : null,
    scroll: scrollCompleteT !== null ? Math.max(0, scrollCompleteT - firstEventT) : null,
    drag: dragCompleteT !== null ? Math.max(0, dragCompleteT - firstEventT) : null,
    total: overallCompleteT !== null ? Math.max(0, overallCompleteT - firstEventT) : null,
  };

  // 4. Tracking Loss & Pauses
  let lostCount = 0;
  let totalLostMs = 0;
  let currentLostStartT: number | null = null;
  let pauses = 0;

  for (const ev of events) {
    if (ev.type === 'tracking_lost') {
      lostCount++;
      if (currentLostStartT === null) {
        currentLostStartT = ev.t;
      }
    } else if (ev.type === 'tracking_restored') {
      if (currentLostStartT !== null) {
        totalLostMs += Math.max(0, ev.t - currentLostStartT);
        currentLostStartT = null;
      }
    } else if (ev.type === 'pause') {
      pauses++;
    }
  }

  // Close open tracking lost interval if ended while lost
  if (currentLostStartT !== null && events.length > 0) {
    const lastT = events[events.length - 1].t;
    totalLostMs += Math.max(0, lastT - currentLostStartT);
  }

  const quality = options.quality ?? (completed ? 'complete' : 'incomplete');

  return {
    sessionId,
    participantId,
    profileId,
    condition,
    mode,
    source,
    durationMs,
    n,
    responseTime: responseTimeStats,
    byCommand,
    tasks: {
      answerAttempts,
      answerCorrectOnAttempt,
      labelDrops,
      labelsCorrect,
      dragCancelled,
      completed,
      taskTimesMs,
    },
    accidental: {
      total: totalAccidental,
      fromUndo,
      fromFacilitator,
      duringRest,
      perMinute,
    },
    tracking: {
      lostCount,
      totalLostMs,
    },
    pauses,
    quality,
  };
}

/**
 * Aggregates multiple SessionMetrics of the same participant/condition
 * (pooled response times, summed counts, weighted durations).
 */
export function aggregateMetrics(metricsList: SessionMetrics[]): SessionMetrics | null {
  if (metricsList.length === 0) return null;
  if (metricsList.length === 1) return metricsList[0];

  const first = metricsList[0];
  const participantId = first.participantId;
  const condition = first.condition;
  const mode = first.mode;
  const source = first.source;
  const profileId = first.profileId;

  let totalDurationMs = 0;
  let totalFires = 0;
  let totalAccidental = 0;
  let fromUndo = 0;
  let fromFacilitator = 0;
  let duringRest = 0;
  let totalLostCount = 0;
  let totalLostMs = 0;
  let totalPauses = 0;

  const totalCommands: Record<CommandName, number> = { select: 0, grab: 0, pause: 0 };
  let totalAnswerAttempts = 0;
  let totalLabelDrops = 0;
  let totalLabelsCorrect = 0;
  let totalDragCancelled = 0;
  let allCompleted = true;

  for (const m of metricsList) {
    totalDurationMs += m.durationMs;
    totalFires += m.responseTime.count;
    totalAccidental += m.accidental.total;
    fromUndo += m.accidental.fromUndo;
    fromFacilitator += m.accidental.fromFacilitator;
    duringRest += m.accidental.duringRest;
    totalLostCount += m.tracking.lostCount;
    totalLostMs += m.tracking.totalLostMs;
    totalPauses += m.pauses;

    totalCommands.select += m.byCommand.select.executed;
    totalCommands.grab += m.byCommand.grab.executed;
    totalCommands.pause += m.byCommand.pause.executed;

    totalAnswerAttempts += m.tasks.answerAttempts;
    totalLabelDrops += m.tasks.labelDrops;
    totalLabelsCorrect += m.tasks.labelsCorrect;
    totalDragCancelled += m.tasks.dragCancelled;

    if (!m.tasks.completed) allCompleted = false;
  }

  // Pooled median/mean approximation
  const validMedianMs = metricsList
    .map((m) => m.responseTime.medianMs)
    .filter((v): v is number => v !== null);
  const pooledMedian = median(validMedianMs);
  const validP90Ms = metricsList
    .map((m) => m.responseTime.p90Ms)
    .filter((v): v is number => v !== null);
  const pooledP90 = percentile(validP90Ms, 0.9);

  const durationMin = totalDurationMs > 0 ? totalDurationMs / 60000 : 0;
  const perMinute = durationMin > 0 ? Number((totalAccidental / durationMin).toFixed(2)) : null;

  return {
    sessionId: `agg_${participantId}_${condition}`,
    participantId,
    profileId,
    condition,
    mode,
    source,
    durationMs: totalDurationMs,
    n: {
      sessionsCount: metricsList.length,
      totalCommandsExecuted: totalFires,
    },
    responseTime: {
      count: totalFires,
      medianMs: pooledMedian,
      p90Ms: pooledP90,
      meanMs: mean(validMedianMs),
      minMs: min(validMedianMs),
      maxMs: max(validMedianMs),
    },
    byCommand: {
      select: { executed: totalCommands.select, responseMedianMs: null },
      grab: { executed: totalCommands.grab, responseMedianMs: null },
      pause: { executed: totalCommands.pause, responseMedianMs: null },
    },
    tasks: {
      answerAttempts: totalAnswerAttempts,
      answerCorrectOnAttempt: null,
      labelDrops: totalLabelDrops,
      labelsCorrect: totalLabelsCorrect,
      dragCancelled: totalDragCancelled,
      completed: allCompleted,
      taskTimesMs: { select: null, scroll: null, drag: null, total: null },
    },
    accidental: {
      total: totalAccidental,
      fromUndo,
      fromFacilitator,
      duringRest,
      perMinute,
    },
    tracking: {
      lostCount: totalLostCount,
      totalLostMs,
    },
    pauses: totalPauses,
    quality: allCompleted ? 'complete' : 'incomplete',
  };
}
