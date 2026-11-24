import React from 'react';
import type { GazeAccuracyRating } from '../gaze/accuracy';
import { Eye, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface GazeAccuracyBadgeProps {
  rating: GazeAccuracyRating;
  meanErrorPx: number;
  onRecalibrate?: () => void;
  compact?: boolean;
}

export const GazeAccuracyBadge: React.FC<GazeAccuracyBadgeProps> = ({
  rating,
  meanErrorPx,
  onRecalibrate,
  compact = false,
}) => {
  const getBadgeStyle = () => {
    switch (rating) {
      case 'good':
        return 'bg-emerald-950/80 border-emerald-800 text-emerald-300';
      case 'fair':
        return 'bg-amber-950/80 border-amber-800 text-amber-300';
      case 'poor':
        return 'bg-rose-950/80 border-rose-800 text-rose-300';
    }
  };

  const getIcon = () => {
    switch (rating) {
      case 'good':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'fair':
        return <Eye className="w-3.5 h-3.5 text-amber-400" />;
      case 'poor':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-medium ${getBadgeStyle()}`}>
        {getIcon()}
        <span>
          Gaze: {rating} (~{Math.round(meanErrorPx)} px)
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border font-mono text-xs ${getBadgeStyle()} shadow-sm`}>
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="font-semibold uppercase tracking-wider">{rating}</span>
        <span className="text-zinc-400">|</span>
        <span>Avg error: ~{Math.round(meanErrorPx)} px</span>
      </div>
      {onRecalibrate && (rating === 'poor' || rating === 'fair') && (
        <button
          onClick={onRecalibrate}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
          title="Recalibrate gaze tracking"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Recalibrate</span>
        </button>
      )}
    </div>
  );
};
