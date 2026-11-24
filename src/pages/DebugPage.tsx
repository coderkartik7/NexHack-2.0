import React, { useState } from 'react';
import { CameraView } from '../components/CameraView';
import { DebugPanel } from '../components/DebugPanel';
import { SignalChart } from '../components/SignalChart';
import { IntentDebugOverlay } from '../components/IntentDebugOverlay';
import { usePipelineStore } from '../vision/pipeline';
import type { SignalName } from '../types/signals';

export const DebugPage: React.FC = () => {
  const { currentFrame, inputMode } = usePipelineStore();
  const [showLandmarks, setShowLandmarks] = useState(true);

  const headSignalList: { key: SignalName; label: string; min: number; max: number; unit?: string }[] = [
    { key: 'headX', label: 'Head X (Yaw)', min: -0.6, max: 0.6, unit: 'norm' },
    { key: 'headY', label: 'Head Y (Pitch)', min: -0.6, max: 0.6, unit: 'norm' },
    { key: 'headRoll', label: 'Head Roll', min: -0.5, max: 0.5, unit: 'rad' },
    { key: 'jawOpen', label: 'Jaw Opening', min: 0.0, max: 0.8, unit: 'score' },
    { key: 'browRaise', label: 'Inner Brow Raise', min: 0.0, max: 0.8, unit: 'score' },
    { key: 'blink', label: 'Blink Average', min: 0.0, max: 1.0, unit: 'score' },
  ];

  const handSignalList: { key: SignalName; label: string; min: number; max: number; unit?: string }[] = [
    { key: 'handX', label: 'Index Fingertip X', min: 0.0, max: 1.0, unit: 'norm' },
    { key: 'handY', label: 'Index Fingertip Y', min: 0.0, max: 1.0, unit: 'norm' },
    { key: 'pinch', label: 'Thumb-Index Aperture', min: 0.0, max: 1.2, unit: 'ratio' },
    { key: 'openPalm', label: 'Palm Extension Span', min: 0.6, max: 2.0, unit: 'ratio' },
  ];

  const activeSignalList = inputMode === 'head' ? headSignalList : handSignalList;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Vision Stream Telemetry</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time biometric landmarking, distance-normalized geometry, and 1€ adaptive filtering
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-md select-none transition-colors">
            <input
              type="checkbox"
              checked={showLandmarks}
              onChange={(e) => setShowLandmarks(e.target.checked)}
              className="rounded-sm accent-teal-500 text-teal-600 focus:ring-0"
            />
            Show Reticle Overlay
          </label>
        </div>
      </div>

      {/* Main Grid: Camera feed + Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CameraView showLandmarks={showLandmarks} />
        <DebugPanel />
      </div>

      {/* Phase 3 Intent Engine Diagnostics & Simulation Overlay */}
      <IntentDebugOverlay />

      {/* Live Rolling Waveforms (10s buffer) */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Rolling Signal Waveforms (10-Second Window)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Channel: <span className="text-teal-400 uppercase font-medium">{inputMode}</span> Mode
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSignalList.map((sig) => (
            <SignalChart
              key={sig.key}
              label={sig.label}
              value={currentFrame?.signals[sig.key] ?? null}
              min={sig.min}
              max={sig.max}
              unit={sig.unit}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
