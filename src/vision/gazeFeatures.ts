import { OneEuroFilter } from './oneEuro';
import type { GazeFeatureExtractionResult, RawGazeFeatures } from '../gaze/types';

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
}

export interface GazeExtractorOptions {
  opennessThreshold?: number; // below which frame is flagged as blink (default 0.16)
  maxYawDeg?: number;         // extreme head pose limit (default 35 deg)
  maxPitchDeg?: number;       // default 30 deg
  maxRollDeg?: number;        // default 30 deg
  filterMinCutoff?: number;   // One Euro minCutoff (default 0.8)
  filterBeta?: number;        // One Euro beta (default 0.005)
}

export const GAZE_FEATURE_NAMES = [
  'irisX_L',
  'irisY_L',
  'irisX_R',
  'irisY_R',
  'openness_L',
  'openness_R',
  'yaw',
  'pitch',
  'roll',
  'noseX',
  'noseY',
  'iod',
] as const;

export class GazeFeatureExtractor {
  private options: Required<GazeExtractorOptions>;
  private filters: Map<string, OneEuroFilter> = new Map();

  constructor(options: GazeExtractorOptions = {}) {
    this.options = {
      opennessThreshold: options.opennessThreshold ?? 0.16,
      maxYawDeg: options.maxYawDeg ?? 35,
      maxPitchDeg: options.maxPitchDeg ?? 30,
      maxRollDeg: options.maxRollDeg ?? 30,
      filterMinCutoff: options.filterMinCutoff ?? 0.8,
      filterBeta: options.filterBeta ?? 0.005,
    };

    for (const name of GAZE_FEATURE_NAMES) {
      this.filters.set(
        name,
        new OneEuroFilter({
          minCutoff: this.options.filterMinCutoff,
          beta: this.options.filterBeta,
          dCutoff: 1.0,
        })
      );
    }
  }

  public reset(): void {
    for (const f of this.filters.values()) {
      f.reset();
    }
  }

