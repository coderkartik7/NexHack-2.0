import type { SessionEvent } from '../logging/eventLog';
import type { LearnerProfile, CommandName } from '../calibration/types';

export type ProtocolStage =
  | 'calibration_check'
  | 'practice'
  | 'activity'
  | 'rest_test'
  | 'recalibrate_and_repeat'
  | 'complete';

export type Condition = 'baseline' | 'after_recalibration';

export interface Participant {
  id: string; // e.g. "P1", "P2"
  anonymousCode: string; // usually same as id
  notes: string;
  profileId: string;
  source: 'live' | 'mouse_sim' | 'replay';
  consentGiven: boolean;
  consentTimestamp: number;
  createdAt: number;
  updatedAt: number;
}

export interface RestSignalSample {
  t: number; // ms offset from rest test start
  signals: Partial<Record<string, number | null>>;
}

export interface FacilitatorMark {
  id: string;
  sessionId: string;
  eventSeq: number; // refers to SessionEvent.seq
  timestamp: number;
  note?: string;
}

export interface StudySession {
  id: string; // unique session ID
  participantId: string;
  profileId: string;
  stage: ProtocolStage;
  condition: Condition;
  mode: 'activity' | 'rest_test' | 'practice';
  source: 'live' | 'mouse_sim' | 'replay';
  inputMode?: 'head' | 'hand' | 'eye';
  isSynthetic?: boolean;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  quality: 'complete' | 'incomplete';
  events: SessionEvent[];
  facilitatorMarks: FacilitatorMark[];
  restSamples?: RestSignalSample[]; // max 10Hz downsampled for RestTimeline
  notes?: string;
}

export interface ResponseTimeStats {
  count: number;
  medianMs: number | null;
  p90Ms: number | null;
  meanMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

export interface SessionMetrics {
  sessionId: string;
  participantId: string;
  profileId: string;
  condition: Condition;
  mode: 'activity' | 'rest_test';
  source: 'live' | 'mouse_sim' | 'replay';
  durationMs: number;
  n: Record<string, number>; // sample sizes per metric
  responseTime: ResponseTimeStats;
  byCommand: Record<
    CommandName,
    {
      executed: number;
      responseMedianMs: number | null;
    }
  >;
  tasks: {
    answerAttempts: number;
    answerCorrectOnAttempt: number | null;
    labelDrops: number;
    labelsCorrect: number;
    dragCancelled: number;
    completed: boolean;
    taskTimesMs: {
      select: number | null;
      scroll: number | null;
      drag: number | null;
      total: number | null;
    };
  };
  accidental: {
    total: number;
    fromUndo: number;
    fromFacilitator: number;
    duringRest: number;
    perMinute: number | null;
  };
  tracking: {
    lostCount: number;
    totalLostMs: number;
  };
  pauses: number;
  quality: 'complete' | 'incomplete';
}

export interface StudyExportBundle {
  schemaVersion: '1.0.0';
  exportedAt: number;
  isSynthetic: boolean;
  methodology: {
    description: string;
    metricsDefinitions: Record<string, string>;
    percentileMethod: string;
    sampleSizeNote: string;
  };
  participants: Participant[];
  profiles: LearnerProfile[];
  sessions: StudySession[];
  metrics: SessionMetrics[];
}
