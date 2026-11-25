import type { LearnerProfile } from '../calibration/types';

export interface InputStatusSummary {
  sourceAlive: boolean;
  sourceId: string;
  isStreaming: boolean;
  fps: number;
  trackingQuality: number;
  isTrackingOk: boolean;
  hasProfile: boolean;
  activeProfileName: string | null;
  mode: 'head' | 'hand' | 'eye';
  isPaused: boolean;
  blockedReason: string | null;
}

export function computeInputStatus(params: {
  sourceAlive: boolean;
  sourceId: string;
  isStreaming: boolean;
  fps: number;
  profile: LearnerProfile | null;
  qualityFace: number;
  qualityHand: number;
  qualityEye?: number | null;
  isPaused: boolean;
  trackingLostSinceT: number | null;
  now?: number;
}): InputStatusSummary {
  const mode = params.profile?.mode ?? 'head';
  const trackingQuality =
    mode === 'head'
      ? params.qualityFace
      : mode === 'eye'
      ? params.qualityEye ?? params.qualityFace
      : params.qualityHand;

  const isTrackingOk = trackingQuality >= 0.25;
  const hasProfile = params.profile !== null;

  let blockedReason: string | null = null;
  if (!hasProfile) {
    blockedReason = 'No calibration profile active. Please calibrate or select a profile.';
  } else if (!params.sourceAlive) {
    blockedReason = 'Input source stopped.';
  } else if (params.sourceId === 'live' && !params.isStreaming) {
    blockedReason = 'Camera pipeline not started or initializing.';
  } else if (params.sourceId === 'live' && params.fps === 0 && params.isStreaming) {
    blockedReason = 'Camera stream stalled (0 FPS).';
  } else if (!isTrackingOk) {
    blockedReason =
      mode === 'head'
        ? 'Face not visible or too far from camera.'
        : mode === 'eye'
        ? 'Eyes/Face not clearly detected.'
        : 'Hand not visible in camera view.';
  } else if (params.isPaused) {
    blockedReason = 'System is paused (Space or Pause gesture to resume).';
  }

  return {
    sourceAlive: params.sourceAlive,
    sourceId: params.sourceId,
    isStreaming: params.isStreaming,
    fps: params.fps,
    trackingQuality,
    isTrackingOk,
    hasProfile,
    activeProfileName: params.profile?.name ?? null,
    mode,
    isPaused: params.isPaused,
    blockedReason,
  };
}
