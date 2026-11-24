import type { SignalFrame, SignalName } from '../types/signals';
import type { RestSignalSample } from './types';

export const REST_PROMPTS = [
  { id: 'natural', text: 'Sit naturally facing the webcam', durationSeconds: 12 },
  { id: 'talk', text: 'Talk out loud (e.g. recite the alphabet or read a sentence)', durationSeconds: 12 },
  { id: 'sip', text: 'Take a sip of water or swallow comfortably', durationSeconds: 12 },
  { id: 'scratch', text: 'Scratch your nose or touch your face naturally', durationSeconds: 12 },
  { id: 'shift', text: 'Shift comfortably in your chair and look away briefly', durationSeconds: 12 },
];

export function getPromptForElapsedSeconds(elapsedSec: number): string {
  const totalCycle = REST_PROMPTS.reduce((sum, p) => sum + p.durationSeconds, 0);
  const normalizedSec = elapsedSec % totalCycle;
  let accumulated = 0;
  for (const p of REST_PROMPTS) {
    accumulated += p.durationSeconds;
    if (normalizedSec < accumulated) {
      return p.text;
    }
  }
  return REST_PROMPTS[0].text;
}

export class RestSignalSampler {
  private samples: RestSignalSample[] = [];
  private lastSampleT = -Infinity;
  private minIntervalMs: number; // default: 100ms (10Hz max)
  private trackedSignals: SignalName[];

  constructor(trackedSignals: SignalName[] = ['headX', 'headY', 'jawOpen', 'browRaise', 'blink', 'handX', 'handY', 'pinch'], hz = 10) {
    this.trackedSignals = trackedSignals;
    this.minIntervalMs = 1000 / Math.max(1, hz);
  }

  public reset(): void {
    this.samples = [];
    this.lastSampleT = -Infinity;
  }

  /**
   * Samples frame at max 10Hz, keeping numerical values only
   */
  public sampleFrame(frame: SignalFrame, relativeT: number): void {
    if (relativeT - this.lastSampleT < this.minIntervalMs) {
      return;
    }

    this.lastSampleT = relativeT;
    const compactSignals: Partial<Record<string, number | null>> = {};
    for (const key of this.trackedSignals) {
      const val = frame.signals[key];
      compactSignals[key] = typeof val === 'number' ? Number(val.toFixed(3)) : null;
    }

    this.samples.push({
      t: Math.round(relativeT),
      signals: compactSignals,
    });
  }

  public getSamples(): RestSignalSample[] {
    return [...this.samples];
  }
}
