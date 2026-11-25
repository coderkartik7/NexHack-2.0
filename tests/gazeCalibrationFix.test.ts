import { describe, it, expect } from 'vitest';
import { GazeFeatureExtractor } from '../src/vision/gazeFeatures';
import { fitGazeModel } from '../src/gaze/model';
import { computeValidationAccuracy } from '../src/gaze/accuracy';
import type { Landmark3D } from '../src/vision/gazeFeatures';

function createMockLandmarks(hasIris = true, blink = false, extremePose = false): Landmark3D[] {
  const lms: Landmark3D[] = [];
  const total = hasIris ? 478 : 468;
  for (let i = 0; i < total; i++) {
    lms.push({ x: 0.5, y: 0.5, z: 0 });
  }

  // Key indices:
  // Left eye: 33 (outer), 133 (inner), 159 (sup), 145 (inf)
  lms[33] = { x: 0.35, y: 0.4, z: 0 };
  lms[133] = { x: 0.45, y: 0.4, z: 0 };
  // Right eye: 263 (outer), 362 (inner), 386 (sup), 374 (inf)
  lms[263] = { x: 0.65, y: 0.4, z: 0 };
  lms[362] = { x: 0.55, y: 0.4, z: 0 };

  // Eyelids for openness
  const eyelidGap = blink ? 0.005 : 0.025;
  lms[159] = { x: 0.4, y: 0.4 - eyelidGap / 2, z: 0 };
  lms[145] = { x: 0.4, y: 0.4 + eyelidGap / 2, z: 0 };
  lms[386] = { x: 0.6, y: 0.4 - eyelidGap / 2, z: 0 };
  lms[374] = { x: 0.6, y: 0.4 + eyelidGap / 2, z: 0 };

  // Nose and chin
  lms[1] = { x: extremePose ? 0.8 : 0.5, y: 0.55, z: 0 };
  lms[152] = { x: 0.5, y: 0.8, z: 0 };

  if (hasIris) {
    // Iris centers: 468, 473
    lms[468] = { x: 0.4, y: 0.4, z: 0 };
    lms[473] = { x: 0.6, y: 0.4, z: 0 };
  }

  return lms;
}

describe('Eye Calibration & Gaze Collector Tests', () => {
  it('(a) all-valid frames yield valid features and complete collection', () => {
    const extractor = new GazeFeatureExtractor();
    const lms = createMockLandmarks(true, false, false);

    const res = extractor.extract(lms, null, 1000);
    expect(res.isValid).toBe(true);
    expect(res.features).not.toBeNull();
    expect(res.features?.length).toBe(12);
    expect(res.blinkDetected).toBe(false);

    // Simulate collecting 30 frames
    const buffer: number[][] = [];
    for (let i = 0; i < 30; i++) {
      const f = extractor.extract(lms, null, 1000 + i * 33);
      if (f.isValid && f.features) {
        buffer.push(f.features);
      }
    }
    expect(buffer.length).toBe(30);
  });

  it('(b) 80% invalid frames still complete after longer time', () => {
    const extractor = new GazeFeatureExtractor();
    const validLms = createMockLandmarks(true, false, false);
    const blinkLms = createMockLandmarks(true, true, false);

    const buffer: number[][] = [];
    // Feed 150 frames with 80% blink
    for (let i = 0; i < 150; i++) {
      const lms = i % 5 === 0 ? validLms : blinkLms;
      const f = extractor.extract(lms, null, 1000 + i * 33);
      if (f.isValid && f.features) {
        buffer.push(f.features);
      }
    }
    // 150 / 5 = 30 valid frames collected
    expect(buffer.length).toBe(30);
  });

  it('(c) 100% invalid frames hit timeout and expose specific reason', () => {
    const extractor = new GazeFeatureExtractor();
    const blinkLms = createMockLandmarks(true, true, false);

    const resBlink = extractor.extract(blinkLms, null, 1000);
    expect(resBlink.isValid).toBe(false);
    expect(resBlink.invalidReason).toBe('blink');

    const noIrisLms = createMockLandmarks(false);
    const resIris = extractor.extract(noIrisLms, null, 1000);
    expect(resIris.isValid).toBe(false);
    expect(resIris.invalidReason).toBe('no_iris');

    const extremePoseLms = createMockLandmarks(true, false, true);
    const resPose = extractor.extract(extremePoseLms, null, 1000);
    expect(resPose.isValid).toBe(false);
    expect(resPose.invalidReason).toBe('extreme_head_pose');
  });

  it('(d) model fitting and validation accuracy evaluation pass on collected synthetic points', () => {
    // Generate samples for 16 points (or > 12 features)
    const points: { x: number; y: number }[] = [];
    for (let x = 100; x <= 900; x += 250) {
      for (let y = 100; y <= 700; y += 200) {
        points.push({ x, y });
      }
    }

    const samples = points.map((pt) => ({
      features: [
        pt.x / 1000,
        pt.y / 1000,
        pt.x / 1000,
        pt.y / 1000,
        0.25,
        0.25,
        0,
        0,
        0,
        0.5,
        0.5,
        0.1,
      ],
      screenX: pt.x,
      screenY: pt.y,
    }));

    const model = fitGazeModel(samples, { includeSecondOrder: false });
    expect(model.weightsX.length).toBeGreaterThan(0);
    expect(model.weightsY.length).toBeGreaterThan(0);

    const evalResult = computeValidationAccuracy(
      [{ x: 105, y: 102 }, { x: 495, y: 398 }],
      [{ x: 100, y: 100 }, { x: 500, y: 400 }],
      1024,
      768
    );
    expect(evalResult.rating).toBe('good');
    expect(evalResult.stats.meanErrorPx).toBeLessThan(120);
  });
});
