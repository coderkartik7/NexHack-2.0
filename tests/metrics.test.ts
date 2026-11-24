import { describe, it, expect } from 'vitest';
import { computeMetrics, aggregateMetrics } from '../src/eval/metrics';
import type { SessionEvent } from '../src/logging/eventLog';
import type { FacilitatorMark } from '../src/eval/types';

describe('Pure Evaluation Metrics Engine', () => {
  it('calculates correct response time median and p90; handles missing timestamps', () => {
    const events: SessionEvent[] = [
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 1,
        t: 1000,
        type: 'command_executed',
        command: 'select',
        gestureOnsetT: 100,
        executedT: 250, // RT = 150ms
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 2,
        t: 2000,
        type: 'command_executed',
        command: 'select',
        gestureOnsetT: 200,
        executedT: 400, // RT = 200ms
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 3,
        t: 3000,
        type: 'command_executed',
        command: 'grab',
        gestureOnsetT: 300,
        executedT: 600, // RT = 300ms
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 4,
        t: 4000,
        type: 'command_executed',
        command: 'pause',
        // Missing timestamps -> skipped
        source: 'live',
        mode: 'activity',
      },
    ];

    const metrics = computeMetrics(events, { durationMs: 5000 });

    expect(metrics.n.commandsExecuted).toBe(4);
    expect(metrics.n.validResponseTimes).toBe(3);
    expect(metrics.n.skippedResponseTimes).toBe(1);

    // Sorted RTs: [150, 200, 300]
    expect(metrics.responseTime.count).toBe(3);
    expect(metrics.responseTime.medianMs).toBe(200);
    expect(metrics.responseTime.minMs).toBe(150);
    expect(metrics.responseTime.maxMs).toBe(300);
    expect(metrics.responseTime.p90Ms).toBeGreaterThan(250);
  });

  it('handles response time with n=0 and n=1 gracefully', () => {
    // n = 0
    const m0 = computeMetrics([], { durationMs: 1000 });
    expect(m0.responseTime.count).toBe(0);
    expect(m0.responseTime.medianMs).toBeNull();
    expect(m0.responseTime.p90Ms).toBeNull();

    // n = 1
    const m1 = computeMetrics(
      [
        {
          sessionId: 's1',
          profileId: 'P1',
          seq: 1,
          t: 500,
          type: 'command_executed',
          command: 'select',
          gestureOnsetT: 100,
          executedT: 280, // RT = 180
          source: 'live',
          mode: 'activity',
        },
      ],
      { durationMs: 1000 }
    );
    expect(m1.responseTime.count).toBe(1);
    expect(m1.responseTime.medianMs).toBe(180);
    expect(m1.responseTime.p90Ms).toBe(180);
  });

  it('accidental activations: deduplicates dual-flagged events (undone + facilitator mark)', () => {
    const events: SessionEvent[] = [
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 10,
        t: 1000,
        type: 'command_executed',
        command: 'select',
        undone: true, // User undone
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 11,
        t: 2000,
        type: 'command_executed',
        command: 'grab',
        undone: false, // Marked by facilitator only
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 12,
        t: 3000,
        type: 'command_executed',
        command: 'select',
        undone: true, // BOTH undone and marked
        source: 'live',
        mode: 'activity',
      },
      {
        sessionId: 's1',
        profileId: 'P1',
        seq: 13,
        t: 4000,
        type: 'command_executed',
        command: 'pause',
        undone: false, // Normal intended command
        source: 'live',
        mode: 'activity',
      },
    ];

    const marks: FacilitatorMark[] = [
      { id: 'm1', sessionId: 's1', eventSeq: 11, timestamp: 2500, note: 'unintended grab' },
      { id: 'm2', sessionId: 's1', eventSeq: 12, timestamp: 3500, note: 'accidental select' },
    ];

    const metrics = computeMetrics(events, {
      durationMs: 60000, // 1 minute
      facilitatorMarks: marks,
      mode: 'activity',
    });

    expect(metrics.accidental.fromUndo).toBe(2); // seq 10 and 12
    expect(metrics.accidental.fromFacilitator).toBe(2); // seq 11 and 12
    expect(metrics.accidental.total).toBe(3); // seq 10, 11, 12 deduplicated!
    expect(metrics.accidental.perMinute).toBe(3.0);
  });

  it('accidental activations during rest test: counts all executed commands', () => {
    const events: SessionEvent[] = [
      {
        sessionId: 's_rest',
        profileId: 'P1',
        seq: 1,
        t: 5000,
        type: 'command_executed',
        command: 'select',
        source: 'live',
        mode: 'rest_test',
      },
      {
        sessionId: 's_rest',
        profileId: 'P1',
        seq: 2,
        t: 15000,
        type: 'command_executed',
        command: 'grab',
        source: 'live',
        mode: 'rest_test',
      },
    ];

    const metrics = computeMetrics(events, {
      durationMs: 60000,
      mode: 'rest_test',
    });

    expect(metrics.accidental.duringRest).toBe(2);
    expect(metrics.accidental.total).toBe(2);
    expect(metrics.accidental.perMinute).toBe(2.0);
  });

  it('task times and completion detection from hand-built event sequence', () => {
    const events: SessionEvent[] = [
      { sessionId: 's1', profileId: 'P1', seq: 1, t: 100, type: 'answer_attempt', correct: false, source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 2, t: 300, type: 'answer_attempt', correct: true, source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 3, t: 600, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 4, t: 800, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 5, t: 1200, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 6, t: 1300, type: 'task_complete', source: 'live', mode: 'activity' },
    ];

    const metrics = computeMetrics(events, { durationMs: 1400 });

    expect(metrics.tasks.completed).toBe(true);
    expect(metrics.tasks.answerAttempts).toBe(2);
    expect(metrics.tasks.answerCorrectOnAttempt).toBe(2);
    expect(metrics.tasks.labelsCorrect).toBe(3);
    expect(metrics.tasks.taskTimesMs.select).toBe(200); // 300 - 100
    expect(metrics.tasks.taskTimesMs.total).toBe(1200); // 1300 - 100
  });

  it('sums tracking-lost intervals, including an open unclosed interval', () => {
    const events: SessionEvent[] = [
      { sessionId: 's1', profileId: 'P1', seq: 1, t: 100, type: 'tracking_lost', source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 2, t: 300, type: 'tracking_restored', source: 'live', mode: 'activity' }, // 200ms
      { sessionId: 's1', profileId: 'P1', seq: 3, t: 600, type: 'tracking_lost', source: 'live', mode: 'activity' },
      { sessionId: 's1', profileId: 'P1', seq: 4, t: 1000, type: 'task_complete', source: 'live', mode: 'activity' }, // Session ends while still lost (400ms)
    ];

    const metrics = computeMetrics(events, { durationMs: 1000 });

    expect(metrics.tracking.lostCount).toBe(2);
    expect(metrics.tracking.totalLostMs).toBe(600); // 200 + 400
  });

  it('aggregate pooling gives consistent summed counts and pooled medians', () => {
    const m1 = computeMetrics([
      { sessionId: 's1', profileId: 'P1', seq: 1, t: 100, type: 'command_executed', command: 'select', gestureOnsetT: 0, executedT: 150, source: 'live', mode: 'activity' },
    ], { durationMs: 30000 });

    const m2 = computeMetrics([
      { sessionId: 's2', profileId: 'P1', seq: 1, t: 200, type: 'command_executed', command: 'select', gestureOnsetT: 0, executedT: 250, source: 'live', mode: 'activity' },
    ], { durationMs: 30000 });

    const agg = aggregateMetrics([m1, m2]);
    expect(agg).not.toBeNull();
    expect(agg?.durationMs).toBe(60000);
    expect(agg?.responseTime.count).toBe(2);
    expect(agg?.responseTime.medianMs).toBe(200); // median of [150, 250]
  });
});
