import React, { useEffect, useRef } from 'react';

interface SignalChartProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  color?: string;
  historyLength?: number;
}

export const SignalChart: React.FC<SignalChartProps> = ({
  label,
  value,
  min = -1,
  max = 1,
  color = '#38bdf8',
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

      // Draw grid lines
      ctx.strokeStyle = '#334155';
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
        ctx.lineWidth = 2;
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-mono text-cyan-400 font-medium">
          {value !== null ? value.toFixed(3) : 'null'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={240}
        height={60}
        className="w-full h-15 bg-slate-950/60 rounded-md"
      />
    </div>
  );
};
