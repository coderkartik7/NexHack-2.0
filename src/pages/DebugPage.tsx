import React, { useState } from 'react';
import { CameraView } from '../components/CameraView';
import { DebugPanel } from '../components/DebugPanel';
import { SignalChart } from '../components/SignalChart';
import { usePipelineStore } from '../vision/pipeline';
import type { SignalName } from '../types/signals';

export const DebugPage: React.FC = () => {
  const { currentFrame, inputMode } = usePipelineStore();
  const [showLandmarks, setShowLandmarks] = useState(true);

  const headSignalList: { key: SignalName; label: string; min: number; max: number; color: string }[] = [
    { key: 'headX', label: 'Head X (Yaw)', min: -0.6, max: 0.6, color: '#38bdf8' },
    { key: 'headY', label: 'Head Y (Pitch)', min: -0.6, max: 0.6, color: '#818cf8' },
    { key: 'headRoll', label: 'Head Roll (Angle)', min: -0.5, max: 0.5, color: '#a78bfa' },
    { key: 'jawOpen', label: 'Jaw Open (Blendshape)', min: 0.0, max: 0.8, color: '#f43f5e' },
    { key: 'browRaise', label: 'Brow Raise (browInnerUp)', min: 0.0, max: 0.8, color: '#f59e0b' },
    { key: 'blink', label: 'Blink (Mean)', min: 0.0, max: 1.0, color: '#10b981' },
  ];

  const handSignalList: { key: SignalName; label: string; min: number; max: number; color: string }[] = [
    { key: 'handX', label: 'Hand X (Horizontal)', min: 0.0, max: 1.0, color: '#38bdf8' },
    { key: 'handY', label: 'Hand Y (Vertical)', min: 0.0, max: 1.0, color: '#818cf8' },
    { key: 'pinch', label: 'Pinch Distance (Ratio)', min: 0.0, max: 1.2, color: '#f43f5e' },
    { key: 'openPalm', label: 'Open Palm Distance (Ratio)', min: 0.6, max: 2.0, color: '#10b981' },
  ];

  const activeSignalList = inputMode === 'head' ? headSignalList : handSignalList;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Vision Pipeline Live Diagnostics</h1>
          <p className="text-sm text-slate-400">
            Real-time webcam tracking, distance-normalized signal extraction, and 1€ filtering
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg select-none">
            <input
              type="checkbox"
              checked={showLandmarks}
              onChange={(e) => setShowLandmarks(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            Show Landmarker Overlay
          </label>
        </div>
      </div>

      {/* Main Grid: Camera feed + Debug Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CameraView showLandmarks={showLandmarks} />
        <DebugPanel />
      </div>

      {/* Live Rolling Line Charts (10s buffer) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Live Signal History (Last 10 Seconds)</h2>
          <span className="text-xs text-slate-400">Showing {inputMode.toUpperCase()} mode signals</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSignalList.map((sig) => (
            <SignalChart
              key={sig.key}
              label={sig.label}
              value={currentFrame?.signals[sig.key] ?? null}
              min={sig.min}
              max={sig.max}
              color={sig.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
