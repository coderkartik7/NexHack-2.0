export interface GazeValidationStats {
  meanErrorPx: number;
  p90ErrorPx: number;
  n: number;
  screenW: number;
  screenH: number;
}

export interface GazeModel {
  version: number;
  featureNames: string[];                  // order of features
  featureMean: number[];                   // standardization means
  featureStd: number[];                    // standardization stds
  weightsX: number[];                      // ridge coefficients for X incl. bias (last term or first)
  weightsY: number[];                      // ridge coefficients for Y incl. bias
  lambda: number;
  trainPoints: number;
  validation: GazeValidationStats | null;
  includeSecondOrder?: boolean;            // whether iris x^2, y^2, xy terms are included
}

export interface RawGazeFeatures {
  irisX_L: number;
  irisY_L: number;
  irisX_R: number;
  irisY_R: number;
  openness_L: number;
  openness_R: number;
  yaw: number;
  pitch: number;
  roll: number;
  noseX: number;
  noseY: number;
  iod: number; // inter-ocular distance
}

export interface GazeFeatureExtractionResult {
  features: number[] | null; // fixed-order feature vector, null if invalid/lost/blink
  rawFeatures: RawGazeFeatures | null;
  isValid: boolean;
  rawGazeX: number | null; // averaged eye-in-socket horizontal ratio (0..1)
  rawGazeY: number | null; // averaged eye-in-socket vertical offset
  eyeOpenness: number;     // min/average openness ratio
  blinkDetected: boolean;
  invalidReason?: 'no_face' | 'no_iris' | 'blink' | 'extreme_head_pose';
}
