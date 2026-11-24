import React, { useState, useEffect, useRef } from 'react';
import type { Participant, StudySession, SessionMetrics } from '../eval/types';
import type { LearnerProfile } from '../calibration/types';
import {
  listParticipants,
  listStudySessions,
  saveParticipant,
  saveStudySession,
  addFacilitatorMark,
  clearAllStudyData,
} from '../storage/studies';
import { listProfiles } from '../storage/profiles';
import { computeMetrics } from '../eval/metrics';
import { createInitialProtocolState, stepProtocol, type ProtocolState } from '../eval/protocol';
import { LiveSource } from '../sim/liveSource';
import { MouseSim } from '../sim/mouseSim';
import type { SignalSource } from '../sim/signalSource';
import { importAndRecomputeStudyBundle } from '../eval/export';

import { ParticipantSetup } from './ParticipantSetup';
import { ProtocolRunner } from './ProtocolRunner';
import { RestTestPanel } from './RestTestPanel';
import { FacilitatorBar } from './FacilitatorBar';
import { ResultsDashboard } from './ResultsDashboard';
import { LessonPage } from './LessonPage';

import { BarChart3, Users } from 'lucide-react';

export const StudyPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'protocol'>('dashboard');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [_sessions, setSessions] = useState<StudySession[]>([]);
  const [metricsList, setMetricsList] = useState<SessionMetrics[]>([]);

  // Protocol Runner state
  const [protocolState, setProtocolState] = useState<ProtocolState | null>(null);
  const [isStageRunning, setIsStageRunning] = useState(false);
  const [currentRunningStage, setCurrentRunningStage] = useState<string | null>(null);
  const [facilitatorMarkCount, setFacilitatorMarkCount] = useState(0);

  const activeSourceRef = useRef<SignalSource | null>(null);

  // Load database entities
  const reloadData = async () => {
    const prs = await listProfiles();
    setProfiles(prs);

    const parts = await listParticipants();
    setParticipants(parts);

    const ses = await listStudySessions();
    setSessions(ses);

    // Compute metrics for all sessions
    const calculatedMetrics: SessionMetrics[] = ses.map((s) => {
      return computeMetrics(s.events || [], {
        sessionId: s.id,
        participantId: s.participantId,
        profileId: s.profileId,
        condition: s.condition,
        mode: s.mode === 'rest_test' ? 'rest_test' : 'activity',
        source: s.source,
        durationMs: s.durationMs,
        quality: s.quality,
        facilitatorMarks: s.facilitatorMarks || [],
      });
    });

    setMetricsList(calculatedMetrics);
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleStartParticipant = async (p: Participant) => {
    await saveParticipant(p);
    const state = createInitialProtocolState(p.id, p.profileId, p.source);
    setProtocolState(state);
    setActiveSubTab('protocol');
    await reloadData();
  };

  const handleStartStage = async () => {
    if (!protocolState) return;

    const sessionId = `ses_${protocolState.participantId}_${protocolState.currentStage}_${Date.now()}`;
    const nextState = stepProtocol(protocolState, {
      type: 'START_STAGE',
      stage: protocolState.currentStage,
      sessionId,
    });

    setProtocolState(nextState);
    setIsStageRunning(true);
    setCurrentRunningStage(protocolState.currentStage);
    setFacilitatorMarkCount(0);

    // Create session record in Dexie
    const newSession: StudySession = {
      id: sessionId,
      participantId: protocolState.participantId,
      profileId: protocolState.profileId,
      stage: protocolState.currentStage,
      condition: protocolState.condition,
      mode: protocolState.currentStage === 'rest_test' ? 'rest_test' : protocolState.currentStage === 'practice' ? 'practice' : 'activity',
      source: protocolState.source,
      startedAt: Date.now(),
      durationMs: 0,
      quality: 'complete',
      events: [],
      facilitatorMarks: [],
    };

    await saveStudySession(newSession);

    // Wire signal source
    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
    }
    const currentProfile = profiles.find((pr) => pr.id === protocolState.profileId) || null;
    if (protocolState.source === 'mouse_sim') {
      activeSourceRef.current = new MouseSim(currentProfile);
    } else {
      activeSourceRef.current = new LiveSource();
    }
    await activeSourceRef.current.start();
  };

  const handleCompleteStage = async () => {
    if (!protocolState || !protocolState.activeSessionId) return;

    const ses = await listStudySessions();
    const currentSes = ses.find((s) => s.id === protocolState.activeSessionId);
    if (currentSes) {
      currentSes.endedAt = Date.now();
      currentSes.durationMs = Math.max(1000, currentSes.endedAt - currentSes.startedAt);
      currentSes.quality = 'complete';
      await saveStudySession(currentSes);
    }

    const nextState = stepProtocol(protocolState, { type: 'COMPLETE_STAGE' });
    setProtocolState(nextState);
    setIsStageRunning(false);
    setCurrentRunningStage(null);

    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
      activeSourceRef.current = null;
    }

    await reloadData();
  };

  const handleSkipStage = () => {
    if (!protocolState) return;
    const nextState = stepProtocol(protocolState, { type: 'SKIP_STAGE' });
    setProtocolState(nextState);
    setIsStageRunning(false);
    setCurrentRunningStage(null);
  };

  const handleAbortStage = async () => {
    if (!protocolState) return;
    const nextState = stepProtocol(protocolState, { type: 'ABORT_STAGE' });
    setProtocolState(nextState);
    setIsStageRunning(false);
    setCurrentRunningStage(null);
    await reloadData();
  };

  const handleRecalibrateRepeat = () => {
    if (!protocolState) return;
    const nextState = stepProtocol(protocolState, { type: 'TRANSITION_TO_RECALIBRATION' });
    setProtocolState(nextState);
    setIsStageRunning(false);
    setCurrentRunningStage(null);
  };

  const handleRestTestComplete = async (samples: any[], falseActivations: any[]) => {
    if (!protocolState || !protocolState.activeSessionId) return;

    const currentSes = await listStudySessions();
    const active = currentSes.find((s) => s.id === protocolState.activeSessionId);
    if (active) {
      active.restSamples = samples;
      active.endedAt = Date.now();
      active.durationMs = Math.max(60000, active.endedAt - active.startedAt);
      active.quality = 'complete';

      // Record false activations as events in session
      for (let i = 0; i < falseActivations.length; i++) {
        const fa = falseActivations[i];
        active.events.push({
          sessionId: active.id,
          profileId: active.profileId,
          seq: i + 1,
          t: fa.t,
          type: 'command_executed',
          command: fa.command,
          source: active.source,
          mode: 'rest_test',
        });
      }
      await saveStudySession(active);
    }

    handleCompleteStage();
  };

  const handleFacilitatorMark = async () => {
    if (!protocolState?.activeSessionId) return;
    const mark = {
      id: `mark_${Date.now()}`,
      sessionId: protocolState.activeSessionId,
      eventSeq: 1, // refers to latest command
      timestamp: Date.now(),
      note: 'Marked unintended by facilitator',
    };
    await addFacilitatorMark(mark);
    setFacilitatorMarkCount((c) => c + 1);
  };

  // Synthetic demo fallback loader
  const handleLoadSyntheticDemo = async () => {
    await clearAllStudyData();

    // Generate 2 synthetic participants with differing calibrated behaviors
    const syntheticP1: Participant = {
      id: 'P1',
      anonymousCode: 'P1',
      notes: 'SYNTHETIC DEMO: Head mode user with jawOpen select',
      profileId: profiles[0]?.id || 'prof_synthetic_head',
      source: 'live',
      consentGiven: true,
      consentTimestamp: Date.now() - 3600000,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    };

    const syntheticP2: Participant = {
      id: 'P2',
      anonymousCode: 'P2',
      notes: 'SYNTHETIC DEMO: Hand mode user with pinch select',
      profileId: profiles[1]?.id || profiles[0]?.id || 'prof_synthetic_hand',
      source: 'live',
      consentGiven: true,
      consentTimestamp: Date.now() - 3000000,
      createdAt: Date.now() - 3000000,
      updatedAt: Date.now() - 3000000,
    };

    await saveParticipant(syntheticP1);
    await saveParticipant(syntheticP2);

    // Activity session for P1 (Fast, 0 false fires)
    const sessionP1Activity: StudySession = {
      id: 'ses_P1_activity_syn',
      participantId: 'P1',
      profileId: syntheticP1.profileId,
      stage: 'activity',
      condition: 'baseline',
      mode: 'activity',
      source: 'live',
      isSynthetic: true,
      startedAt: Date.now() - 3500000,
      endedAt: Date.now() - 3450000,
      durationMs: 50000,
      quality: 'complete',
      events: [
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 1, t: 3000, type: 'command_executed', command: 'select', gestureOnsetT: 2820, executedT: 3000, source: 'live', mode: 'activity' }, // RT 180ms
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 2, t: 3200, type: 'answer_attempt', correct: true, target: 'opt_b', source: 'live', mode: 'activity' },
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 3, t: 15000, type: 'command_executed', command: 'grab', gestureOnsetT: 14790, executedT: 15000, source: 'live', mode: 'activity' }, // RT 210ms
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 4, t: 20000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 5, t: 28000, type: 'command_executed', command: 'grab', gestureOnsetT: 27810, executedT: 28000, source: 'live', mode: 'activity' }, // RT 190ms
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 6, t: 32000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 7, t: 40000, type: 'command_executed', command: 'grab', gestureOnsetT: 39800, executedT: 40000, source: 'live', mode: 'activity' }, // RT 200ms
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 8, t: 45000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P1_activity_syn', profileId: 'P1', seq: 9, t: 48000, type: 'task_complete', source: 'live', mode: 'activity' },
      ],
      facilitatorMarks: [],
    };

    // Rest test for P1 (60s, 0 false triggers)
    const sessionP1Rest: StudySession = {
      id: 'ses_P1_rest_syn',
      participantId: 'P1',
      profileId: syntheticP1.profileId,
      stage: 'rest_test',
      condition: 'baseline',
      mode: 'rest_test',
      source: 'live',
      isSynthetic: true,
      startedAt: Date.now() - 3400000,
      endedAt: Date.now() - 3340000,
      durationMs: 60000,
      quality: 'complete',
      events: [],
      facilitatorMarks: [],
      restSamples: Array.from({ length: 60 }).map((_, i) => ({
        t: i * 1000,
        signals: { jawOpen: 0.08 + Math.sin(i / 5) * 0.05 },
      })),
    };

    // Activity session for P2 (Slightly slower, 1 accidental undo)
    const sessionP2Activity: StudySession = {
      id: 'ses_P2_activity_syn',
      participantId: 'P2',
      profileId: syntheticP2.profileId,
      stage: 'activity',
      condition: 'baseline',
      mode: 'activity',
      source: 'live',
      isSynthetic: true,
      startedAt: Date.now() - 2900000,
      endedAt: Date.now() - 2830000,
      durationMs: 70000,
      quality: 'complete',
      events: [
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 1, t: 5000, type: 'command_executed', command: 'select', gestureOnsetT: 4740, executedT: 5000, undone: true, source: 'live', mode: 'activity' }, // RT 260ms, undone
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 2, t: 5200, type: 'undo', source: 'live', mode: 'activity' },
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 3, t: 8000, type: 'command_executed', command: 'select', gestureOnsetT: 7720, executedT: 8000, source: 'live', mode: 'activity' }, // RT 280ms
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 4, t: 8300, type: 'answer_attempt', correct: true, target: 'opt_b', source: 'live', mode: 'activity' },
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 5, t: 25000, type: 'command_executed', command: 'grab', gestureOnsetT: 24700, executedT: 25000, source: 'live', mode: 'activity' }, // RT 300ms
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 6, t: 30000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 7, t: 42000, type: 'command_executed', command: 'grab', gestureOnsetT: 41730, executedT: 42000, source: 'live', mode: 'activity' }, // RT 270ms
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 8, t: 47000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 9, t: 58000, type: 'command_executed', command: 'grab', gestureOnsetT: 57710, executedT: 58000, source: 'live', mode: 'activity' }, // RT 290ms
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 10, t: 63000, type: 'label_drop', correct: true, source: 'live', mode: 'activity' },
        { sessionId: 'ses_P2_activity_syn', profileId: 'P2', seq: 11, t: 67000, type: 'task_complete', source: 'live', mode: 'activity' },
      ],
      facilitatorMarks: [],
    };

    // Rest test for P2 (60s, 0 false triggers)
    const sessionP2Rest: StudySession = {
      id: 'ses_P2_rest_syn',
      participantId: 'P2',
      profileId: syntheticP2.profileId,
      stage: 'rest_test',
      condition: 'baseline',
      mode: 'rest_test',
      source: 'live',
      isSynthetic: true,
      startedAt: Date.now() - 2800000,
      endedAt: Date.now() - 2740000,
      durationMs: 60000,
      quality: 'complete',
      events: [],
      facilitatorMarks: [],
      restSamples: Array.from({ length: 60 }).map((_, i) => ({
        t: i * 1000,
        signals: { pinch: 0.65 + Math.sin(i / 6) * 0.08 },
      })),
    };

    await saveStudySession(sessionP1Activity);
    await saveStudySession(sessionP1Rest);
    await saveStudySession(sessionP2Activity);
    await saveStudySession(sessionP2Rest);

    await reloadData();
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all participant and study session records?')) {
      await clearAllStudyData();
      setProtocolState(null);
      setIsStageRunning(false);
      await reloadData();
    }
  };

  const handleImportBundle = async (json: string) => {
    try {
      const bundle = importAndRecomputeStudyBundle(json);
      await clearAllStudyData();
      for (const p of bundle.participants) {
        await saveParticipant(p);
      }
      for (const s of bundle.sessions) {
        await saveStudySession(s);
      }
      await reloadData();
      alert('Successfully imported study bundle and recomputed metrics.');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Sub Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 print:hidden">
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
              activeSubTab === 'dashboard'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700/60 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
            <span>Results Dashboard</span>
          </button>
          <button
            onClick={() => setActiveSubTab('protocol')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
              activeSubTab === 'protocol'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700/60 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-400" />
            <span>Guided Study Protocol</span>
          </button>
        </div>

        {protocolState && (
          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
            <span>
              Active: <strong>{protocolState.participantId}</strong>
            </span>
            <button
              onClick={() => setProtocolState(null)}
              className="text-zinc-500 hover:text-zinc-300 underline"
            >
              Exit Protocol
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'dashboard' ? (
        <ResultsDashboard
          metrics={metricsList}
          participants={participants}
          profiles={profiles}
          onLoadSyntheticDemo={handleLoadSyntheticDemo}
          onClearData={handleClearData}
          onImportBundle={handleImportBundle}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {!protocolState ? (
            <ParticipantSetup
              profiles={profiles}
              onStartSession={handleStartParticipant}
              existingParticipants={participants}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <ProtocolRunner
                state={protocolState}
                onStartStage={handleStartStage}
                onCompleteStage={handleCompleteStage}
                onSkipStage={handleSkipStage}
                onAbortStage={handleAbortStage}
                onRecalibrateRepeat={handleRecalibrateRepeat}
                isStageRunning={isStageRunning}
              />

              {/* Live Facilitator Control Bar */}
              {isStageRunning && (
                <FacilitatorBar
                  onMarkUnintended={handleFacilitatorMark}
                  onAddNote={() => prompt('Facilitator observation note:')}
                  markCount={facilitatorMarkCount}
                  lastCommandDescription="Recent command executed"
                />
              )}

              {/* Active Stage Execution Container */}
              {isStageRunning && currentRunningStage === 'rest_test' ? (
                <RestTestPanel
                  durationSeconds={60}
                  profile={profiles.find((p) => p.id === protocolState.profileId) || null}
                  source={activeSourceRef.current || new LiveSource()}
                  onComplete={handleRestTestComplete}
                  onAbort={handleAbortStage}
                />
              ) : isStageRunning ? (
                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
                  <div className="text-xs font-mono text-zinc-400 mb-4 pb-2 border-b border-zinc-850 flex items-center justify-between">
                    <span>
                      Live Stage: <strong className="text-teal-300 capitalize">{protocolState.currentStage}</strong>
                    </span>
                    <span>Use gestures hands-free to complete the activity below.</span>
                  </div>
                  <LessonPage />
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-lg text-center text-xs font-mono text-zinc-500">
                  Click &quot;Start Stage&quot; in the Protocol Runner above to begin the {protocolState.currentStage.replace(/_/g, ' ')} trial.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
