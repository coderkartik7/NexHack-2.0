import React, { useState } from 'react';
import type { SessionMetrics, Participant } from '../eval/types';
import type { LearnerProfile } from '../calibration/types';
import { MetricCard } from './MetricCard';
import { ThresholdCompare } from './ThresholdCompare';
import { ComparisonView } from './ComparisonView';
import { ErrorBoundary } from './ErrorBoundary';
import { compareParticipants, compareConditions, generateFindingsNarrative } from '../eval/compare';
import { exportMetricsToCsv, exportStudyBundleToJson, METHODOLOGY_BLOCK } from '../eval/export';
import { Printer, Download, FileText } from 'lucide-react';

interface ResultsDashboardProps {
  metrics: SessionMetrics[];
  participants: Participant[];
  profiles: LearnerProfile[];
  onLoadSyntheticDemo: () => void;
  onClearData: () => void;
  onImportBundle: (json: string) => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  metrics,
  participants,
  profiles,
  onLoadSyntheticDemo,
  onClearData,
  onImportBundle,
}) => {
  const [includeSimulated, setIncludeSimulated] = useState(false);
  const [selectedUserA, setSelectedUserA] = useState(participants[0]?.id || 'P1');
  const [selectedUserB, setSelectedUserB] = useState(participants[1]?.id || participants[0]?.id || 'P2');

  // Filter metrics: exclude simulated unless toggled
  const activeMetrics = metrics.filter((m) => {
    if (!includeSimulated && (m.source === 'mouse_sim' || m.source === 'replay')) {
      return false;
    }
    return true;
  });

  // Export functions
  const handleExportCsv = () => {
    const csv = exportMetricsToCsv(activeMetrics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesturelearn-metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const bundle = {
      schemaVersion: '1.0.0' as const,
      exportedAt: Date.now(),
      isSynthetic: participants.some((p) => p.notes.includes('SYNTHETIC')),
      methodology: METHODOLOGY_BLOCK,
      participants,
      profiles,
      sessions: [],
      metrics: activeMetrics,
    };
    const json = exportStudyBundleToJson(bundle);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesturelearn-study-bundle-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) onImportBundle(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Participant comparisons setup
  const pA = participants.find((p) => p.id === selectedUserA) || participants[0] || null;
  const pB = participants.find((p) => p.id === selectedUserB) || participants[1] || null;

  const profA = profiles.find((p) => p.id === pA?.profileId) || null;
  const profB = profiles.find((p) => p.id === pB?.profileId) || null;

  const metricsA = activeMetrics.find((m) => m.participantId === selectedUserA && m.mode === 'activity') || null;
  const restMetricsA = activeMetrics.find((m) => m.participantId === selectedUserA && m.mode === 'rest_test') || null;

  const metricsB = activeMetrics.find((m) => m.participantId === selectedUserB && m.mode === 'activity') || null;
  const restMetricsB = activeMetrics.find((m) => m.participantId === selectedUserB && m.mode === 'rest_test') || null;

  const betweenComparison =
    pA && pB
      ? compareParticipants(
          { participantId: pA.id, profile: profA, metrics: metricsA },
          { participantId: pB.id, profile: profB, metrics: metricsB }
        )
      : null;

  // Recalibration comparisons
  const mBaselineA = activeMetrics.find((m) => m.participantId === selectedUserA && m.condition === 'baseline' && m.mode === 'activity') || null;
  const mAfterA = activeMetrics.find((m) => m.participantId === selectedUserA && m.condition === 'after_recalibration' && m.mode === 'activity') || null;
  const recalDelta = compareConditions(mBaselineA, mAfterA);

  const findingsNarrativeA = pA ? generateFindingsNarrative(pA.id, metricsA, restMetricsA, profA) : [];
  const findingsNarrativeB = pB && pB.id !== pA?.id ? generateFindingsNarrative(pB.id, metricsB, restMetricsB, profB) : [];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20 print:p-0 print:max-w-none">
      {/* Top Header & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4 print:border-zinc-300">
        <div>
          <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider font-semibold block">
            Phase 7: Empirical Study Evaluation
          </span>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight print:text-black">
            Pilot Study Evaluation & Findings Dashboard
          </h1>
          <p className="text-xs text-zinc-400 print:text-zinc-600 mt-0.5">
            Two-user empirical pilot evaluating latency, resting noise immunity, and intentional accuracy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-md text-xs font-mono text-zinc-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-md text-xs font-mono text-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-md text-xs font-mono text-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Bundle</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-md text-xs font-mono text-zinc-200 cursor-pointer transition-colors">
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* Demo Fallback & Simulation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 p-3 rounded-lg border border-zinc-800 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onLoadSyntheticDemo}
            className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800 rounded-md text-xs font-semibold font-mono transition-colors shadow-2xs"
            title="Load synthetic two-participant dataset for judges/demo evaluation"
          >
            Load Demo Data (Fallback)
          </button>

          <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSimulated}
              onChange={(e) => setIncludeSimulated(e.target.checked)}
              className="rounded accent-teal-500"
            />
            <span>Include Simulated Runs ({metrics.filter((m) => m.source !== 'live').length})</span>
          </label>
        </div>

        <button
          onClick={onClearData}
          className="text-xs font-mono text-zinc-500 hover:text-rose-400 transition-colors"
        >
          Clear Study Database
        </button>
      </div>

      {/* Participant Metric Cards */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
          Per-Participant Primary Metrics
        </h2>

        {participants.length === 0 && (
          <div className="bg-zinc-900/40 border border-dashed border-zinc-800 p-8 rounded-lg text-center text-xs font-mono text-zinc-500">
            No study sessions recorded yet. Run the Guided Protocol or click &quot;Load Demo Data&quot;.
          </div>
        )}

        {participants.map((p) => {
          const actM = activeMetrics.find((m) => m.participantId === p.id && m.mode === 'activity');
          const restM = activeMetrics.find((m) => m.participantId === p.id && m.mode === 'rest_test');

          return (
            <div
              key={p.id}
              className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-xs text-teal-400 uppercase">
                    Participant {p.id}
                  </span>
                  <span className="text-xs text-zinc-300">
                    &middot; {profiles.find((pr) => pr.id === p.profileId)?.name ?? 'Calibrated Profile'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Consent: Confirmed ({new Date(p.consentTimestamp).toLocaleTimeString()})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <MetricCard
                  label="Median Latency"
                  value={actM?.responseTime.medianMs ?? null}
                  unit="ms"
                  subtext="Response time"
                  n={actM?.responseTime.count}
                  source={actM?.source}
                />
                <MetricCard
                  label="P90 Latency"
                  value={actM?.responseTime.p90Ms ?? null}
                  unit="ms"
                  subtext="Tail latency"
                  n={actM?.responseTime.count}
                  source={actM?.source}
                />
                <MetricCard
                  label="Accidental (Activity)"
                  value={actM?.accidental.total ?? 0}
                  subtext="Undone / flagged"
                  n={actM?.n.totalEvents}
                  source={actM?.source}
                />
                <MetricCard
                  label="False Fires (Rest)"
                  value={restM?.accidental.duringRest ?? 0}
                  subtext={restM?.durationMs ? `${Math.round(restM.durationMs / 1000)}s rest test` : '60s test'}
                  n={restM?.n.totalEvents}
                  source={restM?.source}
                  highlight={restM?.accidental.duringRest === 0}
                />
                <MetricCard
                  label="Tasks Completed"
                  value={actM?.tasks.completed ? '100%' : 'Incomplete'}
                  subtext="Lesson flow"
                  source={actM?.source}
                />
                <MetricCard
                  label="Tracking Loss"
                  value={actM?.tracking.lostCount ?? 0}
                  subtext={actM ? `${(actM.tracking.totalLostMs / 1000).toFixed(1)}s lost` : undefined}
                  source={actM?.source}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Participant Comparison Section */}
      <div className="mt-2 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
            Empirical Comparison & Thresholds
          </h2>

          {participants.length >= 2 && (
            <div className="flex items-center gap-2 text-xs font-mono print:hidden">
              <span className="text-zinc-500">Compare:</span>
              <select
                value={selectedUserA}
                onChange={(e) => setSelectedUserA(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
              <span className="text-zinc-500">vs</span>
              <select
                value={selectedUserB}
                onChange={(e) => setSelectedUserB(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <ErrorBoundary fallbackTitle="Unable to display comparative analytics">
          <ComparisonView
            betweenComparison={betweenComparison}
            recalibrationComparison={
              recalDelta
                ? {
                    participantId: selectedUserA,
                    baseline: mBaselineA,
                    afterRecalibration: mAfterA,
                    recalibrationDelta: recalDelta,
                  }
                : null
            }
          />

          <ThresholdCompare
            profileA={profA}
            profileB={profB}
            participantAId={pA?.id ?? 'User A'}
            participantBId={pB?.id ?? 'User B'}
          />
        </ErrorBoundary>
      </div>

      {/* Auto-Generated Factual Findings Section */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 flex flex-col gap-3 mt-2">
        <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
          <FileText className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
            Auto-Generated Empirical Findings Summary
          </h3>
        </div>

        <div className="space-y-3 text-xs text-zinc-300 font-sans leading-relaxed">
          {findingsNarrativeA.length > 0 && (
            <div>
              <span className="font-mono font-semibold text-teal-300 block mb-1">
                Participant {pA?.id}:
              </span>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 font-mono text-[11px]">
                {findingsNarrativeA.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {findingsNarrativeB.length > 0 && (
            <div className="border-t border-zinc-850 pt-2">
              <span className="font-mono font-semibold text-indigo-300 block mb-1">
                Participant {pB?.id}:
              </span>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 font-mono text-[11px]">
                {findingsNarrativeB.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-zinc-500 border-t border-zinc-850 pt-2">
          Methodology note: All metrics are derived from timestamped SessionEvent records stored locally in IndexedDB. Zero video recordings are created or exported.
        </div>
      </div>
    </div>
  );
};
