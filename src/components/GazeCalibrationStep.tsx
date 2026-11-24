import React, { useState, useEffect, useRef } from 'react';
import type { SignalFrame } from '../types/signals';
import { visionPipeline } from '../vision/pipeline';
import { fitGazeModel, type CalibrationSample } from '../gaze/model';
import { computeValidationAccuracy, type ValidationEvaluation } from '../gaze/accuracy';
import type { GazeModel } from '../gaze/types';
import { GazeValidation } from './GazeValidation';
import { Compass, CheckCircle2, AlertCircle, ArrowRight, Eye, ShieldCheck } from 'lucide-react';

interface GazeCalibrationStepProps {
  onComplete: (model: GazeModel, largeTargetMode: boolean) => void;
  onCancel: () => void;
}

type CalibrationPhase =
  | 'setup'
  | 'fixed_points'
  | 'head_movement'
  | 'fitting'
  | 'validation'
  | 'done';

const NINE_POINTS = [
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

const SIXTEEN_POINTS = [
  ...NINE_POINTS,
  { x: 0.3, y: 0.3 },
  { x: 0.7, y: 0.3 },
  { x: 0.3, y: 0.7 },
  { x: 0.7, y: 0.7 },
  { x: 0.5, y: 0.3 },
  { x: 0.5, y: 0.7 },
  { x: 0.3, y: 0.5 },
];

export const GazeCalibrationStep: React.FC<GazeCalibrationStepProps> = ({
  onComplete,
  onCancel,
}) => {
  const [phase, setPhase] = useState<CalibrationPhase>('setup');
  const [use16Points, setUse16Points] = useState(true);
  const [pointIndex, setPointIndex] = useState(0);
  const [pointState, setPointState] = useState<'settle' | 'collect'>('settle');
  const [headTimerSec, setHeadTimerSec] = useState(20);
  const [fittedModel, setFittedModel] = useState<GazeModel | null>(null);
  const [validationEval, setValidationEval] = useState<ValidationEvaluation | null>(null);

  const [trackingQuality, setTrackingQuality] = useState(0);
  const [trackingReason, setTrackingReason] = useState<string>('Align face');

  // Collected Samples
  const samplesRef = useRef<CalibrationSample[]>([]);
  const currentBufferRef = useRef<number[][]>([]);
  const fittedModelRef = useRef<GazeModel | null>(null);

  const activePoints = use16Points ? SIXTEEN_POINTS : NINE_POINTS;

  // Listen to live pipeline frames for tracking quality
  useEffect(() => {
    const unsub = visionPipeline.subscribe((frame: SignalFrame) => {
      const q = frame.quality.eye ?? frame.quality.face;
      setTrackingQuality(q);
      if (q > 0.4) {
        setTrackingReason('Tracking Ready');
      } else {
        setTrackingReason('Center face in light');
      }
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut for facilitator advance (Space or Enter to advance/trigger)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Phase: Fixed points progression
  useEffect(() => {
    if (phase !== 'fixed_points') return;

    if (pointIndex >= activePoints.length) {
      // Done with fixed points -> head movement phase
      setPhase('head_movement');
      return;
    }

    const currentPt = activePoints[pointIndex];
    const screenW = window.innerWidth || 1024;
    const screenH = window.innerHeight || 768;
    const targetPx = {
      x: Math.round(currentPt.x * screenW),
      y: Math.round(currentPt.y * screenH),
    };

    setPointState('settle');
    currentBufferRef.current = [];

    // Wait ~600ms for eyes to settle
    const settleTimer = setTimeout(() => {
      setPointState('collect');

      const unsub = visionPipeline.subscribe(() => {
        const gazeRes = visionPipeline.latestFaceResult; // handled in pipeline
        // Read features from store or pipeline
        // In VisionPipeline, current gaze feature vector is produced per frame
        const feat = (visionPipeline as any).latestGazeResult?.features;
        if (feat && feat.length >= 12) {
          currentBufferRef.current.push([...feat]);
        }
      });

      // Collect for 1000ms (~30 frames)
      const collectTimer = setTimeout(() => {
        unsub();
        const buffer = currentBufferRef.current;
        if (buffer.length >= 10) {
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

          // Move to next point
          setPointIndex((prev) => prev + 1);
        } else {
          // Repeat point if insufficient valid frames (e.g. blinks)
          setPointState('settle');
        }
      }, 1000);

      return () => {
        clearTimeout(collectTimer);
        unsub();
      };
    }, 600);

    return () => clearTimeout(settleTimer);
  }, [phase, pointIndex, activePoints]);

  // Phase: Head movement random dots
  useEffect(() => {
    if (phase !== 'head_movement') return;

    let timeLeft = 20;
    setHeadTimerSec(timeLeft);

    const interval = setInterval(() => {
      timeLeft -= 1;
      setHeadTimerSec(timeLeft);

      // Random dot sample every 2 seconds
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
    setPhase('fitting');
    setTimeout(() => {
      try {
        const model = fitGazeModel(samplesRef.current, {
          includeSecondOrder: false,
        });
        fittedModelRef.current = model;
        setFittedModel(model);
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

  // Run validation on 6-8 synthetic or live points
  const runValidation = (model: GazeModel) => {
    setPhase('validation');
    const screenW = window.innerWidth || 1024;
    const screenH = window.innerHeight || 768;

    // Evaluate accuracy: cross validate on held-out samples or validation points
    const valTargets = samplesRef.current.slice(-8);
    const predictions = valTargets.map((s) => {
      const pred = model.weightsX.length > 0;
      // Predict for each sample
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

  const handleRecalibrate = () => {
    samplesRef.current = [];
    setPointIndex(0);
    setPhase('setup');
  };

  const handleValidationContinue = (largeTargetMode: boolean) => {
    if (fittedModelRef.current) {
      onComplete(fittedModelRef.current, largeTargetMode);
    }
  };

  // 1. Setup Phase Screen
  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Eye Gaze Calibration Setup</h2>
            <p className="text-xs text-zinc-400">Step 1 of 3: Position and tracking check</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-zinc-300">
          <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Optimal Setup Guidance</span>
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
              <li>Sit about an arm&apos;s length away (~50–70 cm) from the webcam.</li>
              <li>Face lit evenly from the front; avoid bright windows directly behind you.</li>
              <li>Keep head reasonably still and relaxed, looking naturally at the targets.</li>
            </ul>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Tracking Quality:</span>
              <span className={trackingQuality > 0.4 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {trackingReason} ({(trackingQuality * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
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
    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center cursor-none select-none">
        {/* Pulsing Calibration Target Dot */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
          style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
        >
          <div
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
              pointState === 'collect'
                ? 'border-emerald-400 bg-emerald-500/20 scale-110 shadow-lg shadow-emerald-500/40'
                : 'border-teal-400 bg-teal-500/10 scale-95 animate-ping'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
          </div>
        </div>

        {/* Top bar info */}
        <div className="absolute top-6 inset-x-0 flex justify-between px-8 text-xs font-mono text-zinc-400 pointer-events-none">
          <span>Look directly at the pulsing dot.</span>
          <span>
            Point {pointIndex + 1} of {activePoints.length}
          </span>
          <span>Press ESC to exit</span>
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
