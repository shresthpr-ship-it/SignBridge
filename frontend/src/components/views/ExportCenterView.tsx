import React, { useState, useEffect } from 'react';
import { Download, FileJson, FileText, CheckCircle, AlertCircle, Loader2, Archive, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { SignClass, DatasetStats, ExportResult } from '../../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const ExportCenterView: React.FC = () => {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [labelFilter, setLabelFilter] = useState('');
  const [includeAugmented, setIncludeAugmented] = useState(true);
  const [qualityFilter, setQualityFilter] = useState('');
  const [classes, setClasses] = useState<SignClass[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(() => {});
    api.getStats().then(setStats).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setExportResult(null);
    try {
      const result = await api.generateExport(
        format,
        labelFilter || undefined,
        includeAugmented,
        qualityFilter || undefined
      );
      setExportResult(result);
    } catch (e: any) {
      setError(e.message || 'Export generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadUrl = (fmt: string) => {
    const params = new URLSearchParams({ format: fmt });
    if (labelFilter) params.append('label', labelFilter);
    return `${BASE_URL}/dataset/export?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600" />
          Export Center
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Export your labeled landmark dataset in structured formats for model training.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Export Configuration */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Export Configuration">
            <div className="space-y-5">
              {/* Format */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Export Format</label>
                <div className="flex gap-3">
                  {[
                    { value: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" />, desc: 'Nested structure with full landmark detail' },
                    { value: 'csv', label: 'CSV', icon: <FileText className="w-4 h-4" />, desc: 'Flat table — 63 landmark columns' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value as 'json' | 'csv')}
                      className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        format === opt.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={format === opt.value ? 'text-indigo-600' : 'text-slate-400'}>{opt.icon}</span>
                      <div>
                        <div className={`text-sm font-semibold ${format === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sign Label</label>
                  <select
                    value={labelFilter}
                    onChange={e => setLabelFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Labels</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{c.name} ({c.sample_count})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quality Filter</label>
                  <select
                    value={qualityFilter}
                    onChange={e => setQualityFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="approved">Approved Only</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={includeAugmented}
                      onChange={e => setIncludeAugmented(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Include augmented samples</span>
                  </label>
                </div>
              </div>

              {/* Generate Button */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating || !stats || stats.total_samples === 0}
                  leftIcon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                >
                  {isGenerating ? 'Generating...' : 'Generate Export'}
                </Button>
                <a href={downloadUrl('json')} download className="inline-flex">
                  <Button variant="outline" leftIcon={<FileJson className="w-4 h-4" />}>
                    Download JSON
                  </Button>
                </a>
                <a href={downloadUrl('csv')} download className="inline-flex">
                  <Button variant="outline" leftIcon={<FileText className="w-4 h-4" />}>
                    Download CSV
                  </Button>
                </a>
              </div>

              {/* Export Result */}
              {exportResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                    <CheckCircle className="w-4 h-4" /> Export Ready
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-700">
                    <div><span className="text-emerald-500">Export ID:</span> <span className="font-mono">{exportResult.export_id}</span></div>
                    <div><span className="text-emerald-500">Samples:</span> <strong>{exportResult.sample_count}</strong></div>
                    <div><span className="text-emerald-500">Format:</span> <span className="uppercase font-semibold">{exportResult.format}</span></div>
                    <div><span className="text-emerald-500">Created:</span> {new Date(exportResult.created_at).toLocaleTimeString()}</div>
                  </div>
                  <a href={downloadUrl(exportResult.format)} download className="inline-block mt-1">
                    <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
                      Download {exportResult.format.toUpperCase()} ({exportResult.sample_count} samples)
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Schema Documentation */}
          <Card title="Dataset Schema">
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-indigo-700">
                  <FileJson className="w-3.5 h-3.5" /> JSON Schema
                </div>
                <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap">{`{
  "schema_version": "1.0",
  "exported_at": "2024-01-01T12:00:00",
  "total_samples": 46,
  "samples": [
    {
      "id": "sample-abc123",
      "label": "Hello",
      "split": "train",
      "review_status": "approved",
      "quality_score": 0.95,
      "created_at": "2024-01-01T12:00:00",
      "device_info": "webcam-capture",
      "notes": "",
      "landmarks": [
        { "x": 0.512, "y": 0.731, "z": -0.023, "visibility": 1.0 },
        ...21 points total (wrist + 5 fingers × 4 joints)
      ]
    }
  ]
}`}</pre>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-indigo-700">
                  <FileText className="w-3.5 h-3.5" /> CSV Schema
                </div>
                <p className="text-xs text-slate-600">
                  Columns: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">id, label, split, review_status, quality_score, created_at, device_info, notes</code> followed by 63 coordinate columns: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">x_0, y_0, z_0, ..., x_20, y_20, z_20</code>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Landmark ordering follows MediaPipe Hand Landmarker convention: index 0 = wrist, 1–4 = thumb, 5–8 = index finger, 9–12 = middle finger, 13–16 = ring finger, 17–20 = pinky.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Dataset Summary */}
        <div className="space-y-4">
          <Card title="Dataset Summary">
            {stats ? (
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Total Samples', value: stats.total_samples, color: 'text-slate-800' },
                  { label: 'Sign Labels', value: stats.unique_labels, color: 'text-indigo-700' },
                  { label: 'Approved', value: stats.approved_samples, color: 'text-emerald-700' },
                  { label: 'Pending Review', value: stats.pending_review, color: 'text-amber-700' },
                  { label: 'Rejected', value: stats.rejected_samples, color: 'text-red-700' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-slate-500">{item.label}</span>
                    <span className={`font-semibold font-mono ${item.color}`}>{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Split Distribution</p>
                  {Object.entries(stats.split_distribution).map(([split, count]) => (
                    <div key={split} className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="capitalize">{split}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic py-4 text-center">Loading statistics...</div>
            )}
          </Card>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="w-3.5 h-3.5" /> Privacy Note
            </div>
            <p>All media and landmarks are stored locally on this machine. No data is transmitted to external servers.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
