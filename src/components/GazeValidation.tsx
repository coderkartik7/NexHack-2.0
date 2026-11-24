import React from 'react';
import type { ValidationEvaluation } from '../gaze/accuracy';
import { GazeAccuracyBadge } from './GazeAccuracyBadge';
import { Target, RefreshCw, ArrowRight, ShieldCheck, Check } from 'lucide-react';

interface GazeValidationProps {
  evaluation: ValidationEvaluation;
  onRecalibrate: () => void;
  onContinue: (largeTargetMode: boolean) => void;
}

export const GazeValidation: React.FC<GazeValidationProps> = ({
  evaluation,
  onRecalibrate,
  onContinue,
}) => {
  const { stats, rating, advice } = evaluation;

  return (
    <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Gaze Validation Result</h2>
            <p className="text-xs text-zinc-400">
              Evaluated on {stats.n} independent target dots
            </p>
          </div>
        </div>
        <GazeAccuracyBadge rating={rating} meanErrorPx={stats.meanErrorPx} />
      </div>

      {/* Metrics breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
          <span className="text-xs text-zinc-400 block font-mono">Mean Error</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">
            ~{stats.meanErrorPx} <span className="text-sm font-normal text-zinc-400">px</span>
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Average deviation on screen
          </span>
        </div>

        <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
          <span className="text-xs text-zinc-400 block font-mono">90th Percentile Error</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">
            ~{stats.p90ErrorPx} <span className="text-sm font-normal text-zinc-400">px</span>
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            90% of samples fell within this radius
          </span>
        </div>
      </div>

      {/* Guidance / Advice */}
      <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50 space-y-2">
        <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Facilitator Advice</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{advice}</p>
        <p className="text-xs text-zinc-500 italic">
          Webcam gaze is naturally imprecise (100–200 px is normal on laptop webcams).
          Targets in GestureLearn use sticky hover and magnetism to ensure comfortable selection.
        </p>
      </div>

      {/* Decision Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          onClick={onRecalibrate}
          className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-zinc-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Recalibrate</span>
        </button>

        {rating === 'poor' ? (
          <button
            onClick={() => onContinue(true)}
            className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-600/20"
          >
            <span>Continue with Large-Target Mode</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => onContinue(false)}
            className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-600/20"
          >
            <Check className="w-4 h-4" />
            <span>Accept and Continue</span>
          </button>
        )}
      </div>
    </div>
  );
};
