import { describe, it, expect } from 'vitest';
import { fitGazeModel, predictGaze } from '../src/gaze/model';

describe('Head Compensation Sanity Check', () => {
  it('bounds prediction error when synthetic head shifts occur', () => {
    // Generate synthetic calibration samples where the learner looked at targets
    // with varying small head poses (yaw, pitch, roll, noseX, noseY)
    const samples = [];
    const screenW = 1000;
    const screenH = 800;

    // Grid of targets
    for (let tx = 100; tx <= 900; tx += 200) {
      for (let ty = 100; ty <= 700; ty += 200) {
        // Iris ratios correlate with target
        const irisX = tx / screenW;
        const irisY = ty / screenH;
        // Minor natural head shift
        const headYaw = (tx - 500) / 2000;
        const headPitch = (ty - 400) / 2000;

        const features = [
          irisX,           // irisX_L
          irisY,           // irisY_L
          1 - irisX,       // irisX_R
          irisY,           // irisY_R
          0.25, 0.25,      // openness
          headYaw,         // yaw
          headPitch,       // pitch
          0,               // roll
          0.5 + headYaw,   // noseX
          0.5 + headPitch, // noseY
          0.1,             // iod
        ];

        samples.push({
          features,
          screenX: tx,
          screenY: ty,
        });
      }
    }

    const model = fitGazeModel(samples, { includeSecondOrder: false });

    // Test a target at (500, 400) with two different synthetic head poses
    // Pose 1: Centered head
    const baseTargetX = 500;
    const baseTargetY = 400;
    const featPose1 = [
      0.5, 0.5, 0.5, 0.5, 0.25, 0.25, 0, 0, 0, 0.5, 0.5, 0.1,
    ];
    const pred1 = predictGaze(model, featPose1, screenW, screenH);

    // Pose 2: Head translated / turned slightly (+0.05 yaw) but eyes compensating (-0.03 iris)
    const featPose2 = [
      0.47, 0.5, 0.53, 0.5, 0.25, 0.25, 0.05, 0, 0, 0.55, 0.5, 0.1,
    ];
    const pred2 = predictGaze(model, featPose2, screenW, screenH);

    const err1 = Math.hypot(pred1.x - baseTargetX, pred1.y - baseTargetY);
    const err2 = Math.hypot(pred2.x - baseTargetX, pred2.y - baseTargetY);

    // Both prediction errors should stay well bounded (< 150 px)
    expect(err1).toBeLessThan(150);
    expect(err2).toBeLessThan(150);
    expect(Math.abs(pred1.x - pred2.x)).toBeLessThan(120);
  });
});
