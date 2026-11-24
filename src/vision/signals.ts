import type { FaceLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { SignalFrame, SignalName } from '../types/signals';
import { gazeFeatureExtractor } from './gazeFeatures';
import type { GazeFeatureExtractionResult } from '../gaze/types';

/**
 * Computes 2D Euclidean distance between two landmark points
 */
function dist2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Extracts normalized, distance-invariant scalar signals from FaceLandmarker and HandLandmarker results.
 * Returns null for any signal when tracker lost the subject.
 */
export function extractSignals(
  timestampMs: number,
  faceResult: FaceLandmarkerResult | null,
  handResult: HandLandmarkerResult | null,
  outGazeFeatures?: { result?: GazeFeatureExtractionResult }
): SignalFrame {
  const signals: Record<SignalName, number | null> = {
    headX: null,
    headY: null,
    headRoll: null,
    jawOpen: null,
    browRaise: null,
    blink: null,
    handX: null,
    handY: null,
    pinch: null,
    openPalm: null,
    gazeX: null,
    gazeY: null,
    irisDistL: null,
    irisDistR: null,
    eyeOpenness: null,
  };

  let faceQuality = 0;
  let handQuality = 0;
  let eyeQuality = 0;

  // 1. Process Face landmarks & blendshapes
  if (
    faceResult &&
    faceResult.faceLandmarks &&
    faceResult.faceLandmarks.length > 0 &&
    faceResult.faceLandmarks[0].length >= 468
  ) {
    const lm = faceResult.faceLandmarks[0];
    const leftEye = lm[33];
    const rightEye = lm[263];
    const noseTip = lm[1];

    // Inter-ocular distance (IOD) in normalized screen coords
    const iod = dist2D(leftEye, rightEye);

    // Compute face quality based on inter-ocular distance (typical face occupies ~0.1 to 0.35 screen width)
    if (iod > 0.04) {
      faceQuality = Math.min(1.0, Math.max(0.0, (iod - 0.04) / 0.1));
    }

    if (iod > 0.02) {
      const midEyeX = (leftEye.x + rightEye.x) / 2.0;
      const midEyeY = (leftEye.y + rightEye.y) / 2.0;

      signals.headX = -(noseTip.x - midEyeX) / iod;
      signals.headY = (noseTip.y - midEyeY) / iod;

      const dy = rightEye.y - leftEye.y;
      const dx = rightEye.x - leftEye.x;
      signals.headRoll = Math.atan2(dy, dx);
    }

    // Blendshapes
    if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
      const categories = faceResult.faceBlendshapes[0].categories;
      const shapeMap = new Map<string, number>();
      for (const cat of categories) {
        shapeMap.set(cat.categoryName, cat.score);
      }

      signals.jawOpen = shapeMap.get('jawOpen') ?? null;
      signals.browRaise = shapeMap.get('browInnerUp') ?? null;

      const blinkL = shapeMap.get('eyeBlinkLeft') ?? 0;
      const blinkR = shapeMap.get('eyeBlinkRight') ?? 0;
      signals.blink = (blinkL + blinkR) / 2.0;
    }

    // Extract Eye / Gaze features if iris landmarks are present
    const matrix = faceResult.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
    const gazeRes = gazeFeatureExtractor.extract(lm, matrix, timestampMs);
    if (outGazeFeatures) {
      outGazeFeatures.result = gazeRes;
    }

    signals.gazeX = gazeRes.rawGazeX;
    signals.gazeY = gazeRes.rawGazeY;
    signals.eyeOpenness = gazeRes.eyeOpenness;
    if (gazeRes.rawFeatures) {
      signals.irisDistL = gazeRes.rawFeatures.irisX_L;
      signals.irisDistR = gazeRes.rawFeatures.irisX_R;
    }

    if (gazeRes.isValid) {
      eyeQuality = faceQuality;
    } else {
      eyeQuality = gazeRes.blinkDetected ? 0.1 : 0;
    }
  }

  // 2. Process Hand landmarks
  if (
    handResult &&
    handResult.landmarks &&
    handResult.landmarks.length > 0 &&
    handResult.landmarks[0].length >= 21
  ) {
    const hand = handResult.landmarks[0];
    const wrist = hand[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleMcp = hand[9];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    const handSize = Math.max(dist2D(wrist, middleMcp), 0.01);
    handQuality = Math.min(1.0, Math.max(0.0, (handSize - 0.05) / 0.15));

    signals.handX = 1.0 - indexTip.x;
    signals.handY = indexTip.y;

    const pinchDist = dist2D(thumbTip, indexTip);
    signals.pinch = pinchDist / handSize;

    const tips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
    const sumDist = tips.reduce((acc, tip) => acc + dist2D(wrist, tip), 0);
    const meanTipDist = sumDist / tips.length;
    signals.openPalm = meanTipDist / handSize;
  }

  return {
    t: timestampMs,
    quality: {
      face: faceQuality,
      hand: handQuality,
      eye: eyeQuality,
    },
    signals,
  };
}
