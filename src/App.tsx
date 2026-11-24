import { useState } from 'react';
import { DebugPage } from './pages/DebugPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { Activity, Sliders } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'debug' | 'calibration'>('debug');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top App Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20">
              G
            </div>
            <div>
              <span className="font-black text-lg text-white tracking-tight">GestureLearn</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                Phase 1 & 2
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('debug')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'debug'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              Vision Stream (Phase 1)
            </button>
            <button
              onClick={() => setActiveTab('calibration')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calibration'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Calibration & Profiles (Phase 2)
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === 'debug' ? <DebugPage /> : <CalibrationPage />}
      </main>

      {/* App Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        GestureLearn Client-Side Vision Engine • Zero Cloud Streaming (Privacy Safe) • 1€ Filtered
      </footer>
    </div>
  );
}

export default App;
