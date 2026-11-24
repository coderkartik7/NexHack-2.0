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
  CheckCircle2,
  Copy,
  Trash2,
  Download,
  Upload,
  Plus,
  Check,
  Edit2,
  Sliders,
  AlertCircle,
  Eye,
  Hand,
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
    setNotification('Active learner profile set.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete calibrated profile "${name}"? This cannot be undone.`)) {
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
        setNotification(`Imported profile "${imported.name}".`);
        setTimeout(() => setNotification(null), 4000);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid profile configuration.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getReliabilityBadge = (rating: string) => {
    if (rating === 'reliable') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">
          Reliable
        </span>
      );
    }
    if (rating === 'marginal') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/60 text-amber-400 border border-amber-900/60">
          Marginal
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-950/60 text-rose-400 border border-rose-900/60">
        Review
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      {/* Top Banner & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-400" />
            Configured Learner Profiles
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Individual resting baselines, calibrated ranges, and activation bounds stored in IndexedDB
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 rounded-md text-xs font-medium cursor-pointer transition-colors shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            Import JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            onClick={onStartCalibration}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 rounded-md text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New Calibration
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {notification}
        </div>
      )}

      {error && (
        <div className="bg-rose-950/60 border border-rose-800/80 text-rose-300 px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          {error}
        </div>
      )}

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((p) => {
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              className={`bg-zinc-900/60 border rounded-lg p-4 flex flex-col justify-between transition-colors ${
                isActive
                  ? 'border-teal-500/80 bg-zinc-900/90 shadow-2xs'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center font-mono font-semibold text-xs border ${
                        p.mode === 'head'
                          ? 'bg-zinc-950 text-teal-400 border-zinc-800'
                          : 'bg-zinc-950 text-emerald-400 border-zinc-800'
                      }`}
                    >
                      {p.mode === 'head' ? <Eye className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
                    </div>
                    <div>
                      {editingId === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 focus:outline-teal-500 font-sans"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(p.id)}
                            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-0.5 rounded text-zinc-200"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-100 text-sm">{p.name}</h3>
                          <button
                            onClick={() => handleStartRename(p)}
                            className="text-zinc-500 hover:text-zinc-300"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        <span className="capitalize">{p.mode}</span> Mode &bull; Calibrated{' '}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <span className="px-2 py-0.5 bg-teal-950/60 text-teal-400 border border-teal-800/80 rounded text-[10px] font-mono font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                {/* Command Reliability Breakdown */}
                <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-md p-2.5 my-3 flex flex-col gap-1.5">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Calibrated Triggers & Separation
                  </div>
                  <div className="space-y-1">
                    {(['select', 'grab', 'pause'] as const).map((cmd) => {
                      const binding = p.commands[cmd];
                      if (!binding) return null;
                      return (
                        <div
                          key={cmd}
                          className="flex items-center justify-between text-xs py-0.5 border-b border-zinc-900 last:border-0"
                        >
                          <span className="font-mono text-zinc-300 capitalize text-xs">
                            {cmd} <span className="text-zinc-500">({binding.signal})</span>
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-zinc-500">
                              thr: <span className="text-zinc-300">{binding.enter}</span>
                            </span>
                            {getReliabilityBadge(binding.separability?.rating ?? 'reliable')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Range mapping summary */}
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 mb-3">
                  <Sliders className="w-3 h-3 text-zinc-500" />
                  <span>
                    Cursor Gain: X {p.cursorMapping?.gainX?.toFixed(1) ?? '1.0'}x &middot; Y{' '}
                    {p.cursorMapping?.gainY?.toFixed(1) ?? '1.0'}x
                  </span>
                </div>
              </div>

              {/* Bottom Card Controls */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                <div className="flex items-center gap-1.5">
                  {!isActive && (
                    <button
                      onClick={() => handleSetActive(p.id)}
                      className="text-xs font-medium px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 rounded transition-colors"
                    >
                      Set as Active
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(p.id)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
                    title="Duplicate Profile"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleExport(p)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
                    title="Export Profile JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors"
                  title="Delete Profile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="col-span-2 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-lg p-10 text-center flex flex-col items-center">
            <User className="w-8 h-8 text-zinc-600 mb-2.5" />
            <h3 className="text-sm font-semibold text-zinc-200">No Learner Profiles Configured</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-5">
              Run the calibration wizard to compute resting baselines and hysteresis thresholds tailored to the learner.
            </p>
            <button
              onClick={onStartCalibration}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 rounded-md font-semibold text-xs transition-colors"
            >
              Start Initial Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
