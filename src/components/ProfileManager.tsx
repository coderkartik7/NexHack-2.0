import React, { useState, useEffect } from 'react';
import {
  listProfiles,
  deleteProfile,
  duplicateProfile,
  renameProfile,
  getActiveProfileId,
  setActiveProfileId,
  exportProfileToJson,
  importProfileFromJson,
  saveProfile,
} from '../storage/profiles';
import type { LearnerProfile } from '../calibration/types';
import {
  User,
  CheckCircle,
  Copy,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Edit2,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

interface ProfileManagerProps {
  onStartCalibration: () => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ onStartCalibration }) => {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const list = await listProfiles();
    setProfiles(list);
    const active = getActiveProfileId();
    setActiveId(active);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSetActive = (id: string) => {
    setActiveProfileId(id);
    setActiveId(id);
    setNotification('Active learner profile changed.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete profile "${name}"?`)) {
      await deleteProfile(id);
      await refresh();
      setNotification(`Profile "${name}" removed.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateProfile(id);
    await refresh();
  };

  const handleStartRename = (profile: LearnerProfile) => {
    setEditingId(profile.id);
    setRenameText(profile.name);
  };

  const handleSaveRename = async (id: string) => {
    if (renameText.trim()) {
      await renameProfile(id, renameText.trim());
      setEditingId(null);
      await refresh();
    }
  };

  const handleExport = (profile: LearnerProfile) => {
    const jsonStr = exportProfileToJson(profile);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesturelearn-profile-${profile.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = importProfileFromJson(text);
        await saveProfile(imported);
        await refresh();
        setActiveProfileId(imported.id);
        setActiveId(imported.id);
        setNotification(`Successfully imported profile "${imported.name}".`);
        setTimeout(() => setNotification(null), 4000);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid profile JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getReliabilityBadge = (rating: string) => {
    if (rating === 'reliable') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
          Reliable
        </span>
      );
    }
    if (rating === 'marginal') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
          Marginal
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
        Unreliable
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      {/* Top Banner & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <User className="w-7 h-7 text-indigo-400" />
            Learner Profiles Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage individual calibrated thresholds and comfort ranges stored securely in IndexedDB
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-sm">
            <Upload className="w-4 h-4 text-slate-400" />
            Import Profile
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            onClick={onStartCalibration}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-102"
          >
            <Sparkles className="w-4 h-4" />
            New Calibration Wizard
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {notification}
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-300 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Profiles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {profiles.map((p) => {
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                        p.mode === 'head'
                          ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      {editingId === p.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(p.id)}
                            className="text-xs bg-indigo-600 px-2 py-1 rounded text-white"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">{p.name}</h3>
                          <button
                            onClick={() => handleStartRename(p)}
                            className="text-slate-500 hover:text-slate-300"
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-slate-400">
                        Mode: <span className="capitalize font-semibold text-slate-300">{p.mode}</span> • Calibrated{' '}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <span className="px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-indigo-400" />
                      Active
                    </span>
                  )}
                </div>

                {/* Command Reliability Badges */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 my-3 flex flex-col gap-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Calibrated Gestures & Reliability
                  </div>
                  <div className="space-y-1.5">
                    {(['select', 'grab', 'pause'] as const).map((cmd) => {
                      const binding = p.commands[cmd];
                      if (!binding) return null;
                      return (
                        <div
                          key={cmd}
                          className="flex items-center justify-between text-xs py-0.5 border-b border-slate-900 last:border-0"
                        >
                          <span className="font-mono text-slate-300 capitalize font-medium">
                            {cmd} ({binding.signal})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-500">
                              thr: {binding.enter}
                            </span>
                            {getReliabilityBadge(binding.separability?.rating ?? 'reliable')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Range mapping summary */}
                <div className="text-xs text-slate-400 flex items-center gap-2 mb-4">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Range Gain: X {p.cursorMapping?.gainX?.toFixed(1) ?? '1.0'}x, Y{' '}
                    {p.cursorMapping?.gainY?.toFixed(1) ?? '1.0'}x
                  </span>
                </div>
              </div>

              {/* Bottom Card Controls */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => handleSetActive(p.id)}
                      className="text-xs font-bold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(p.id)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Duplicate Profile"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExport(p)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Export JSON"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 transition-colors"
                  title="Delete Profile"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="col-span-2 bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center">
            <User className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-slate-200">No Learner Profiles Yet</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
              Calibrate individual resting baseline, comfortable range of motion, and activation gestures to avoid false triggers.
            </p>
            <button
              onClick={onStartCalibration}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm"
            >
              Run First Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
