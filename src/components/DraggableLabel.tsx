import React from 'react';
import type { DraggableLabelItem } from '../lesson/lessonData';
import { GripVertical, CheckCircle2 } from 'lucide-react';

interface DraggableLabelProps {
  label: DraggableLabelItem;
  isPlaced: boolean;
  isCorrect: boolean;
  isDragging: boolean;
  onPointerDown?: () => void;
  hoveredTargetId?: string | null;
}

export const DraggableLabel: React.FC<DraggableLabelProps> = ({
  label,
  isPlaced,
  isDragging,
  onPointerDown,
  hoveredTargetId,
}) => {
  const targetId = `target_${label.id}`;
  const isHovered = hoveredTargetId === targetId;

  if (isPlaced) {
    return (
      <div className="px-3.5 py-2 rounded-md border border-zinc-800/80 bg-zinc-950/40 text-zinc-500 font-mono text-xs flex items-center gap-2 opacity-50">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="line-through">{label.text}</span>
      </div>
    );
  }

  return (
    <div
      id={targetId}
      onPointerDown={onPointerDown}
      className={`px-4 py-3 rounded-lg border flex items-center gap-2.5 font-medium text-xs cursor-grab active:cursor-grabbing transition-colors min-w-[130px] justify-center select-none shadow-xs ${
        isDragging
          ? 'opacity-40 border-dashed border-teal-500 bg-teal-950/20'
          : isHovered
          ? 'border-teal-400 bg-zinc-800 text-teal-200 ring-2 ring-teal-400/40'
          : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-600'
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <span>{label.text}</span>
    </div>
  );
};
