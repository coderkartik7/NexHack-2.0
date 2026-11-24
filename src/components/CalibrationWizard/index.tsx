import React, { useEffect, useState } from 'react';
import { useCalibrationStore, HEAD_GESTURES, HAND_GESTURES, EYE_GESTURES } from '../../calibration/store';
import { usePipelineStore, visionPipeline } from '../../vision/pipeline';
import type { CommandName, GestureOption } from '../../calibration/types';
import type { SignalFrame } from '../../types/signals';
import { GazeCalibrationStep } from '../GazeCalibrationStep';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Eye,
  Hand,
  Clock,
  HelpCircle,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const CalibrationWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const {
    currentStep,
    learnerName,
    inputMode,
    selectedGestures,
    isRecordingRest,
    restProgress,
    restBaseline,
    romStep,
    romTargets,
    cursorMapping,
    activeSamplingCommand,
    gestureReps,
    calibratedBindings,
    setLearnerName,
    setInputMode,
    setCommandGesture,
    nextStep,
    prevStep,
    setStep,
    addRestSample,
    finalizeRestBaseline,
    addRomSample,
    advanceRomTarget,
    recordGestureRepetition,
    reRecordCommand,
    computeAllThresholds,
    saveCalibratedProfile,
  } = useCalibrationStore();

  const { currentFrame, setInputMode: setPipelineMode } = usePipelineStore();

  // Sync vision pipeline mode with calibration wizard mode
  useEffect(() => {
    setPipelineMode(inputMode);
  }, [inputMode, setPipelineMode]);

  // Step 3: 15-second Rest Baseline recording timer
  useEffect(() => {
    if (currentStep === 'rest_baseline' && isRecordingRest) {
      const startTime = performance.now();
      const DURATION_MS = 15000;

      const unsubscribe = visionPipeline.subscribe((frame: SignalFrame) => {
        addRestSample(frame.signals);
      });

      const interval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const prog = Math.min(1.0, elapsed / DURATION_MS);
        useCalibrationStore.setState({ restProgress: prog });

        if (elapsed >= DURATION_MS) {
          clearInterval(interval);
          unsubscribe();
          finalizeRestBaseline();
        }
      }, 50);

      return () => {
        clearInterval(interval);
        unsubscribe();
      };
    }
  }, [currentStep, isRecordingRest, addRestSample, finalizeRestBaseline]);

  // Step 4: Guided Range of Motion target timer
  useEffect(() => {
    if (currentStep === 'range_of_motion' && romStep < romTargets.length) {
      const TARGET_TIME = 3000; // 3 seconds per target dot

      const unsubscribe = visionPipeline.subscribe((frame: SignalFrame) => {
        const x = inputMode === 'head' ? frame.signals.headX : frame.signals.handX;
        const y = inputMode === 'head' ? frame.signals.headY : frame.signals.handY;
        if (typeof x === 'number' && typeof y === 'number') {
          addRomSample(x, y);
        }
      });

      const timer = setTimeout(() => {
        unsubscribe();
        advanceRomTarget();
      }, TARGET_TIME);

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }
  }, [currentStep, romStep, romTargets.length, inputMode, addRomSample, advanceRomTarget]);

  // Step 5: Gesture Repetition prompt & auto-peak recording
  const [repState, setRepState] = useState<'idle' | 'cue_perform' | 'relax'>('idle');
  const [currentRepIndex, setCurrentRepIndex] = useState(0);

  const startRepetitionRecording = () => {
    setCurrentRepIndex(0);
    setRepState('cue_perform');
  };

  useEffect(() => {
    if (currentStep === 'gesture_sampling' && repState === 'cue_perform') {
      const gesture = selectedGestures[activeSamplingCommand];
      let maxVal = gesture.direction === 'high' ? -Infinity : Infinity;
      const startTime = performance.now();

      const unsubscribe = visionPipeline.subscribe((frame: SignalFrame) => {
        const val = frame.signals[gesture.signal];
        if (typeof val === 'number') {
          if (gesture.direction === 'high') {
            if (val > maxVal) maxVal = val;
          } else {
            if (val < maxVal) maxVal = val;
          }
        }
      });

      // 1.8 second window for gesture action
      const timer = setTimeout(() => {
        unsubscribe();
        const durationMs = Math.round(performance.now() - startTime);

        // Validation against rest noise
        const restStats = restBaseline?.[gesture.signal];
        const restRef = restStats
          ? gesture.direction === 'high'
            ? restStats.p95
            : restStats.p95
          : 0;

        const isLow = gesture.direction === 'low';
        const movedSignificantly = isLow ? maxVal < restRef * 0.9 : maxVal > restRef * 1.1;

        const rep = {
          peak: maxVal === -Infinity || maxVal === Infinity ? 0 : Number(maxVal.toFixed(3)),
          durationMs,
          isValid: movedSignificantly,
        };

        recordGestureRepetition(activeSamplingCommand, rep);
        setRepState('relax');
      }, 1800);

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    } else if (currentStep === 'gesture_sampling' && repState === 'relax') {
      // 1.2 second relax window
      const timer = setTimeout(() => {
        const reps = gestureReps[activeSamplingCommand] || [];
        if (reps.length < 5) {
          setCurrentRepIndex(reps.length);
          setRepState('cue_perform');
        } else {
          setRepState('idle');
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [
    currentStep,
    repState,
    activeSamplingCommand,
    selectedGestures,
    restBaseline,
    gestureReps,
    recordGestureRepetition,
  ]);

  // Steps definition for wizard progress indicator
  const wizardSteps: { key: typeof currentStep; label: string }[] = [
    { key: 'mode_and_name', label: 'Identity' },
    { key: 'gesture_selection', label: 'Triggers' },
    { key: 'rest_baseline', label: 'Baseline' },
    { key: 'range_of_motion', label: 'Range' },
    { key: 'gesture_sampling', label: 'Sampling' },
    { key: 'threshold_review', label: 'Review' },
    { key: 'try_it', label: 'Verify' },
  ];

  const currentStepIdx = wizardSteps.findIndex((s) => s.key === currentStep);

  // Render Step 1: Input Mode & Learner Name
  const renderStep1 = () => (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-2">
      <div>
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
          Learner Name
        </label>
        <input
          type="text"
          value={learnerName}
          onChange={(e) => setLearnerName(e.target.value)}
          placeholder="e.g. Alex M."
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500 rounded-md px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors"
        />
        <p className="text-[11px] text-zinc-400 font-mono mt-1">
          Identifies this learner&apos;s calibration profiles and threshold sets.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Tracking Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInputMode('head')}
            className={`p-3.5 rounded-lg border text-left transition-colors flex flex-col justify-between min-h-[110px] ${
              inputMode === 'head'
                ? 'border-teal-500/80 bg-zinc-950/80 shadow-2xs'
                : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Eye className="w-4 h-4 text-teal-400" />
              {inputMode === 'head' && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
            </div>
            <div>
              <div className="font-semibold text-zinc-100 text-xs">Head Tracking</div>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                Nose tip pointing with facial blendshapes (jaw, brow, blink)
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('hand')}
            className={`p-3.5 rounded-lg border text-left transition-colors flex flex-col justify-between min-h-[110px] ${
              inputMode === 'hand'
                ? 'border-teal-500/80 bg-zinc-950/80 shadow-2xs'
                : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Hand className="w-4 h-4 text-teal-400" />
              {inputMode === 'hand' && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
            </div>
            <div>
              <div className="font-semibold text-zinc-100 text-xs">Hand Tracking</div>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                Index fingertip cursor with pinch and palm gestures
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('eye')}
            className={`col-span-2 p-3.5 rounded-lg border text-left transition-colors flex flex-col justify-between min-h-[90px] ${
              inputMode === 'eye'
                ? 'border-teal-500/80 bg-zinc-950/80 shadow-2xs'
                : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="font-semibold text-zinc-100 text-xs">Eye (Gaze) Mode</span>
              </div>
              {inputMode === 'eye' && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
            </div>
            <div>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                Webcam eye gaze tracking cursor with calibrated facial gestures (jaw, brow, long blink). Expect ~100–200 px error.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Choose Gestures for Select, Grab, Pause
  const renderStep2 = () => {
    const gesturePool =
      inputMode === 'eye'
        ? EYE_GESTURES
        : inputMode === 'head'
        ? HEAD_GESTURES
        : HAND_GESTURES;
    const commands: { key: CommandName; label: string; desc: string }[] = [
      { key: 'select', label: 'Select Command', desc: 'Primary activation / click' },
      { key: 'grab', label: 'Grab Command', desc: 'Hold for drag, release for drop' },
      { key: 'pause', label: 'Pause Command', desc: 'Temporary tracking hold' },
    ];

    const isDuplicate =
      selectedGestures.select.signal === selectedGestures.grab.signal ||
      selectedGestures.select.signal === selectedGestures.pause.signal ||
      selectedGestures.grab.signal === selectedGestures.pause.signal;

    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto py-1">
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-md p-3 text-xs text-zinc-400 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <span>
            Assign each command to a distinct biometric gesture. Live sensor readings appear beside each option to verify comfort.
            {inputMode === 'eye' && ' (Note: Long blink commands momentarily pause gaze tracking during closure; click stabilization prevents cursor wandering).'}
          </span>
        </div>

        {isDuplicate && (
          <div className="bg-amber-950/60 border border-amber-800/80 text-amber-300 p-2.5 rounded-md text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            Duplicate gesture assignment detected. Each command must use a distinct signal.
          </div>
        )}

        <div className="space-y-3">
          {commands.map((cmd) => {
            const currentSelection = selectedGestures[cmd.key];
            const liveSignalVal = currentFrame?.signals[currentSelection.signal];

            return (
              <div key={cmd.key} className="bg-zinc-950/60 border border-zinc-800/80 rounded-md p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-200 text-xs">{cmd.label}</h3>
                    <p className="text-[11px] text-zinc-400">{cmd.desc}</p>
                  </div>

                  {/* Live test readout */}
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded font-mono text-[11px]">
                    <span className="text-zinc-500">Live:</span>
                    <span className="text-teal-400 font-medium">
                      {typeof liveSignalVal === 'number' ? liveSignalVal.toFixed(3) : '--'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {gesturePool.map((g: GestureOption) => {
                    const isSelected = currentSelection.signal === g.signal;
                    return (
                      <button
                        key={g.signal}
                        type="button"
                        onClick={() => setCommandGesture(cmd.key, g)}
                        className={`p-2.5 rounded border text-left transition-colors ${
                          isSelected
                            ? 'border-teal-500/80 bg-zinc-900/90 text-zinc-100 shadow-2xs'
                            : 'border-zinc-800/80 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-medium text-zinc-200">{g.label}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {g.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Step 3: 15-second Rest Baseline
  const renderStep3 = () => (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-4 text-center">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Natural Resting Baseline Recording</h2>
        <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          Sit naturally facing the camera for 15 seconds. Small natural blinks, breathing, and minor head posture adjustments establish the learner&apos;s noise floor to prevent false triggers.
        </p>
      </div>

      <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-5 flex flex-col items-center gap-4">
        {/* Grounded Meter Bar */}
        <div className="w-full bg-zinc-900 rounded h-2 border border-zinc-800 overflow-hidden">
          <div
            className="bg-teal-500 h-full transition-all duration-100 ease-linear rounded-xs"
            style={{ width: `${Math.round(restProgress * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[11px] text-zinc-500 font-mono">
          <span>{Math.round(restProgress * 15)}s elapsed</span>
          <span>15s target</span>
        </div>

        {!isRecordingRest && !restBaseline && (
          <button
            type="button"
            onClick={() => useCalibrationStore.setState({ isRecordingRest: true })}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold rounded-md text-xs transition-colors shadow-2xs"
          >
            Start 15s Baseline Capture
          </button>
        )}

        {isRecordingRest && (
          <div className="flex items-center gap-2 text-teal-400 font-medium text-xs">
            <Clock className="w-4 h-4 animate-spin" />
            Sampling resting variance... Keep seated naturally.
          </div>
        )}

        {restBaseline && !isRecordingRest && (
          <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 p-3 rounded-md text-xs font-medium flex items-center gap-2 w-full text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Baseline established. Noise variance and 95th percentile bounds recorded.</span>
          </div>
        )}
      </div>
    </div>
  );

  // Render Step 4: Guided Range of Motion
  const renderStep4 = () => {
    const currentTarget = romTargets[romStep] || romTargets[romTargets.length - 1];
    const isCompleted = romStep >= romTargets.length;

    return (
      <div className="flex flex-col gap-4 max-w-xl mx-auto py-1">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-zinc-100">Comfortable Range of Motion</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Move your {inputMode === 'head' ? 'head' : 'hand'} comfortably toward each highlighted target dot. A 10% safety margin ensures relaxed motion spans the workspace.
          </p>
        </div>

        {/* Guided Target Field */}
        <div className="relative w-full aspect-16/9 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
          {/* Viewfinder crosshairs */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-px border-b border-zinc-900 border-dashed" />
            <div className="h-full w-px border-r border-zinc-900 border-dashed absolute" />
          </div>

          {!isCompleted ? (
            <div
              className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-teal-400/20 border border-teal-400 flex items-center justify-center transition-all duration-700 ease-out"
              style={{
                left: `${currentTarget.x * 100}%`,
                top: `${currentTarget.y * 100}%`,
              }}
            >
              <div className="w-2 h-2 rounded-full bg-teal-400" />
            </div>
          ) : (
            <div className="text-center p-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
              <h3 className="font-semibold text-zinc-100 text-sm">Range Calibration Complete</h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                Gain calculated: X {cursorMapping?.gainX}x &middot; Y {cursorMapping?.gainY}x
              </p>
            </div>
          )}

          <div className="absolute bottom-2.5 left-2.5 bg-zinc-900/90 px-2.5 py-1 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400">
            Target {Math.min(romStep + 1, romTargets.length)} of {romTargets.length}:{' '}
            <span className="text-teal-400 font-semibold">{currentTarget.label}</span>
          </div>
        </div>

        {isCompleted && (
          <button
            type="button"
            onClick={() => useCalibrationStore.setState({ romStep: 0, romSamples: [] })}
            className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 self-center"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Re-calibrate Range of Motion
          </button>
        )}
      </div>
    );
  };

  // Render Step 5: Gesture Sampling (5 reps per command)
  const renderStep5 = () => {
    const commands: CommandName[] = ['select', 'grab', 'pause'];
    const currentGesture = selectedGestures[activeSamplingCommand];
    const reps = gestureReps[activeSamplingCommand] || [];

    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto py-1">
        {/* Command tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-md border border-zinc-800">
          {commands.map((cmd) => {
            const count = (gestureReps[cmd] || []).length;
            const isDone = count >= 5;
            return (
              <button
                key={cmd}
                type="button"
                onClick={() => {
                  useCalibrationStore.setState({ activeSamplingCommand: cmd });
                  setRepState('idle');
                }}
                className={`flex-1 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                  activeSamplingCommand === cmd
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cmd} {isDone ? '✓' : `(${count}/5)`}
              </button>
            );
          })}
        </div>

        {/* Repetition Cue Box */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-5 text-center flex flex-col items-center gap-3.5">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Sampling {activeSamplingCommand} Command
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Target Gesture: <span className="text-teal-400 font-medium">{currentGesture.label}</span>
            </p>
          </div>

          {/* Cue prompt */}
          <div
            className={`w-full py-6 rounded-md border font-mono text-sm tracking-wider uppercase transition-colors ${
              repState === 'cue_perform'
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-400'
                : repState === 'relax'
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500'
            }`}
          >
            {repState === 'cue_perform' && 'Perform Gesture Now'}
            {repState === 'relax' && 'Relax / Neutral Posture'}
            {repState === 'idle' && (reps.length >= 5 ? 'All 5 Repetitions Captured' : 'Ready to capture')}
          </div>

          {repState === 'idle' && reps.length < 5 && (
            <button
              type="button"
              onClick={startRepetitionRecording}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold rounded-md text-xs shadow-2xs transition-colors"
            >
              Start Recording Reps
            </button>
          )}

          {/* Reps progress dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((idx) => {
              const rep = reps[idx];
              const isRecorded = !!rep;
              return (
                <div
                  key={idx}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center text-[10px] font-mono font-medium ${
                    isRecorded
                      ? rep.isValid
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                        : 'bg-rose-950/80 border-rose-800 text-rose-400'
                      : idx === currentRepIndex && repState !== 'idle'
                      ? 'border-teal-400 bg-teal-950/40 text-teal-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-600'
                  }`}
                >
                  {isRecorded ? (rep.isValid ? '✓' : '✕') : idx + 1}
                </div>
              );
            })}
          </div>

          {reps.length > 0 && (
            <button
              type="button"
              onClick={() => reRecordCommand(activeSamplingCommand)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 mt-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-sample this gesture
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render Step 6: Review Calibrated Thresholds & Separability Check
  const renderStep6 = () => {
    if (!calibratedBindings) return null;

    return (
      <div className="flex flex-col gap-4 max-w-xl mx-auto py-1">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-zinc-100">Threshold Calculation & Separability</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hysteresis activation boundaries and d-prime statistical separability from resting baseline
          </p>
        </div>

        <div className="space-y-3">
          {(['select', 'grab', 'pause'] as const).map((cmd) => {
            const binding = calibratedBindings[cmd];
            const isReliable = binding.separability.rating === 'reliable';
            const isMarginal = binding.separability.rating === 'marginal';

            return (
              <div
                key={cmd}
                className="bg-zinc-950/60 border border-zinc-800/80 rounded-md p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100 capitalize text-xs">{cmd}</span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      ({binding.signal}, {binding.direction === 'high' ? 'active ↑' : 'active ↓'})
                    </span>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isReliable
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                        : isMarginal
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-900/60'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-900/60'
                    }`}
                  >
                    {binding.separability.rating}
                  </span>
                </div>

                {/* Threshold details grid */}
                <div className="grid grid-cols-4 gap-2 text-xs bg-zinc-900/60 p-2.5 rounded border border-zinc-850">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      Enter Threshold
                    </span>
                    <span className="font-mono font-semibold text-teal-400 text-xs">{binding.enter}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      Exit Hysteresis
                    </span>
                    <span className="font-mono font-semibold text-zinc-200 text-xs">{binding.exit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      Min Hold Time
                    </span>
                    <span className="font-mono font-semibold text-zinc-200 text-xs">{binding.minHoldMs} ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      d&apos; / Overlap
                    </span>
                    <span className="font-mono font-semibold text-zinc-200 text-xs">
                      {binding.separability.dPrime} &middot; {(binding.separability.overlap * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {!isReliable && (
                  <div className="bg-amber-950/40 border border-amber-900/60 p-2.5 rounded text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <span>
                        Overlap detected with resting baseline. Consider selecting another gesture with higher physical amplitude.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStep('gesture_selection');
                        }}
                        className="block mt-1 text-amber-200 underline font-medium"
                      >
                        Change Gesture Choice
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Step 7: Try-it Verification Screen
  const renderStep7 = () => {
    if (!calibratedBindings) return null;

    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto py-1 text-center">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Live Threshold Verification</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Perform gestures to test real-time activation against calculated entry and exit thresholds.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(['select', 'grab', 'pause'] as const).map((cmd) => {
            const binding = calibratedBindings[cmd];
            const liveVal = currentFrame?.signals[binding.signal];
            const isHigh = binding.direction === 'high';
            const isActive =
              typeof liveVal === 'number' && (isHigh ? liveVal >= binding.enter : liveVal <= binding.enter);

            return (
              <div
                key={cmd}
                className={`p-4 rounded-md border flex flex-col items-center justify-center transition-colors min-h-[100px] ${
                  isActive
                    ? 'bg-teal-950/80 border-teal-500/80 text-teal-200 shadow-2xs'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="font-semibold text-xs capitalize text-zinc-200">{cmd}</div>
                <div className="text-[11px] font-mono mt-1 text-zinc-400">
                  {typeof liveVal === 'number' ? liveVal.toFixed(2) : '--'} / {binding.enter}
                </div>
                <div
                  className={`mt-2 w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-teal-400' : 'bg-zinc-800'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Step 8: Saved Success Screen
  const renderStep8 = () => (
    <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto py-6 text-center">
      <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center">
        <Check className="w-5 h-5" />
      </div>
      <h2 className="text-base font-semibold text-zinc-100">Profile Saved Successfully</h2>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Learner profile &quot;{learnerName}&quot; is active and securely persisted in IndexedDB.
      </p>
      <button
        type="button"
        onClick={onComplete}
        className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold rounded-md text-xs transition-colors"
      >
        Return to Profiles
      </button>
    </div>
  );

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 shadow-xs flex flex-col justify-between min-h-[540px]">
      {/* Wizard Header / Breadcrumb */}
      <div className="flex flex-col gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Calibration Protocol
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-xs font-mono text-zinc-400 capitalize">
              {currentStep.replace(/_/g, ' ')}
            </span>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Step indicator pills */}
        <div className="grid grid-cols-7 gap-1">
          {wizardSteps.map((s, idx) => {
            const isCompleted = currentStepIdx > idx || currentStep === 'saved';
            const isCurrent = currentStep === s.key;
            return (
              <div
                key={s.key}
                className={`h-1 rounded-xs transition-colors ${
                  isCurrent
                    ? 'bg-teal-400'
                    : isCompleted
                    ? 'bg-teal-900'
                    : 'bg-zinc-800'
                }`}
                title={s.label}
              />
            );
          })}
        </div>
      </div>

      {/* Main Step Content */}
      <div className="my-auto py-3">
        {currentStep === 'mode_and_name' && renderStep1()}
        {currentStep === 'gesture_selection' && renderStep2()}
        {currentStep === 'gaze_calibration' && (
          <GazeCalibrationStep
            onComplete={(model, largeTarget) => {
              useCalibrationStore.getState().setGazeCalibration(model, largeTarget);
            }}
            onCancel={onComplete}
          />
        )}
        {currentStep === 'rest_baseline' && renderStep3()}
        {currentStep === 'range_of_motion' && renderStep4()}
        {currentStep === 'gesture_sampling' && renderStep5()}
        {currentStep === 'threshold_review' && renderStep6()}
        {currentStep === 'try_it' && renderStep7()}
        {currentStep === 'saved' && renderStep8()}
      </div>

      {/* Bottom Nav Controls */}
      {currentStep !== 'saved' && (
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 'mode_and_name'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {currentStep === 'gesture_sampling' ? (
            <button
              type="button"
              onClick={() => {
                computeAllThresholds();
                nextStep();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-zinc-950 transition-colors shadow-2xs"
            >
              Compute Thresholds <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : currentStep === 'try_it' ? (
            <button
              type="button"
              onClick={() => saveCalibratedProfile()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-zinc-950 transition-colors shadow-2xs"
            >
              Save Profile <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-zinc-950 transition-colors shadow-2xs"
            >
              Next Step <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
