import type { FaceLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { SignalFrame, SignalName } from '../types/signals';

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
  handResult: HandLandmarkerResult | null
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
  };

  let faceQuality = 0;
  let handQuality = 0;

  // 1. Process Face landmarks & blendshapes
  if (
    faceResult &&
    faceResult.faceLandmarks &&
    faceResult.faceLandmarks.length > 0 &&
    faceResult.faceLandmarks[0].length >= 468
  ) {
    const lm = faceResult.faceLandmarks[0];
    // Key landmarks:
    // Left eye outer: 33, Right eye outer: 263
    // Nose tip: 1
    // Left eye center: 468/33/133, Right eye center: 473/362/263
    // Left iris/pupil or inner corner: 133, Right inner corner: 362
    const leftEye = lm[33];
    const rightEye = lm[263];
    const noseTip = lm[1];

    // Inter-ocular distance (IOD) in normalized screen coords
    const iod = dist2D(leftEye, rightEye);

    // Compute face quality based on inter-ocular distance (typical face occupies ~0.1 to 0.35 screen width)
    if (iod > 0.04) {
      // Scale quality: 0 at iod < 0.04, 1.0 around iod ~ 0.15
      faceQuality = Math.min(1.0, Math.max(0.0, (iod - 0.04) / 0.1));
    }

    if (iod > 0.02) {
      // Mid-eye point
      const midEyeX = (leftEye.x + rightEye.x) / 2.0;
      const midEyeY = (leftEye.y + rightEye.y) / 2.0;

      // Distance-normalized nose offset
      // In mirrored video, when user moves head right (their right = camera left in unmirrored),
      // we mirror headX so user moving right yields positive headX.
      // lm.x is 0 at left of camera feed (which is user's right side in mirrored display).
      // Mirrored coordinate: (1 - midEyeX) or inverted nose offset.
      // Let's adopt consistent user perspective: moving head right increases headX.
      signals.headX = -(noseTip.x - midEyeX) / iod;
      signals.headY = (noseTip.y - midEyeY) / iod;

      // Head roll: angle between eyes
      // dy / dx
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
  }

  // 2. Process Hand landmarks
  if (
    handResult &&
    handResult.landmarks &&
    handResult.landmarks.length > 0 &&
    handResult.landmarks[0].length >= 21
  ) {
    const hand = handResult.landmarks[0];
    // Hand Landmarks:
    // 0: Wrist
    // 4: Thumb tip
    // 8: Index fingertip
    // 9: Middle finger MCP
    // 12: Middle fingertip
    // 16: Ring fingertip
    // 20: Pinky fingertip
    const wrist = hand[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleMcp = hand[9];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    // Hand size: distance from wrist (0) to middle MCP (9)
    const handSize = Math.max(dist2D(wrist, middleMcp), 0.01);

    // Hand quality based on hand size in frame
    handQuality = Math.min(1.0, Math.max(0.0, (handSize - 0.05) / 0.15));

    // Cursor coordinates (mirrored so moving user hand right moves cursor right)
    // indexTip.x is normalized [0, 1]. In mirrored web view, 1 - indexTip.x maps camera right to screen right.
    signals.handX = 1.0 - indexTip.x;
    signals.handY = indexTip.y;

    // Pinch: distance between thumb tip (4) and index tip (8) divided by hand size
    const pinchDist = dist2D(thumbTip, indexTip);
    signals.pinch = pinchDist / handSize;

    // Open palm: mean fingertip-to-wrist distance divided by hand size
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
    },
    signals,
  };
}
