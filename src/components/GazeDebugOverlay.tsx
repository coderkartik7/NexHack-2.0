import React, { useState, useEffect } from 'react';
import type { GazeCursor } from '../gaze/gazeCursor';
import type { GazeFeatureExtractionResult } from '../gaze/types';
import type { CalibrationSample } from '../gaze/model';
import { Target, Eye, Compass, X } from 'lucide-react';

interface GazeDebugOverlayProps {
  cursor: GazeCursor | null;
  gazeResult: GazeFeatureExtractionResult | null;
  calibrationPoints?: CalibrationSample[];
  isOpen: boolean;
  onClose: () => void;
  onRecenter?: () => void;
}

export const GazeDebugOverlay: React.FC<GazeDebugOverlayProps> = ({
  cursor,
  gazeResult,
  calibrationPoints = [],
  isOpen,
  onClose,
  onRecenter,
}) => {
  const [testValidationDot, setTestValidationDot] = useState<{ x: number; y: number } | null>(null);
  const [liveErrorPx, setLiveErrorPx] = useState<number | null>(null);

  const state = cursor?.getState();
  const drift = cursor?.getDriftCorrector().getOffset() ?? { x: 0, y: 0 };
  const rawFeatures = gazeResult?.rawFeatures;

  // Running error against validation dot on demand
  useEffect(() => {
    if (!testValidationDot || !state) return;
    const dx = state.screenX - testValidationDot.x;
    const dy = state.screenY - testValidationDot.y;
    setLiveErrorPx(Math.round(Math.hypot(dx, dy)));
  }, [state?.screenX, state?.screenY, testValidationDot]);

  if (!isOpen) return null;

  const spawnValidationDot = () => {
    const margin = 100;
    const w = window.innerWidth || 1024;
    const h = window.innerHeight || 768;
    const x = margin + Math.random() * (w - 2 * margin);
    const y = margin + Math.random() * (h - 2 * margin);
    setTestValidationDot({ x, y });
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden font-mono text-xs">
      {/* Visual Canvas Elements */}
      <svg className="absolute inset-0 w-full h-full">
        {/* Render calibration points and error vectors if present */}
        {calibrationPoints.map((pt, idx) => (
          <g key={idx}>
            <circle
              cx={pt.screenX}
              cy={pt.screenY}
              r={6}
              className="fill-teal-500/40 stroke-teal-400 stroke-1"
            />
          </g>
        ))}

        {/* Test Validation Dot */}
        {testValidationDot && (
          <g>
            <circle
              cx={testValidationDot.x}
              cy={testValidationDot.y}
              r={12}
              className="fill-rose-500/30 stroke-rose-400 stroke-2 animate-pulse"
            />
            <circle
              cx={testValidationDot.x}
              cy={testValidationDot.y}
              r={3}
              className="fill-rose-400"
            />
            {state && (
              <line
                x1={testValidationDot.x}
                y1={testValidationDot.y}
                x2={state.screenX}
                y2={state.screenY}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )}
          </g>
        )}

        {/* Predicted Raw Point vs Filtered Point */}
        {state && (
          <g>
            <circle
              cx={state.rawPredictedX}
              cy={state.rawPredictedY}
              r={5}
              className="fill-amber-400/50 stroke-amber-300 stroke-1"
            />
            <line
              x1={state.rawPredictedX}
              y1={state.rawPredictedY}
              x2={state.screenX}
              y2={state.screenY}
              stroke="#fbbf24"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          </g>
        )}
      </svg>

      {/* Floating HUD Panel */}
      <div className="absolute top-16 right-4 w-80 bg-zinc-950/90 border border-zinc-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md pointer-events-auto text-zinc-200">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-teal-400" />
            <span className="font-semibold text-white">Gaze Tracking HUD</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* State Summary */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">State</span>
              <span className={state?.isStale ? 'text-amber-400' : gazeResult?.isValid ? 'text-emerald-400' : 'text-rose-400'}>
                {state?.isStale ? 'STALE (Hold)' : gazeResult?.isValid ? 'TRACKING' : gazeResult?.invalidReason ?? 'LOST'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Fixation</span>
              <span className={state?.isFixating ? 'text-teal-400 font-bold' : 'text-zinc-400'}>
                {state?.isFixating ? 'FIXATING' : 'SACCADE'}
              </span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="space-y-1 text-[11px] bg-zinc-900/40 p-2 rounded border border-zinc-800/50">
            <div className="flex justify-between">
              <span className="text-zinc-400">Raw Prediction:</span>
              <span className="text-amber-300 font-mono">
                {Math.round(state?.rawPredictedX ?? 0)}, {Math.round(state?.rawPredictedY ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Cursor (Filtered):</span>
              <span className="text-teal-300 font-mono font-bold">
                {Math.round(state?.screenX ?? 0)}, {Math.round(state?.screenY ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Drift Offset:</span>
              <span className="text-zinc-300 font-mono">
                ΔX: {Math.round(drift.x)}, ΔY: {Math.round(drift.y)}
              </span>
            </div>
          </div>

          {/* Head Pose & Iris Ratios */}
          {rawFeatures && (
            <div className="space-y-1 text-[10px] text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-800/50">
              <div className="flex justify-between">
                <span>Head Yaw / Pitch / Roll:</span>
                <span className="text-zinc-200">
                  {((rawFeatures.yaw * 180) / Math.PI).toFixed(1)}° / {((rawFeatures.pitch * 180) / Math.PI).toFixed(1)}° / {((rawFeatures.roll * 180) / Math.PI).toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>Iris X (L / R):</span>
                <span className="text-zinc-200">
                  {rawFeatures.irisX_L.toFixed(2)} / {rawFeatures.irisX_R.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Eye Openness (L / R):</span>
                <span className="text-zinc-200">
                  {rawFeatures.openness_L.toFixed(2)} / {rawFeatures.openness_R.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Validation Dot & Error Measurement */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
            <button
              onClick={spawnValidationDot}
              className="flex-1 py-1 px-2 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-[11px] flex items-center justify-center gap-1 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Test Dot</span>
            </button>
            {onRecenter && (
              <button
                onClick={onRecenter}
                className="py-1 px-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 transition-colors"
                title="Reset drift offset"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Re-center</span>
              </button>
            )}
          </div>

          {testValidationDot && liveErrorPx !== null && (
            <div className="p-2 bg-rose-950/40 border border-rose-800/60 rounded text-center">
              <span className="text-zinc-400 text-[10px]">Error vs Test Dot: </span>
              <span className="text-rose-300 font-bold text-sm">~{liveErrorPx} px</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
