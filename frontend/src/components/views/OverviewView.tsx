import React from 'react';
import {
  Crosshair,
  Video,
  Database,
  Tag,
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Inbox,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export const OverviewView: React.FC = () => {
  const { stats, samples, activities, setActiveTab } = useApp();

  const totalSamples = stats?.total_samples ?? 0;
  const uniqueLabels = stats?.unique_labels ?? 0;
  const pendingReview = stats?.pending_review ?? 0;
  const approvedSamples = stats?.approved_samples ?? 0;

  // Calculate actual approved percentage
  const approvedPercentage =
    totalSamples > 0 ? Math.round((approvedSamples / totalSamples) * 100) : 0;
  const pendingPercentage =
    totalSamples > 0 ? Math.round((pendingReview / totalSamples) * 100) : 0;

  const recentSamples = samples.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-[11px] font-medium text-indigo-700 font-mono">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              SignBridge Intelligence Studio
            </div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Research Corpus & Recognition Workspace
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Capture and inspect real-time 21-point hand landmark sequences, test live gesture
              inference, and govern structured sign-language datasets with quality reviews.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Crosshair className="w-3.5 h-3.5" />}
              onClick={() => setActiveTab('recognition')}
            >
              Open Live Recognition
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Video className="w-3.5 h-3.5" />}
              onClick={() => setActiveTab('studio')}
            >
              Capture New Sample
            </Button>
          </div>
        </div>
      </div>

      {/* Dataset Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Samples */}
        <Card compact className="relative">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium">Total Samples</span>
            <Database className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1.5">
            {totalSamples}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            <span>63 geometric features / frame</span>
          </div>
        </Card>

        {/* Unique Labels */}
        <Card compact className="relative">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium">Unique Labels</span>
            <Tag className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1.5">
            {uniqueLabels}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            <span>{stats?.total_classes ?? 0} registered categories</span>
          </div>
        </Card>

        {/* Pending Review */}
        <Card compact className="relative">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium">Pending Review</span>
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1.5">
            {pendingReview}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span className="font-mono">{pendingPercentage}% of corpus</span>
            {pendingReview > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className="text-amber-700 hover:text-amber-800 font-medium text-[10px] underline underline-offset-2"
              >
                Review now &rarr;
              </button>
            )}
          </div>
        </Card>

        {/* Approved Samples */}
        <Card compact className="relative">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium">Approved Samples</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1.5">
            {approvedSamples}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            <span className="text-emerald-700 font-semibold">{approvedPercentage}% quality approved</span>
          </div>
        </Card>
      </div>

      {/* Dataset Quality Visualization (Shown when actual data exists) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card
            title="Corpus Quality & Label Balance"
            subtitle="Actual verified distribution computed from stored sample sequence features"
          >
            {totalSamples === 0 ? (
              <EmptyState
                icon={<Database className="w-5 h-5 text-slate-400" />}
                title="No dataset samples recorded"
                description="The corpus currently contains zero samples. Capture gesture sequences or run batch video ingestion to populate quality metrics."
                actionLabel="Capture First Sample"
                onAction={() => setActiveTab('studio')}
              />
            ) : (
              <div className="space-y-4">
                {/* Verification Quality Ratio Bar */}
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium">Corpus Verification State</span>
                    <span className="font-mono text-[11px]">
                      {approvedSamples} Approved / {pendingReview} Pending
                    </span>
                  </div>

                  {/* Multi-segment stacked bar */}
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{ width: `${approvedPercentage}%` }}
                      title={`Approved: ${approvedPercentage}%`}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${pendingPercentage}%` }}
                      title={`Pending Review: ${pendingPercentage}%`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                      <span>Approved ({approvedPercentage}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      <span>Pending Verification ({pendingPercentage}%)</span>
                    </div>
                  </div>
                </div>

                {/* Class Distribution Bars (Actual Data) */}
                <div className="space-y-2.5 pt-1">
                  <div className="text-xs font-medium text-slate-700">
                    Top Gesture Distribution:
                  </div>

                  {stats && stats.class_distribution ? (
                    <div className="space-y-2">
                      {Object.entries(stats.class_distribution)
                        .filter(([_, count]) => count > 0)
                        .slice(0, 5)
                        .map(([label, count]) => {
                          const pct = Math.round((count / totalSamples) * 100);
                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-800">{label}</span>
                                <span className="font-mono text-slate-500 text-[11px]">
                                  {count} samples ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </Card>

          {/* Recent Samples Table */}
          <Card
            title="Recent Corpus Ingestion"
            subtitle="Latest hand gesture sequences saved to storage"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('dataset')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View Explorer
              </Button>
            }
          >
            {recentSamples.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Inbox className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                No samples captured yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">SAMPLE ID</th>
                      <th className="py-2 px-3">SIGN LABEL</th>
                      <th className="py-2 px-3">SPLIT</th>
                      <th className="py-2 px-3">STATUS</th>
                      <th className="py-2 px-3">CAPTURED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {recentSamples.map((sample) => (
                      <tr key={sample.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-500">{sample.id}</td>
                        <td className="py-2 px-3 font-medium text-slate-900 font-sans">
                          {sample.label}
                        </td>
                        <td className="py-2 px-3">
                          <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {sample.split}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={sample.review_status === 'pending_review' ? 'amber' : 'green'}
                            size="sm"
                          >
                            {sample.review_status === 'pending_review' ? 'Pending' : 'Approved'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[10px]">
                          {new Date(sample.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Processing Activity Stream */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="Processing Activity"
            subtitle="Chronological log of system actions and reviews"
            compact
          >
            {activities.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <Activity className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                No processing activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {activities.map((act) => {
                  const categoryIcons = {
                    capture: <Video className="w-3.5 h-3.5 text-indigo-600" />,
                    review: <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />,
                    augmentation: <Sparkles className="w-3.5 h-3.5 text-indigo-500" />,
                    system: <Activity className="w-3.5 h-3.5 text-slate-400" />,
                  };

                  return (
                    <div
                      key={act.id}
                      className="p-2.5 rounded bg-slate-50/70 border border-slate-200/80 text-xs space-y-1 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          {categoryIcons[act.category as keyof typeof categoryIcons] || categoryIcons.system}
                          <span>{act.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(act.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                        {act.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Shortcuts */}
          <Card title="Workspace Workflows" compact>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('review')}
                className="w-full text-left p-2.5 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">Review Queue</div>
                  <div className="text-[11px] text-slate-500">
                    Audit joint accuracy and approve ingested samples
                  </div>
                </div>
                <Badge variant={pendingReview > 0 ? 'amber' : 'slate'} size="sm">
                  {pendingReview} pending
                </Badge>
              </button>

              <button
                onClick={() => setActiveTab('augmentation')}
                className="w-full text-left p-2.5 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">Augmentation Lab</div>
                  <div className="text-[11px] text-slate-500">
                    Apply scale, jitter, and mirror transforms to balance classes
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
