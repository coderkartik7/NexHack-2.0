import React, { useState } from 'react';
import { CalibrationWizard } from '../components/CalibrationWizard';
import { ProfileManager } from '../components/ProfileManager';
import { CameraView } from '../components/CameraView';
import { useCalibrationStore } from '../calibration/store';

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
      {/* Top Section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Learner Calibration & Customization</h1>
          <p className="text-sm text-slate-400">
            Per-learner baseline adaptation, hysteresis thresholding, and input mapping
          </p>
        </div>

        {isWizardActive && (
          <button
            onClick={() => setIsWizardActive(false)}
            className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
          >
            Back to Profiles
          </button>
        )}
      </div>

      {isWizardActive ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <CameraView showLandmarks={true} />
            <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
              <span className="font-bold text-slate-200 block mb-1">Webcam Monitoring</span>
              Keep your face or hand comfortably centered within frame during calibration.
            </div>
          </div>
          <div className="lg:col-span-2">
            <CalibrationWizard onComplete={handleWizardComplete} />
          </div>
        </div>
      ) : (
        <ProfileManager onStartCalibration={handleStartCalibration} />
      )}
    </div>
  );
};
