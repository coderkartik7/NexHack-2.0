import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

export interface LandmarkerInstances {
  faceLandmarker: FaceLandmarker;
  handLandmarker: HandLandmarker;
}

class LandmarkersService {
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private initPromise: Promise<LandmarkerInstances> | null = null;

  async init(): Promise<LandmarkerInstances> {
    if (this.faceLandmarker && this.handLandmarker) {
      return {
        faceLandmarker: this.faceLandmarker,
        handLandmarker: this.handLandmarker,
      };
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // WASM loader from Google CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // FaceLandmarker: GPU with CPU fallback
      let faceLandmarker: FaceLandmarker;
      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      } catch (gpuError) {
        console.warn('FaceLandmarker GPU delegate failed, falling back to CPU:', gpuError);
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      }

      // HandLandmarker: GPU with CPU fallback
      let handLandmarker: HandLandmarker;
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      } catch (gpuError) {
        console.warn('HandLandmarker GPU delegate failed, falling back to CPU:', gpuError);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      }

      this.faceLandmarker = faceLandmarker;
      this.handLandmarker = handLandmarker;

      return {
        faceLandmarker,
        handLandmarker,
      };
    })();

    return this.initPromise;
  }

  isLoaded(): boolean {
    return this.faceLandmarker !== null && this.handLandmarker !== null;
  }

  getLandmarkers(): { face: FaceLandmarker | null; hand: HandLandmarker | null } {
    return {
      face: this.faceLandmarker,
      hand: this.handLandmarker,
    };
  }

  close(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.initPromise = null;
  }
}

export const landmarkersService = new LandmarkersService();
