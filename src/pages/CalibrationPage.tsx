import React, { useState } from 'react';
import { CalibrationWizard } from '../components/CalibrationWizard';
import { ProfileManager } from '../components/ProfileManager';
import { CameraView } from '../components/CameraView';
import { useCalibrationStore } from '../calibration/store';
import { ArrowLeft, Video } from 'lucide-react';

export const CalibrationPage: React.FC = () => {
  const [isWizardActive, setIsWizardActive] = useState(false);
  const resetWizard = useCalibrationStore((s) => s.resetWizard);

  const handleStartCalibration = () => {
    resetWizard();
    setIsWizardActive(true);
  };

  const handleWizardComplete = () => {
    setIsWizardActive(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Learner Calibration & Profiles</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Individual resting baseline estimation, range of motion mapping, and hysteresis thresholds
          </p>
        </div>

        {isWizardActive && (
          <button
            onClick={() => setIsWizardActive(false)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-md transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Profiles
          </button>
        )}
      </div>

      {isWizardActive ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/60 p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Video className="w-3.5 h-3.5 text-teal-400" />
                <span>Webcam Telemetry Feed</span>
              </div>
              <CameraView showLandmarks={true} />
              <p className="text-[11px] text-zinc-400 font-mono leading-relaxed mt-1">
                Maintain your face or hand comfortably within the viewfinder during calibration steps.
              </p>
            </div>
          </div>
          <div className="lg:col-span-8">
            <CalibrationWizard onComplete={handleWizardComplete} />
          </div>
        </div>
      ) : (
        <ProfileManager onStartCalibration={handleStartCalibration} />
      )}
    </div>
  );
};
