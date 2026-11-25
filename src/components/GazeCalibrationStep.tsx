import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SignalFrame } from '../types/signals';
import { visionPipeline, usePipelineStore } from '../vision/pipeline';
import { fitGazeModel, type CalibrationSample } from '../gaze/model';
import { computeValidationAccuracy, type ValidationEvaluation } from '../gaze/accuracy';
import type { GazeModel, GazeFeatureExtractionResult } from '../gaze/types';
import { GazeValidation } from './GazeValidation';
import { Compass, ArrowRight, Eye, AlertCircle, RefreshCw, FastForward } from 'lucide-react';

interface GazeCalibrationStepProps {
  onComplete: (model: GazeModel, largeTargetMode: boolean) => void;
  onCancel: () => void;
}

export type CalibrationPhase =
  | 'setup'
  | 'fixed_points'
  | 'head_movement'
  | 'fitting'
  | 'validation'
  | 'done';

export type PointCollectionState =
  | 'waiting_for_face'
  | 'settling'
  | 'collecting'
  | 'point_done'
  | 'next_point'
  | 'fitting'
  | 'validating';

export const NINE_POINTS = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

export const SIXTEEN_POINTS = [
  ...NINE_POINTS,
  { x: 0.3, y: 0.3 },
  { x: 0.7, y: 0.3 },
  { x: 0.3, y: 0.7 },
  { x: 0.7, y: 0.7 },
  { x: 0.5, y: 0.3 },
  { x: 0.5, y: 0.7 },
  { x: 0.3, y: 0.5 },
];

const STORAGE_KEY_SAMPLES = 'gesturelearn_gaze_calib_samples';
const STORAGE_KEY_INDEX = 'gesturelearn_gaze_calib_index';

