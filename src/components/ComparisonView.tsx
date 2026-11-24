import React from 'react';
import type { BetweenParticipantsComparison, ParticipantComparison } from '../eval/compare';
import { Users, ArrowRightLeft } from 'lucide-react';

interface ComparisonViewProps {
  betweenComparison: BetweenParticipantsComparison | null;
  recalibrationComparison: ParticipantComparison | null;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  betweenComparison,
  recalibrationComparison,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Between Participants Comparison (User A vs User B) */}
      {betweenComparison && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
                Cross-Participant Comparison (User A vs User B)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {betweenComparison.disclaimer}
            </span>
          </div>

          {/* Side by side comparison table */}
          <div className="overflow-x-auto border border-zinc-800 rounded-md">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Metric</th>
                  <th className="py-2.5 px-3 font-medium text-teal-300">
                    {betweenComparison.userA.participantId} ({betweenComparison.userA.profile?.name ?? 'Profile A'})
                  </th>
                  <th className="py-2.5 px-3 font-medium text-indigo-300">
                    {betweenComparison.userB.participantId} ({betweenComparison.userB.profile?.name ?? 'Profile B'})
                  </th>
                  <th className="py-2.5 px-3 font-medium text-zinc-400">Difference (B - A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">Input Modality</td>
                  <td className="py-2 px-3 text-zinc-200 capitalize">{betweenComparison.userA.profile?.mode ?? '--'} Mode</td>
                  <td className="py-2 px-3 text-zinc-200 capitalize">{betweenComparison.userB.profile?.mode ?? '--'} Mode</td>
                  <td className="py-2 px-3 text-zinc-500">&mdash;</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">Median Response Time</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userA.metrics?.responseTime.medianMs ?? '--'} ms</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userB.metrics?.responseTime.medianMs ?? '--'} ms</td>
                  <td className="py-2 px-3 font-semibold text-teal-400">
                    {betweenComparison.deltas.medianResponseTimeDiffMs !== null
                      ? `${betweenComparison.deltas.medianResponseTimeDiffMs > 0 ? '+' : ''}${betweenComparison.deltas.medianResponseTimeDiffMs} ms`
                      : '--'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">P90 Response Time</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userA.metrics?.responseTime.p90Ms ?? '--'} ms</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userB.metrics?.responseTime.p90Ms ?? '--'} ms</td>
                  <td className="py-2 px-3 text-zinc-400">
                    {betweenComparison.deltas.p90ResponseTimeDiffMs !== null
                      ? `${betweenComparison.deltas.p90ResponseTimeDiffMs > 0 ? '+' : ''}${betweenComparison.deltas.p90ResponseTimeDiffMs} ms`
                      : '--'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">Accidental Activations (Activity)</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userA.metrics?.accidental.total ?? 0}</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userB.metrics?.accidental.total ?? 0}</td>
                  <td className="py-2 px-3 text-zinc-400">
                    {betweenComparison.deltas.accidentalTotalDiff !== null
                      ? `${betweenComparison.deltas.accidentalTotalDiff > 0 ? '+' : ''}${betweenComparison.deltas.accidentalTotalDiff}`
                      : '--'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">Accidental Activations (Rest / min)</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userA.metrics?.accidental.duringRest ?? 0}</td>
                  <td className="py-2 px-3 text-zinc-200">{betweenComparison.userB.metrics?.accidental.duringRest ?? 0}</td>
                  <td className="py-2 px-3 text-zinc-400">&mdash;</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-zinc-300 font-sans">Task Execution Total Time</td>
                  <td className="py-2 px-3 text-zinc-200">
                    {betweenComparison.userA.metrics?.tasks.taskTimesMs.total !== null
                      ? `${(betweenComparison.userA.metrics!.tasks.taskTimesMs.total! / 1000).toFixed(1)} s`
                      : '--'}
                  </td>
                  <td className="py-2 px-3 text-zinc-200">
                    {betweenComparison.userB.metrics?.tasks.taskTimesMs.total !== null
                      ? `${(betweenComparison.userB.metrics!.tasks.taskTimesMs.total! / 1000).toFixed(1)} s`
                      : '--'}
                  </td>
                  <td className="py-2 px-3 text-zinc-400">
                    {betweenComparison.deltas.tasksTotalTimeDiffMs !== null
                      ? `${(betweenComparison.deltas.tasksTotalTimeDiffMs / 1000).toFixed(1)} s`
                      : '--'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual SVG Comparison Bars (Lightweight, robust, no external chart crash) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {/* Response Time Bar Visualizer */}
            <div className="bg-zinc-950 p-3.5 rounded-md border border-zinc-850 flex flex-col gap-2">
              <span className="text-[11px] font-mono text-zinc-400 uppercase">Median Latency Comparison (ms)</span>
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div>
                  <div className="flex justify-between mb-1 text-[11px] text-zinc-400">
                    <span>{betweenComparison.userA.participantId}</span>
                    <span className="text-teal-400">{betweenComparison.userA.metrics?.responseTime.medianMs ?? 0} ms</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-3 rounded overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-xs transition-all"
                      style={{
                        width: `${Math.min(100, ((betweenComparison.userA.metrics?.responseTime.medianMs ?? 0) / 600) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-[11px] text-zinc-400">
                    <span>{betweenComparison.userB.participantId}</span>
                    <span className="text-indigo-400">{betweenComparison.userB.metrics?.responseTime.medianMs ?? 0} ms</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-3 rounded overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-xs transition-all"
                      style={{
                        width: `${Math.min(100, ((betweenComparison.userB.metrics?.responseTime.medianMs ?? 0) / 600) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Accidental Activations Visualizer */}
            <div className="bg-zinc-950 p-3.5 rounded-md border border-zinc-850 flex flex-col gap-2">
              <span className="text-[11px] font-mono text-zinc-400 uppercase">Accidental Activations (Count)</span>
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div>
                  <div className="flex justify-between mb-1 text-[11px] text-zinc-400">
                    <span>{betweenComparison.userA.participantId} (Activity / Rest)</span>
                    <span className="text-teal-400">{betweenComparison.userA.metrics?.accidental.total ?? 0}</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-3 rounded overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-xs transition-all"
                      style={{
                        width: `${Math.min(100, ((betweenComparison.userA.metrics?.accidental.total ?? 0) / 10) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-[11px] text-zinc-400">
                    <span>{betweenComparison.userB.participantId} (Activity / Rest)</span>
                    <span className="text-indigo-400">{betweenComparison.userB.metrics?.accidental.total ?? 0}</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-3 rounded overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-xs transition-all"
                      style={{
                        width: `${Math.min(100, ((betweenComparison.userB.metrics?.accidental.total ?? 0) / 10) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Before vs After Recalibration Comparison */}
      {recalibrationComparison?.recalibrationDelta && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2.5">
            <ArrowRightLeft className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              Recalibration Impact Analysis ({recalibrationComparison.participantId})
            </h3>
          </div>

          <p className="text-xs font-medium text-teal-200">
            {recalibrationComparison.recalibrationDelta.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs font-mono">
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850">
              <span className="text-[10px] text-zinc-500 uppercase block">Latency Delta</span>
              <span className="font-semibold text-zinc-200">
                {recalibrationComparison.recalibrationDelta.medianResponseTimeDeltaMs !== null
                  ? `${recalibrationComparison.recalibrationDelta.medianResponseTimeDeltaMs} ms`
                  : '--'}
              </span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850">
              <span className="text-[10px] text-zinc-500 uppercase block">Tail (P90) Delta</span>
              <span className="font-semibold text-zinc-200">
                {recalibrationComparison.recalibrationDelta.p90ResponseTimeDeltaMs !== null
                  ? `${recalibrationComparison.recalibrationDelta.p90ResponseTimeDeltaMs} ms`
                  : '--'}
              </span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850">
              <span className="text-[10px] text-zinc-500 uppercase block">Accidental Delta</span>
              <span className="font-semibold text-zinc-200">
                {recalibrationComparison.recalibrationDelta.accidentalActivityDelta !== null
                  ? `${recalibrationComparison.recalibrationDelta.accidentalActivityDelta > 0 ? '+' : ''}${recalibrationComparison.recalibrationDelta.accidentalActivityDelta}`
                  : '--'}
              </span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850">
              <span className="text-[10px] text-zinc-500 uppercase block">Total Time Delta</span>
              <span className="font-semibold text-zinc-200">
                {recalibrationComparison.recalibrationDelta.taskTotalTimeDeltaMs !== null
                  ? `${(recalibrationComparison.recalibrationDelta.taskTotalTimeDeltaMs / 1000).toFixed(1)} s`
                  : '--'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
