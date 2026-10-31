import React, { useState, useRef, useEffect } from 'react';
import { Database, Filter, Eye, Trash2, Download, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { SignSample } from '../../types';
import { drawHandSkeleton } from '../../utils/handRenderer';
import { api } from '../../services/api';

export const DatasetView: React.FC = () => {
  const { samples, classes, stats, removeSample, addToast } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSplit, setSelectedSplit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectingSample, setInspectingSample] = useState<SignSample | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter logic
  const filteredSamples = samples.filter((sample) => {
    if (selectedClass !== 'all' && sample.label.toLowerCase() !== selectedClass.toLowerCase()) {
      return false;
    }
    if (selectedSplit !== 'all' && sample.split.toLowerCase() !== selectedSplit.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = sample.label.toLowerCase().includes(q);
      const matchNotes = (sample.notes || '').toLowerCase().includes(q);
      const matchId = sample.id.toLowerCase().includes(q);
      if (!matchLabel && !matchNotes && !matchId) return false;
    }
    return true;
  });

  // Render modal canvas when sample selected
  useEffect(() => {
    if (!inspectingSample || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawHandSkeleton(ctx, inspectingSample.landmarks, canvas.width, canvas.height, {
      lineColor: '#4f46e5',
      jointColor: '#818cf8',
      wristColor: '#312e81',
      lineWidth: 2.5,
      jointRadius: 4,
    });
  }, [inspectingSample]);

  const handleExport = (format: 'json' | 'csv') => {
    try {
      const url = api.getExportUrl(format);
      window.open(url, '_blank');
      addToast({
        type: 'info',
        title: 'Export Generated',
        message: `Dataset downloaded in ${format.toUpperCase()} format.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Export Error',
        message: err.message,
      });
    }
  };

  const getSplitBadgeVariant = (split: string) => {
    if (split === 'train') return 'indigo';
    if (split === 'val') return 'amber';
    return 'green';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Dataset Explorer</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit recorded gesture landmarks, train/validation/test splits, and dataset balance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Dataset Metrics Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card compact>
            <div className="text-[11px] text-slate-500 font-medium">Total Samples</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">{stats.total_samples}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">63 features / sample</div>
          </Card>

          <Card compact>
            <div className="text-[11px] text-slate-500 font-medium">Class Vocabulary</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">{stats.total_classes ?? stats.unique_labels}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Gestures registered</div>
          </Card>

          <Card compact>
            <div className="text-[11px] text-slate-500 font-medium">Partition Breakdown</div>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-800">
              <span className="text-indigo-600 font-semibold">{stats.split_distribution.train} tr</span>
              <span className="text-slate-300">/</span>
              <span className="text-amber-600 font-semibold">{stats.split_distribution.val} va</span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-600 font-semibold">{stats.split_distribution.test} te</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Train / Val / Test</div>
          </Card>

          <Card compact>
            <div className="text-[11px] text-slate-500 font-medium">Mean Balance</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">{stats.avg_samples_per_class}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Samples per class</div>
          </Card>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <Card compact>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Class filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded border border-slate-300 text-xs px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Classes ({samples.length})</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name} ({cls.sample_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Split filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 ml-0 sm:ml-2">
              <span>Split:</span>
              <select
                value={selectedSplit}
                onChange={(e) => setSelectedSplit(e.target.value)}
                className="rounded border border-slate-300 text-xs px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Splits</option>
                <option value="train">Train</option>
                <option value="val">Validation</option>
                <option value="test">Test</option>
              </select>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by ID or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>
        </div>
      </Card>

      {/* Samples Table */}
      {filteredSamples.length === 0 ? (
        <EmptyState
          icon={<Database className="w-6 h-6 text-slate-400" />}
          title="No samples found"
          description="Try adjusting your class, split, or search query filter, or switch to Annotation Studio to record new sign gestures."
          actionLabel="Clear Filters"
          onAction={() => {
            setSelectedClass('all');
            setSelectedSplit('all');
            setSearchQuery('');
          }}
        />
      ) : (
        <Card compact className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                  <th className="py-2.5 px-4 font-mono text-[11px]">SAMPLE ID</th>
                  <th className="py-2.5 px-4">SIGN LABEL</th>
                  <th className="py-2.5 px-4">SPLIT</th>
                  <th className="py-2.5 px-4">KEYPOINTS</th>
                  <th className="py-2.5 px-4">HARDWARE</th>
                  <th className="py-2.5 px-4">TIMESTAMP</th>
                  <th className="py-2.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSamples.map((sample) => (
                  <tr key={sample.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-4 font-mono text-slate-500 text-[11px]">
                      {sample.id}
                    </td>
                    <td className="py-2 px-4 font-medium text-slate-900">
                      {sample.label}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant={getSplitBadgeVariant(sample.split)} size="sm">
                        {sample.split.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-600 text-[11px]">
                      {sample.landmarks.length} pts (63 dims)
                    </td>
                    <td className="py-2 px-4 text-slate-500 text-[11px]">
                      {sample.device_info || 'Webcam'}
                    </td>
                    <td className="py-2 px-4 text-slate-400 text-[11px]">
                      {new Date(sample.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectingSample(sample)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSample(sample.id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50/50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
            <span>Showing {filteredSamples.length} of {samples.length} total samples</span>
            <span>Canonical MediaPipe 21 Hand Topology</span>
          </div>
        </Card>
      )}

      {/* Sample Inspector Modal */}
      <Modal
        isOpen={inspectingSample !== null}
        onClose={() => setInspectingSample(null)}
        title={inspectingSample ? `Landmark Inspector — ${inspectingSample.label}` : 'Sample Details'}
        subtitle={inspectingSample ? `ID: ${inspectingSample.id} • Split: ${inspectingSample.split.toUpperCase()}` : ''}
        maxWidth="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setInspectingSample(null)}>
            Close Inspector
          </Button>
        }
      >
        {inspectingSample && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Landmark Canvas preview */}
              <div className="aspect-square bg-slate-950 rounded-md border border-slate-800 p-2 flex items-center justify-center relative">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[10px] font-mono text-slate-300">
                  21-Point Skeletal Graph
                </span>
              </div>

              {/* Sample metadata */}
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sign Class:</span>
                    <strong className="text-slate-900">{inspectingSample.label}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data Split:</span>
                    <Badge variant={getSplitBadgeVariant(inspectingSample.split)} size="sm">
                      {inspectingSample.split}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Captured At:</span>
                    <span className="font-mono text-slate-700">{new Date(inspectingSample.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Notes:</span>
                    <span className="text-slate-700">{inspectingSample.notes || 'None'}</span>
                  </div>
                </div>

                {/* Key landmark coordinates table preview */}
                <div className="border border-slate-200 rounded overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="p-1.5">PT#</th>
                        <th className="p-1.5">X</th>
                        <th className="p-1.5">Y</th>
                        <th className="p-1.5">Z</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectingSample.landmarks.map((pt, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-1 text-slate-400">#{idx}</td>
                          <td className="p-1 text-slate-700">{pt.x.toFixed(3)}</td>
                          <td className="p-1 text-slate-700">{pt.y.toFixed(3)}</td>
                          <td className="p-1 text-slate-500">{(pt.z || 0).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