  /**
   * Extract gaze features from landmarks deterministically.
   * Driven by injected timestamp `nowMs`.
   */
  public extract(
    landmarks: Landmark3D[] | null | undefined,
    facialTransformationMatrix: number[] | null | undefined,
    nowMs: number
  ): GazeFeatureExtractionResult {
    if (!landmarks || landmarks.length < 468) {
      return {
        features: null,
        rawFeatures: null,
        isValid: false,
        rawGazeX: null,
        rawGazeY: null,
        eyeOpenness: 0,
        blinkDetected: true,
        invalidReason: 'no_face',
      };
    }

    // Key Landmark Indices:
    // Left eye (viewer's left / subject's right):
    // Outer corner: 33, Inner corner: 133
    // Superior eyelid: 159, Inferior eyelid: 145
    // Iris center: 468 (or average of 469..472 if 468+ available)
    //
    // Right eye (viewer's right / subject's left):
    // Outer corner: 263, Inner corner: 362
    // Superior eyelid: 386, Inferior eyelid: 374
    // Iris center: 473 (or average of 474..477 if 473+ available)
    const hasIris = landmarks.length >= 478;
    if (!hasIris) {
      return {
        features: null,
        rawFeatures: null,
        isValid: false,
        rawGazeX: null,
        rawGazeY: null,
        eyeOpenness: 0,
        blinkDetected: true,
        invalidReason: 'no_iris',
      };
    }

    const p33 = landmarks[33];
    const p133 = landmarks[133];
    const p159 = landmarks[159];
    const p145 = landmarks[145];
    const p468 = landmarks[468];

    const p263 = landmarks[263];
    const p362 = landmarks[362];
    const p386 = landmarks[386];
    const p374 = landmarks[374];
    const p473 = landmarks[473];

    // Left Eye Geometry (landmarks 33 to 133):
    // Eye width vector (outer 33 to inner 133 in normalized image coords)
    const eyeWidthVecL = { x: p133.x - p33.x, y: p133.y - p33.y };
    const eyeWidthL = Math.hypot(eyeWidthVecL.x, eyeWidthVecL.y);

    const eyeOpenVecL = { x: p145.x - p159.x, y: p145.y - p159.y };
    const eyeOpenL = Math.hypot(eyeOpenVecL.x, eyeOpenVecL.y);
    const opennessRatioL = eyeWidthL > 1e-4 ? eyeOpenL / eyeWidthL : 0;

    // Iris projected onto eye corner axis:
    // unit vector along eye width
    const uLx = eyeWidthL > 1e-4 ? eyeWidthVecL.x / eyeWidthL : 1;
    const uLy = eyeWidthL > 1e-4 ? eyeWidthVecL.y / eyeWidthL : 0;
    // vector from outer corner (33) to iris center (468)
    const vIrisL = { x: p468.x - p33.x, y: p468.y - p33.y };
    // horizontal projection (0 = at outer corner 33, 1 = at inner corner 133)
    const projHL = vIrisL.x * uLx + vIrisL.y * uLy;
    const irisX_L = eyeWidthL > 1e-4 ? Math.max(0, Math.min(1, projHL / eyeWidthL)) : 0.5;

    // Eyelid midline midpoint
    const midEyelidL = { x: (p159.x + p145.x) / 2, y: (p159.y + p145.y) / 2 };
    // Vertical offset relative to eyelid midline, normalized by eye width
    // unit perpendicular vector (pointing downward)
    const perpLx = -uLy;
    const perpLy = uLx;
    const vIrisMidL = { x: p468.x - midEyelidL.x, y: p468.y - midEyelidL.y };
    const projVL = vIrisMidL.x * perpLx + vIrisMidL.y * perpLy;
    const irisY_L = eyeWidthL > 1e-4 ? projVL / eyeWidthL : 0;

    // Right Eye Geometry:
    // Outer 263 to inner 362 (or inner 362 to outer 263).
    // Let's adopt consistent orientation from outer corner (263) to inner corner (362):
    const eyeWidthVecR = { x: p362.x - p263.x, y: p362.y - p263.y };
    const eyeWidthR = Math.hypot(eyeWidthVecR.x, eyeWidthVecR.y);

    const eyeOpenVecR = { x: p374.x - p386.x, y: p374.y - p386.y };
    const eyeOpenR = Math.hypot(eyeOpenVecR.x, eyeOpenVecR.y);
    const opennessRatioR = eyeWidthR > 1e-4 ? eyeOpenR / eyeWidthR : 0;

    const uRx = eyeWidthR > 1e-4 ? eyeWidthVecR.x / eyeWidthR : 1;
    const uRy = eyeWidthR > 1e-4 ? eyeWidthVecR.y / eyeWidthR : 0;
    const vIrisR = { x: p473.x - p263.x, y: p473.y - p263.y };
    const projHR = vIrisR.x * uRx + vIrisR.y * uRy;
    const irisX_R = eyeWidthR > 1e-4 ? Math.max(0, Math.min(1, projHR / eyeWidthR)) : 0.5;

    const midEyelidR = { x: (p386.x + p374.x) / 2, y: (p386.y + p374.y) / 2 };
    const perpRx = -uRy;
    const perpRy = uRx;
    const vIrisMidR = { x: p473.x - midEyelidR.x, y: p473.y - midEyelidR.y };
    const projVR = vIrisMidR.x * perpRx + vIrisMidR.y * perpRy;
    const irisY_R = eyeWidthR > 1e-4 ? projVR / eyeWidthR : 0;

    // Openness and Blink Detection
    const eyeOpenness = Math.min(opennessRatioL, opennessRatioR);
    const isBlink = eyeOpenness < this.options.opennessThreshold;

    // Head Pose features
    // Inter-ocular distance (outer left 33 to outer right 263)
    const iod = Math.hypot(p263.x - p33.x, p263.y - p33.y);
    const noseTip = landmarks[1];
    const noseX = noseTip.x;
    const noseY = noseTip.y;

    let yaw = 0;
    let pitch = 0;
    let roll = 0;

    if (facialTransformationMatrix && facialTransformationMatrix.length === 16) {
      // Extract Euler angles from 4x4 matrix
      // R = [ [r00, r01, r02], [r10, r11, r12], [r20, r21, r22] ]
      const m = facialTransformationMatrix;
      pitch = Math.atan2(m[9], m[10]);
      yaw = Math.atan2(-m[8], Math.hypot(m[9], m[10]));
      roll = Math.atan2(m[4], m[0]);
    } else {
      // Derive head pose geometrically from landmark coordinates
      // Roll: angle of line connecting outer eye corners 33 and 263
      roll = Math.atan2(p263.y - p33.y, p263.x - p33.x);

      // Mid-eye and chin
      const midEyeX = (p33.x + p263.x) / 2;
      const midEyeY = (p33.y + p263.y) / 2;
      const chin = landmarks[152];

      // Yaw: horizontal displacement of nose relative to mid-eye, normalized by iod
      yaw = iod > 1e-4 ? (noseTip.x - midEyeX) / iod : 0;

      // Pitch: vertical displacement of nose relative to mid-eye and chin
      const faceHeight = Math.hypot(chin.x - midEyeX, chin.y - midEyeY);
      pitch = faceHeight > 1e-4 ? (noseTip.y - midEyeY) / faceHeight - 0.4 : 0;
    }

    // Convert yaw/pitch/roll to degrees for extreme pose check
    const yawDeg = (yaw * 180) / Math.PI;
    const pitchDeg = (pitch * 180) / Math.PI;
    const rollDeg = (roll * 180) / Math.PI;

    const isExtremePose =
      Math.abs(yawDeg) > this.options.maxYawDeg ||
      Math.abs(pitchDeg) > this.options.maxPitchDeg ||
      Math.abs(rollDeg) > this.options.maxRollDeg;

    // Check validity
    let invalidReason: GazeFeatureExtractionResult['invalidReason'];
    if (isBlink) {
      invalidReason = 'blink';
    } else if (isExtremePose) {
      invalidReason = 'extreme_head_pose';
    }

    const isValid = !isBlink && !isExtremePose;

    const rawFeatures: RawGazeFeatures = {
      irisX_L,
      irisY_L,
      irisX_R,
      irisY_R,
      openness_L: opennessRatioL,
      openness_R: opennessRatioR,
      yaw,
      pitch,
      roll,
      noseX,
      noseY,
      iod,
    };

    // Raw iris ratios for debugging / visualization (eye-in-socket)
    // Note: for Left eye (subject's right), 0 is outer (left in mirror), 1 is inner (right in mirror).
    // For Right eye (subject's left), 0 is outer (right in mirror), 1 is inner (left in mirror).
    // To have a consistent 0..1 ratio where 0 = looking rightward and 1 = looking leftward:
    // Average both eye horizontal ratios:
    const avgIrisX = (irisX_L + (1 - irisX_R)) / 2;
    const avgIrisY = (irisY_L + irisY_R) / 2;

    if (!isValid) {
      return {
        features: null,
        rawFeatures,
        isValid: false,
        rawGazeX: avgIrisX,
        rawGazeY: avgIrisY,
        eyeOpenness,
        blinkDetected: isBlink,
        invalidReason,
      };
    }

    // Apply light One Euro filter to raw features
    const smoothedFeatures: number[] = [
      this.filters.get('irisX_L')!.filter(irisX_L, nowMs),
      this.filters.get('irisY_L')!.filter(irisY_L, nowMs),
      this.filters.get('irisX_R')!.filter(irisX_R, nowMs),
      this.filters.get('irisY_R')!.filter(irisY_R, nowMs),
      this.filters.get('openness_L')!.filter(opennessRatioL, nowMs),
      this.filters.get('openness_R')!.filter(opennessRatioR, nowMs),
      this.filters.get('yaw')!.filter(yaw, nowMs),
      this.filters.get('pitch')!.filter(pitch, nowMs),
      this.filters.get('roll')!.filter(roll, nowMs),
      this.filters.get('noseX')!.filter(noseX, nowMs),
      this.filters.get('noseY')!.filter(noseY, nowMs),
      this.filters.get('iod')!.filter(iod, nowMs),
    ];

    return {
      features: smoothedFeatures,
      rawFeatures,
      isValid: true,
      rawGazeX: avgIrisX,
      rawGazeY: avgIrisY,
      eyeOpenness,
      blinkDetected: false,
    };
  }
}

export const gazeFeatureExtractor = new GazeFeatureExtractor();
