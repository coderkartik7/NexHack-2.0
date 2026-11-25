import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PLANT_CELL_LESSON } from '../lesson/lessonData';
import {
  LessonStore,
  createSelectOptionAction,
  createPlaceLabelAction,
  type LessonState,
} from '../lesson/lessonStore';
import { TargetResolver, type TargetRect } from '../lesson/targeting';
import { ScrollController } from '../lesson/scrollZones';
import { IntentEngine } from '../intent/engine';
import { IntentCursor } from '../intent/cursor';
import { GazeCursor } from '../gaze/gazeCursor';
import { commandBus } from '../intent/bus';
import { LiveSource } from '../sim/liveSource';
import { MouseSim } from '../sim/mouseSim';
import type { SignalSource } from '../sim/signalSource';
import { listProfiles, getActiveProfileId } from '../storage/profiles';
import { EventLogger } from '../logging/eventLog';
import { db } from '../storage/db';
import type { LearnerProfile } from '../calibration/types';
import { createTargetResolverForProfile } from '../lesson/targeting';
import { GazeDebugOverlay } from './GazeDebugOverlay';
import { visionPipeline, usePipelineStore } from '../vision/pipeline';
import { computeInputStatus } from '../pipeline/statusSelector';
import { PipelineHealthProbe } from './PipelineHealthProbe';

import { QuestionCard } from './QuestionCard';
import { DiagramPanel } from './DiagramPanel';
import { DraggableLabel } from './DraggableLabel';
import { GestureCursor } from './GestureCursor';
import { StatusChip } from './StatusChip';
import { Toasts, type ToastMessage } from './Toasts';
import { ScrollZones } from './ScrollZones';

