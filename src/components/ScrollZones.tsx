import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ScrollZonesProps {
  topDwellProgress: number;
  bottomDwellProgress: number;
  onScrollUpClick: () => void;
  onScrollDownClick: () => void;
  hoveredTargetId?: string | null;
}

export const ScrollZones: React.FC<ScrollZonesProps> = ({
  topDwellProgress,
  bottomDwellProgress,
  onScrollUpClick,
  onScrollDownClick,
  hoveredTargetId,
}) => {
  return (
    <>
      {/* Top Scroll Zone Indicator Band */}
      <div
        className={`fixed top-14 left-0 right-0 h-16 pointer-events-none z-30 transition-all ${
          topDwellProgress > 0 ? 'bg-teal-500/10 border-b border-teal-500/30' : 'bg-transparent'
        }`}
      >
        {topDwellProgress > 0 && (
          <div className="flex items-center justify-center h-full gap-2 text-teal-300 font-mono text-xs font-semibold">
            <ChevronUp className="w-4 h-4 animate-bounce" />
            <span>Auto-Scrolling Up ({Math.round(topDwellProgress * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Bottom Scroll Zone Indicator Band */}
      <div
        className={`fixed bottom-0 left-0 right-0 h-20 pointer-events-none z-30 transition-all ${
          bottomDwellProgress > 0 ? 'bg-teal-500/10 border-t border-teal-500/30' : 'bg-transparent'
        }`}
      >
        {bottomDwellProgress > 0 && (
          <div className="flex items-center justify-center h-full gap-2 text-teal-300 font-mono text-xs font-semibold">
            <ChevronDown className="w-4 h-4 animate-bounce" />
            <span>Auto-Scrolling Down ({Math.round(bottomDwellProgress * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Floating Manual Scroll Buttons (Hover + Selectable) */}
      <div className="fixed right-6 bottom-28 z-40 flex flex-col gap-2">
        <button
          id="btn_scroll_up"
          onClick={onScrollUpClick}
          className={`w-12 h-12 rounded-lg bg-zinc-900/90 border flex items-center justify-center text-zinc-300 shadow-md transition-colors ${
            hoveredTargetId === 'btn_scroll_up'
              ? 'border-teal-400 text-teal-300 ring-2 ring-teal-400/30 bg-zinc-800'
              : 'border-zinc-700 hover:border-zinc-600'
          }`}
          title="Scroll Up (Hover + Select)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        <button
          id="btn_scroll_down"
          onClick={onScrollDownClick}
          className={`w-12 h-12 rounded-lg bg-zinc-900/90 border flex items-center justify-center text-zinc-300 shadow-md transition-colors ${
            hoveredTargetId === 'btn_scroll_down'
              ? 'border-teal-400 text-teal-300 ring-2 ring-teal-400/30 bg-zinc-800'
              : 'border-zinc-700 hover:border-zinc-600'
          }`}
          title="Scroll Down (Hover + Select)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
