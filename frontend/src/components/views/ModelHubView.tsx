import React from 'react';
import { Cpu, Compass, Layers, GitBranch } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';

export const ModelHubView: React.FC = () => {
  const { stats, systemInfo } = useApp();

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Vision Pipeline & Architecture</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Engineering specification of the computer vision landmark extraction and invariant classifier architecture.
        </p>
      </div>

      {/* 4-Stage Pipeline Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card compact className="relative border-slate-300">
          <div className="text-[10px] font-mono text-slate-400 font-semibold mb-1">STAGE 01</div>
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            Image Acquisition
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            RGB video frame capture at 640x480 resolution via OpenCV VideoCapture stream.
          </p>
        </Card>

        <Card compact className="relative border-slate-300">
          <div className="text-[10px] font-mono text-slate-400 font-semibold mb-1">STAGE 02</div>
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            Landmark Extraction
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            MediaPipe Hands localizes 21 3D joint coordinates (x, y, z) per detected hand.
          </p>
        </Card>

        <Card compact className="relative border-slate-300">
          <div className="text-[10px] font-mono text-slate-400 font-semibold mb-1">STAGE 03</div>
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Geometry Invariance
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Wrist point (0) translated to origin; coordinates scaled by wrist-to-MCP (9) distance.
          </p>
        </Card>

        <Card compact className="relative border-slate-300">
          <div className="text-[10px] font-mono text-slate-400 font-semibold mb-1">STAGE 04</div>
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
            Centroid Inference
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Cosine similarity + Euclidean metric matching against calibrated gesture class prototypes.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mathematical Formulation & Feature Vectors (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card title="Feature Representation & Invariance Normalization">
            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <p>
                Each captured frame is mapped to a normalized <strong>63-dimensional feature vector</strong>:
              </p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono text-[11px] overflow-x-auto">
                V = [ (x_0 - x_wrist) / s, (y_0 - y_wrist) / s, (z_0 - z_wrist) / s, ... , (z_20 - z_wrist) / s ]
              </div>
              <p className="text-slate-500 text-[11px]">
                Where <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">s = || P_mcp - P_wrist ||</code> acts as the Euclidean scale factor. This guarantees full invariance to camera distance, zoom level, and translation within the frame.
              </p>

              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-900 mb-1">Centroid Distance Function</h4>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded font-mono text-[11px] text-slate-800">
                  Confidence = 0.70 × CosineSimilarity(V, C_k) + 0.30 × Proximity(V, C_k)
                </div>
              </div>
            </div>
          </Card>

          {/* System Runtime Spec */}
          <Card title="Backend Engine Diagnostics" compact>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Vision Engine</span>
                <span className="font-semibold text-slate-900 font-mono mt-0.5 block">
                  {systemInfo?.backend_engine || 'Geometry-Assisted Math Engine'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">MediaPipe Available</span>
                <span className="font-semibold text-slate-900 font-mono mt-0.5 block">
                  {systemInfo?.mediapipe_available ? 'Yes (Native)' : 'Synthetic / Math Fallback'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Backend API</span>
                <span className="font-semibold text-slate-900 font-mono mt-0.5 block">
                  FastAPI v{systemInfo?.version || '1.0.0'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Total Vector DB Records</span>
                <span className="font-semibold text-indigo-600 font-mono mt-0.5 block">
                  {stats?.total_samples || 0} samples
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Class Distribution & Dataset Balance (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Class Distribution & Balance">
            {stats && stats.class_distribution ? (
              <div className="space-y-3">
                {Object.entries(stats.class_distribution).map(([label, count]) => {
                  const maxCount = Math.max(...Object.values(stats.class_distribution), 1);
                  const pct = Math.round((count / maxCount) * 100);

                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800">{label}</span>
                        <span className="font-mono text-slate-500">{count} samples</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Loading distribution metrics...</p>
            )}
          </Card>

          <Card title="Dataset Partition Strategy" compact>
            {stats && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Training Split (80% target):</span>
                  <span className="font-mono font-medium text-slate-900">{stats.split_distribution.train}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Validation Split (10% target):</span>
                  <span className="font-mono font-medium text-slate-900">{stats.split_distribution.val}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Test Split (10% target):</span>
                  <span className="font-mono font-medium text-slate-900">{stats.split_distribution.test}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
