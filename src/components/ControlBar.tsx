import React from 'react';
import { Pause, Play, Undo2, Volume2, VolumeX, Sliders, Users } from 'lucide-react';

interface ControlBarProps {
  isPaused: boolean;
  canUndo: boolean;
  isMuted: boolean;
  activeProfileName: string;
  onTogglePause: () => void;
  onUndo: () => void;
  onToggleMute: () => void;
  onRecalibrate: () => void;
  onSwitchProfile: () => void;
  hoveredTargetId?: string | null;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPaused,
  canUndo,
  isMuted,
  activeProfileName,
  onTogglePause,
  onUndo,
  onToggleMute,
  onRecalibrate,
  onSwitchProfile,
  hoveredTargetId,
}) => {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-md">
      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        {/* Large Pause / Resume Target (min 120x60 or large touch area) */}
        <button
          id="btn_pause_toggle"
          onClick={onTogglePause}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-xs transition-colors min-w-[120px] justify-center ${
            hoveredTargetId === 'btn_pause_toggle' ? 'ring-2 ring-teal-400' : ''
          } ${
            isPaused
              ? 'bg-amber-600 hover:bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/80'
          }`}
          title="Space key or calibrated Pause gesture"
        >
          {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Large Undo Target */}
        <button
          id="btn_undo_action"
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-xs transition-colors min-w-[110px] justify-center disabled:opacity-30 disabled:pointer-events-none ${
            hoveredTargetId === 'btn_undo_action' ? 'ring-2 ring-teal-400' : ''
          } bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-100`}
          title="Ctrl+Z or Backspace fallback"
        >
          <Undo2 className="w-4 h-4" />
          <span>Undo</span>
        </button>

        {/* Audio Mute Toggle */}
        <button
          id="btn_toggle_mute"
          onClick={onToggleMute}
          className={`p-2.5 rounded-md border text-zinc-300 transition-colors ${
            hoveredTargetId === 'btn_toggle_mute' ? 'ring-2 ring-teal-400' : ''
          } ${
            isMuted
              ? 'bg-zinc-950 border-zinc-800 text-zinc-500'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/80 text-zinc-200'
          }`}
          title={isMuted ? 'Unmute Audio Cues' : 'Mute Audio Cues'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
        </button>
      </div>

      {/* Profile & Navigation Controls */}
      <div className="flex items-center gap-2">
        <button
          id="btn_recalibrate"
          onClick={onRecalibrate}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition-colors ${
            hoveredTargetId === 'btn_recalibrate' ? 'ring-2 ring-teal-400' : ''
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-teal-400" />
          <span>Recalibrate</span>
        </button>

        <button
          id="btn_switch_profile"
          onClick={onSwitchProfile}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition-colors ${
            hoveredTargetId === 'btn_switch_profile' ? 'ring-2 ring-teal-400' : ''
          }`}
        >
          <Users className="w-3.5 h-3.5 text-teal-400" />
          <span>Profile: {activeProfileName}</span>
        </button>
      </div>
    </div>
  );
};
