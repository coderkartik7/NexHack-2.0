import React, { useRef, useEffect } from 'react';
import type { RestSignalSample } from '../eval/types';
import type { LearnerProfile } from '../calibration/types';

interface RestTimelineProps {
  samples: RestSignalSample[];
  profile: LearnerProfile | null;
  falseActivations?: { t: number; command: string }[];
  durationMs?: number;
}

export const RestTimeline: React.FC<RestTimelineProps> = ({
  samples,
  profile,
  falseActivations = [],
  durationMs = 60000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines (every 10 seconds)
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    const totalSec = Math.max(10, Math.round(durationMs / 1000));
    for (let s = 10; s < totalSec; s += 10) {
      const x = (s / totalSec) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (!profile || samples.length === 0) {
      ctx.fillStyle = '#71717a';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(samples.length === 0 ? 'No rest signal samples recorded' : 'Loading signals...', width / 2, height / 2);
      return;
    }

    // Determine signal to plot (default to primary select command signal)
    const selectBinding = profile.commands.select;
    const signalKey = selectBinding.signal;
    const enterThr = selectBinding.enter;
    const exitThr = selectBinding.exit;

    // Range calculation
    const vals = samples.map((s) => s.signals[signalKey]).filter((v): v is number => typeof v === 'number');
    const minVal = Math.min(0, ...vals, enterThr * 0.8);
    const maxVal = Math.max(1.0, ...vals, enterThr * 1.3);
    const range = maxVal - minVal || 1;

    const getY = (val: number) => height - ((val - minVal) / range) * (height - 30) - 15;

    // Draw Enter Threshold line (dashed red)
    const enterY = getY(enterThr);
    ctx.strokeStyle = '#f43f5e'; // rose-500
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, enterY);
    ctx.lineTo(width, enterY);
    ctx.stroke();

    // Draw Exit Threshold line (dashed amber)
    const exitY = getY(exitThr);
    ctx.strokeStyle = '#f59e0b'; // amber-500
    ctx.beginPath();
    ctx.moveTo(0, exitY);
    ctx.lineTo(width, exitY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Signal Trace
    ctx.strokeStyle = '#2dd4bf'; // teal-400
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const val = s.signals[signalKey] ?? minVal;
      const x = (s.t / durationMs) * width;
      const y = getY(val);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Mark False Activations with Red Dots & Pins
    for (const fa of falseActivations) {
      const faX = (fa.t / durationMs) * width;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(faX, enterY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pin stem
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(faX, enterY);
      ctx.lineTo(faX, enterY - 14);
      ctx.stroke();

      ctx.fillStyle = '#fca5a5';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fa.command, faX, enterY - 16);
    }

    // Legend
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Signal: ${signalKey} (${profile.mode} mode)`, 10, 16);

    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`Enter Threshold: ${enterThr.toFixed(2)}`, 200, 16);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`Exit Threshold: ${exitThr.toFixed(2)}`, 390, 16);
  }, [samples, profile, falseActivations, durationMs]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
        <span className="font-semibold text-zinc-200">Rest Timeline (Signal vs Thresholds)</span>
        <span>
          Duration: {Math.round(durationMs / 1000)}s &middot; False Fires: {falseActivations.length}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={180}
        className="w-full h-44 bg-zinc-950 rounded border border-zinc-900"
      />
      <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span>0s</span>
        <span>15s</span>
        <span>30s</span>
        <span>45s</span>
        <span>{Math.round(durationMs / 1000)}s</span>
      </div>
    </div>
  );
};
