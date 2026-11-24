import { describe, it, expect } from 'vitest';
import { DriftCorrector } from '../src/gaze/drift';

describe('Drift Correction Pure Logic', () => {
  it('nudges offset towards target center with EMA on selection', () => {
    const corrector = new DriftCorrector({ alpha: 0.1, maxOffsetPx: 100 });

    // Initial offset is (0, 0)
    expect(corrector.getOffset()).toEqual({ x: 0, y: 0 });

    // Target is at (500, 500), predicted gaze is (450, 450) -> error is +50 px
    // new offset should be 0 + 0.1 * 50 = +5 px
    corrector.onTargetSelected(450, 450, 500, 500);
    expect(corrector.getOffset().x).toBeCloseTo(5, 2);
    expect(corrector.getOffset().y).toBeCloseTo(5, 2);
  });

  it('converges toward consistent target error', () => {
    const corrector = new DriftCorrector({ alpha: 0.2, maxOffsetPx: 100 });

    for (let i = 0; i < 20; i++) {
      corrector.onTargetSelected(470, 470, 500, 500); // 30 px discrepancy
    }

    const offset = corrector.getOffset();
    expect(offset.x).toBeCloseTo(30, 0);
    expect(offset.y).toBeCloseTo(30, 0);
  });

  it('strictly respects the maximum offset cap', () => {
    const corrector = new DriftCorrector({ alpha: 0.5, maxOffsetPx: 50 });

    // Huge discrepancy of 500 px
    for (let i = 0; i < 10; i++) {
      corrector.onTargetSelected(0, 0, 500, 500);
    }

    const offset = corrector.getOffset();
    const magnitude = Math.hypot(offset.x, offset.y);
    expect(magnitude).toBeLessThanOrEqual(50.01);
  });

  it('resets offset on re-center', () => {
    const corrector = new DriftCorrector();
    corrector.setOffset(45, -30);
    expect(corrector.getOffset().x).toBe(45);

    corrector.reset();
    expect(corrector.getOffset()).toEqual({ x: 0, y: 0 });
  });
});
