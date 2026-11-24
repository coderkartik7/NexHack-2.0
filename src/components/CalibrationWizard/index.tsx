import React, { useEffect, useState } from 'react';
import { useCalibrationStore, HEAD_GESTURES, HAND_GESTURES } from '../../calibration/store';
import { usePipelineStore, visionPipeline } from '../../vision/pipeline';
import type { CommandName, GestureOption } from '../../calibration/types';
import type { SignalFrame } from '../../types/signals';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Eye,
  Hand,
  Clock,
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

  // Render Step 1: Input Mode & Learner Name
  const renderStep1 = () => (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4">
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-2">Learner Name</label>
        <input
          type="text"
          value={learnerName}
          onChange={(e) => setLearnerName(e.target.value)}
          placeholder="e.g. Alex"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:outline-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">Input Mode</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setInputMode('head')}
            className={`p-5 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all ${
              inputMode === 'head'
                ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/30'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-base">Head Mode</div>
              <p className="text-xs text-slate-400 mt-1">
                Nose & eye pointing with facial gestures (jaw, brow, eye blinks)
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('hand')}
            className={`p-5 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all ${
              inputMode === 'hand'
                ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/30'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center">
              <Hand className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-base">Hand Mode</div>
              <p className="text-xs text-slate-400 mt-1">
                Fingertip tracking with pinch and open palm gestures
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Choose Gestures for Select, Grab, Pause
  const renderStep2 = () => {
    const gesturePool = inputMode === 'head' ? HEAD_GESTURES : HAND_GESTURES;
    const commands: { key: CommandName; label: string; desc: string }[] = [
      { key: 'select', label: 'Select Command', desc: 'Trigger a click / item selection' },
      { key: 'grab', label: 'Grab Command', desc: 'Hold to drag an object, release to drop' },
      { key: 'pause', label: 'Pause Command', desc: 'Temporary resting pause' },
    ];

    const isDuplicate =
      selectedGestures.select.signal === selectedGestures.grab.signal ||
      selectedGestures.select.signal === selectedGestures.pause.signal ||
      selectedGestures.grab.signal === selectedGestures.pause.signal;

    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300">
          Assign each command to a distinct comfortable gesture. Live values appear beside each option so you can test them before proceeding.
        </div>

        {isDuplicate && (
          <div className="bg-amber-950/70 border border-amber-800 text-amber-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Each command must be assigned to a unique gesture. Please adjust duplicate selections.
          </div>
        )}

        <div className="space-y-5">
          {commands.map((cmd) => {
            const currentSelection = selectedGestures[cmd.key];
            const liveSignalVal = currentFrame?.signals[currentSelection.signal];

            return (
              <div key={cmd.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white capitalize text-sm">{cmd.label}</h3>
                    <p className="text-xs text-slate-400">{cmd.desc}</p>
                  </div>

                  {/* Live test readout */}
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold">Live Value:</span>
                    <span className="font-mono text-cyan-400 font-bold text-xs">
                      {typeof liveSignalVal === 'number' ? liveSignalVal.toFixed(3) : 'null'}
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
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{g.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
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
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-6 text-center">
      <div>
        <h2 className="text-xl font-black text-white">15-Second Rest Baseline Recording</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Sit naturally facing the webcam. Small posture shifts or blinking naturally is fine.
          This establishes resting thresholds to prevent false activations.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-4">
        {/* Circular progress or bar */}
        <div className="w-full bg-slate-950 rounded-full h-4 border border-slate-800 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${Math.round(restProgress * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-xs text-slate-400 font-mono">
          <span>{Math.round(restProgress * 15)}s elapsed</span>
          <span>15s total</span>
        </div>

        {!isRecordingRest && !restBaseline && (
          <button
            type="button"
            onClick={() => useCalibrationStore.setState({ isRecordingRest: true })}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30"
          >
            Start 15s Baseline Recording
          </button>
        )}

        {isRecordingRest && (
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm animate-pulse">
            <Clock className="w-5 h-5" />
            Recording natural resting movement... Please sit comfortably.
          </div>
        )}

        {restBaseline && !isRecordingRest && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            Baseline established successfully! Signal variance and p95/p99 recorded.
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
      <div className="flex flex-col gap-5 max-w-2xl mx-auto py-2">
        <div className="text-center">
          <h2 className="text-lg font-black text-white">Comfortable Range of Motion</h2>
          <p className="text-xs text-slate-400 mt-1">
            Move your {inputMode === 'head' ? 'head' : 'hand'} comfortably to follow the guided dot.
            A 10% safety margin will ensure small comfortable movements span the full screen.
          </p>
        </div>

        {/* Interactive Guided Dot Canvas area */}
        <div className="relative w-full aspect-16/9 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
          {!isCompleted ? (
            <div
              className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 flex items-center justify-center transition-all duration-700 ease-out"
              style={{
                left: `${currentTarget.x * 100}%`,
                top: `${currentTarget.y * 100}%`,
              }}
            >
              <div className="w-3 h-3 rounded-full bg-white animate-ping" />
            </div>
          ) : (
            <div className="text-center p-6">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
              <h3 className="font-bold text-white text-base">Range Calibration Complete</h3>
              <p className="text-xs text-slate-400 mt-1">
                Gain calculated: X {cursorMapping?.gainX}x, Y {cursorMapping?.gainY}x
              </p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300">
            Target {Math.min(romStep + 1, romTargets.length)} of {romTargets.length}:{' '}
            <span className="font-bold text-cyan-400">{currentTarget.label}</span>
          </div>
        </div>

        {isCompleted && (
          <button
            type="button"
            onClick={() => useCalibrationStore.setState({ romStep: 0, romSamples: [] })}
            className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200"
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
      <div className="flex flex-col gap-6 max-w-xl mx-auto py-2">
        {/* Command tabs */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
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
                className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                  activeSamplingCommand === cmd
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cmd} {isDone ? '✓' : `(${count}/5)`}
              </button>
            );
          })}
        </div>

        {/* Repetition Cue Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-white capitalize">
              Sampling {activeSamplingCommand} command
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Gesture: <span className="text-indigo-400 font-semibold">{currentGesture.label}</span> ({currentGesture.description})
            </p>
          </div>

          {/* Cue prompt */}
          <div
            className={`w-full py-8 rounded-xl border font-black text-xl tracking-wider uppercase transition-all ${
              repState === 'cue_perform'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 scale-102 animate-pulse'
                : repState === 'relax'
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {repState === 'cue_perform' && '👉 PERFORM GESTURE NOW!'}
            {repState === 'relax' && '😌 RELAX...'}
            {repState === 'idle' && (reps.length >= 5 ? 'All 5 Reps Captured' : 'Ready to record')}
          </div>

          {repState === 'idle' && reps.length < 5 && (
            <button
              type="button"
              onClick={startRepetitionRecording}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-md"
            >
              Start Recording Reps
            </button>
          )}

          {/* Reps progress dots */}
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((idx) => {
              const rep = reps[idx];
              const isRecorded = !!rep;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${
                    isRecorded
                      ? rep.isValid
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : 'bg-red-500 border-red-400 text-white'
                      : idx === currentRepIndex && repState !== 'idle'
                      ? 'border-indigo-400 bg-indigo-950 animate-ping'
                      : 'border-slate-700 bg-slate-950 text-slate-600'
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
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mt-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-record this command
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
      <div className="flex flex-col gap-5 max-w-2xl mx-auto py-2">
        <div className="text-center">
          <h2 className="text-lg font-black text-white">Calibration & Separability Results</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic activation thresholds computed with hysteresis and rest separation (d-prime)
          </p>
        </div>

        <div className="space-y-4">
          {(['select', 'grab', 'pause'] as const).map((cmd) => {
            const binding = calibratedBindings[cmd];
            const isReliable = binding.separability.rating === 'reliable';
            const isMarginal = binding.separability.rating === 'marginal';

            return (
              <div
                key={cmd}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white capitalize text-sm">{cmd}</span>
                    <span className="text-xs font-mono text-slate-400">
                      ({binding.signal}, {binding.direction === 'high' ? 'active ↑' : 'active ↓'})
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isReliable
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : isMarginal
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-red-950 text-red-400 border border-red-800'
                    }`}
                  >
                    {binding.separability.rating}
                  </span>
                </div>

                {/* Threshold details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Enter Threshold
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{binding.enter}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Exit Threshold
                    </span>
                    <span className="font-mono font-bold text-indigo-400">{binding.exit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Min Hold
                    </span>
                    <span className="font-mono font-bold text-white">{binding.minHoldMs} ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      d' / Overlap
                    </span>
                    <span className="font-mono font-bold text-white">
                      {binding.separability.dPrime} / {(binding.separability.overlap * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {!isReliable && (
                  <div className="bg-amber-950/40 border border-amber-900/60 p-3 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span>
                        Overlap warning: Gesture peaks are close to resting noise. Consider
                        re-recording or selecting a different gesture.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStep('gesture_selection');
                        }}
                        className="block mt-1 text-amber-200 underline font-bold"
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
      <div className="flex flex-col gap-6 max-w-xl mx-auto py-2 text-center">
        <div>
          <h2 className="text-lg font-black text-white">Live Verification Playground</h2>
          <p className="text-xs text-slate-400 mt-1">
            Perform gestures to test activation. Boxes light up in real time when crossing calibrated thresholds.
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
                className={`p-6 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                  isActive
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20 scale-105'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-black text-base capitalize">{cmd}</div>
                <div className="text-[10px] font-mono mt-1 opacity-80">
                  {typeof liveVal === 'number' ? liveVal.toFixed(2) : '--'} / {binding.enter}
                </div>
                <div
                  className={`mt-3 w-3 h-3 rounded-full ${
                    isActive ? 'bg-slate-950 animate-ping' : 'bg-slate-800'
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
    <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-8 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
        <Check className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-white">Profile Saved Successfully!</h2>
      <p className="text-sm text-slate-400">
        Learner profile &quot;{learnerName}&quot; is active. It will persist across browser reloads in IndexedDB.
      </p>
      <button
        type="button"
        onClick={onComplete}
        className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm"
      >
        Go to Profiles Manager
      </button>
    </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-4xl mx-auto flex flex-col justify-between min-h-[580px]">
      {/* Wizard Header / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            Calibration Wizard
          </span>
          <h1 className="text-lg font-black text-white capitalize">
            {currentStep.replace(/_/g, ' ')}
          </h1>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="text-xs text-slate-400 hover:text-white"
        >
          Exit Wizard
        </button>
      </div>

      {/* Main Step Content */}
      <div className="my-auto py-4">
        {currentStep === 'mode_and_name' && renderStep1()}
        {currentStep === 'gesture_selection' && renderStep2()}
        {currentStep === 'rest_baseline' && renderStep3()}
        {currentStep === 'range_of_motion' && renderStep4()}
        {currentStep === 'gesture_sampling' && renderStep5()}
        {currentStep === 'threshold_review' && renderStep6()}
        {currentStep === 'try_it' && renderStep7()}
        {currentStep === 'saved' && renderStep8()}
      </div>

      {/* Bottom Nav Controls */}
      {currentStep !== 'saved' && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 'mode_and_name'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {currentStep === 'gesture_sampling' ? (
            <button
              type="button"
              onClick={() => {
                computeAllThresholds();
                nextStep();
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
            >
              Compute Thresholds <ArrowRight className="w-4 h-4" />
            </button>
          ) : currentStep === 'try_it' ? (
            <button
              type="button"
              onClick={() => saveCalibratedProfile()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
            >
              Save Profile <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
            >
              Next Step <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
