import React, { useState, useEffect } from 'react';
import { usePipelineStore, visionPipeline } from '../vision/pipeline';
import { cameraService } from '../vision/camera';
import { landmarkersService } from '../vision/landmarkers';
import { commandBus } from '../intent/bus';
import { listProfiles, getActiveProfileId } from '../storage/profiles';
import type { LearnerProfile } from '../calibration/types';
import type { BusEvent } from '../intent/types';
import { Activity, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface LinkState {
  status: 'green' | 'amber' | 'red';
  label: string;
  detail: string;
  ageMs?: number;
}

interface PipelineHealthProbeProps {
  enginePaused?: boolean;
  engineFrameCount?: number;
  engineMachines?: Record<string, any>;
  cursorState?: { rawX: number; rawY: number; screenX: number; screenY: number; frozen: boolean };
  targetsCount?: number;
  hoveredTargetId?: string | null;
  lastCommand?: string | null;
  activeProfile?: LearnerProfile | null;
  defaultExpanded?: boolean;
  className?: string;
}

export const PipelineHealthProbe: React.FC<PipelineHealthProbeProps> = ({
  enginePaused = false,
  engineFrameCount = 0,
  engineMachines,
  cursorState,
  targetsCount = 0,
  hoveredTargetId = null,
  lastCommand = null,
  activeProfile: propProfile,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeProfile, setActiveProfile] = useState<LearnerProfile | null>(propProfile ?? null);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(performance.now());

  const {
    currentFrame,
    latestGazeResult: _latestGazeResult,
    fps,
    inputMode,
    isStreaming: _isStreaming,
    isLoadingModels: _isLoadingModels,
    error: _error,
    lastDetectionTimestamp,
    activeSourceId,
    sourceStarted,
  } = usePipelineStore();

  // Polling clock for live age calculations
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, []);

  // Fetch active profile if not passed in
  useEffect(() => {
    if (propProfile) {
      setActiveProfile(propProfile);
      return;
    }
    listProfiles().then((profiles) => {
      const activeId = getActiveProfileId();
      const p = profiles.find((prof) => prof.id === activeId) || profiles[0] || null;
      setActiveProfile(p);
    });
  }, [propProfile]);

  // Event bus monitoring (last 10 seconds sliding window)
  useEffect(() => {
    const history: { type: string; t: number }[] = [];
    const unsub = commandBus.subscribe((ev: BusEvent) => {
      const t = performance.now();
      history.push({ type: ev.type, t });
    });

    const purgeInterval = setInterval(() => {
      const cut = performance.now() - 10000;
      while (history.length > 0 && history[0].t < cut) {
        history.shift();
      }
      const counts: Record<string, number> = {};
      for (const item of history) {
        counts[item.type] = (counts[item.type] || 0) + 1;
      }
      setEventCounts(counts);
    }, 500);

    return () => {
      unsub();
      clearInterval(purgeInterval);
    };
  }, []);

  // 1. Camera stream active
  const videoEl = visionPipeline.getVideoElement();
  const streamActive = cameraService.isActive();
  const videoWidth = videoEl?.videoWidth ?? 0;
  const videoHeight = videoEl?.videoHeight ?? 0;
  const videoReady = videoEl ? videoEl.readyState : 0;
  const currentTime = videoEl?.currentTime ?? 0;

  const link1: LinkState = {
    label: '1. Camera Stream',
    status: streamActive && videoWidth > 0 && videoReady >= 2 ? 'green' : streamActive ? 'amber' : 'red',
    detail: `active=${streamActive}, readyState=${videoReady}, ${videoWidth}x${videoHeight}, t=${currentTime.toFixed(1)}s`,
  };

  // 2. Landmarkers initialized (face, hand)
  const landmarkersLoaded = landmarkersService.isLoaded();
  const lastDetectAge = lastDetectionTimestamp ? Math.round(now - lastDetectionTimestamp) : undefined;
  const link2: LinkState = {
    label: '2. Landmarkers',
    status: landmarkersLoaded && lastDetectAge !== undefined && lastDetectAge < 1500 ? 'green' : landmarkersLoaded ? 'amber' : 'red',
    detail: `loaded=${landmarkersLoaded}, face=${visionPipeline.latestFaceResult ? 'yes' : 'no'}, hand=${visionPipeline.latestHandResult ? 'yes' : 'no'}`,
    ageMs: lastDetectAge,
  };

  // 3. Frames per second
  const link3: LinkState = {
    label: '3. Pipeline FPS',
    status: fps >= 25 ? 'green' : fps >= 10 ? 'amber' : 'red',
    detail: `${fps} FPS`,
  };

  // 4. Latest SignalFrame
  const signals = currentFrame?.signals;
  const nonNullSignals = signals ? Object.entries(signals).filter(([_, v]) => v !== null).map(([k]) => k) : [];
  const frameAge = currentFrame ? Math.round(now - currentFrame.t) : undefined;
  const link4: LinkState = {
    label: '4. SignalFrame',
    status: currentFrame && frameAge !== undefined && frameAge < 1000 && nonNullSignals.length > 0 ? 'green' : currentFrame ? 'amber' : 'red',
    detail: currentFrame ? `Signals: [${nonNullSignals.slice(0, 4).join(', ')}${nonNullSignals.length > 4 ? ` +${nonNullSignals.length - 4}` : ''}], Q: face=${currentFrame.quality.face.toFixed(2)}, hand=${currentFrame.quality.hand.toFixed(2)}` : 'No frames yet',
    ageMs: frameAge,
  };

  // 5. Source in use
  const link5: LinkState = {
    label: '5. Source & Start',
    status: sourceStarted ? 'green' : 'red',
    detail: `source=${activeSourceId}, started=${sourceStarted}`,
  };

  // 6. Active Profile
  const profileModeMatches = activeProfile ? activeProfile.mode === inputMode : false;
  const link6: LinkState = {
    label: '6. Active Profile & Mode',
    status: activeProfile && profileModeMatches ? 'green' : activeProfile ? 'amber' : 'red',
    detail: activeProfile ? `"${activeProfile.name}" (${activeProfile.mode}), pipeline=${inputMode}` : 'No profile loaded',
  };

  // 7. Engine
  const machineStates = engineMachines
    ? Object.entries(engineMachines).map(([cmd, ctx]) => `${cmd}:${ctx.state}`).join(' ')
    : 'select:IDLE grab:IDLE pause:IDLE';
  const link7: LinkState = {
    label: '7. Intent Engine',
    status: !enginePaused ? 'green' : 'amber',
    detail: `paused=${enginePaused}, frames/sec=${engineFrameCount}, states: [${machineStates}]`,
  };

  // 8. Cursor
  const curX = cursorState ? cursorState.screenX : 0;
  const curY = cursorState ? cursorState.screenY : 0;
  const link8: LinkState = {
    label: '8. Cursor Mapping',
    status: cursorState && (cursorState.screenX > 0 || cursorState.screenY > 0) ? 'green' : 'amber',
    detail: cursorState ? `raw=(${cursorState.rawX.toFixed(2)}, ${cursorState.rawY.toFixed(2)}) -> screen=(${curX}, ${curY}), frozen=${cursorState.frozen}` : 'No cursor state',
  };

  // 9. Lesson
  const link9: LinkState = {
    label: '9. Lesson Targeting',
    status: targetsCount > 0 ? 'green' : 'amber',
    detail: `targets=${targetsCount}, hovered=${hoveredTargetId || 'none'}, lastCmd=${lastCommand || 'none'}`,
  };

  // 10. Event Bus
  const totalEvents10s = Object.values(eventCounts).reduce((a, b) => a + b, 0);
  const link10: LinkState = {
    label: '10. Event Bus (last 10s)',
    status: 'green',
    detail: `total=${totalEvents10s}, breakdown: ${JSON.stringify(eventCounts)}`,
  };

  const links: LinkState[] = [link1, link2, link3, link4, link5, link6, link7, link8, link9, link10];

  const firstRed = links.find((l) => l.status === 'red');
  const firstAmber = links.find((l) => l.status === 'amber');

  const renderStatusBadge = (status: 'green' | 'amber' | 'red') => {
    switch (status) {
      case 'green':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'amber':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'red':
        return <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    }
  };

  return (
    <div className={`bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono shadow-md ${className}`}>
      {/* Header bar / Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-zinc-900/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="font-semibold text-zinc-200">Pipeline Health Probe</span>
          {firstRed ? (
            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-bold">
              FIRST RED: {firstRed.label}
            </span>
          ) : firstAmber ? (
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
              AMBER: {firstAmber.label}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
              ALL 10 LINKS HEALTHY
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-[11px]">{isExpanded ? 'Hide' : 'Expand Live Chain'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Expanded 10-link list */}
      {isExpanded && (
        <div className="p-3 border-t border-zinc-800/80 space-y-2 bg-zinc-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {links.map((link, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border flex flex-col gap-0.5 ${
                  link.status === 'red'
                    ? 'bg-rose-950/30 border-rose-900 text-rose-200'
                    : link.status === 'amber'
                    ? 'bg-amber-950/20 border-amber-900 text-amber-200'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                    {renderStatusBadge(link.status)}
                    <span>{link.label}</span>
                  </div>
                  {link.ageMs !== undefined && (
                    <span className="text-[10px] text-zinc-400">{link.ageMs}ms ago</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 break-words leading-tight">{link.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
