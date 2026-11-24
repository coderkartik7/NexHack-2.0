import React from 'react';
import { ProgressRing } from './ProgressRing';
import { Hand, Pause, AlertCircle } from 'lucide-react';

interface GestureCursorProps {
  x: number;
  y: number;
  isHovering: boolean;
  isGrabbing: boolean;
  isPaused: boolean;
  isTrackingLost: boolean;
  candidateCommand: string | null;
  candidateProgress: number; // 0..1
  actionLabel?: string | null; // e.g. "Select" or "Grab"
}

export const GestureCursor: React.FC<GestureCursorProps> = ({
  x,
  y,
  isHovering,
  isGrabbing,
  isPaused,
  isTrackingLost,
  candidateCommand,
  candidateProgress,
  actionLabel,
}) => {
  if (isTrackingLost) {
    return (
      <div
        className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
        style={{ left: `${x}px`, top: `${y}px` }}
      >
        <div className="w-9 h-9 rounded-full bg-rose-950/80 border-2 border-rose-500/80 flex items-center justify-center text-rose-300 shadow-md animate-pulse">
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div
        className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 opacity-60"
        style={{ left: `${x}px`, top: `${y}px` }}
      >
        <div className="w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-600 flex items-center justify-center text-zinc-400">
          <Pause className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div className="relative flex items-center justify-center">
        {/* Progress Ring during candidate hold */}
        {candidateProgress > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ProgressRing
              radius={26}
              stroke={3.5}
              progress={candidateProgress}
              color={candidateCommand === 'grab' ? '#10b981' : '#2dd4bf'}
            />
          </div>
        )}

        {/* Outer reticle / cursor circle */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${
            isGrabbing
              ? 'bg-emerald-500 text-zinc-950 scale-110 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300'
              : candidateProgress > 0
              ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-300 scale-105'
              : isHovering
              ? 'bg-teal-500/20 border-2 border-teal-400 text-teal-300 scale-105 shadow-md shadow-teal-500/20'
              : 'bg-zinc-950/70 border-2 border-zinc-300/80 text-zinc-200'
          }`}
        >
          {isGrabbing ? (
            <Hand className="w-4 h-4 fill-current stroke-[2.5]" />
          ) : candidateCommand ? (
            <span className="text-[10px] font-mono font-bold uppercase">{candidateCommand[0]}</span>
          ) : (
            <div className="w-2 h-2 rounded-full bg-current" />
          )}
        </div>

        {/* Hover Action Badge */}
        {actionLabel && !isGrabbing && (
          <div className="absolute top-10 whitespace-nowrap bg-zinc-950/90 border border-zinc-700/80 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-teal-300 shadow-sm backdrop-blur-xs">
            {actionLabel}
          </div>
        )}
      </div>
    </div>
  );
};
