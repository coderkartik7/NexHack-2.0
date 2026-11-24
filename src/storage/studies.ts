import { db } from './db';
import type { Participant, StudySession, FacilitatorMark } from '../eval/types';

export async function listParticipants(): Promise<Participant[]> {
  return await db.participants.orderBy('createdAt').reverse().toArray();
}

export async function getParticipant(id: string): Promise<Participant | undefined> {
  return await db.participants.get(id);
}

export async function saveParticipant(p: Participant): Promise<void> {
  p.updatedAt = Date.now();
  await db.participants.put(p);
}

export async function listStudySessions(participantId?: string): Promise<StudySession[]> {
  if (participantId) {
    return await db.studySessions.where('participantId').equals(participantId).reverse().sortBy('startedAt');
  }
  return await db.studySessions.orderBy('startedAt').reverse().toArray();
}

export async function getStudySession(id: string): Promise<StudySession | undefined> {
  return await db.studySessions.get(id);
}

export async function saveStudySession(session: StudySession): Promise<void> {
  await db.studySessions.put(session);
}

export async function deleteStudySession(id: string): Promise<void> {
  await db.studySessions.delete(id);
  // Also clean up related facilitator marks
  await db.facilitatorMarks.where('sessionId').equals(id).delete();
}

export async function addFacilitatorMark(mark: FacilitatorMark): Promise<void> {
  await db.facilitatorMarks.put(mark);
  // Also update in-session mark copy
  const session = await db.studySessions.get(mark.sessionId);
  if (session) {
    const marks = session.facilitatorMarks || [];
    marks.push(mark);
    session.facilitatorMarks = marks;
    await db.studySessions.put(session);
  }
}

export async function getFacilitatorMarks(sessionId: string): Promise<FacilitatorMark[]> {
  return await db.facilitatorMarks.where('sessionId').equals(sessionId).toArray();
}

export async function clearAllStudyData(): Promise<void> {
  await db.participants.clear();
  await db.studySessions.clear();
  await db.facilitatorMarks.clear();
}
