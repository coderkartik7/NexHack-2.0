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
      visionPipeline.start(videoRef.current).catch((err) => {
        if (!isCancelled) {
          console.error('Failed to start vision pipeline:', err);
        }
      });
    }

    return () => {
      isCancelled = true;
      visionPipeline.stop();
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

          // Head landmarks drawing - refined teal technical aesthetic
          if (inputMode === 'head' && visionPipeline.latestFaceResult?.faceLandmarks?.[0]) {
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
          }

          // Hand landmarks drawing
          if (inputMode === 'hand' && visionPipeline.latestHandResult?.landmarks?.[0]) {
            const hand = visionPipeline.latestHandResult.landmarks[0];
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)'; // teal-400
            ctx.fillStyle = '#14b8a6';
            ctx.lineWidth = 1.5;

            // Hand connections
            const connections = [
              [0, 1], [1, 2], [2, 3], [3, 4], // thumb
              [0, 5], [5, 6], [6, 7], [7, 8], // index
              [5, 9], [9, 10], [10, 11], [11, 12], // middle
              [9, 13], [13, 14], [14, 15], [15, 16], // ring
              [13, 17], [17, 18], [18, 19], [19, 20], // pinky
              [0, 17], // palm base
            ];

            for (const [i, j] of connections) {
              const p1 = hand[i];
              const p2 = hand[j];
              ctx.beginPath();
              ctx.moveTo((1.0 - p1.x) * canvas.width, p1.y * canvas.height);
              ctx.lineTo((1.0 - p2.x) * canvas.width, p2.y * canvas.height);
              ctx.stroke();
            }

            // Draw landmark points
            for (let i = 0; i < hand.length; i++) {
              const pt = hand[i];
              const x = (1.0 - pt.x) * canvas.width;
              const y = pt.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, i === 8 ? 4.5 : 2.5, 0, 2 * Math.PI);
              ctx.fillStyle = i === 8 ? '#f43f5e' : '#2dd4bf';
              ctx.fill();
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
    <div className="relative w-full aspect-4/3 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-sm flex flex-col justify-end">
      {/* Video Element (mirrored display) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
        playsInline
        muted
      />

      {/* Canvas Overlay for landmarks */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Subtle corner reticle markings */}
      <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-400/80 bg-zinc-950/70 backdrop-blur-xs px-2 py-0.5 rounded border border-zinc-800">
        CAM_01 &bull; {inputMode.toUpperCase()}
      </div>

      {/* Loading state */}
      {isLoadingModels && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/85 text-zinc-100 z-20 backdrop-blur-xs">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2.5" />
          <p className="text-xs font-medium text-zinc-200">Initializing MediaPipe neural models</p>
          <span className="text-[11px] font-mono text-zinc-500 mt-1">FaceLandmarker & HandLandmarker</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 text-zinc-100 p-6 text-center z-30">
          <AlertCircle className="w-8 h-8 text-rose-400 mb-2.5" />
          <h3 className="text-sm font-semibold text-zinc-100">Video Capture Stream Offline</h3>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-sm font-mono leading-relaxed">{error}</p>
          <button
            onClick={() => {
              if (videoRef.current) {
                visionPipeline.start(videoRef.current).catch(() => {});
              }
            }}
            className="mt-4 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-xs font-medium text-zinc-200 transition-colors"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {/* Quality Warning Banner */}
      {qualityWarning && isStreaming && (
        <div className="absolute top-3 left-3 right-3 bg-amber-950/90 border border-amber-800/80 text-amber-300 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2 shadow-sm z-10 backdrop-blur-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{qualityWarning}</span>
        </div>
      )}

      {/* Idle / Off State indicator */}
      {!isStreaming && !isLoadingModels && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 z-10">
          <Camera className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-xs font-mono">Video stream standby</p>
        </div>
      )}
    </div>
  );
};
