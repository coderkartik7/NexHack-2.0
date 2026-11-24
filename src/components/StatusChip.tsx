import React from 'react';
import { ShieldCheck, AlertCircle, Pause, Sparkles } from 'lucide-react';

interface StatusChipProps {
  isTrackingOk: boolean;
  isPaused: boolean;
  lastGestureName: string | null;
  suggestRecalibrate?: boolean;
  gazeRating?: 'good' | 'fair' | 'poor' | null;
  gazeErrorPx?: number | null;
  onRecalibrate?: () => void;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  isTrackingOk,
  isPaused,
  lastGestureName,
  suggestRecalibrate = false,
  gazeRating,
  gazeErrorPx,
  onRecalibrate,
}) => {
  if (!isTrackingOk) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono font-medium shadow-xs">
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>Tracking Lost</span>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono font-medium shadow-xs">
        <Pause className="w-3.5 h-3.5 text-amber-400" />
        <span>System Paused</span>
      </div>
    );
  }

  if (lastGestureName) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-950/80 border border-teal-800 text-teal-300 text-xs font-mono font-medium shadow-xs animate-pulse">
        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
        <span>Gesture: {lastGestureName}</span>
      </div>
    );
  }

  if (gazeRating) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-medium shadow-xs ${
            gazeRating === 'good'
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
              : gazeRating === 'fair'
              ? 'bg-amber-950/60 border-amber-800/80 text-amber-300'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
          }`}
        >
          <ShieldCheck
            className={`w-3.5 h-3.5 ${
              gazeRating === 'good'
                ? 'text-emerald-400'
                : gazeRating === 'fair'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          />
          <span>Gaze: {gazeRating} (~{Math.round(gazeErrorPx ?? 150)} px)</span>
        </div>
        {(suggestRecalibrate || gazeRating === 'poor') && onRecalibrate && (
          <button
            onClick={onRecalibrate}
            className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-mono font-medium shadow-xs transition-colors"
          >
            Recalibrate
          </button>
        )}
      </div>
    );
  }

  if (suggestRecalibrate) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-mono font-medium shadow-xs">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span>Recalibrate Suggested</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono font-medium shadow-xs">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      <span>Tracking Active</span>
    </div>
  );
};
