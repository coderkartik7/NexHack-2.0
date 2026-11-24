import React, { useState, useEffect, useRef } from 'react';
import type { LearnerProfile } from '../calibration/types';
import type { SignalSource } from '../sim/signalSource';
import { IntentEngine } from '../intent/engine';
import { CommandBus } from '../intent/bus';
import { RestSignalSampler, getPromptForElapsedSeconds } from '../eval/restTest';
import type { RestSignalSample } from '../eval/types';
import { RestTimeline } from './RestTimeline';
import { Clock, Play, Square } from 'lucide-react';

interface RestTestPanelProps {
  durationSeconds?: number;
  profile: LearnerProfile | null;
  source: SignalSource;
  onComplete: (samples: RestSignalSample[], falseActivations: { t: number; command: string }[]) => void;
  onAbort?: () => void;
}

export const RestTestPanel: React.FC<RestTestPanelProps> = ({
  durationSeconds = 60,
  profile,
  source,
  onComplete,
  onAbort,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [falseCount, setFalseCount] = useState(0);
  const [falseActivations, setFalseActivations] = useState<{ t: number; command: string }[]>([]);
  const [liveSamples, setLiveSamples] = useState<RestSignalSample[]>([]);

  const samplerRef = useRef<RestSignalSampler>(new RestSignalSampler());
  const engineRef = useRef<IntentEngine | null>(null);
  const busRef = useRef<CommandBus>(new CommandBus());
  const startWallTRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  // Initialize observer engine (passive monitoring)
  useEffect(() => {
    const bus = busRef.current;
    const engine = new IntentEngine(bus, profile);
    engineRef.current = engine;

    const unsub = bus.subscribe((ev) => {
      if (ev.type === 'select.fire' || ev.type === 'grab.start' || ev.type === 'pause.toggle') {
        const cmd = ev.type.split('.')[0];
        const relativeT = performance.now() - startWallTRef.current;
        setFalseCount((c) => c + 1);
        setFalseActivations((prev) => [...prev, { t: Math.round(relativeT), command: cmd }]);
      }
    });

    return () => unsub();
  }, [profile]);

  const startTest = () => {
    setIsRunning(true);
    setElapsedSec(0);
    setFalseCount(0);
    setFalseActivations([]);
    setLiveSamples([]);
    samplerRef.current.reset();
    startWallTRef.current = performance.now();

    // Source subscription
    const unsubSource = source.subscribe((frame) => {
      const relT = performance.now() - startWallTRef.current;
      // 1. Monitor in engine (emits false triggers if signal crosses enter + hold)
      engineRef.current?.processFrame(frame);
      // 2. Downsample for timeline plot
      samplerRef.current.sampleFrame(frame, relT);
      setLiveSamples(samplerRef.current.getSamples());
    });

    // Countdown interval
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.round((performance.now() - startWallTRef.current) / 1000);
      setElapsedSec(elapsed);

      if (elapsed >= durationSeconds) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        unsubSource();
        setIsRunning(false);
        onComplete(samplerRef.current.getSamples(), falseActivations);
      }
    }, 250);
  };

  const stopTest = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    onAbort?.();
  };

  const currentPrompt = getPromptForElapsedSeconds(elapsedSec);
  const remainingSec = Math.max(0, durationSeconds - elapsedSec);

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-5 flex flex-col gap-5 max-w-3xl mx-auto shadow-sm">
      {/* Top Countdown & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider font-semibold">
            Stage 4: Timed Resting Noise Protocol
          </span>
          <h2 className="text-base font-semibold text-zinc-100">
            {durationSeconds}-Second Resting Evaluation
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800 flex items-center gap-2 font-mono text-sm">
            <Clock className="w-4 h-4 text-teal-400" />
            <span className="text-zinc-100 font-semibold">{remainingSec}s</span>
            <span className="text-zinc-500 text-xs">remaining</span>
          </div>

          {!isRunning ? (
            <button
              onClick={startTest}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold rounded-md text-xs shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start {durationSeconds}s Rest Test</span>
            </button>
          ) : (
            <button
              onClick={stopTest}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-md text-xs font-semibold transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Abort Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Rotating Guided Behavior Prompt Banner */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-1.5 min-h-[90px]">
        <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
          Guided Protocol Cue (Rotates every 12s)
        </span>
        <p className="text-sm font-medium text-teal-200">
          {isRunning ? currentPrompt : 'Click "Start Rest Test" and follow natural behavioral prompts.'}
        </p>
      </div>

      {/* Running False Activation Counter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-950/70 border border-zinc-800 p-3 rounded-md flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-400">False Commands Fired:</span>
          <span
            className={`font-mono text-lg font-bold ${
              falseCount === 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {falseCount}
          </span>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800 p-3 rounded-md flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-400">Target Condition:</span>
          <span className="font-mono text-xs text-zinc-300">
            0 false fires (Rest &lt; Enter Thr)
          </span>
        </div>
      </div>

      {/* Live Rest Timeline */}
      <RestTimeline
        samples={liveSamples}
        profile={profile}
        falseActivations={falseActivations}
        durationMs={durationSeconds * 1000}
      />
    </div>
  );
};
