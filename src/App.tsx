import { useState } from 'react';
import { DebugPage } from './pages/DebugPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { LessonPage } from './components/LessonPage';
import { StudyPage } from './components/StudyPage';
import { HealthPage } from './pages/HealthPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Activity, Sliders, ShieldCheck, BookOpen, BarChart3, Stethoscope } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'study' | 'lesson' | 'debug' | 'calibration' | 'health'>('study');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-teal-500/20 selection:text-teal-200">
      {/* Precision Instrument Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-teal-400 font-mono font-semibold text-xs shadow-inner">
              GL
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm tracking-tight text-zinc-100">GestureLearn</span>
              <span className="hidden sm:inline-block text-[11px] text-zinc-500 font-mono">
                Hands-Free Classroom Control
              </span>
            </div>
          </div>

          {/* Navigation Segment Control */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveTab('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'study'
                  ? 'bg-zinc-800 text-teal-300 shadow-xs border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
              Evaluation Study
            </button>
            <button
              onClick={() => setActiveTab('lesson')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'lesson'
                  ? 'bg-zinc-800 text-teal-300 shadow-xs border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              Lesson Activity
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'debug'
                  ? 'bg-zinc-800 text-teal-300 shadow-xs border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              Live Telemetry
            </button>
            <button
              onClick={() => setActiveTab('calibration')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'calibration'
                  ? 'bg-zinc-800 text-teal-300 shadow-xs border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-teal-400" />
              Calibration & Profiles
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'health'
                  ? 'bg-zinc-800 text-teal-300 shadow-xs border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
              Health Probe
            </button>
          </nav>

          {/* Privacy badge */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-Cloud Edge AI</span>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <ErrorBoundary fallbackTitle="An error occurred in this view">
          {activeTab === 'study' ? (
            <StudyPage />
          ) : activeTab === 'lesson' ? (
            <LessonPage
              onNavigateToCalibration={() => setActiveTab('calibration')}
              onNavigateToProfiles={() => setActiveTab('calibration')}
            />
          ) : activeTab === 'debug' ? (
            <DebugPage />
          ) : activeTab === 'calibration' ? (
            <CalibrationPage />
          ) : (
            <HealthPage onBack={() => setActiveTab('lesson')} />
          )}
        </ErrorBoundary>
      </main>

      {/* Grounded Utility Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-3 text-[11px] text-zinc-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>GestureLearn Assistive Engine &middot; Phase 7 Production Build</div>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>MediaPipe WASM Engine</span>
            <span>1€ Adaptive Filter</span>
            <span>Local IndexedDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
