import { create } from 'zustand';
import type {
  CommandBinding,
  CommandName,
  CursorMapping,
  GestureOption,
  GestureSampleRep,
  LearnerProfile,
  SignalSummaryStats,
} from './types';
import type { InputMode, SignalName } from '../types/signals';
import { computeSignalStats } from './stats';
import { computeThresholds } from './thresholds';
import { computeSeparability } from './separability';
import { saveProfile, setActiveProfileId } from '../storage/profiles';

import type { GazeModel } from '../gaze/types';

export type WizardStep =
  | 'mode_and_name'
  | 'gesture_selection'
  | 'gaze_calibration'
  | 'rest_baseline'
  | 'range_of_motion'
  | 'gesture_sampling'
  | 'threshold_review'
  | 'try_it'
  | 'saved';

export const HEAD_GESTURES: GestureOption[] = [
  { signal: 'jawOpen', direction: 'high', label: 'Jaw Open', description: 'Drop jaw downward naturally' },
  { signal: 'browRaise', direction: 'high', label: 'Eyebrow Raise', description: 'Lift both eyebrows upward' },
  { signal: 'blink', direction: 'high', label: 'Extended Blink', description: 'Close both eyes firmly' },
  { signal: 'headRoll', direction: 'high', label: 'Head Tilt Right', description: 'Tilt head slightly to the right' },
];

export const EYE_GESTURES: GestureOption[] = [
  { signal: 'jawOpen', direction: 'high', label: 'Jaw Open', description: 'Drop jaw downward without moving head' },
  { signal: 'browRaise', direction: 'high', label: 'Eyebrow Raise', description: 'Lift eyebrows upward without moving head' },
  { signal: 'blink', direction: 'high', label: 'Long Blink', description: 'Close both eyes firmly for calibrated duration' },
];

export const HAND_GESTURES: GestureOption[] = [
  { signal: 'pinch', direction: 'low', label: 'Index-Thumb Pinch', description: 'Touch thumb and index fingertips together' },
  { signal: 'openPalm', direction: 'high', label: 'Wide Open Palm', description: 'Spread fingers wide outward' },
];

export interface CalibrationWizardState {
  currentStep: WizardStep;
  learnerName: string;
  inputMode: InputMode;

  // Selected gesture for each command
  selectedGestures: Record<CommandName, GestureOption>;

  // Step 3: Rest baseline
  isRecordingRest: boolean;
  restProgress: number; // 0 to 1
  restBuffer: Record<SignalName, number[]>;
  restBaseline: Record<SignalName, SignalSummaryStats> | null;

  // Step 4: Range of motion
  romStep: number; // 0: Top-Left, 1: Top-Right, 2: Bottom-Right, 3: Bottom-Left, 4: Center, 5: Done
  romTargets: { label: string; x: number; y: number }[];
  romSamples: { x: number; y: number }[];
  cursorMapping: CursorMapping | null;

  // Step 5: Gesture samples
  activeSamplingCommand: CommandName;
  gestureReps: Record<CommandName, GestureSampleRep[]>;
  isRecordingRep: boolean;
  currentRepProgress: number; // 0 to 1

  // Gaze Model calibration state
  gazeModel: GazeModel | null;
  largeTargetMode: boolean;
  dwellSelectionEnabled: boolean;
  dwellTimeMs: number;
  naturalBlinkDurationMs: number;
  setGazeCalibration: (model: GazeModel, largeTargetMode: boolean) => void;
  setDwellSelection: (enabled: boolean, dwellMs?: number) => void;

  // Step 6: Computed bindings
  calibratedBindings: Record<CommandName, CommandBinding> | null;

  // Saved profile id
  savedProfileId: string | null;

  // Actions
  setLearnerName: (name: string) => void;
  setInputMode: (mode: InputMode) => void;
  setCommandGesture: (command: CommandName, gesture: GestureOption) => void;
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Recording actions
  addRestSample: (signals: Record<SignalName, number | null>) => void;
  finalizeRestBaseline: () => void;

  addRomSample: (x: number, y: number) => void;
  advanceRomTarget: () => void;
  finalizeRom: () => void;

