import React from 'react';
import { usePipelineStore } from '../vision/pipeline';
import { Activity, Gauge, Eye, Hand } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  const { currentFrame, fps, inputMode, setInputMode } = usePipelineStore();

  const signals: Partial<Record<string, number | null>> = currentFrame?.signals ?? {};
  const quality = currentFrame?.quality ?? { face: 0, hand: 0 };

  const headSignalKeys = [
    { key: 'headX', label: 'Head X (Yaw / Center)', min: -1.0, max: 1.0 },
    { key: 'headY', label: 'Head Y (Pitch)', min: -1.0, max: 1.0 },
    { key: 'headRoll', label: 'Head Roll (Angle)', min: -0.8, max: 0.8 },
    { key: 'jawOpen', label: 'Jaw Open (Blendshape)', min: 0.0, max: 1.0 },
    { key: 'browRaise', label: 'Brow Raise (browInnerUp)', min: 0.0, max: 1.0 },
    { key: 'blink', label: 'Blink (Mean eyes)', min: 0.0, max: 1.0 },
  ] as const;

  const handSignalKeys = [
    { key: 'handX', label: 'Hand X (Cursor)', min: 0.0, max: 1.0 },
    { key: 'handY', label: 'Hand Y (Cursor)', min: 0.0, max: 1.0 },
    { key: 'pinch', label: 'Pinch Distance (Ratio)', min: 0.0, max: 1.5 },
    { key: 'openPalm', label: 'Open Palm (Ratio)', min: 0.5, max: 2.2 },
  ] as const;

  const activeSignals = inputMode === 'head' ? headSignalKeys : handSignalKeys;
  const currentQuality = inputMode === 'head' ? quality.face : quality.hand;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Signal Stream Monitor
          </h2>
          <p className="text-xs text-slate-400">
            Real-time normalized values filtered with 1€ filter
          </p>
        </div>

        {/* Input Mode Selector */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setInputMode('head')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              inputMode === 'head'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            Head Tracking
          </button>
          <button
            onClick={() => setInputMode('hand')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              inputMode === 'hand'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
            Hand Tracking
          </button>
        </div>
      </div>

      {/* Performance & Quality Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <Gauge className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Pipeline FPS
            </div>
            <div className="text-lg font-black font-mono text-white">
              {fps}{' '}
              <span className="text-xs font-normal text-slate-400">fps</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full animate-pulse ${
              currentQuality > 0.5
                ? 'bg-emerald-500'
                : currentQuality > 0.2
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
          />
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Tracking Quality
            </div>
            <div className="text-lg font-black font-mono text-white">
              {(currentQuality * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            Status
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">
            {currentQuality >= 0.3 ? 'Tracking Active' : 'Subject Lost / Low'}
          </div>
        </div>
      </div>

      {/* Numeric Readouts */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Active Mode Signals ({inputMode.toUpperCase()})
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {activeSignals.map((sig) => {
            const rawVal = signals[sig.key];
            const hasVal = typeof rawVal === 'number';
            return (
              <div
                key={sig.key}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 flex items-center justify-between"
              >
                <div className="truncate mr-2">
                  <span className="text-xs font-semibold text-slate-300 block truncate">
                    {sig.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {sig.key}
                  </span>
                </div>
                <span
                  className={`font-mono text-sm font-bold ${
                    hasVal ? 'text-cyan-400' : 'text-slate-600'
                  }`}
                >
                  {hasVal ? rawVal.toFixed(3) : 'null'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
