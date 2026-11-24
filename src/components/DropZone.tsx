import React from 'react';
import type { DropZoneTarget } from '../lesson/lessonData';
import { Target, CheckCircle2 } from 'lucide-react';

interface DropZoneProps {
  zone: DropZoneTarget;
  placedLabelText: string | null;
  isCorrect: boolean;
  isHovered: boolean;
  isSnapTarget: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  zone,
  placedLabelText,
  isCorrect,
  isHovered,
  isSnapTarget,
}) => {
  const targetId = `target_${zone.id}`;

  return (
    <div
      id={targetId}
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-all duration-150"
      style={{
        left: `${zone.xPercent}%`,
        top: `${zone.yPercent}%`,
      }}
    >
      <div
        className={`w-28 h-12 rounded-lg border flex items-center justify-center text-xs font-mono font-medium p-2 text-center transition-all duration-150 shadow-md ${
          placedLabelText
            ? isCorrect
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-500/10'
              : 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-amber-500/10'
            : isSnapTarget
            ? 'bg-teal-500/30 border-2 border-teal-300 text-teal-100 scale-105 ring-4 ring-teal-400/30'
            : isHovered
            ? 'bg-zinc-800/90 border-teal-400 text-zinc-100 ring-2 ring-teal-400/20'
            : 'bg-zinc-950/85 border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-500'
        }`}
      >
        {placedLabelText ? (
          <div className="flex items-center gap-1.5 truncate">
            {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            <span className="truncate">{placedLabelText}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Target className="w-3 h-3 text-teal-400/70 shrink-0" />
            <span>Drop: {zone.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