  recordGestureRepetition: (command: CommandName, rep: GestureSampleRep) => void;
  reRecordCommand: (command: CommandName) => void;
  computeAllThresholds: () => void;
  saveCalibratedProfile: () => Promise<LearnerProfile>;
  resetWizard: () => void;
}

const STEP_ORDER: WizardStep[] = [
  'mode_and_name',
  'gesture_selection',
  'rest_baseline',
  'range_of_motion',
  'gesture_sampling',
  'threshold_review',
  'try_it',
  'saved',
];

export const useCalibrationStore = create<CalibrationWizardState>((set, get) => ({
  currentStep: 'mode_and_name',
  learnerName: 'Learner 1',
  inputMode: 'head',

  selectedGestures: {
    select: HEAD_GESTURES[0], // jawOpen
    grab: HEAD_GESTURES[1],   // browRaise
    pause: HEAD_GESTURES[2],  // blink
  },

  isRecordingRest: false,
  restProgress: 0,
  restBuffer: {
    headX: [],
    headY: [],
    headRoll: [],
    jawOpen: [],
    browRaise: [],
    blink: [],
    handX: [],
    handY: [],
    pinch: [],
    openPalm: [],
    gazeX: [],
    gazeY: [],
    irisDistL: [],
    irisDistR: [],
    eyeOpenness: [],
  },
  restBaseline: null,

  romStep: 0,
  romTargets: [
    { label: 'Top-Left Corner', x: 0.15, y: 0.15 },
    { label: 'Top-Right Corner', x: 0.85, y: 0.15 },
    { label: 'Bottom-Right Corner', x: 0.85, y: 0.85 },
    { label: 'Bottom-Left Corner', x: 0.15, y: 0.85 },
    { label: 'Center Target', x: 0.5, y: 0.5 },
  ],
  romSamples: [],
  cursorMapping: null,

  activeSamplingCommand: 'select',
  gestureReps: {
    select: [],
    grab: [],
    pause: [],
  },
  isRecordingRep: false,
  currentRepProgress: 0,

  calibratedBindings: null,
  savedProfileId: null,

  gazeModel: null,
  largeTargetMode: false,
  dwellSelectionEnabled: false,
  dwellTimeMs: 1000,
  naturalBlinkDurationMs: 250,

  setGazeCalibration: (model, largeTargetMode) => {
    set({
      gazeModel: model,
      largeTargetMode,
      currentStep: 'rest_baseline',
    });
  },

  setDwellSelection: (enabled, dwellMs = 1000) => {
    set({
      dwellSelectionEnabled: enabled,
      dwellTimeMs: dwellMs,
    });
  },

  setLearnerName: (learnerName) => set({ learnerName }),

  setInputMode: (mode) => {
    // Default gestures for the chosen mode
    const defaultGestures: Record<CommandName, GestureOption> =
      mode === 'head'
        ? {
            select: HEAD_GESTURES[0],
            grab: HEAD_GESTURES[1],
            pause: HEAD_GESTURES[2],
          }
        : mode === 'eye'
        ? {
            select: EYE_GESTURES[0], // jawOpen
            grab: EYE_GESTURES[1],   // browRaise
            pause: EYE_GESTURES[2],  // long blink
          }
        : {
            select: HAND_GESTURES[0], // pinch
            grab: HAND_GESTURES[1],   // openPalm
            pause: HAND_GESTURES[0],  // will adjust
          };

    set({
      inputMode: mode,
      selectedGestures: defaultGestures,
    });
  },

  setCommandGesture: (command, gesture) => {
    const current = { ...get().selectedGestures };
    // Prevent assigning the same gesture twice
    for (const [cmd, g] of Object.entries(current)) {
      if (cmd !== command && g.signal === gesture.signal) {
        // Find an unused gesture from options
        const pool =
          get().inputMode === 'eye'
            ? EYE_GESTURES
            : get().inputMode === 'head'
            ? HEAD_GESTURES
            : HAND_GESTURES;
        const replacement = pool.find((opt) => opt.signal !== gesture.signal);
        if (replacement) {
          current[cmd as CommandName] = replacement;
        }
      }
    }
    current[command] = gesture;
    set({ selectedGestures: current });
  },

  setStep: (currentStep) => set({ currentStep }),

  nextStep: () => {
    const curr = get().currentStep;
    const isEye = get().inputMode === 'eye';
    
    // In eye mode, after gesture_selection we go to gaze_calibration, then rest_baseline, then gesture_sampling (skipping range_of_motion)
    if (isEye) {
      if (curr === 'gesture_selection') {
        set({ currentStep: 'gaze_calibration' });
        return;
      }
      if (curr === 'gaze_calibration') {
        set({ currentStep: 'rest_baseline' });
        return;
      }
      if (curr === 'rest_baseline') {
        set({ currentStep: 'gesture_sampling' });
        return;
      }
    }

    const idx = STEP_ORDER.indexOf(curr);
    if (idx < STEP_ORDER.length - 1) {
      let next = STEP_ORDER[idx + 1];
      if (isEye && next === 'range_of_motion') {
        next = 'gesture_sampling';
      }
      set({ currentStep: next });
    }
  },

  prevStep: () => {
    const curr = get().currentStep;
    const isEye = get().inputMode === 'eye';

    if (isEye) {
      if (curr === 'gaze_calibration') {
        set({ currentStep: 'gesture_selection' });
        return;
      }
      if (curr === 'rest_baseline') {
        set({ currentStep: 'gaze_calibration' });
        return;
      }
      if (curr === 'gesture_sampling') {
        set({ currentStep: 'rest_baseline' });
        return;
      }
    }

    const idx = STEP_ORDER.indexOf(curr);
    if (idx > 0) {
      let prev = STEP_ORDER[idx - 1];
      if (isEye && prev === 'range_of_motion') {
        prev = 'rest_baseline';
      }
      set({ currentStep: prev });
    }
  },

  addRestSample: (signals) => {
    const buffer = { ...get().restBuffer };
    for (const [key, val] of Object.entries(signals)) {
      if (typeof val === 'number') {
        const k = key as SignalName;
        if (!buffer[k]) buffer[k] = [];
        buffer[k].push(val);
      }
    }
    set({ restBuffer: buffer });
  },

  finalizeRestBaseline: () => {
    const buffer = get().restBuffer;
    const baseline: Partial<Record<SignalName, SignalSummaryStats>> = {};
    for (const [key, samples] of Object.entries(buffer)) {
      baseline[key as SignalName] = computeSignalStats(samples);
    }

    // Measure natural blink duration from rest buffer if available
    let naturalBlinkDurationMs = 250;
    const blinkSamples = buffer.blink || [];
    if (blinkSamples.length > 0) {
      // Find continuous episodes of blink > 0.5
      let maxDurationFrames = 0;
      let curFrames = 0;
      for (const val of blinkSamples) {
        if (val > 0.4) {
          curFrames++;
          if (curFrames > maxDurationFrames) maxDurationFrames = curFrames;
        } else {
          curFrames = 0;
        }
      }
      if (maxDurationFrames > 0) {
        naturalBlinkDurationMs = Math.round(maxDurationFrames * 33); // ~33ms per frame
      }
    }

    set({
      restBaseline: baseline as Record<SignalName, SignalSummaryStats>,
      isRecordingRest: false,
      restProgress: 1,
      naturalBlinkDurationMs,
    });
  },

  addRomSample: (x, y) => {
    set((state) => ({
      romSamples: [...state.romSamples, { x, y }],
    }));
  },

  advanceRomTarget: () => {
    const nextRom = get().romStep + 1;
    set({ romStep: nextRom });
    if (nextRom >= get().romTargets.length) {
      get().finalizeRom();
    }
  },

  finalizeRom: () => {
    const samples = get().romSamples;
    if (samples.length === 0) {
      // Default identity mapping
      set({
        cursorMapping: { gainX: 1.0, gainY: 1.0, offsetX: 0.5, offsetY: 0.5 },
      });
      return;
    }

    const xs = samples.map((s) => s.x);
    const ys = samples.map((s) => s.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Range with 10% safety margin
    const rangeX = Math.max(maxX - minX, 0.05);
    const rangeY = Math.max(maxY - minY, 0.05);

    // Linear gain mapping to span 0..1 screen coordinates
    // gain = 1 / (range * 0.9) to make slight movements comfortable
    const gainX = Number((1.0 / (rangeX * 0.9)).toFixed(2));
    const gainY = Number((1.0 / (rangeY * 0.9)).toFixed(2));

    const offsetX = Number(((minX + maxX) / 2).toFixed(3));
    const offsetY = Number(((minY + maxY) / 2).toFixed(3));

    set({
      cursorMapping: {
        gainX: Math.max(1.0, Math.min(gainX, 4.0)),
        gainY: Math.max(1.0, Math.min(gainY, 4.0)),
        offsetX,
        offsetY,
      },
    });
  },

  recordGestureRepetition: (command, rep) => {
    set((state) => {
      const currentReps = state.gestureReps[command] || [];
      return {
        gestureReps: {
          ...state.gestureReps,
          [command]: [...currentReps, rep],
        },
      };
    });
  },

  reRecordCommand: (command) => {
    set((state) => ({
      gestureReps: {
        ...state.gestureReps,
        [command]: [],
      },
    }));
  },

  computeAllThresholds: () => {
    const { restBaseline, restBuffer, selectedGestures, gestureReps, naturalBlinkDurationMs } = get();
    if (!restBaseline) return;

    const commands: CommandName[] = ['select', 'grab', 'pause'];
    const bindings: Partial<Record<CommandName, CommandBinding>> = {};

    for (const cmd of commands) {
      const gesture = selectedGestures[cmd];
      const stats = restBaseline[gesture.signal];
      const reps = gestureReps[cmd] || [];
      const restSamples = restBuffer[gesture.signal] || [];

      const thresholdResult = computeThresholds(
        stats,
        gesture.direction,
        reps,
        gesture.signal,
        naturalBlinkDurationMs
      );
      const separabilityResult = computeSeparability(
        stats,
        restSamples,
        gesture.direction,
        reps,
        thresholdResult.enter
      );

      bindings[cmd] = {
        signal: gesture.signal,
        direction: gesture.direction,
        enter: Number(thresholdResult.enter.toFixed(3)),
        exit: Number(thresholdResult.exit.toFixed(3)),
        minHoldMs: thresholdResult.minHoldMs,
        cooldownMs: thresholdResult.cooldownMs,
        separability: {
          dPrime: separabilityResult.dPrime,
          overlap: separabilityResult.overlap,
          rating: separabilityResult.rating,
        },
      };
    }

    set({
      calibratedBindings: bindings as Record<CommandName, CommandBinding>,
    });
  },

  saveCalibratedProfile: async () => {
    const {
      learnerName,
      inputMode,
      cursorMapping,
      restBaseline,
      calibratedBindings,
      gazeModel,
      largeTargetMode,
      dwellSelectionEnabled,
      dwellTimeMs,
    } = get();

    const profile: LearnerProfile = {
      id: 'prof_' + Math.random().toString(36).substring(2, 9),
      name: learnerName.trim() || 'Learner',
      mode: inputMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 2,
      cursorMapping: cursorMapping ?? {
        gainX: 1.5,
        gainY: 1.5,
        offsetX: 0.5,
        offsetY: 0.5,
      },
      restBaseline: restBaseline ?? ({} as any),
      commands: calibratedBindings!,
      gaze: gazeModel ?? undefined,
      largeTargetMode,
      dwellSelectionEnabled,
      dwellTimeMs,
    };

    await saveProfile(profile);
    setActiveProfileId(profile.id);

    set({ savedProfileId: profile.id, currentStep: 'saved' });
    return profile;
  },

  resetWizard: () => {
    set({
      currentStep: 'mode_and_name',
      restProgress: 0,
      isRecordingRest: false,
      restBuffer: {
        headX: [],
        headY: [],
        headRoll: [],
        jawOpen: [],
        browRaise: [],
        blink: [],
        handX: [],
        handY: [],
        pinch: [],
        openPalm: [],
        gazeX: [],
        gazeY: [],
        irisDistL: [],
        irisDistR: [],
        eyeOpenness: [],
      },
      restBaseline: null,
      romStep: 0,
      romSamples: [],
      cursorMapping: null,
      activeSamplingCommand: 'select',
      gestureReps: { select: [], grab: [], pause: [] },
      calibratedBindings: null,
      savedProfileId: null,
    });
  },
}));
