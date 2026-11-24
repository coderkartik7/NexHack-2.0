import React from 'react';
import type { QuestionOption } from '../lesson/lessonData';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QuestionCardProps {
  prompt: string;
  options: QuestionOption[];
  selectedOptionId: string | null;
  isAnswered: boolean;
  isCorrect: boolean;
  onSelectOption: (optionId: string) => void;
  hoveredTargetId?: string | null;
  largeLayout?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  prompt,
  options,
  selectedOptionId,
  isAnswered,
  isCorrect,
  onSelectOption,
  hoveredTargetId,
  largeLayout = false,
}) => {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold">
          Step 1: Conceptual Understanding
        </span>
        {isAnswered && (
          <span
            className={`text-xs font-mono font-medium flex items-center gap-1 ${
              isCorrect ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" /> Retry Available
              </>
            )}
          </span>
        )}
      </div>

      <h2 className="text-sm font-medium text-zinc-100 leading-relaxed">{prompt}</h2>

      {/* Accessible, large interactive options (min 120x120 in large layout, spaced farther apart) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${largeLayout ? 'gap-6 pt-3' : 'gap-3 pt-1'}`}>
        {options.map((opt, idx) => {
          const isSelected = selectedOptionId === opt.id;
          const targetId = `target_${opt.id}`;
          const isHovered = hoveredTargetId === targetId;

          return (
            <button
              key={opt.id}
              id={targetId}
              onClick={() => onSelectOption(opt.id)}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                largeLayout ? 'min-h-[120px] min-w-[120px]' : 'min-h-[76px]'
              } cursor-pointer ${
                isSelected
                  ? opt.isCorrect
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-100'
                    : 'border-amber-500 bg-amber-950/40 text-amber-100'
                  : isHovered
                  ? 'border-teal-400 bg-zinc-800/90 text-zinc-100 ring-2 ring-teal-400/30'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 text-zinc-300'
              }`}
            >
              <span className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono font-semibold text-xs text-zinc-300 shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium">{opt.text}</span>
                {isSelected && (
                  <span className="text-[11px] text-zinc-400 mt-1 font-sans leading-snug">
                    {opt.explanation}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
