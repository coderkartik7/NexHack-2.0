import { describe, it, expect } from 'vitest';
import { computeValidationAccuracy } from '../src/gaze/accuracy';

describe('Gaze Accuracy Evaluation', () => {
  it('computes accurate mean and P90 error on known synthetic point sets', () => {
    const targets = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
      { x: 400, y: 400 },
      { x: 500, y: 500 },
    ];
    // Offset each by dx = 30, dy = 40 => hypot = 50 px error
    const predictions = targets.map((t) => ({ x: t.x + 30, y: t.y + 40 }));

    const res = computeValidationAccuracy(predictions, targets, 1024, 768);
    expect(res.stats.meanErrorPx).toBe(50);
    expect(res.stats.p90ErrorPx).toBe(50);
    expect(res.stats.n).toBe(5);
    expect(res.rating).toBe('good'); // < 120 px
  });

  it('categorizes ratings properly: good (<120), fair (120-200), poor (>200)', () => {
    const t = [{ x: 100, y: 100 }];

    // Good: 80 px error
    const goodRes = computeValidationAccuracy([{ x: 180, y: 100 }], t, 1024, 768);
    expect(goodRes.rating).toBe('good');

    // Fair: 150 px error
    const fairRes = computeValidationAccuracy([{ x: 250, y: 100 }], t, 1024, 768);
    expect(fairRes.rating).toBe('fair');

    // Poor: 240 px error
    const poorRes = computeValidationAccuracy([{ x: 340, y: 100 }], t, 1024, 768);
    expect(poorRes.rating).toBe('poor');
  });
});
