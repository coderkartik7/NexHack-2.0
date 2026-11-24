import { describe, it, expect } from 'vitest';
import { GazeFeatureExtractor } from '../src/vision/gazeFeatures';

function createSyntheticLandmarks(options: {
  irisX_L?: number;
  irisX_R?: number;
  opennessRatio?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
}) {
  const lm = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));

  // Left eye: 33 (outer), 133 (inner)
  // Eye width = 0.1
  lm[33] = { x: 0.35, y: 0.4, z: 0 };
  lm[133] = { x: 0.45, y: 0.4, z: 0 };

  // Eyelids: 159 (upper), 145 (lower)
  const open = options.opennessRatio ?? 0.25;
  lm[159] = { x: 0.4, y: 0.4 - open * 0.05, z: 0 };
  lm[145] = { x: 0.4, y: 0.4 + open * 0.05, z: 0 };

  // Iris center: 468
  const rxL = options.irisX_L ?? 0.5;
  lm[468] = { x: 0.35 + rxL * 0.1, y: 0.4, z: 0 };

  // Right eye: 263 (outer), 362 (inner)
  lm[263] = { x: 0.65, y: 0.4, z: 0 };
  lm[362] = { x: 0.55, y: 0.4, z: 0 };

  lm[386] = { x: 0.6, y: 0.4 - open * 0.05, z: 0 };
  lm[374] = { x: 0.6, y: 0.4 + open * 0.05, z: 0 };

  const rxR = options.irisX_R ?? 0.5;
  lm[473] = { x: 0.65 - rxR * 0.1, y: 0.4, z: 0 };

  // Nose tip: 1, Chin: 152
  const yawOffset = (options.yaw ?? 0) * 0.1;
  lm[1] = { x: 0.5 + yawOffset, y: 0.5, z: 0 };
  lm[152] = { x: 0.5, y: 0.7, z: 0 };

  return lm;
}

describe('Gaze Features Extraction', () => {
  it('extracts expected normalized iris ratios from synthetic landmarks', () => {
    const extractor = new GazeFeatureExtractor();
    const lm = createSyntheticLandmarks({ irisX_L: 0.6, irisX_R: 0.6, opennessRatio: 0.25 });

    const res = extractor.extract(lm, null, 100);
    expect(res.isValid).toBe(true);
    expect(res.rawFeatures).not.toBeNull();
    expect(res.rawFeatures!.irisX_L).toBeCloseTo(0.6, 1);
    expect(res.features).not.toBeNull();
    expect(res.features!.length).toBe(12);
  });

  it('flags blink frames as invalid with null features and blinkDetected=true', () => {
    const extractor = new GazeFeatureExtractor({ opennessThreshold: 0.16 });
    const lm = createSyntheticLandmarks({ opennessRatio: 0.08 }); // eyes closed

    const res = extractor.extract(lm, null, 150);
    expect(res.isValid).toBe(false);
    expect(res.blinkDetected).toBe(true);
    expect(res.features).toBeNull();
    expect(res.invalidReason).toBe('blink');
  });

  it('rejects extreme head pose with null features and extreme_head_pose reason', () => {
    const extractor = new GazeFeatureExtractor({ maxYawDeg: 35 });
    // extreme yaw (> 35 deg)
    const lm = createSyntheticLandmarks({ yaw: 2.5, opennessRatio: 0.25 });

    const res = extractor.extract(lm, null, 200);
    expect(res.isValid).toBe(false);
    expect(res.features).toBeNull();
    expect(res.invalidReason).toBe('extreme_head_pose');
  });

  it('never outputs stale values when subject is lost', () => {
    const extractor = new GazeFeatureExtractor();
    const lm = createSyntheticLandmarks({ irisX_L: 0.5 });
    extractor.extract(lm, null, 100);

    // Subject lost in next frame
    const lostRes = extractor.extract(null, null, 133);
    expect(lostRes.isValid).toBe(false);
    expect(lostRes.features).toBeNull();
    expect(lostRes.invalidReason).toBe('no_face');
  });
});
