import React from 'react';
import { PipelineHealthProbe } from '../components/PipelineHealthProbe';
import { Activity, ArrowLeft } from 'lucide-react';

export const HealthPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            <span>GestureLearn Pipeline Health Diagnostics</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time live probe across all 10 links of the vision, intent, cursor, and lesson chain
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        )}
      </div>

      <PipelineHealthProbe defaultExpanded={true} />
    </div>
  );
};
