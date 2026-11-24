import React from 'react';
import type { ProtocolState } from '../eval/protocol';
import { STAGE_SEQUENCE } from '../eval/protocol';
import { ArrowRight, XCircle, CheckCircle2 } from 'lucide-react';

interface ProtocolRunnerProps {
  state: ProtocolState;
  onStartStage: () => void;
  onCompleteStage: () => void;
  onSkipStage: () => void;
  onAbortStage: () => void;
  onRecalibrateRepeat: () => void;
  isStageRunning: boolean;
}

export const ProtocolRunner: React.FC<ProtocolRunnerProps> = ({
  state,
  onStartStage,
  onCompleteStage,
  onSkipStage,
  onAbortStage,
  onRecalibrateRepeat,
  isStageRunning,
}) => {
  const currentIdx = STAGE_SEQUENCE.indexOf(state.currentStage);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 shadow-xs">
      {/* Protocol Progress Bar */}
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-teal-400 uppercase font-semibold">
            Study Protocol Runner
          </span>
          <span className="text-zinc-600">&middot;</span>
          <span className="text-xs font-mono text-zinc-300">
            Participant: <strong>{state.participantId}</strong> ({state.condition})
          </span>
        </div>

        <span className="text-[11px] font-mono text-zinc-500">
          Stage {currentIdx + 1} of {STAGE_SEQUENCE.length}:{' '}
          <strong className="text-zinc-300 capitalize">{state.currentStage.replace(/_/g, ' ')}</strong>
        </span>
      </div>

      {/* Ordered Step Pills */}
      <div className="grid grid-cols-6 gap-1.5 py-1">
        {STAGE_SEQUENCE.map((s) => {
          const isDone = state.history.some((h) => h.stage === s);
          const isCurrent = state.currentStage === s;

          return (
            <div
              key={s}
              className={`p-2 rounded text-[11px] font-mono flex items-center justify-between border ${
                isCurrent
                  ? 'border-teal-500 bg-teal-950/40 text-teal-300 font-semibold'
                  : isDone
                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
                  : 'border-zinc-850 bg-zinc-950 text-zinc-600'
              }`}
            >
              <span className="truncate capitalize">{s.replace(/_/g, ' ')}</span>
              {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />}
            </div>
          );
        })}
      </div>

      {/* Stage Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-850">
        <div className="flex items-center gap-2">
          <button
            onClick={onAbortStage}
            disabled={!isStageRunning && state.activeSessionId === null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-rose-300 text-xs font-mono transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Abort Stage</span>
          </button>

          <button
            onClick={onSkipStage}
            disabled={isStageRunning}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs font-mono transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Skip Stage
          </button>
        </div>

        <div className="flex items-center gap-2">
          {state.currentStage === 'recalibrate_and_repeat' ? (
            <button
              onClick={onRecalibrateRepeat}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-zinc-950 text-xs font-semibold font-mono transition-colors shadow-2xs"
            >
              <span>Recalibrate & Repeat Stages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : !isStageRunning ? (
            <button
              onClick={onStartStage}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-zinc-950 text-xs font-semibold font-mono transition-colors shadow-2xs"
            >
              <span>Start Stage ({state.currentStage.replace(/_/g, ' ')})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onCompleteStage}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-semibold font-mono transition-colors shadow-2xs"
            >
              <span>Mark Stage Complete</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
