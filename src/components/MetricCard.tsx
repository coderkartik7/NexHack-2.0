import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  subtext?: string;
  n?: number | string;
  source?: 'live' | 'mouse_sim' | 'replay';
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  n,
  source,
  highlight = false,
}) => {
  const isSimulated = source === 'mouse_sim' || source === 'replay';

  return (
    <div
      className={`p-3.5 rounded-lg border flex flex-col justify-between transition-colors ${
        highlight
          ? 'bg-teal-950/30 border-teal-500/70 shadow-xs'
          : 'bg-zinc-900/60 border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider leading-snug">
          {label}
        </span>
        {isSimulated && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
            SIMULATED
          </span>
        )}
      </div>

      <div className="my-2 flex items-baseline gap-1.5">
        <span className="text-xl font-bold font-mono text-zinc-100 tracking-tight">
          {value !== null && value !== undefined ? value : 'no data'}
        </span>
        {unit && value !== null && (
          <span className="text-xs font-mono text-zinc-400">{unit}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-850 pt-1.5 mt-1">
        <span>{subtext ?? ''}</span>
        {n !== undefined && (
          <span className="text-zinc-400">N = {n}</span>
        )}
      </div>
    </div>
  );
};
