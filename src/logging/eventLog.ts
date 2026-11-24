export interface SessionEvent {
  sessionId: string;
  profileId: string;
  seq: number;
  t: number; // ms since session start
  type:
    | 'gesture_onset'
    | 'command_executed'
    | 'undo'
    | 'pause'
    | 'resume'
    | 'tracking_lost'
    | 'tracking_restored'
    | 'answer_attempt'
    | 'label_drop'
    | 'drag_cancelled'
    | 'task_complete';
  command?: 'select' | 'grab' | 'pause';
  commandSource?: 'gesture' | 'dwell';
  target?: string;
  correct?: boolean;
  gestureOnsetT?: number;
  executedT?: number; // for response time
  undone?: boolean; // set when the user undoes it
  source: 'live' | 'mouse_sim' | 'replay';
  mode: 'activity' | 'rest_test'; // rest_test used by a later phase
  inputMode?: 'head' | 'hand' | 'eye';
}

export interface SessionRecord {
  id: string; // sessionId
  profileId: string;
  startedAt: number;
  endedAt?: number;
  source: 'live' | 'mouse_sim' | 'replay';
  mode: 'activity' | 'rest_test';
  inputMode?: 'head' | 'hand' | 'eye';
  events: SessionEvent[];
}

export class EventLogger {
  private sessionId: string;
  private profileId: string;
  private source: 'live' | 'mouse_sim' | 'replay';
  private mode: 'activity' | 'rest_test';
  private sessionStartWallT: number;
  private seqCounter = 0;
  private inMemoryEvents: SessionEvent[] = [];

  constructor(
    profileId = 'default_learner',
    source: 'live' | 'mouse_sim' | 'replay' = 'live',
    mode: 'activity' | 'rest_test' = 'activity'
  ) {
    this.sessionId = 'ses_' + Math.random().toString(36).substring(2, 9);
    this.profileId = profileId;
    this.source = source;
    this.mode = mode;
    this.sessionStartWallT = performance.now();
  }

  public setMode(mode: 'activity' | 'rest_test'): void {
    this.mode = mode;
  }

  public getMode(): 'activity' | 'rest_test' {
    return this.mode;
  }

  public setSource(source: 'live' | 'mouse_sim' | 'replay'): void {
    this.source = source;
  }

  public setProfileId(profileId: string): void {
    this.profileId = profileId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public log(
    type: SessionEvent['type'],
    data: Partial<
      Omit<SessionEvent, 'sessionId' | 'profileId' | 'seq' | 't' | 'type' | 'source' | 'mode'>
    > = {}
  ): SessionEvent {
    const relativeT = Math.round(performance.now() - this.sessionStartWallT);
    const event: SessionEvent = {
      sessionId: this.sessionId,
      profileId: this.profileId,
      seq: this.seqCounter++,
      t: relativeT,
      type,
      source: this.source,
      mode: this.mode,
      ...data,
    };

    this.inMemoryEvents.push(event);
    return event;
  }

  /**
   * When an action is undone, flag previous matching events as undone
   */
  public flagLastActionUndone(targetType?: string): void {
    for (let i = this.inMemoryEvents.length - 1; i >= 0; i--) {
      const ev = this.inMemoryEvents[i];
      if (
        !ev.undone &&
        (ev.type === 'answer_attempt' || ev.type === 'label_drop' || ev.type === 'command_executed')
      ) {
        if (!targetType || ev.type === targetType) {
          ev.undone = true;
          break;
        }
      }
    }
  }

  public getEvents(): SessionEvent[] {
    return [...this.inMemoryEvents];
  }

  public exportJson(): string {
    return JSON.stringify(
      {
        sessionId: this.sessionId,
        profileId: this.profileId,
        source: this.source,
        mode: this.mode,
        eventCount: this.inMemoryEvents.length,
        events: this.inMemoryEvents,
      },
      null,
      2
    );
  }
}
