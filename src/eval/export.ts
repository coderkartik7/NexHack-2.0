import type { StudyExportBundle, SessionMetrics } from './types';
import { computeMetrics } from './metrics';

export const METHODOLOGY_BLOCK = {
  description: 'GestureLearn Evaluation Study Pilot Bundle (N=2, descriptive only)',
  metricsDefinitions: {
    responseTime: 'Time elapsed between gestureOnsetT and executedT on command_executed events (ms).',
    accidentalActivity: 'Commands executed in activity mode that were either undone by learner or marked unintended by facilitator (deduplicated).',
    accidentalRest: 'Any command executed during timed rest test periods (false triggers).',
    perMinuteAccidental: 'Total accidental activations divided by total test duration in minutes.',
    trackingLostMs: 'Sum of durations between tracking_lost and tracking_restored events (ms).',
  },
  percentileMethod: 'Linear interpolation between nearest ranks (R-7 / NIST standard).',
  sampleSizeNote: 'Descriptive pilot comparison only (N=2). No inferential claims or p-values are claimed.',
};

/**
 * Exports metrics and raw sessions to standard CSV format
 */
export function exportMetricsToCsv(metricsList: SessionMetrics[]): string {
  const headers = [
    'sessionId',
    'participantId',
    'profileId',
    'condition',
    'mode',
    'source',
    'quality',
    'durationMs',
    'n_events',
    'responseCount',
    'responseMedianMs',
    'responseP90Ms',
    'responseMeanMs',
    'responseMinMs',
    'responseMaxMs',
    'selectExecuted',
    'selectResponseMedianMs',
    'grabExecuted',
    'grabResponseMedianMs',
    'pauseExecuted',
    'pauseResponseMedianMs',
    'answerAttempts',
    'answerCorrectOnAttempt',
    'labelDrops',
    'labelsCorrect',
    'dragCancelled',
    'taskCompleted',
    'taskTotalTimeMs',
    'accidentalTotal',
    'accidentalFromUndo',
    'accidentalFromFacilitator',
    'accidentalDuringRest',
    'accidentalPerMinute',
    'trackingLostCount',
    'trackingLostTotalMs',
    'pauses',
  ];

  const rows = metricsList.map((m) => [
    m.sessionId,
    m.participantId,
    m.profileId,
    m.condition,
    m.mode,
    m.source,
    m.quality,
    m.durationMs,
    m.n.totalEvents ?? m.responseTime.count,
    m.responseTime.count,
    m.responseTime.medianMs ?? '',
    m.responseTime.p90Ms ?? '',
    m.responseTime.meanMs ?? '',
    m.responseTime.minMs ?? '',
    m.responseTime.maxMs ?? '',
    m.byCommand.select.executed,
    m.byCommand.select.responseMedianMs ?? '',
    m.byCommand.grab.executed,
    m.byCommand.grab.responseMedianMs ?? '',
    m.byCommand.pause.executed,
    m.byCommand.pause.responseMedianMs ?? '',
    m.tasks.answerAttempts,
    m.tasks.answerCorrectOnAttempt ?? '',
    m.tasks.labelDrops,
    m.tasks.labelsCorrect,
    m.tasks.dragCancelled,
    m.tasks.completed ? 'true' : 'false',
    m.tasks.taskTimesMs.total ?? '',
    m.accidental.total,
    m.accidental.fromUndo,
    m.accidental.fromFacilitator,
    m.accidental.duringRest,
    m.accidental.perMinute ?? '',
    m.tracking.lostCount,
    m.tracking.totalLostMs,
    m.pauses,
  ]);

  const escapeCell = (val: any) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  return [headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}

/**
 * Exports complete study bundle to JSON string
 */
export function exportStudyBundleToJson(bundle: StudyExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Imports and validates study bundle, and recomputes all metrics from raw session events
 */
export function importAndRecomputeStudyBundle(jsonStr: string): StudyExportBundle {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.sessions || !Array.isArray(parsed.sessions)) {
    throw new Error('Study bundle must contain a valid "sessions" array.');
  }

  // Recompute metrics for every session deterministically
  const recomputedMetrics: SessionMetrics[] = parsed.sessions.map((s: any) => {
    return computeMetrics(s.events || [], {
      sessionId: s.id,
      participantId: s.participantId,
      profileId: s.profileId,
      condition: s.condition || 'baseline',
      mode: s.mode || 'activity',
      source: s.source || 'live',
      durationMs: s.durationMs,
      quality: s.quality || 'complete',
      facilitatorMarks: s.facilitatorMarks || [],
    });
  });

  return {
    schemaVersion: '1.0.0',
    exportedAt: parsed.exportedAt || Date.now(),
    isSynthetic: parsed.isSynthetic || false,
    methodology: parsed.methodology || METHODOLOGY_BLOCK,
    participants: parsed.participants || [],
    profiles: parsed.profiles || [],
    sessions: parsed.sessions || [],
    metrics: recomputedMetrics,
  };
}
