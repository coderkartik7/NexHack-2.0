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

  // Draw landmark overlay
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

          // Head landmarks drawing
          if (inputMode === 'head' && visionPipeline.latestFaceResult?.faceLandmarks?.[0]) {
            const lms = visionPipeline.latestFaceResult.faceLandmarks[0];
            ctx.fillStyle = '#38bdf8'; // sky-400
            // Draw essential landmarks: eyes, nose, mouth
            const keyPoints = [1, 33, 133, 263, 362, 61, 291, 13, 14, 10, 152];
            for (const idx of keyPoints) {
              const pt = lms[idx];
              if (pt) {
                // Invert X because camera view is mirrored
                const x = (1.0 - pt.x) * canvas.width;
                const y = pt.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, idx === 1 ? 5 : 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            }

            // Draw line between eyes to show roll
            const pL = lms[33];
            const pR = lms[263];
            if (pL && pR) {
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo((1.0 - pL.x) * canvas.width, pL.y * canvas.height);
              ctx.lineTo((1.0 - pR.x) * canvas.width, pR.y * canvas.height);
              ctx.stroke();
            }
          }

          // Hand landmarks drawing
          if (inputMode === 'hand' && visionPipeline.latestHandResult?.landmarks?.[0]) {
            const hand = visionPipeline.latestHandResult.landmarks[0];
            ctx.strokeStyle = '#4ade80'; // green-400
            ctx.fillStyle = '#22c55e';
            ctx.lineWidth = 2;

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
              ctx.arc(x, y, i === 8 ? 6 : 3, 0, 2 * Math.PI);
              ctx.fillStyle = i === 8 ? '#f43f5e' : '#4ade80';
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
    <div className="relative w-full max-w-xl aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
      {/* Video Element (mirrored display) */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100"
        playsInline
        muted
      />

      {/* Canvas Overlay for landmarks */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Loading state */}
      {isLoadingModels && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white z-20 backdrop-blur-xs">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-3" />
          <p className="text-base font-medium">Initializing MediaPipe Vision AI models...</p>
          <span className="text-xs text-slate-400 mt-1">This happens once per session</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 text-white p-6 text-center z-30">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <h3 className="text-lg font-bold">Camera Initialization Failed</h3>
          <p className="text-sm text-red-200 mt-2 max-w-md">{error}</p>
          <button
            onClick={() => {
              if (videoRef.current) {
                visionPipeline.start(videoRef.current).catch(() => {});
              }
            }}
            className="mt-5 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition-colors"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {/* Quality Warning Banner */}
      {qualityWarning && isStreaming && (
        <div className="absolute top-3 left-3 right-3 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg z-10 backdrop-blur-xs animate-pulse">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{qualityWarning}</span>
        </div>
      )}

      {/* Idle / Off State indicator */}
      {!isStreaming && !isLoadingModels && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10">
          <Camera className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">Webcam is inactive</p>
        </div>
      )}
    </div>
  );
};