import { RotateCcw, Download, AlertCircle, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface LessonPageProps {
  onNavigateToCalibration?: () => void;
  onNavigateToProfiles?: () => void;
}

export const LessonPage: React.FC<LessonPageProps> = ({
  onNavigateToCalibration,
  onNavigateToProfiles,
}) => {
  // 1. Core Profile & Sources
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [sourceType, setSourceType] = useState<'live' | 'mouse_sim' | 'replay'>('live');
  const [_isRestTestMode] = useState(false);

  // 2. Lesson Store State
  const lessonStoreRef = useRef<LessonStore>(new LessonStore());
  const [lessonState, setLessonState] = useState<LessonState>(lessonStoreRef.current.getState());

  // 3. Engine, Cursor & Event Logger
  const engineRef = useRef<IntentEngine | null>(null);
  const cursorRef = useRef<IntentCursor | null>(null);
  const gazeCursorRef = useRef<GazeCursor | null>(null);
  const loggerRef = useRef<EventLogger>(new EventLogger());
  const sourceRef = useRef<SignalSource | null>(null);
  const targetResolverRef = useRef<TargetResolver>(new TargetResolver());
  const scrollControllerRef = useRef<ScrollController>(new ScrollController());

  // Diagnostics & Watchdog
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [engineFrameCount, setEngineFrameCount] = useState(0);
  const engineFrameCountRef = useRef(0);
  const [_lastFrameTime, _setLastFrameTime] = useState(performance.now());
  const lastFrameTimeRef = useRef(performance.now());
  const [stallWarning, setStallWarning] = useState<string | null>(null);

  // Gaze HUD & Dwell Selection state
  const [showGazeHud, setShowGazeHud] = useState(false);
  const dwellHoverTargetRef = useRef<{ id: string; startT: number } | null>(null);

  // 4. Cursor & Interaction Live State
  const [cursorPos, setCursorPos] = useState({ x: 500, y: 400 });
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [snapZoneId, setSnapZoneId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isTrackingLost, setIsTrackingLost] = useState(false);
  const [candidateProgress, setCandidateProgress] = useState(0);
  const [candidateCommand, setCandidateCommand] = useState<string | null>(null);
  const [lastGestureRecognized, setLastGestureRecognized] = useState<string | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabbedLabelId, setGrabbedLabelId] = useState<string | null>(null);

  // 5. Scroll State & Toasts
  const [topDwellProgress, setTopDwellProgress] = useState(0);
  const [bottomDwellProgress, setBottomDwellProgress] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const playCueSound = useCallback((type: 'fire' | 'grab' | 'complete') => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'fire') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'grab') {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'complete') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [isMuted]);

  // Load active profile from storage
  useEffect(() => {
    (async () => {
      const profiles = await listProfiles();
      const activeId = getActiveProfileId();
      const current = profiles.find((p) => p.id === activeId) || profiles[0] || null;
      if (current) {
        setProfile(current);
        loggerRef.current.setProfileId(current.id);
        usePipelineStore.getState().setInputMode(current.mode);
      }
      setHasLoadedProfile(true);
    })();
  }, []);

  // Subscribe to Lesson Store
  useEffect(() => {
    const unsub = lessonStoreRef.current.subscribe((state) => {
      setLessonState(state);
    });
    return () => unsub();
  }, []);

  // Initialize IntentEngine & IntentCursor / GazeCursor
  useEffect(() => {
    if (!profile) return;

    // Automatically synchronize pipeline inputMode with active profile
    usePipelineStore.getState().setInputMode(profile.mode);

    const engine = new IntentEngine(commandBus, profile);
    engineRef.current = engine;

    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const h = typeof window !== 'undefined' ? window.innerHeight : 768;

    if (profile.mode === 'eye') {
      gazeCursorRef.current = new GazeCursor({ viewportWidth: w, viewportHeight: h }, profile);
      cursorRef.current = null;
    } else {
      cursorRef.current = new IntentCursor({ viewportWidth: w, viewportHeight: h }, profile);
      gazeCursorRef.current = null;
    }

    targetResolverRef.current = createTargetResolverForProfile(profile);

    // Window resize handler
    const handleResize = () => {
      cursorRef.current?.setViewport(window.innerWidth, window.innerHeight);
      gazeCursorRef.current?.setViewport(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [profile]);

  // Watchdog: detect frame stall > 1.0s and update engine frames/sec
  useEffect(() => {
    const interval = setInterval(() => {
      setEngineFrameCount(engineFrameCountRef.current);
      engineFrameCountRef.current = 0;

      const elapsedSinceFrame = performance.now() - lastFrameTimeRef.current;
      if (sourceRef.current?.isActive() && elapsedSinceFrame > 1000) {
        const mode = profile?.mode ?? 'head';
        const isLive = sourceType === 'live';
        if (isLive) {
          const streaming = usePipelineStore.getState().isStreaming;
          if (!streaming) {
            setStallWarning('Camera stopped / initializing');
          } else {
            setStallWarning(mode === 'head' ? 'No face detected in camera' : mode === 'eye' ? 'Eyes not detected' : 'No hand detected in camera');
          }
        } else {
          setStallWarning('Input source stalled');
        }
      } else {
        setStallWarning(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [profile, sourceType]);

  // Keyboard fallbacks (Space for pause, Ctrl+Z / Backspace for Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if ((e.ctrlKey && e.key.toLowerCase() === 'z') || e.key === 'Backspace') {
        if (!e.repeat) {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Query and measure target bounding rectangles in DOM
  const collectTargetRects = useCallback((): TargetRect[] => {
    if (typeof document === 'undefined') return [];
    const elements = document.querySelectorAll('[id^="target_"], [id^="btn_"]');
    const rects: TargetRect[] = [];
    elements.forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) {
        rects.push({
          id: el.id,
          type: el.id.startsWith('target_zone')
            ? 'drop_zone'
            : el.id.startsWith('target_label')
            ? 'label'
            : el.id.startsWith('target_opt')
            ? 'option'
            : el.id.startsWith('btn_scroll')
            ? 'scroll'
            : 'button',
          x: b.left,
          y: b.top,
          width: b.width,
          height: b.height,
        });
      }
    });
    return rects;
  }, []);

  // Command Bus Event Handlers
  useEffect(() => {
    const unsubscribe = commandBus.subscribe((ev) => {
      if (ev.type === 'candidate_progress') {
        setCandidateCommand(ev.progress > 0 ? ev.command : null);
        setCandidateProgress(ev.progress);
      } else if (ev.type === 'pause.toggle') {
        const nextPaused = engineRef.current ? engineRef.current.getIsPaused() : !isPaused;
        setIsPaused(nextPaused);
        if (nextPaused) {
          if (grabbedLabelId) {
            lessonStoreRef.current.cancelDrag();
            setIsGrabbing(false);
            setGrabbedLabelId(null);
            loggerRef.current.log('drag_cancelled', { target: grabbedLabelId });
            addToast('Tracking paused: Drag cancelled', 'warning');
          }
          loggerRef.current.log('pause');
        } else {
          loggerRef.current.log('resume');
        }
      } else if (ev.type === 'tracking_lost') {
        setIsTrackingLost(true);
        if (grabbedLabelId) {
          lessonStoreRef.current.cancelDrag();
          setIsGrabbing(false);
          setGrabbedLabelId(null);
          loggerRef.current.log('drag_cancelled', { target: grabbedLabelId });
          addToast('Tracking lost: Item returned to tray', 'warning');
        }
        loggerRef.current.log('tracking_lost');
      } else if (ev.type === 'tracking_restored') {
        setIsTrackingLost(false);
        loggerRef.current.log('tracking_restored');
      } else if (ev.type === 'select.fire') {
        setLastGestureRecognized('Select');
        playCueSound('fire');
        setTimeout(() => setLastGestureRecognized(null), 1200);

        loggerRef.current.log('command_executed', {
          command: 'select',
          gestureOnsetT: ev.onsetT,
          executedT: ev.executedT,
        });

        // Trigger action on hovered target
        const currentHovered = hoveredTargetId;
        if (currentHovered) {
          handleSelectAction(currentHovered);
        }
      } else if (ev.type === 'grab.start') {
        setLastGestureRecognized('Grab');
        playCueSound('grab');
        setTimeout(() => setLastGestureRecognized(null), 1200);

        loggerRef.current.log('command_executed', {
          command: 'grab',
          gestureOnsetT: ev.onsetT,
          executedT: ev.executedT,
        });

        // If hovering an unplaced label, pick it up
        const currentHovered = hoveredTargetId;
        if (currentHovered && currentHovered.startsWith('target_label_')) {
          const labelId = currentHovered.replace('target_', '');
          setIsGrabbing(true);
          setGrabbedLabelId(labelId);
          lessonStoreRef.current.setDragging(labelId, cursorPos);
          addToast(`Holding ${labelId.replace('label_', '').replace(/_/g, ' ')}`, 'info');
        }
      } else if (ev.type === 'grab.end') {
        // Release drop
        if (grabbedLabelId) {
          handleDropAction(grabbedLabelId, ev.reason);
        }
      }
    });

    return () => unsubscribe();
  }, [hoveredTargetId, grabbedLabelId, cursorPos, isPaused, playCueSound, addToast]);

  // Wire SignalSource stream to Intent Engine & Cursor
  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
    }

    let source: SignalSource;
    if (sourceType === 'mouse_sim') {
      source = new MouseSim(profile);
    } else {
      source = new LiveSource();
    }
    sourceRef.current = source;
    loggerRef.current.setSource(sourceType);

    const unsub = source.subscribe((frame) => {
      lastFrameTimeRef.current = performance.now();
      engineFrameCountRef.current++;

      // 1. Process in engine
      if (engineRef.current) {
        engineRef.current.processFrame(frame);
      }

      // 2. Update Cursor (head/hand IntentCursor OR eye GazeCursor)
      if (engineRef.current) {
        const machines = engineRef.current.getMachineContexts();
        let cursorScreenX = 512;
        let cursorScreenY = 384;

        if (profile?.mode === 'eye' && gazeCursorRef.current) {
          const gazeFeat = (visionPipeline as any).latestGazeResult?.features ?? null;
          const gState = gazeCursorRef.current.update(gazeFeat, frame, machines, frame.t);
          cursorScreenX = gState.screenX;
          cursorScreenY = gState.screenY;
        } else if (cursorRef.current) {
          const cState = cursorRef.current.update(frame, machines, frame.t);
          cursorScreenX = cState.screenX;
          cursorScreenY = cState.screenY;
        }

        // 3. Resolve Targeting
        const targets = collectTargetRects();
        const res = targetResolverRef.current.resolveTarget(
          cursorScreenX,
          cursorScreenY,
          targets
        );

        setCursorPos({ x: res.cursorDisplayX, y: res.cursorDisplayY });
        setHoveredTargetId(res.hoveredTargetId);

        // Optional Dwell Selection
        if (profile?.mode === 'eye' && profile.dwellSelectionEnabled && res.hoveredTargetId) {
          if (!dwellHoverTargetRef.current || dwellHoverTargetRef.current.id !== res.hoveredTargetId) {
            dwellHoverTargetRef.current = { id: res.hoveredTargetId, startT: frame.t };
          } else {
            const dwellLimit = profile.dwellTimeMs || 1000;
            const elapsed = frame.t - dwellHoverTargetRef.current.startT;
            if (elapsed >= dwellLimit) {
              dwellHoverTargetRef.current = null;
              commandBus.publish({
                type: 'select.fire',
                onsetT: frame.t - dwellLimit,
                executedT: frame.t,
                source: 'dwell',
              });
            }
          }
        } else {
          dwellHoverTargetRef.current = null;
        }

        // If dragging a label, check drop zone snapping
        if (grabbedLabelId) {
          lessonStoreRef.current.setDragging(grabbedLabelId, {
            x: res.cursorDisplayX,
            y: res.cursorDisplayY,
          });
          const dropZones = targets.filter((t) => t.type === 'drop_zone');
          const snap = targetResolverRef.current.findSnapZone(
            res.cursorDisplayX,
            res.cursorDisplayY,
            dropZones
          );
          setSnapZoneId(snap ? snap.id.replace('target_', '') : null);
        }

        // 4. Scroll Zone Evaluation
        const scrollDec = scrollControllerRef.current.evaluate(
          cursorScreenY,
          window.innerHeight || 800,
          frame.t,
          engineRef.current.getIsPaused()
        );

        setTopDwellProgress(scrollDec.inBand === 'top' ? scrollDec.dwellProgress : 0);
        setBottomDwellProgress(scrollDec.inBand === 'bottom' ? scrollDec.dwellProgress : 0);

        if (scrollDec.shouldScroll && scrollDec.deltaY !== 0) {
          window.scrollBy({ top: scrollDec.deltaY, behavior: 'instant' });
        }
      }
    });

    source.start().catch(console.error);

    return () => {
      unsub();
      source.stop();
    };
  }, [sourceType, profile, grabbedLabelId, collectTargetRects]);

  // Action: Select target triggered
  const handleSelectAction = (targetId: string) => {
    const now = performance.now();

    if (targetId.startsWith('target_opt_')) {
      const optId = targetId.replace('target_', '');
      const action = createSelectOptionAction(optId, now);
      lessonStoreRef.current.execute(action);

      const opt = PLANT_CELL_LESSON.question.options.find((o) => o.id === optId);
      loggerRef.current.log('answer_attempt', {
        target: optId,
        correct: opt?.isCorrect,
      });

      if (opt?.isCorrect) {
        addToast('Correct answer selected!', 'success');
        if (lessonStoreRef.current.getState().isCompleted) {
          playCueSound('complete');
          loggerRef.current.log('task_complete');
        }
      } else {
        addToast('Incorrect. You can try again or undo.', 'warning');
      }
    } else if (targetId === 'btn_pause_toggle') {
      togglePause();
    } else if (targetId === 'btn_undo_action') {
      handleUndo();
    } else if (targetId === 'btn_toggle_mute') {
      setIsMuted((prev) => !prev);
    } else if (targetId === 'btn_recalibrate') {
      onNavigateToCalibration?.();
    } else if (targetId === 'btn_switch_profile') {
      onNavigateToProfiles?.();
    } else if (targetId === 'btn_scroll_up') {
      window.scrollBy({ top: -350, behavior: 'smooth' });
    } else if (targetId === 'btn_scroll_down') {
      window.scrollBy({ top: 350, behavior: 'smooth' });
    }
  };

  // Action: Drop label triggered
  const handleDropAction = (labelId: string, reason: 'natural' | 'tracking_lost') => {
    setIsGrabbing(false);
    setGrabbedLabelId(null);

    if (reason === 'tracking_lost') {
      lessonStoreRef.current.cancelDrag();
      loggerRef.current.log('drag_cancelled', { target: labelId });
      addToast('Tracking interrupted: label returned', 'warning');
      return;
    }

    const currentSnap = snapZoneId;
    const now = performance.now();

    if (currentSnap) {
      const action = createPlaceLabelAction(labelId, currentSnap, now);
      lessonStoreRef.current.execute(action);

      const label = PLANT_CELL_LESSON.diagram.labels.find((l) => l.id === labelId);
      const isCorrect = label?.correctZoneId === currentSnap;

      loggerRef.current.log('label_drop', {
        target: `${labelId}->${currentSnap}`,
        correct: isCorrect,
      });

      if (isCorrect) {
        addToast(`Correct! Placed in ${currentSnap.replace('zone_', '')}`, 'success');
        if (lessonStoreRef.current.getState().isCompleted) {
          playCueSound('complete');
          loggerRef.current.log('task_complete');
        }
      } else {
        addToast('Placed in wrong zone. You can undo or move it.', 'warning');
      }
    } else {
      lessonStoreRef.current.cancelDrag();
      addToast('Dropped outside zone: returned to tray', 'info');
    }
    setSnapZoneId(null);
  };

  const togglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleUndo = () => {
    if (lessonStoreRef.current.canUndo()) {
      const action = lessonStoreRef.current.undo();
      loggerRef.current.log('undo', { target: action?.type });
      loggerRef.current.flagLastActionUndone();
      addToast(`Undone: ${action?.description ?? 'Action'}`, 'info');
    }
  };

  const handleDownloadSession = async () => {
    const jsonStr = loggerRef.current.exportJson();
    try {
      await db.sessions.put({
        id: loggerRef.current.getSessionId(),
        profileId: profile?.id ?? 'default_learner',
        startedAt: Date.now(),
        source: sourceType,
        mode: loggerRef.current.getMode(),
        events: loggerRef.current.getEvents(),
      });
    } catch (e) {
      console.error('Failed to save session to Dexie:', e);
    }

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesturelearn-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetLesson = () => {
    lessonStoreRef.current = new LessonStore();
    setLessonState(lessonStoreRef.current.getState());
    addToast('Lesson activity reset', 'info');
  };

  // Compute live input status
  const pipelineStore = usePipelineStore();
  const inputStatus = computeInputStatus({
    sourceAlive: sourceRef.current?.isActive() ?? false,
    sourceId: sourceType,
    isStreaming: pipelineStore.isStreaming,
    fps: pipelineStore.fps,
    profile,
    qualityFace: pipelineStore.currentFrame?.quality.face ?? 0,
    qualityHand: pipelineStore.currentFrame?.quality.hand ?? 0,
    qualityEye: pipelineStore.currentFrame?.quality.eye,
    isPaused,
    trackingLostSinceT: engineRef.current?.trackingLostSinceT ?? null,
  });

  // If no profile found after DB lookup, show blocking plain-language screen
  if (hasLoadedProfile && !profile) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">No Calibration Found</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The quiz requires a calibrated learner profile to translate your gestures and movements into cursor interactions.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigateToCalibration?.()}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors shadow-lg shadow-teal-600/20 inline-flex items-center gap-2"
          >
            <Sliders className="w-4 h-4" />
            <span>Calibrate Now</span>
          </button>
        </div>
      </div>
    );
  }

  const cursorDiagnostics = cursorRef.current?.getState() || {
    rawX: 0,
    rawY: 0,
    screenX: cursorPos.x,
    screenY: cursorPos.y,
    frozen: false,
  };

  return (
    <div className="relative min-h-[140vh] pb-32 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Visual Stall Banner if frames stop arriving > 1s */}
      {stallWarning && (
        <div className="bg-rose-950/90 border border-rose-600 text-rose-200 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Input frame stall detected: {stallWarning}</span>
          </div>
          {sourceType === 'live' && (
            <button
              onClick={() => {
                sourceRef.current?.start().catch(console.error);
              }}
              className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded text-xs font-mono font-bold"
            >
              Restart Pipeline
            </button>
          )}
        </div>
      )}

      {/* Input Blocked Notice if blocked */}
      {inputStatus.blockedReason && !stallWarning && (
        <div className="bg-amber-950/70 border border-amber-700/80 text-amber-200 px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Input Blocked: {inputStatus.blockedReason}</span>
        </div>
      )}

      {/* Top Telemetry & Control Bar */}
      <div className="sticky top-16 z-40 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <StatusChip
              isTrackingOk={inputStatus.isTrackingOk}
              isPaused={isPaused}
              lastGestureName={lastGestureRecognized}
              blockedReason={inputStatus.blockedReason}
              gazeRating={profile?.mode === 'eye' ? profile?.gaze?.validation?.meanErrorPx ? (profile.gaze.validation.meanErrorPx < 120 ? 'good' : profile.gaze.validation.meanErrorPx <= 200 ? 'fair' : 'poor') : 'fair' : null}
              gazeErrorPx={profile?.gaze?.validation?.meanErrorPx}
              onRecalibrate={() => onNavigateToCalibration?.()}
            />

            {profile?.mode === 'eye' && (
              <button
                onClick={() => setShowGazeHud((prev) => !prev)}
                className={`px-2 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                  showGazeHud
                    ? 'bg-teal-950 text-teal-300 border-teal-800'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Gaze HUD
              </button>
            )}

            {/* Toggle On-Screen Diagnostics */}
            <button
              onClick={() => setShowDiagnostics((prev) => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                showDiagnostics
                  ? 'bg-teal-950 text-teal-300 border-teal-800'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Probe</span>
              {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Signal Source Switcher */}
            <div className="flex bg-zinc-900 p-0.5 rounded-md border border-zinc-800 text-[11px] font-mono">
              <button
                onClick={() => setSourceType('live')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sourceType === 'live' ? 'bg-zinc-800 text-teal-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Live Camera
              </button>
              <button
                onClick={() => setSourceType('mouse_sim')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sourceType === 'mouse_sim' ? 'bg-zinc-800 text-teal-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Mouse Sim (J/K/L)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn_pause_toggle"
              onClick={togglePause}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                isPaused
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {isPaused ? 'Resume (Space)' : 'Pause (Space)'}
            </button>
            <button
              id="btn_undo_action"
              onClick={handleUndo}
              disabled={!lessonStoreRef.current.canUndo()}
              className="px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Undo (Ctrl+Z)
            </button>
            <button
              onClick={handleResetLesson}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
              title="Reset Lesson"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadSession}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
              title="Export Session Log"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Health Probe / Diagnostics Panel */}
        {showDiagnostics && (
          <PipelineHealthProbe
            defaultExpanded={true}
            enginePaused={isPaused}
            engineFrameCount={engineFrameCount}
            engineMachines={engineRef.current?.getMachineContexts()}
            cursorState={cursorDiagnostics}
            targetsCount={collectTargetRects().length}
            hoveredTargetId={hoveredTargetId}
            lastCommand={candidateCommand || lastGestureRecognized}
            activeProfile={profile}
          />
        )}
      </div>

      {/* Section 1: Question Understanding */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100">
            {PLANT_CELL_LESSON.title}
          </h1>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            {PLANT_CELL_LESSON.topic}
          </span>
        </div>

        <QuestionCard
          prompt={PLANT_CELL_LESSON.question.prompt}
          options={PLANT_CELL_LESSON.question.options}
          selectedOptionId={lessonState.selectedOptionId}
          isAnswered={lessonState.isQuestionAnswered}
          isCorrect={lessonState.isQuestionCorrect}
          onSelectOption={(optId) => handleSelectAction(`target_${optId}`)}
          hoveredTargetId={hoveredTargetId}
          largeLayout={profile?.mode === 'eye'}
        />
      </section>

      {/* Section 2: Below-the-Fold Diagram & Drop Zones (Requires scrolling) */}
      <section className="mt-8 flex flex-col gap-4 pt-6 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold block">
              Step 2: Anatomical Labeling
            </span>
            <h2 className="text-sm font-semibold text-zinc-100">
              {PLANT_CELL_LESSON.diagram.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {PLANT_CELL_LESSON.diagram.instructions}
            </p>
          </div>

          <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
            Dwell in top/bottom bands or use buttons on right to scroll.
          </div>
        </div>

        {/* Anatomical Diagram Panel with Drop Zones */}
        <DiagramPanel
          zones={PLANT_CELL_LESSON.diagram.zones}
          placements={lessonState.placements}
          placementResults={lessonState.placementResults}
          hoveredTargetId={hoveredTargetId}
          snapZoneId={snapZoneId}
        />

        {/* Label Tray */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2.5">
          <span className="text-[11px] font-mono uppercase text-zinc-400 tracking-wider font-semibold">
            Organelle Label Tray (Hover + Grab to Drag)
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {PLANT_CELL_LESSON.diagram.labels.map((lbl) => (
              <DraggableLabel
                key={lbl.id}
                label={lbl}
                isPlaced={lessonState.placements[lbl.id] !== null}
                isCorrect={lessonState.placementResults[lbl.id] ?? false}
                isDragging={grabbedLabelId === lbl.id}
                hoveredTargetId={hoveredTargetId}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Floating Scroll Zone Overlays & Manual Buttons */}
      <ScrollZones
        topDwellProgress={topDwellProgress}
        bottomDwellProgress={bottomDwellProgress}
        onScrollUpClick={() => window.scrollBy({ top: -350, behavior: 'smooth' })}
        onScrollDownClick={() => window.scrollBy({ top: 350, behavior: 'smooth' })}
        hoveredTargetId={hoveredTargetId}
      />

      {/* Dynamic Gesture Cursor */}
      <GestureCursor
        x={cursorPos.x}
        y={cursorPos.y}
        isHovering={!!hoveredTargetId}
        isGrabbing={isGrabbing}
        isPaused={isPaused}
        isTrackingLost={isTrackingLost}
        candidateCommand={candidateCommand}
        candidateProgress={candidateProgress}
        actionLabel={
          hoveredTargetId?.startsWith('target_label')
            ? 'Hold Grab'
            : hoveredTargetId?.startsWith('target_opt')
            ? 'Hold Select'
            : hoveredTargetId?.startsWith('btn_')
            ? 'Hold Select'
            : null
        }
      />

      {/* Toast Notifications */}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Gaze Debug Overlay */}
      <GazeDebugOverlay
        cursor={gazeCursorRef.current}
        gazeResult={(visionPipeline as any).latestGazeResult ?? null}
        isOpen={showGazeHud}
        onClose={() => setShowGazeHud(false)}
        onRecenter={() => {
          gazeCursorRef.current?.getDriftCorrector().reset();
          addToast('Gaze drift offset re-centered to (0,0)', 'info');
        }}
      />
    </div>
  );
};
