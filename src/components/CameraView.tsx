import React, { useEffect, useRef } from 'react';
import { usePipelineStore, visionPipeline } from '../vision/pipeline';
import { Camera, AlertCircle, Loader2 } from 'lucide-react';

interface CameraViewProps {
  showLandmarks?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({ showLandmarks = true }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { isStreaming, isLoadingModels, error, qualityWarning, inputMode } = usePipelineStore();

  useEffect(() => {
    let isCancelled = false;

    if (videoRef.current) {
      visionPipeline.acquire(videoRef.current).catch((err) => {
        if (!isCancelled) {
          console.error('Failed to start vision pipeline:', err);
        }
      });
    }

    return () => {
      isCancelled = true;
      visionPipeline.release();
    };
  }, []);

  // Draw technical reticle and landmark overlay
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && showLandmarks && isStreaming) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Precision viewfinder center crosshair
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);

          ctx.beginPath();
          ctx.moveTo(cx - 20, cy);
          ctx.lineTo(cx + 20, cy);
          ctx.moveTo(cx, cy - 20);
          ctx.lineTo(cx, cy + 20);
          ctx.stroke();
          ctx.setLineDash([]);

          // Head / Eye landmarks drawing
          if ((inputMode === 'head' || inputMode === 'eye') && visionPipeline.latestFaceResult?.faceLandmarks?.[0]) {
            const lms = visionPipeline.latestFaceResult.faceLandmarks[0];
            ctx.fillStyle = '#2dd4bf'; // teal-400

            // Draw essential landmarks: eyes, nose, mouth
            const keyPoints = [1, 33, 133, 263, 362, 61, 291, 13, 14, 10, 152];
            for (const idx of keyPoints) {
              const pt = lms[idx];
              if (pt) {
                // Invert X because camera view is mirrored
                const x = (1.0 - pt.x) * canvas.width;
                const y = pt.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, idx === 1 ? 4 : 2.5, 0, 2 * Math.PI);
                ctx.fill();
              }
            }

            // Draw line between eyes to show roll
            const pL = lms[33];
            const pR = lms[263];
            if (pL && pR) {
              ctx.strokeStyle = '#14b8a6';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo((1.0 - pL.x) * canvas.width, pL.y * canvas.height);
              ctx.lineTo((1.0 - pR.x) * canvas.width, pR.y * canvas.height);
              ctx.stroke();
            }

            // Iris landmarks if available (468..477)
            if (lms.length >= 478) {
              const irisL = lms[468];
              const irisR = lms[473];
              ctx.fillStyle = '#38bdf8'; // sky-400
              if (irisL) {
                ctx.beginPath();
                ctx.arc((1.0 - irisL.x) * canvas.width, irisL.y * canvas.height, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
              if (irisR) {
                ctx.beginPath();
                ctx.arc((1.0 - irisR.x) * canvas.width, irisR.y * canvas.height, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }

          // Hand landmarks drawing
          if (inputMode === 'hand' && visionPipeline.latestHandResult?.landmarks?.[0]) {
            const hand = visionPipeline.latestHandResult.landmarks[0];
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)'; // teal-400
            ctx.fillStyle = '#14b8a6';

            // Draw palm and finger bones
            const connections = [
              [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
              [0, 5], [5, 6], [6, 7], [7, 8],       // Index
              [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
              [9, 13], [13, 14], [14, 15], [15, 16],// Ring
              [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
              [0, 17],                              // Palm base
            ];

            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const [startIdx, endIdx] of connections) {
              const pStart = hand[startIdx];
              const pEnd = hand[endIdx];
              if (pStart && pEnd) {
                ctx.moveTo((1.0 - pStart.x) * canvas.width, pStart.y * canvas.height);
                ctx.lineTo((1.0 - pEnd.x) * canvas.width, pEnd.y * canvas.height);
              }
            }
            ctx.stroke();

            // Draw joints
            for (let i = 0; i < hand.length; i++) {
              const pt = hand[i];
              if (pt) {
                const x = (1.0 - pt.x) * canvas.width;
                const y = pt.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, i === 4 || i === 8 ? 4 : 2.5, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }
        }
      }
      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [showLandmarks, isStreaming, inputMode]);

  return (
    <div className="relative w-full aspect-4/3 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex items-center justify-center">
      {/* Underlying Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100"
        autoPlay
        playsInline
        muted
      />

      {/* Foreground Technical Reticle & Landmarks Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Model Loading State */}
      {isLoadingModels && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-10">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          <span className="text-xs font-mono text-zinc-300 tracking-wide uppercase">
            Loading MediaPipe Models...
          </span>
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-4 text-center z-10">
          <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-100">Camera or Model Error</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">{error}</p>
          <button
            onClick={() => {
              if (videoRef.current) {
                visionPipeline.acquire(videoRef.current).catch(() => {});
              }
            }}
            className="mt-3 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded-md transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Not Streaming Placeholder */}
      {!isStreaming && !isLoadingModels && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2">
          <Camera className="w-8 h-8 stroke-[1.5]" />
          <span className="text-xs font-mono">Initializing camera...</span>
        </div>
      )}

      {/* Transient Quality Warning */}
      {isStreaming && qualityWarning && (
        <div className="absolute bottom-3 inset-x-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 backdrop-blur-xs">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{qualityWarning}</span>
        </div>
      )}
    </div>
  );
};
