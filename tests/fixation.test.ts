import { describe, it, expect } from 'vitest';
import { FixationDetector } from '../src/gaze/fixation';

describe('Fixation Detector (I-DT)', () => {
  it('snaps to centroid when dispersion is below threshold over minDuration', () => {
    const detector = new FixationDetector({
      dispersionThresholdPx: 50,
      minDurationMs: 100,
    });

    // Feed points clustered around (300, 400) over 150ms
    detector.update({ x: 300, y: 400 }, 100);
    detector.update({ x: 305, y: 395 }, 133);
    detector.update({ x: 298, y: 402 }, 166);
    const state = detector.update({ x: 302, y: 399 }, 210);

    expect(state.isFixating).toBe(true);
    expect(state.centroidX).toBeCloseTo(301.25, 1);
    expect(state.centroidY).toBeCloseTo(399, 1);
  });

  it('releases immediately on a saccade', () => {
    const detector = new FixationDetector({
      dispersionThresholdPx: 50,
      minDurationMs: 100,
    });

    // Fixating
    detector.update({ x: 300, y: 400 }, 100);
    detector.update({ x: 302, y: 401 }, 150);
    detector.update({ x: 299, y: 398 }, 210);
    const fixState = detector.update({ x: 301, y: 400 }, 250);
    expect(fixState.isFixating).toBe(true);

    // Sudden large jump: Saccade to (600, 800)
    const saccadeState = detector.update({ x: 600, y: 800 }, 283);
    expect(saccadeState.isFixating).toBe(false);
    expect(saccadeState.centroidX).toBe(600);
    expect(saccadeState.centroidY).toBe(800);
  });

  it('is completely deterministic across runs', () => {
    const run = () => {
      const d = new FixationDetector({ dispersionThresholdPx: 40, minDurationMs: 80 });
      const pts = [
        { pt: { x: 100, y: 200 }, t: 10 },
        { pt: { x: 102, y: 203 }, t: 40 },
        { pt: { x: 98, y: 198 }, t: 70 },
        { pt: { x: 101, y: 201 }, t: 100 },
        { pt: { x: 250, y: 400 }, t: 130 },
      ];
      return pts.map((p) => d.update(p.pt, p.t));
    };

    const res1 = run();
    const res2 = run();
    expect(res1).toEqual(res2);
  });
});
