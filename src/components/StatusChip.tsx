import React from 'react';
import { ShieldCheck, AlertCircle, Pause, Sparkles } from 'lucide-react';

interface StatusChipProps {
  isTrackingOk: boolean;
  isPaused: boolean;
  lastGestureName: string | null;
  blockedReason?: string | null;
  suggestRecalibrate?: boolean;
  gazeRating?: 'good' | 'fair' | 'poor' | null;
  gazeErrorPx?: number | null;
  onRecalibrate?: () => void;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  isTrackingOk,
  isPaused,
  lastGestureName,
  blockedReason,
  suggestRecalibrate: _suggestRecalibrate = false,
  gazeRating,
  gazeErrorPx,
  onRecalibrate,
}) => {
  if (!isTrackingOk) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono font-medium shadow-xs"
        title={blockedReason || 'Tracking Lost'}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>Tracking Lost</span>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono font-medium shadow-xs"
        title={blockedReason || 'System Paused'}
      >
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
      <div
        onClick={onRecalibrate}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-medium shadow-xs cursor-pointer transition-colors ${
          gazeRating === 'good'
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
            : gazeRating === 'fair'
            ? 'bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60'
            : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
        }`}
        title="Click to re-calibrate gaze"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>
          Gaze: {gazeRating.toUpperCase()} {gazeErrorPx ? `(${gazeErrorPx}px)` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono font-medium shadow-xs">
      <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
      <span>Tracking Active</span>
    </div>
  );
};
