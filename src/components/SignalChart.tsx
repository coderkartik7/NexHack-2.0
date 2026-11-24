import React, { useEffect, useRef } from 'react';

interface SignalChartProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  color?: string;
  unit?: string;
  historyLength?: number;
}

export const SignalChart: React.FC<SignalChartProps> = ({
  label,
  value,
  min = -1,
  max = 1,
  color = '#2dd4bf', // default crisp teal
  unit,
  historyLength = 200, // ~10 seconds at 20-30 FPS
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (value !== null && !isNaN(value)) {
      historyRef.current.push(value);
      if (historyRef.current.length > historyLength) {
        historyRef.current.shift();
      }
    }
  }, [value, historyLength]);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle baseline grid line
      ctx.strokeStyle = '#27272a'; // zinc-800
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      // Mid-line
      const midY = height / 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const history = historyRef.current;
      if (history.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const range = max - min || 1;
        const step = width / (historyLength - 1);
        const startIndex = historyLength - history.length;

        for (let i = 0; i < history.length; i++) {
          const val = history[i];
          const clamped = Math.max(min, Math.min(max, val));
          // Invert y because canvas (0,0) is top-left
          const y = height - ((clamped - min) / range) * height;
          const x = (startIndex + i) * step;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [color, min, max, historyLength]);

  const hasVal = value !== null && !isNaN(value);

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-md p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-medium text-zinc-300 truncate">{label}</span>
          {unit && (
            <span className="text-[10px] font-mono text-zinc-400">({unit})</span>
          )}
        </div>
        <span className="font-mono text-xs font-semibold text-teal-400">
          {hasVal ? value.toFixed(3) : '--'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={240}
        height={56}
        className="w-full h-14 bg-zinc-900/60 rounded border border-zinc-900"
      />
    </div>
  );
};
