import { describe, it, expect } from 'vitest';
import { RestSignalSampler, getPromptForElapsedSeconds } from '../src/eval/restTest';
import type { SignalFrame } from '../src/types/signals';

describe('Rest Test Logic & Sampler', () => {
  it('rotates guided prompts every 12 seconds', () => {
    const p0 = getPromptForElapsedSeconds(0);
    const p13 = getPromptForElapsedSeconds(13);
    const p25 = getPromptForElapsedSeconds(25);

    expect(p0).toContain('Sit naturally');
    expect(p13).toContain('Talk out loud');
    expect(p25).toContain('Take a sip');
  });

  it('downsamples signals at max 10Hz (min 100ms interval)', () => {
    const sampler = new RestSignalSampler(['jawOpen', 'headX'], 10);

    const makeFrame = (t: number, jaw: number): SignalFrame => ({
      t,
      quality: { face: 0.9, hand: 0.9 },
      signals: {
        headX: 0.1, headY: 0, headRoll: 0, jawOpen: jaw, browRaise: 0, blink: 0,
        handX: 0.5, handY: 0.5, pinch: 0.8, openPalm: 1.0,
      },
    });

    // Feed 30 frames spanning 0 to 300ms (10ms steps)
    for (let t = 0; t <= 300; t += 10) {
      sampler.sampleFrame(makeFrame(t, t / 1000), t);
    }

    const samples = sampler.getSamples();
    // At 10Hz, in 300ms we expect ~4 samples (0, 100, 200, 300)
    expect(samples.length).toBeLessThanOrEqual(5);
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples[0].signals.jawOpen).toBe(0);
  });
});
