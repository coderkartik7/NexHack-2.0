import { describe, it, expect } from 'vitest';
import { compareConditions, compareParticipants, generateFindingsNarrative } from '../src/eval/compare';
import { computeMetrics } from '../src/eval/metrics';
import { exportMetricsToCsv, exportStudyBundleToJson, importAndRecomputeStudyBundle, METHODOLOGY_BLOCK } from '../src/eval/export';
import type { SessionEvent } from '../src/logging/eventLog';
import type { StudyExportBundle, StudySession } from '../src/eval/types';

describe('Comparison, Export and Import Engines (Pure)', () => {
  const eventsBase: SessionEvent[] = [
    { sessionId: 's1', profileId: 'P1', seq: 1, t: 100, type: 'command_executed', command: 'select', gestureOnsetT: 0, executedT: 200, source: 'live', mode: 'activity' },
  ];
  const eventsAfter: SessionEvent[] = [
    { sessionId: 's2', profileId: 'P1', seq: 1, t: 100, type: 'command_executed', command: 'select', gestureOnsetT: 0, executedT: 150, source: 'live', mode: 'activity' },
  ];

  it('computes before vs after recalibration latency deltas and descriptions', () => {
    const mBase = computeMetrics(eventsBase, { durationMs: 20000, condition: 'baseline' });
    const mAfter = computeMetrics(eventsAfter, { durationMs: 20000, condition: 'after_recalibration' });

    const comp = compareConditions(mBase, mAfter);
    expect(comp).not.toBeNull();
    expect(comp?.medianResponseTimeDeltaMs).toBe(-50); // improved by 50ms
    expect(comp?.description).toContain('improved by 50 ms');
  });

  it('compares User A vs User B descriptively', () => {
    const mA = computeMetrics(eventsBase, { participantId: 'P1' });
    const mB = computeMetrics(eventsAfter, { participantId: 'P2' });

    const comp = compareParticipants(
      { participantId: 'P1', profile: null, metrics: mA },
      { participantId: 'P2', profile: null, metrics: mB }
    );

    expect(comp.deltas.medianResponseTimeDiffMs).toBe(-50);
    expect(comp.disclaimer).toContain('descriptive pilot comparison only');
  });

  it('generates factual rule-based findings narrative', () => {
    const mAct = computeMetrics(eventsBase, { durationMs: 30000 });
    const mRest = computeMetrics([], { durationMs: 60000, mode: 'rest_test' });

    const statements = generateFindingsNarrative('P1', mAct, mRest, null);
    expect(statements.some((s) => s.includes('0 false commands fired'))).toBe(true);
    expect(statements.some((s) => s.includes('median response time of 200 ms'))).toBe(true);
  });

  it('Export CSV: produces correct headers and row structure', () => {
    const mA = computeMetrics(eventsBase, { sessionId: 's1', participantId: 'P1', durationMs: 5000 });
    const csv = exportMetricsToCsv([mA]);

    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // 1 header + 1 row
    expect(lines[0]).toContain('sessionId,participantId,profileId');
    expect(lines[1]).toContain('s1,P1');
  });

  it('Export / Import Round Trip: export JSON, re-import and recompute metrics yields identical numbers', () => {
    const session: StudySession = {
      id: 'ses_test_1',
      participantId: 'P1',
      profileId: 'prof_1',
      stage: 'activity',
      condition: 'baseline',
      mode: 'activity',
      source: 'live',
      startedAt: 1000,
      durationMs: 5000,
      quality: 'complete',
      events: eventsBase,
      facilitatorMarks: [],
    };

    const initialMetrics = computeMetrics(eventsBase, {
      sessionId: session.id,
      participantId: session.participantId,
      profileId: session.profileId,
      durationMs: session.durationMs,
    });

    const bundle: StudyExportBundle = {
      schemaVersion: '1.0.0',
      exportedAt: 5000,
      isSynthetic: false,
      methodology: METHODOLOGY_BLOCK,
      participants: [{ id: 'P1', anonymousCode: 'P1', notes: '', profileId: 'prof_1', source: 'live', consentGiven: true, consentTimestamp: 100, createdAt: 100, updatedAt: 100 }],
      profiles: [],
      sessions: [session],
      metrics: [initialMetrics],
    };

    const json = exportStudyBundleToJson(bundle);
    const reimported = importAndRecomputeStudyBundle(json);

    expect(reimported.metrics.length).toBe(1);
    expect(reimported.metrics[0].responseTime.medianMs).toBe(initialMetrics.responseTime.medianMs);
    expect(reimported.metrics[0].n.commandsExecuted).toBe(initialMetrics.n.commandsExecuted);
    expect(reimported.metrics[0].accidental.total).toBe(initialMetrics.accidental.total);
  });
});
