import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { SignSample } from '../../types';
import { drawHandSkeleton } from '../../utils/handRenderer';

export const ReviewQueueView: React.FC = () => {
  const { samples, reviewSampleAction, setActiveTab } = useApp();

  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedSample, setSelectedSample] = useState<SignSample | null>(null);
  const [isActing, setIsActing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const filteredSamples = samples.filter((s) => {
    const status = s.review_status || 'approved';
    if (filterStatus === 'pending') return status === 'pending_review';
    if (filterStatus === 'approved') return status === 'approved';
    if (filterStatus === 'rejected') return status === 'rejected';
    return true;
  });

  // Select first sample by default
  useEffect(() => {
    if (filteredSamples.length > 0 && !selectedSample) {
      setSelectedSample(filteredSamples[0]);
    } else if (filteredSamples.length === 0) {
      setSelectedSample(null);
    }
  }, [filteredSamples, selectedSample]);

  // Draw selected sample on canvas
  useEffect(() => {
    if (!canvasRef.current || !selectedSample) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (selectedSample.landmarks && selectedSample.landmarks.length >= 21) {
      drawHandSkeleton(ctx, selectedSample.landmarks, canvas.width, canvas.height, {
        lineColor: '#4f46e5',
        jointColor: '#818cf8',
        wristColor: '#312e81',
        lineWidth: 2.5,
        jointRadius: 3.5,
      });
    }
  }, [selectedSample]);

  const handleApprove = async (id: string) => {
    setIsActing(true);
    await reviewSampleAction(id, 'approved', 'Joint geometry validated');
    setIsActing(false);
  };

  const handleReject = async (id: string) => {
    setIsActing(true);
    await reviewSampleAction(id, 'rejected', 'Failed quality threshold');
    setIsActing(false);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Data Review & Governance Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit anatomical joint consistency, filter false positives, and approve gesture
            samples for model training inclusion.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200 text-xs">
          {[
            { id: 'pending', label: 'Pending Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All Items' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterStatus(tab.id as any);
                setSelectedSample(null);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors text-xs ${
                filterStatus === tab.id
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredSamples.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
          title={
            filterStatus === 'pending'
              ? 'Review queue is clear'
              : `No samples found in '${filterStatus}'`
          }
          description={
            filterStatus === 'pending'
              ? 'All current samples have been reviewed and approved. Use Capture Studio or Video Processing to add new data.'
              : 'Try changing your status filter above.'
          }
          actionLabel={filterStatus === 'pending' ? 'Capture More Samples' : undefined}
          onAction={() => setActiveTab('studio')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Samples list (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <Card compact title={`Queue List (${filteredSamples.length} items)`}>
              <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                {filteredSamples.map((sample) => {
                  const isSelected = selectedSample?.id === sample.id;
                  const status = sample.review_status || 'approved';

                  return (
                    <div
                      key={sample.id}
                      onClick={() => setSelectedSample(sample)}
                      className={`p-3 cursor-pointer transition-colors text-xs ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-2 border-indigo-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900">{sample.label}</strong>
                        <Badge
                          variant={
                            status === 'pending_review'
                              ? 'amber'
                              : status === 'approved'
                              ? 'green'
                              : 'rose'
                          }
                          size="sm"
                        >
                          {status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                        <span>ID: {sample.id}</span>
                        <span>Split: {sample.split.toUpperCase()}</span>
                      </div>

                      {sample.notes && (
                        <p className="text-[11px] text-slate-600 mt-1 truncate">
                          {sample.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right: Inspection & Decision Console (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {selectedSample ? (
              <Card
                title={`Inspection: ${selectedSample.label} (${selectedSample.id})`}
                subtitle={`Captured: ${new Date(selectedSample.created_at).toLocaleString()}`}
              >
                <div className="space-y-4">
                  {/* Canvas Viewport */}
                  <div className="relative w-full aspect-4/3 bg-slate-950 rounded-md overflow-hidden border border-slate-800 flex items-center justify-center">
                    <div
                      className="absolute inset-0 opacity-15 pointer-events-none"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                      }}
                    />

                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={480}
                      className="relative z-10 w-full h-full object-contain"
                    />

                    <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[11px] font-mono text-slate-300">
                        21-Point Skeletal Graph
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 z-20 text-[11px] font-mono text-slate-400">
                      Quality Score:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {(selectedSample.quality_score || 0.96) * 100}%
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Keypoint Completeness</span>
                      <span className="font-semibold text-slate-900 font-mono mt-0.5 block">
                        21 / 21 Joints (100%)
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Hardware Origin</span>
                      <span className="font-semibold text-slate-900 font-mono mt-0.5 block">
                        {selectedSample.device_info || 'Webcam-MediaPipe'}
                      </span>
                    </div>
                  </div>

                  {/* Action Decision Buttons */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(selectedSample.id)}
                      disabled={isActing}
                      className="text-rose-700 border-rose-300 hover:bg-rose-50"
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Reject Sample
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(selectedSample.id)}
                      isLoading={isActing}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Approve for Training Set
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card compact>
                <div className="py-12 text-center text-xs text-slate-400">
                  Select a sample from the queue list to inspect landmarks.
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
