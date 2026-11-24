import React from 'react';
import type { LearnerProfile } from '../calibration/types';
import { Eye, Hand, Sliders } from 'lucide-react';

interface ThresholdCompareProps {
  profileA: LearnerProfile | null;
  profileB: LearnerProfile | null;
  participantAId?: string;
  participantBId?: string;
}

export const ThresholdCompare: React.FC<ThresholdCompareProps> = ({
  profileA,
  profileB,
  participantAId = 'Participant A',
  participantBId = 'Participant B',
}) => {
  if (!profileA || !profileB) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-lg text-center text-xs font-mono text-zinc-500">
        Both calibrated learner profiles are required for side-by-side threshold inspection.
      </div>
    );
  }

  const commands = (['select', 'grab', 'pause'] as const);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
            Calibrated Baseline & Threshold Comparison
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Independent Per-Learner Biometrics
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile A Card */}
        <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-md p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <div>
              <span className="text-[10px] font-mono text-teal-400 uppercase font-semibold">
                {participantAId}
              </span>
              <h4 className="text-sm font-semibold text-zinc-100">{profileA.name}</h4>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono capitalize">
              {profileA.mode === 'head' ? <Eye className="w-3 h-3 text-teal-400" /> : <Hand className="w-3 h-3 text-emerald-400" />}
              <span>{profileA.mode} Mode</span>
            </div>
          </div>

          <div className="space-y-2">
            {commands.map((cmd) => {
              const b = profileA.commands[cmd];
              return (
                <div key={cmd} className="bg-zinc-900/40 p-2 rounded border border-zinc-900 text-xs font-mono flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 capitalize">{cmd} ({b.signal})</span>
                    <span className="text-[10px] text-zinc-500">{b.direction === 'high' ? 'active ↑' : 'active ↓'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-zinc-400">
                    <div>Enter: <span className="text-zinc-200">{b.enter}</span></div>
                    <div>Exit: <span className="text-zinc-200">{b.exit}</span></div>
                    <div>Hold: <span className="text-zinc-200">{b.minHoldMs}ms</span></div>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-0.5">
                    <span>Separability: d&apos; = {b.separability.dPrime}</span>
                    <span className={b.separability.rating === 'reliable' ? 'text-emerald-400' : 'text-amber-400'}>
                      {b.separability.rating}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-zinc-500 border-t border-zinc-900 pt-2 flex items-center justify-between">
            <span>Cursor Gain: X {profileA.cursorMapping.gainX}x &middot; Y {profileA.cursorMapping.gainY}x</span>
          </div>
        </div>

        {/* Profile B Card */}
        <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-md p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <div>
              <span className="text-[10px] font-mono text-teal-400 uppercase font-semibold">
                {participantBId}
              </span>
              <h4 className="text-sm font-semibold text-zinc-100">{profileB.name}</h4>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono capitalize">
              {profileB.mode === 'head' ? <Eye className="w-3 h-3 text-teal-400" /> : <Hand className="w-3 h-3 text-emerald-400" />}
              <span>{profileB.mode} Mode</span>
            </div>
          </div>

          <div className="space-y-2">
            {commands.map((cmd) => {
              const b = profileB.commands[cmd];
              return (
                <div key={cmd} className="bg-zinc-900/40 p-2 rounded border border-zinc-900 text-xs font-mono flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 capitalize">{cmd} ({b.signal})</span>
                    <span className="text-[10px] text-zinc-500">{b.direction === 'high' ? 'active ↑' : 'active ↓'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-zinc-400">
                    <div>Enter: <span className="text-zinc-200">{b.enter}</span></div>
                    <div>Exit: <span className="text-zinc-200">{b.exit}</span></div>
                    <div>Hold: <span className="text-zinc-200">{b.minHoldMs}ms</span></div>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-0.5">
                    <span>Separability: d&apos; = {b.separability.dPrime}</span>
                    <span className={b.separability.rating === 'reliable' ? 'text-emerald-400' : 'text-amber-400'}>
                      {b.separability.rating}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-zinc-500 border-t border-zinc-900 pt-2 flex items-center justify-between">
            <span>Cursor Gain: X {profileB.cursorMapping.gainX}x &middot; Y {profileB.cursorMapping.gainY}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};
