import Dexie, { type Table } from 'dexie';
import type { LearnerProfile } from '../calibration/types';

export class GestureLearnDatabase extends Dexie {
  profiles!: Table<LearnerProfile, string>;

  constructor() {
    super('GestureLearnDB');
    this.version(1).stores({
      profiles: 'id, name, mode, createdAt, updatedAt',
    });
  }
}

export const db = new GestureLearnDatabase();