export const GazeCalibrationStep: React.FC<GazeCalibrationStepProps> = ({
  onComplete,
  onCancel,
}) => {
  const [phase, setPhase] = useState<CalibrationPhase>('setup');
  const [use16Points, setUse16Points] = useState(true);
  const [pointIndex, setPointIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INDEX);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [machineState, setMachineState] = useState<PointCollectionState>('waiting_for_face');
  const [headTimerSec, setHeadTimerSec] = useState(20);
  const [validationEval, setValidationEval] = useState<ValidationEvaluation | null>(null);

  const [trackingQuality, setTrackingQuality] = useState(0);
  const [rejectionReason, setRejectionReason] = useState<string>('Align face');
  const [validFramesCount, setValidFramesCount] = useState(0);
  const [_pointTimeoutSeconds, setPointTimeoutSeconds] = useState(8);
  const [pointTimedOut, setPointTimedOut] = useState(false);
  const [cameraStalled, setCameraStalled] = useState(false);
  const [isLenientMode, setIsLenientMode] = useState(false);

  // Collected Samples persisted
  const samplesRef = useRef<CalibrationSample[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAMPLES);
      if (saved) {
        samplesRef.current = JSON.parse(saved) || [];
      }
    } catch {}
  }, []);
  const currentBufferRef = useRef<number[][]>([]);
  const fittedModelRef = useRef<GazeModel | null>(null);
  const lastSignalTimeRef = useRef<number>(performance.now());

  const activePoints = use16Points ? SIXTEEN_POINTS : NINE_POINTS;
  const TARGET_FRAMES = isLenientMode ? 15 : 30;

  const logTransition = useCallback((from: string, to: string, detail?: string) => {
    if (import.meta.env.DEV) {
      console.log(`[GazeCalibration] ${from} -> ${to}${detail ? ` (${detail})` : ''}`);
    }
  }, []);

  // Sync mode with vision pipeline
  useEffect(() => {
    usePipelineStore.getState().setInputMode('eye');
  }, []);

  // Listen to live pipeline frames for tracking quality & watchdog
  useEffect(() => {
    const unsub = visionPipeline.subscribe((frame: SignalFrame) => {
      lastSignalTimeRef.current = performance.now();
      setCameraStalled(false);

      const q = frame.quality.eye ?? frame.quality.face;
      setTrackingQuality(q);
    });

    const watchdog = setInterval(() => {
      if (performance.now() - lastSignalTimeRef.current > 2000) {
        setCameraStalled(true);
      }
    }, 1000);

    return () => {
      unsub();
      clearInterval(watchdog);
    };
  }, []);

  // Keyboard shortcuts (Escape = cancel, Space/Enter = manual advance if >= 10 frames)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (phase === 'fixed_points' && currentBufferRef.current.length >= 10) {
          e.preventDefault();
          commitCurrentPoint();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, onCancel]);

  // Persist samples and index
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAMPLES, JSON.stringify(samplesRef.current));
      localStorage.setItem(STORAGE_KEY_INDEX, String(pointIndex));
    } catch {}
  }, [pointIndex]);

  // Helper to commit whatever valid frames we have (>= 10) for current target
  const commitCurrentPoint = useCallback(() => {
    const buffer = currentBufferRef.current;
    if (buffer.length < 10) return false;

    const currentPt = activePoints[pointIndex] || { x: 0.5, y: 0.5 };
    const screenW = window.innerWidth || 1024;
    const screenH = window.innerHeight || 768;
    const targetPx = {
      x: Math.round(currentPt.x * screenW),
      y: Math.round(currentPt.y * screenH),
    };

    // Median feature vector
    const numF = buffer[0].length;
    const medianVec: number[] = [];
    for (let col = 0; col < numF; col++) {
      const vals = buffer.map((r) => r[col]).sort((a, b) => a - b);
      medianVec.push(vals[Math.floor(vals.length / 2)]);
    }

    samplesRef.current.push({
      features: medianVec,
      screenX: targetPx.x,
      screenY: targetPx.y,
    });

    logTransition('collecting', 'point_done', `point ${pointIndex + 1} collected with ${buffer.length} frames`);
    setMachineState('point_done');
    setPointTimedOut(false);
    setPointIndex((prev) => prev + 1);
    return true;
  }, [activePoints, pointIndex, logTransition]);

  // Phase: Fixed points progression state machine
  useEffect(() => {
    if (phase !== 'fixed_points') return;

    if (pointIndex >= activePoints.length) {
      logTransition('fixed_points', 'head_movement');
      setPhase('head_movement');
      return;
    }

    logTransition(machineState, 'settling', `point ${pointIndex + 1}`);
    setMachineState('settling');
    setValidFramesCount(0);
    currentBufferRef.current = [];
    setPointTimedOut(false);
    setPointTimeoutSeconds(isLenientMode ? 12 : 8);

    let pointTimer: ReturnType<typeof setTimeout> | null = null;
    let collectInterval: ReturnType<typeof setInterval> | null = null;
    let unsubPipeline: (() => void) | null = null;

    // Settle for 600ms
    const settleTimer = setTimeout(() => {
      logTransition('settling', 'collecting');
      setMachineState('collecting');

      // Subscribe to vision frames for collection and diagnostic feedback
      unsubPipeline = visionPipeline.subscribe(() => {
        const gazeResult: GazeFeatureExtractionResult | null =
          visionPipeline.latestGazeResult ?? usePipelineStore.getState().latestGazeResult;

        if (!gazeResult) {
          setRejectionReason('No face detected, move closer');
          return;
        }

        if (!gazeResult.isValid) {
          if (gazeResult.invalidReason === 'no_face') {
            setRejectionReason('Face not found, move closer');
          } else if (gazeResult.invalidReason === 'no_iris') {
            setRejectionReason('Iris landmarks missing (check lighting)');
          } else if (gazeResult.invalidReason === 'blink') {
            setRejectionReason('Eyes look closed, open them a little wider');
          } else if (gazeResult.invalidReason === 'extreme_head_pose') {
            setRejectionReason('Head turned too far, face camera directly');
          } else {
            setRejectionReason('Poor visibility, adjust lighting');
          }
          return;
        }

        // Frame is valid!
        setRejectionReason('Good gaze tracking');
        const feat = gazeResult.features;
        if (feat && feat.length >= 12) {
          currentBufferRef.current.push([...feat]);
          const currentCount = currentBufferRef.current.length;
          setValidFramesCount(currentCount);

          if (currentCount >= TARGET_FRAMES) {
            commitCurrentPoint();
          }
        }
      });

      // 8s (or 12s) Timeout countdown
      let remainingSec = isLenientMode ? 12 : 8;
      collectInterval = setInterval(() => {
        remainingSec -= 1;
        setPointTimeoutSeconds(remainingSec);
        if (remainingSec <= 0) {
          if (collectInterval) clearInterval(collectInterval);
          if (currentBufferRef.current.length >= 10) {
            commitCurrentPoint();
          } else {
            setPointTimedOut(true);
          }
        }
      }, 1000);
    }, 600);

    return () => {
      clearTimeout(settleTimer);
      if (pointTimer) clearTimeout(pointTimer);
      if (collectInterval) clearInterval(collectInterval);
      if (unsubPipeline) unsubPipeline();
    };
  }, [phase, pointIndex, activePoints.length, TARGET_FRAMES, isLenientMode, commitCurrentPoint, logTransition]);

  // Phase: Head movement random dots
  useEffect(() => {
    if (phase !== 'head_movement') return;

    let timeLeft = 20;
    setHeadTimerSec(timeLeft);

    const interval = setInterval(() => {
      timeLeft -= 1;
      setHeadTimerSec(timeLeft);

      if (timeLeft % 2 === 0) {
        const screenW = window.innerWidth || 1024;
        const screenH = window.innerHeight || 768;
        const rx = 0.15 + Math.random() * 0.7;
        const ry = 0.15 + Math.random() * 0.7;
        const feat = (visionPipeline as any).latestGazeResult?.features;
        if (feat && feat.length >= 12) {
          samplesRef.current.push({
            features: [...feat],
            screenX: Math.round(rx * screenW),
            screenY: Math.round(ry * screenH),
          });
        }
      }

      if (timeLeft <= 0) {
        clearInterval(interval);
        startFitting();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Start Ridge Regression fitting
  const startFitting = () => {
    logTransition(phase, 'fitting');
    setPhase('fitting');
    setMachineState('fitting');
    setTimeout(() => {
      try {
        const model = fitGazeModel(samplesRef.current, {
          includeSecondOrder: false,
        });
        fittedModelRef.current = model;
        runValidation(model);
      } catch (err: any) {
        console.error('Fitting error:', err);
        alert(`Model fitting failed: ${err.message}. Retrying fixed points.`);
        samplesRef.current = [];
        setPointIndex(0);
        setPhase('fixed_points');
      }
    }, 500);
  };

  // Run validation on held-out samples
  const runValidation = (model: GazeModel) => {
    logTransition('fitting', 'validation');
    setPhase('validation');
    setMachineState('validating');
    const screenW = window.innerWidth || 1024;
    const screenH = window.innerHeight || 768;

    const valTargets = samplesRef.current.slice(-8);
    const predictions = valTargets.map((s) => {
      const w = model.weightsX;
      let px = w[w.length - 1];
      for (let j = 0; j < s.features.length; j++) {
        px += ((s.features[j] - model.featureMean[j]) / model.featureStd[j]) * w[j];
      }
      const wy = model.weightsY;
      let py = wy[wy.length - 1];
      for (let j = 0; j < s.features.length; j++) {
        py += ((s.features[j] - model.featureMean[j]) / model.featureStd[j]) * wy[j];
      }
      return { x: px, y: py };
    });

    const evalResult = computeValidationAccuracy(
      predictions,
      valTargets.map((s) => ({ x: s.screenX, y: s.screenY })),
      screenW,
      screenH
    );

    model.validation = evalResult.stats;
    setValidationEval(evalResult);
  };

  const handleValidationContinue = (largeTargetMode: boolean) => {
    if (fittedModelRef.current) {
      // Clear wizard persistence on completion
      try {
        localStorage.removeItem(STORAGE_KEY_SAMPLES);
        localStorage.removeItem(STORAGE_KEY_INDEX);
      } catch {}
      onComplete(fittedModelRef.current, largeTargetMode);
    }
  };

  const handleRecalibrate = () => {
    samplesRef.current = [];
    setPointIndex(0);
    setPhase('fixed_points');
  };

  const handleSkipPoint = () => {
    // Skip allowed only if not corners or center (index != 0, 1, 2, 4, 6, 8)
    const isCornerOrCenter = [0, 2, 4, 6, 8].includes(pointIndex);
    if (isCornerOrCenter && activePoints.length <= 9) {
      alert('Corner and center dots cannot be skipped for gaze model stability.');
      return;
    }
    setPointIndex((prev) => prev + 1);
  };

  // 1. Initial Setup Screen
  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
            <Eye className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Eye Gaze Calibration</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            We will calibrate the neural gaze tracker by having you look at target dots across the display.
          </p>
        </div>

        {/* Camera Watchdog Banner */}
        {cameraStalled && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl flex items-center justify-between text-rose-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Camera is not sending frames.</span>
            </div>
            <button
              onClick={() => {
                const vid = visionPipeline.getVideoElement();
                if (vid) visionPipeline.acquire(vid).catch(console.error);
              }}
              className="px-2 py-1 bg-rose-900 hover:bg-rose-800 rounded text-rose-100 font-bold"
            >
              Restart camera
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Camera Alignment</span>
              <span className={`font-mono ${trackingQuality > 0.4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {trackingQuality > 0.4 ? 'Ready' : rejectionReason}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  trackingQuality > 0.4 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, trackingQuality * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
            <div>
              <span className="text-sm font-medium text-white block">Calibration Points</span>
              <span className="text-xs text-zinc-400">16 points recommended for higher accuracy</span>
            </div>
            <button
              onClick={() => setUse16Points(!use16Points)}
              className="px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors bg-zinc-800 text-teal-300 border-zinc-700 hover:bg-zinc-700"
            >
              {use16Points ? '16 Points (Accurate)' : '9 Points (Fast)'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
            <div>
              <span className="text-sm font-medium text-white block">Lenient Mode (Young/Restricted Learners)</span>
              <span className="text-xs text-zinc-400">15 frames/dot & 12s timeout</span>
            </div>
            <input
              type="checkbox"
              checked={isLenientMode}
              onChange={(e) => setIsLenientMode(e.target.checked)}
              className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              samplesRef.current = [];
              setPointIndex(0);
              setPhase('fixed_points');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors shadow-lg shadow-teal-600/20"
          >
            <span>Start Dot Calibration</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Fixed Calibration Points Phase
  if (phase === 'fixed_points') {
    const pt = activePoints[pointIndex] || { x: 0.5, y: 0.5 };
    const pct = Math.min(100, Math.round((validFramesCount / TARGET_FRAMES) * 100));

    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center select-none">
        {/* Pulsing Calibration Target Dot with Progress Ring */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none"
          style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
        >
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="4"
                className="text-zinc-800"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="4"
                className="text-teal-400 transition-all duration-75"
                strokeDasharray={201}
                strokeDashoffset={201 - (201 * pct) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Center target dot */}
            <div className="absolute w-4 h-4 rounded-full bg-white shadow-md animate-pulse" />
          </div>
        </div>

        {/* Top telemetry and prompt bar */}
        <div className="absolute top-6 inset-x-0 flex flex-col items-center gap-2 px-8 text-xs font-mono pointer-events-none">
          <div className="flex justify-between w-full text-zinc-400">
            <span>Look directly at the dot.</span>
            <span className="font-bold text-teal-400">
              Point {pointIndex + 1} of {activePoints.length}
            </span>
            <span>ESC to exit</span>
          </div>

          {/* Live Progress & Frame Rejection Reason */}
          <div className="px-4 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg flex items-center gap-3 backdrop-blur-md">
            <span className="text-zinc-300 font-semibold">
              Collecting {validFramesCount}/{TARGET_FRAMES} valid frames
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span className={rejectionReason.includes('Good') ? 'text-teal-400' : 'text-amber-400'}>
              {rejectionReason}
            </span>
          </div>
        </div>

        {/* Timeout / Facilitator Control Overlays */}
        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-8 pointer-events-auto">
          {cameraStalled && (
            <div className="p-3 bg-rose-950/90 border border-rose-700 text-rose-200 rounded-xl text-xs flex items-center gap-3 shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Camera is not sending frames!</span>
              <button
                onClick={() => {
                  const vid = visionPipeline.getVideoElement();
                  if (vid) visionPipeline.acquire(vid).catch(console.error);
                }}
                className="px-2 py-1 bg-rose-900 rounded font-bold"
              >
                Restart camera
              </button>
            </div>
          )}

          {pointTimedOut && (
            <div className="p-4 bg-zinc-900/95 border border-amber-600/80 rounded-xl max-w-md text-center space-y-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 font-semibold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Point timed out: {rejectionReason}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs">
                <button
                  onClick={() => {
                    currentBufferRef.current = [];
                    setValidFramesCount(0);
                    setPointTimedOut(false);
                    setPointTimeoutSeconds(isLenientMode ? 12 : 8);
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200"
                >
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                  Retry Point
                </button>
                <button
                  onClick={handleSkipPoint}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200"
                >
                  <FastForward className="w-3.5 h-3.5 inline mr-1" />
                  Skip Point
                </button>
                <button
                  onClick={() => setIsLenientMode(true)}
                  className="px-3 py-1.5 bg-teal-900/80 hover:bg-teal-800 text-teal-200 rounded"
                >
                  Use lenient settings
                </button>
              </div>
            </div>
          )}

          {/* Facilitator Manual Advance button (active when >= 10 frames) */}
          <div className="flex items-center gap-2">
            <button
              onClick={commitCurrentPoint}
              disabled={validFramesCount < 10}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Accept {validFramesCount} frames & Advance (Space/Enter)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Head Movement Coverage Phase
  if (phase === 'head_movement') {
    return (
      <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6 text-center">
        <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
          <Compass className="w-6 h-6 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Head-Movement Coverage (20s)</h2>
          <p className="text-xs text-zinc-400">
            Keep looking at the dots while making small, natural head shifts.
          </p>
        </div>

        <div className="p-6 bg-zinc-950/60 rounded-xl border border-zinc-800 font-mono">
          <span className="text-4xl font-bold text-teal-400">{headTimerSec}</span>
          <span className="text-xs text-zinc-500 block mt-1">seconds remaining</span>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={startFitting}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            Skip phase (warning: accuracy may degrade when head moves)
          </button>
        </div>
      </div>
    );
  }

  // 4. Model Fitting Phase
  if (phase === 'fitting') {
    return (
      <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-teal-400 border-t-transparent animate-spin mx-auto" />
        <h3 className="text-base font-bold text-white">Fitting Ridge Regression Model...</h3>
        <p className="text-xs text-zinc-400">
          Cross-validating L2 regularization penalty and feature standardizations.
        </p>
      </div>
    );
  }

  // 5. Validation Result Phase
  if (phase === 'validation' && validationEval) {
    return (
      <GazeValidation
        evaluation={validationEval}
        onRecalibrate={handleRecalibrate}
        onContinue={handleValidationContinue}
      />
    );
  }

  return null;
};
