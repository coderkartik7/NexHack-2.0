import React from 'react';
import { Flag, MessageSquarePlus } from 'lucide-react';

interface FacilitatorBarProps {
  onMarkUnintended: () => void;
  onAddNote: () => void;
  markCount: number;
  lastCommandDescription?: string | null;
}

export const FacilitatorBar: React.FC<FacilitatorBarProps> = ({
  onMarkUnintended,
  onAddNote,
  markCount,
  lastCommandDescription,
}) => {
  return (
    <div className="bg-zinc-950 border border-amber-900/50 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm print:hidden">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-mono font-semibold text-amber-300 uppercase tracking-wider">
          Facilitator Controls
        </span>
        {lastCommandDescription && (
          <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
            &middot; Last: <span className="text-zinc-200">{lastCommandDescription}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onMarkUnintended}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700/80 rounded-md text-xs font-semibold transition-colors shadow-2xs"
          title="Mark the most recent command as unintended / accidental"
        >
          <Flag className="w-3.5 h-3.5 text-amber-400" />
          <span>Mark Last As Unintended ({markCount})</span>
        </button>

        <button
          onClick={onAddNote}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-700 rounded-md text-xs font-medium transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-zinc-400" />
          <span>Add Note</span>
        </button>
      </div>
    </div>
  );
};
