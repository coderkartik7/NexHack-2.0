import React, { useState } from 'react';
import type { Participant } from '../eval/types';
import type { LearnerProfile } from '../calibration/types';
import { UserCheck } from 'lucide-react';

interface ParticipantSetupProps {
  profiles: LearnerProfile[];
  onStartSession: (participant: Participant) => void;
  existingParticipants: Participant[];
}

export const ParticipantSetup: React.FC<ParticipantSetupProps> = ({
  profiles,
  onStartSession,
  existingParticipants,
}) => {
  const [participantId, setParticipantId] = useState(`P${existingParticipants.length + 1}`);
  const [notes, setNotes] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || '');
  const [source, setSource] = useState<'live' | 'mouse_sim' | 'replay'>('live');
  const [consentGiven, setConsentGiven] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId.trim()) {
      setValidationError('Participant code is required (e.g. P1, P2).');
      return;
    }
    if (!consentGiven) {
      setValidationError('Participant consent confirmation is required before beginning.');
      return;
    }
    if (!selectedProfileId) {
      setValidationError('Please select a calibrated learner profile.');
      return;
    }

    setValidationError(null);
    const participant: Participant = {
      id: participantId.trim(),
      anonymousCode: participantId.trim(),
      notes: notes.trim(),
      profileId: selectedProfileId,
      source,
      consentGiven: true,
      consentTimestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onStartSession(participant);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 max-w-xl mx-auto shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-zinc-800/80 pb-3 mb-4">
        <UserCheck className="w-4 h-4 text-teal-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Participant Setup & Study Consent</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs font-sans">
        {/* Anonymous ID */}
        <div>
          <label className="block text-zinc-300 font-semibold mb-1 font-mono uppercase text-[11px]">
            Anonymous Participant Code
          </label>
          <input
            type="text"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            placeholder="e.g. P1, P2"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 font-mono focus:outline-teal-500"
          />
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            Privacy rule: Use anonymous codes only. Do not record real names or identifying details.
          </p>
        </div>

        {/* Profile Selector */}
        <div>
          <label className="block text-zinc-300 font-semibold mb-1 font-mono uppercase text-[11px]">
            Calibrated Learner Profile
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 font-sans focus:outline-teal-500"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.mode} mode)
              </option>
            ))}
          </select>
        </div>

        {/* Signal Source Selector */}
        <div>
          <label className="block text-zinc-300 font-semibold mb-1 font-mono uppercase text-[11px]">
            Signal Source
          </label>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setSource('live')}
              className={`p-2 rounded border text-left transition-colors ${
                source === 'live'
                  ? 'border-teal-500 bg-teal-950/40 text-teal-300 font-semibold'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => setSource('mouse_sim')}
              className={`p-2 rounded border text-left transition-colors ${
                source === 'mouse_sim'
                  ? 'border-teal-500 bg-teal-950/40 text-teal-300 font-semibold'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              Mouse Simulator (J/K/L)
            </button>
          </div>
        </div>

        {/* Contextual Notes */}
        <div>
          <label className="block text-zinc-300 font-semibold mb-1 font-mono uppercase text-[11px]">
            Session & Learner Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Small comfortable range of motion, fatigue sensitive"
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 font-sans focus:outline-teal-500 resize-none"
          />
        </div>

        {/* Consent Checkbox */}
        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-md flex items-start gap-2.5">
          <input
            type="checkbox"
            id="consent_check"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="rounded accent-teal-500 text-teal-600 mt-0.5"
          />
          <label htmlFor="consent_check" className="text-zinc-300 leading-snug cursor-pointer select-none">
            <span className="font-semibold text-zinc-100 block mb-0.5">Informed Consent</span>
            <span>
              I confirm that the participant has consented to biometric intent evaluation. No video or imagery is ever stored or transmitted; only numerical signal and event telemetry are recorded locally.
            </span>
          </label>
        </div>

        {validationError && (
          <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
            {validationError}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold rounded-md text-xs transition-colors shadow-2xs mt-1"
        >
          Initialize Protocol Runner
        </button>
      </form>
    </div>
  );
};
