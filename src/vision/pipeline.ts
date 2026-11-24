import { create } from 'zustand';
import type { SignalFrame, InputMode } from '../types/signals';
import { OneEuroFilter } from './oneEuro';
import { cameraService } from './camera';
import { landmarkersService } from './landmarkers';
import { extractSignals } from './signals';
import type { FaceLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { GazeFeatureExtractionResult } from '../gaze/types';

export interface PipelineStoreState {
  currentFrame: SignalFrame | null;
  latestGazeResult: GazeFeatureExtractionResult | null;
  fps: number;
  inputMode: InputMode;
  isStreaming: boolean;
  isLoadingModels: boolean;
  error: string | null;
  qualityWarning: string | null;
  setInputMode: (mode: InputMode) => void;
  setError: (error: string | null) => void;
}

export const usePipelineStore = create<PipelineStoreState>((set) => ({
  currentFrame: null,
  latestGazeResult: null,
  fps: 0,
  inputMode: 'head',
  isStreaming: false,
  isLoadingModels: false,
  error: null,
  qualityWarning: null,
  setInputMode: (inputMode) => set({ inputMode }),
  setError: (error) => set({ error }),
}));

type FrameSubscriber = (frame: SignalFrame) => void;

export class VisionPipeline {
  private subscribers: Set<FrameSubscriber> = new Set();
  private filters: Map<string, OneEuroFilter> = new Map();
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;
  private frameCount = 0;
  private lastFpsTimestamp = performance.now();
  private lowQualitySince: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  // Raw landmarker results for debug overlay
  public latestFaceResult: FaceLandmarkerResult | null = null;
  public latestHandResult: HandLandmarkerResult | null = null;

  constructor() {
    this.initFilters();
  }

  private initFilters(): void {
    const signalNames = [
      'headX',
      'headY',
      'headRoll',
      'jawOpen',
      'browRaise',
      'blink',
      'handX',
      'handY',
      'pinch',
      'openPalm',
      'gazeX',
      'gazeY',
      'irisDistL',
      'irisDistR',
      'eyeOpenness',
    ];
    for (const name of signalNames) {
      // headX, headY, handX, handY benefit from slightly higher beta for quick cursor responsiveness with low lag
      const isCursor = name === 'headX' || name === 'headY' || name === 'handX' || name === 'handY';
      const isGaze = name === 'gazeX' || name === 'gazeY';
      this.filters.set(
        name,
        new OneEuroFilter({
          minCutoff: isGaze ? 0.8 : 1.0,
          beta: isCursor ? 0.015 : isGaze ? 0.005 : 0.007,
          dCutoff: 1.0,
        })
      );
    }
  }

  subscribe(callback: FrameSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  async start(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    usePipelineStore.setState({ isLoadingModels: true, error: null });

    try {
      // 1. Initialize landmarkers (singleton)
      await landmarkersService.init();
      usePipelineStore.setState({ isLoadingModels: false });

      // 2. Start camera
      await cameraService.start(videoElement);
      usePipelineStore.setState({ isStreaming: true });

      // 3. Start processing loop
      this.lastVideoTime = -1;
      this.startLoop();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      usePipelineStore.setState({
        error: errorMsg,
        isLoadingModels: false,
        isStreaming: false,
      });
      throw err;
    }
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    cameraService.stop();
    this.latestFaceResult = null;
    this.latestHandResult = null;
    this.lowQualitySince = null;

    // Reset filters
    this.filters.forEach((filter) => filter.reset());

    usePipelineStore.setState({
      isStreaming: false,
      fps: 0,
      qualityWarning: null,
    });
  }

  private startLoop(): void {
    const loop = () => {
      if (document.hidden) {
        // Stop or pause processing when document is hidden to conserve power and avoid invalid timestamps
        this.animationFrameId = requestAnimationFrame(loop);
        return;
      }

      this.processVideoFrame();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private processVideoFrame(): void {
    if (!this.videoElement || this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    // Skip duplicate video timestamps to avoid MediaPipe errors
    if (this.videoElement.currentTime === this.lastVideoTime) {
      return;
    }
    this.lastVideoTime = this.videoElement.currentTime;

    const timestampMs = performance.now();
    const { face, hand } = landmarkersService.getLandmarkers();
    if (!face || !hand) {
      return;
    }

    const mode = usePipelineStore.getState().inputMode;

    try {
      // Run detectForVideo for active mode (both head and eye modes use faceLandmarker)
      if (mode === 'head' || mode === 'eye') {
        this.latestFaceResult = face.detectForVideo(this.videoElement, timestampMs);
        this.latestHandResult = null;
      } else {
        this.latestHandResult = hand.detectForVideo(this.videoElement, timestampMs);
        this.latestFaceResult = null;
      }

      // Extract normalized raw signals
      const gazeOut: { result?: GazeFeatureExtractionResult } = {};
      const rawFrame = extractSignals(
        timestampMs,
        this.latestFaceResult,
        this.latestHandResult,
        gazeOut
      );
      if (gazeOut.result) {
        usePipelineStore.setState({ latestGazeResult: gazeOut.result });
      }

      // Apply One Euro filter to continuous signals
      const smoothedSignals = { ...rawFrame.signals };
      for (const [name, val] of Object.entries(rawFrame.signals)) {
        const filter = this.filters.get(name);
        if (filter) {
          if (val === null) {
            filter.reset();
            smoothedSignals[name as keyof typeof smoothedSignals] = null;
          } else {
            smoothedSignals[name as keyof typeof smoothedSignals] = filter.filter(val, timestampMs);
          }
        }
      }

      const smoothedFrame: SignalFrame = {
        t: timestampMs,
        quality: rawFrame.quality,
        signals: smoothedSignals,
      };

      // Quality evaluation
      const qualityScore = mode === 'head' ? rawFrame.quality.face : rawFrame.quality.hand;
      let warning: string | null = null;
      if (qualityScore < 0.25) {
        if (this.lowQualitySince === null) {
          this.lowQualitySince = timestampMs;
        } else if (timestampMs - this.lowQualitySince > 1000) {
          warning =
            mode === 'head'
              ? 'Face not clearly visible (Move closer or ensure good lighting)'
              : 'Hand not clearly visible in camera frame';
        }
      } else {
        this.lowQualitySince = null;
      }

      // Update FPS
      this.frameCount++;
      const timeDelta = timestampMs - this.lastFpsTimestamp;
      let currentFps = usePipelineStore.getState().fps;
      if (timeDelta >= 500) {
        currentFps = Math.round((this.frameCount * 1000) / timeDelta);
        this.frameCount = 0;
        this.lastFpsTimestamp = timestampMs;
      }

      // Update store
      usePipelineStore.setState({
        currentFrame: smoothedFrame,
        fps: currentFps,
        qualityWarning: warning,
      });

      // Notify external subscribers
      for (const subscriber of this.subscribers) {
        subscriber(smoothedFrame);
      }
    } catch (e) {
      console.error('Error during vision frame processing:', e);
    }
  }
}

export const visionPipeline = new VisionPipeline();
