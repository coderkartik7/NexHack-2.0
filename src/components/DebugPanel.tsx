import React from 'react';
import { usePipelineStore } from '../vision/pipeline';
import { Activity, Gauge, Eye, Hand } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  const { currentFrame, fps, inputMode, setInputMode } = usePipelineStore();

  const signals: Partial<Record<string, number | null>> = currentFrame?.signals ?? {};
  const quality = currentFrame?.quality ?? { face: 0, hand: 0 };

  const headSignalKeys = [
    { key: 'headX', label: 'Head Yaw (Normalized)', range: '[-1.0, 1.0]' },
    { key: 'headY', label: 'Head Pitch (Normalized)', range: '[-1.0, 1.0]' },
    { key: 'headRoll', label: 'Head Roll (Radians)', range: '[-0.8, 0.8]' },
    { key: 'jawOpen', label: 'Jaw Aperture (Blendshape)', range: '[0.0, 1.0]' },
    { key: 'browRaise', label: 'Brow Elevation (Blendshape)', range: '[0.0, 1.0]' },
    { key: 'blink', label: 'Blink State (Average)', range: '[0.0, 1.0]' },
  ] as const;

  const handSignalKeys = [
    { key: 'handX', label: 'Cursor X (Index Tip)', range: '[0.0, 1.0]' },
    { key: 'handY', label: 'Cursor Y (Index Tip)', range: '[0.0, 1.0]' },
    { key: 'pinch', label: 'Pinch Distance Ratio', range: '[0.0, 1.5]' },
    { key: 'openPalm', label: 'Open Palm Span Ratio', range: '[0.5, 2.2]' },
  ] as const;

  const activeSignals = inputMode === 'head' ? headSignalKeys : handSignalKeys;
  const currentQuality = inputMode === 'head' ? quality.face : quality.hand;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 shadow-xs flex flex-col gap-4">
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Signal Stream Monitor
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Normalized geometry filtered with 1€ adaptive low-pass filter
          </p>
        </div>

        {/* Input Mode Selector */}
        <div className="flex bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
          <button
            onClick={() => setInputMode('head')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              inputMode === 'head'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            Head Mode
          </button>
          <button
            onClick={() => setInputMode('hand')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              inputMode === 'hand'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Hand className="w-3.5 h-3.5 text-teal-400" />
            Hand Mode
          </button>
        </div>
      </div>

      {/* Performance & Quality Telemetry Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-md p-2.5 flex items-center gap-2.5">
          <Gauge className="w-4 h-4 text-zinc-400" />
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              Framerate
            </div>
            <div className="text-sm font-semibold font-mono text-zinc-100">
              {fps} <span className="text-[11px] font-normal text-zinc-500">fps</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-md p-2.5 flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full ${
              currentQuality > 0.5
                ? 'bg-emerald-400'
                : currentQuality > 0.2
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              Confidence
            </div>
            <div className="text-sm font-semibold font-mono text-zinc-100">
              {(currentQuality * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-md p-2.5 col-span-2 sm:col-span-1 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-teal-400" />
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              Active Channel
            </div>
            <div className="text-sm font-semibold font-mono text-zinc-100 capitalize">
              {inputMode}
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Data Rows (Structured Table/Grid) */}
      <div className="border border-zinc-800/80 rounded-md overflow-hidden bg-zinc-950/40">
        <div className="grid grid-cols-12 px-3 py-1.5 bg-zinc-950 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          <span className="col-span-6">Signal</span>
          <span className="col-span-3 text-right">Raw Range</span>
          <span className="col-span-3 text-right">Value</span>
        </div>
        <div className="divide-y divide-zinc-900">
          {activeSignals.map((sig) => {
            const rawVal = signals[sig.key];
            const hasVal = typeof rawVal === 'number' && !isNaN(rawVal);
            return (
              <div
                key={sig.key}
                className="grid grid-cols-12 px-3 py-2 text-xs items-center hover:bg-zinc-900/40 transition-colors"
              >
                <div className="col-span-6 flex flex-col">
                  <span className="font-medium text-zinc-200">{sig.label}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{sig.key}</span>
                </div>
                <div className="col-span-3 text-right font-mono text-[11px] text-zinc-500">
                  {sig.range}
                </div>
                <div className="col-span-3 text-right font-mono font-medium">
                  {hasVal ? (
                    <span className="text-teal-400 bg-teal-950/40 border border-teal-900/50 px-1.5 py-0.5 rounded text-[11px]">
                      {rawVal.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-zinc-600 font-mono text-[11px]">&mdash;</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
