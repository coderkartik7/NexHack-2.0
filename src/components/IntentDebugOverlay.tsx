import React, { useState, useEffect, useRef } from 'react';
import { IntentEngine } from '../intent/engine';
import { commandBus } from '../intent/bus';
import { SignalRecorder, type RecordedTrace } from '../sim/recorder';
import { ReplaySource } from '../sim/replay';
import { MouseSim } from '../sim/mouseSim';
import { LiveSource } from '../sim/liveSource';
import type { SignalSource } from '../sim/signalSource';
import { listProfiles, getActiveProfileId } from '../storage/profiles';
import type { LearnerProfile, CommandName } from '../calibration/types';
import type { BusEvent, MachineContext } from '../intent/types';
import { Play, Square, Download, Upload, Cpu, MousePointer } from 'lucide-react';

export const IntentDebugOverlay: React.FC = () => {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [sourceType, setSourceType] = useState<'live' | 'mouse_sim' | 'replay'>('live');
  const [engineEvents, setEngineEvents] = useState<{ id: number; event: BusEvent; time: string }[]>([]);
  const [machineContexts, setMachineContexts] = useState<Record<CommandName, MachineContext> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const [lastTrace, setLastTrace] = useState<RecordedTrace | null>(null);
  const [isEnginePaused, setIsEnginePaused] = useState(false);

  const engineRef = useRef<IntentEngine | null>(null);
  const recorderRef = useRef<SignalRecorder>(new SignalRecorder());
  const sourceRef = useRef<SignalSource | null>(null);
  const nextEvIdRef = useRef(1);

  // Load active profile
  useEffect(() => {
    (async () => {
      const activeId = getActiveProfileId();
      const profiles = await listProfiles();
      const current = profiles.find((p) => p.id === activeId) || profiles[0] || null;
      if (current) {
        setProfile(current);
      }
    })();
  }, []);

  // Initialize IntentEngine & CommandBus subscription
  useEffect(() => {
    const engine = new IntentEngine(commandBus, profile);
    engineRef.current = engine;

    const unsubscribe = commandBus.subscribe((ev) => {
      setEngineEvents((prev) => [
        {
          id: nextEvIdRef.current++,
          event: ev,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 49),
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, [profile]);

  // Set up active SignalSource
  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
    }

    let source: SignalSource;
    if (sourceType === 'mouse_sim') {
      const sim = new MouseSim(profile);
      source = sim;
    } else if (sourceType === 'replay' && lastTrace) {
      const rep = new ReplaySource(lastTrace);
      source = rep;
    } else {
      source = new LiveSource();
    }

    sourceRef.current = source;
    const unsub = source.subscribe((frame) => {
      // Process frame through Intent Engine
      if (engineRef.current) {
        engineRef.current.processFrame(frame);
        setMachineContexts(engineRef.current.getMachineContexts());
      }
      // Record if active
      if (recorderRef.current.getIsRecording()) {
        recorderRef.current.record(frame);
        setRecordedCount(recorderRef.current.getFrameCount());
      }
    });

    source.start().catch(console.error);

    return () => {
      unsub();
      source.stop();
    };
  }, [sourceType, profile, lastTrace]);

  const toggleRecording = () => {
    if (isRecording) {
      const trace = recorderRef.current.stop();
      setIsRecording(false);
      setLastTrace(trace);
    } else {
      recorderRef.current.start();
      setIsRecording(true);
      setRecordedCount(0);
    }
  };

  const handleDownloadTrace = () => {
    if (!lastTrace) return;
    const blob = new Blob([JSON.stringify(lastTrace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesturelearn-trace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadTrace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text) as RecordedTrace;
        if (parsed.frames && Array.isArray(parsed.frames)) {
          setLastTrace(parsed);
          setSourceType('replay');
        }
      } catch {
        alert('Invalid trace JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
      {/* Header & Source Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Intent Engine & Signal Source</h2>
          <span className="text-[11px] font-mono text-zinc-500">
            Profile: <span className="text-zinc-300">{profile?.name ?? 'Default (No profile)'}</span>
          </span>
        </div>

        {/* Source Radio Buttons */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
          <button
            onClick={() => setSourceType('live')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              sourceType === 'live'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Live Camera
          </button>
          <button
            onClick={() => setSourceType('mouse_sim')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              sourceType === 'mouse_sim'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MousePointer className="w-3 h-3" /> Mouse Sim (J/K/L)
          </button>
          <button
            onClick={() => setSourceType('replay')}
            disabled={!lastTrace}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 ${
              sourceType === 'replay'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Replay Trace
          </button>
        </div>
      </div>

      {sourceType === 'mouse_sim' && (
        <div className="bg-teal-950/40 border border-teal-900/60 rounded-md p-2.5 text-xs text-teal-300 font-mono">
          &bull; Move cursor inside window to drive coordinates &middot; Hold <strong>J</strong> (Select) &middot; Hold <strong>K</strong> (Grab) &middot; Hold <strong>L</strong> (Pause)
        </div>
      )}

      {/* Trace Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/50 p-2.5 rounded-md border border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isRecording
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
          >
            {isRecording ? <Square className="w-3.5 h-3.5 text-rose-400" /> : <Play className="w-3.5 h-3.5" />}
            {isRecording ? `Stop Recording (${recordedCount} frames)` : 'Record 60s Trace'}
          </button>

          {lastTrace && (
            <button
              onClick={handleDownloadTrace}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download JSON ({lastTrace.frameCount}f)
            </button>
          )}

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-xs font-medium cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" /> Load Trace
            <input type="file" accept=".json" onChange={handleUploadTrace} className="hidden" />
          </label>
        </div>

        <button
          onClick={() => {
            const next = !isEnginePaused;
            engineRef.current?.setPaused(next);
            setIsEnginePaused(next);
          }}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-medium text-zinc-200 transition-colors"
        >
          {isEnginePaused ? 'Resume Engine' : 'Pause Engine'}
        </button>
      </div>

      {/* Machine State Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['select', 'grab', 'pause'] as const).map((cmd) => {
          const ctx = machineContexts?.[cmd];
          const binding = profile?.commands[cmd];
          const state = ctx?.state ?? 'IDLE';

          return (
            <div
              key={cmd}
              className={`p-3 rounded-md border flex flex-col justify-between ${
                state === 'ACTIVE'
                  ? 'border-emerald-500/80 bg-emerald-950/30'
                  : state === 'CANDIDATE'
                  ? 'border-amber-500/80 bg-amber-950/30'
                  : state === 'COOLDOWN'
                  ? 'border-rose-900/60 bg-zinc-950/60'
                  : 'border-zinc-800 bg-zinc-950/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-zinc-200 capitalize">{cmd}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                    state === 'ACTIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : state === 'CANDIDATE'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : state === 'COOLDOWN'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  {state}
                </span>
              </div>

              <div className="mt-2 text-[11px] font-mono text-zinc-400 space-y-0.5">
                <div>Signal: <span className="text-zinc-200">{binding?.signal ?? '--'}</span></div>
                <div>
                  Enter/Exit: <span className="text-zinc-200">{binding?.enter} / {binding?.exit}</span>
                </div>
                <div>Hold Target: <span className="text-zinc-200">{binding?.minHoldMs} ms</span></div>
              </div>

              {/* Candidate Progress Bar */}
              <div className="mt-2 w-full bg-zinc-900 rounded-full h-1.5 border border-zinc-800 overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-75"
                  style={{ width: `${Math.round((ctx?.lastProgress ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Dispatched Intent Event Stream */}
      <div className="border border-zinc-800/80 rounded-md bg-zinc-950/70 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-850 pb-1.5">
          <span className="font-medium text-zinc-300">Live Dispatched Intent Events</span>
          <span className="font-mono text-[10px] text-zinc-500">Last 50 events</span>
        </div>

        <div className="h-36 overflow-y-auto font-mono text-[11px] space-y-1 pr-1">
          {engineEvents.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-0.5 px-1.5 rounded bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-850/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-teal-400 font-semibold">{item.event.type}</span>
                <span className="text-zinc-400">{JSON.stringify(item.event)}</span>
              </div>
              <span className="text-[10px] text-zinc-600">{item.time}</span>
            </div>
          ))}
          {engineEvents.length === 0 && (
            <div className="text-zinc-600 text-center py-8">
              No gesture commands fired yet. Perform a calibrated gesture or hold J/K/L in Mouse Sim.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
