import Dexie, { type Table } from 'dexie';
import type { LearnerProfile } from '../calibration/types';
import type { SessionRecord } from '../logging/eventLog';
import type { Participant, StudySession, FacilitatorMark } from '../eval/types';

export class GestureLearnDatabase extends Dexie {
  profiles!: Table<LearnerProfile, string>;
  sessions!: Table<SessionRecord, string>;
  participants!: Table<Participant, string>;
  studySessions!: Table<StudySession, string>;
  facilitatorMarks!: Table<FacilitatorMark, string>;

  constructor() {
    super('GestureLearnDB');
    this.version(3).stores({
      profiles: 'id, name, mode, createdAt, updatedAt',
      sessions: 'id, profileId, startedAt, mode, source',
      participants: 'id, anonymousCode, profileId, consentGiven, createdAt',
      studySessions: 'id, participantId, profileId, stage, condition, mode, source, startedAt',
      facilitatorMarks: 'id, sessionId, eventSeq, timestamp',
    });
  }
}

export const db = new GestureLearnDatabase();
