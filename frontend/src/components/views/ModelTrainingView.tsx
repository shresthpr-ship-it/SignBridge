import React, { useState, useEffect } from 'react';
import { Brain, Cpu, Play, CheckCircle, AlertTriangle, AlertCircle, Loader2, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../services/api';
import { TrainingStatus, TrainingResult } from '../../types';

export const ModelTrainingView: React.FC = () => {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [training, setTraining] = useState<boolean>(false);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTrainingStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch training status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.trainModel();
      setResult(res);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Model Training & Evaluation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Train and validate a supervised gesture classification baseline model from normalized 3D hand landmark representations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStatus}
          disabled={loading || training}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh Status
        </Button>
      </div>

      {/* Strict Engineering Notice / Disclaimer */}
      <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Scientific Boundary & Anti-Hallucination Policy</p>
          <p className="text-amber-800 leading-relaxed">
            This module trains a standard <strong>Multi-Layer Perceptron (MLP)</strong> classifier specifically on isolated 63D invariant coordinate vectors (x, y, z for 21 joints).
            It recognizes discrete static hand poses. It does <strong>not</strong> claim continuous sign sentence translation, which requires temporal sequence modeling (e.g. LSTM/Transformer) and non-manual grammatical facial/pose markers.
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Requirements & Training Trigger */}
        <div className="lg:col-span-2 space-y-5">
          <Card title="Dataset Readiness for Supervised Training">
            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Analyzing dataset sample distributions...
              </div>
            ) : status ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-2">
                    {status.can_train ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        {status.can_train ? 'Prerequisites Satisfied' : 'Insufficient Labeled Training Data'}
                      </div>
                      <div className="text-[11px] text-slate-500">{status.message}</div>
                    </div>
                  </div>
                  <Badge variant={status.can_train ? 'green' : 'amber'} size="sm">
                    {status.can_train ? 'Ready' : 'Blocked'}
                  </Badge>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-md text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Samples</span>
                    <p className="text-base font-bold text-slate-800 font-mono mt-0.5">{status.total_samples}</p>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-md text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Valid Landmarks</span>
                    <p className="text-base font-bold text-slate-800 font-mono mt-0.5">{status.valid_samples}</p>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-md text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Viable Classes (≥10)</span>
                    <p className="text-base font-bold text-indigo-700 font-mono mt-0.5">
                      {Object.keys(status.viable_classes).length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-md text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Model Artifact</span>
                    <p className="text-xs font-semibold mt-1">
                      {status.trained_model_exists ? (
                        <span className="text-emerald-700">Trained</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Breakdown of Viable and Under-sampled Classes */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-slate-700">Class Distribution Analysis</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="border border-emerald-100 bg-emerald-50/50 p-2.5 rounded-md">
                      <div className="font-semibold text-emerald-900 mb-1 flex items-center justify-between">
                        <span>Viable Classes (≥ 10 samples)</span>
                        <span className="font-mono">{Object.keys(status.viable_classes).length}</span>
                      </div>
                      {Object.keys(status.viable_classes).length > 0 ? (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {Object.entries(status.viable_classes).map(([cls, cnt]) => (
                            <div key={cls} className="flex justify-between items-center text-[11px] text-emerald-800">
                              <span>{cls}</span>
                              <span className="font-mono font-medium">{cnt} samples</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-700 italic">No classes have reached 10 samples yet.</p>
                      )}
                    </div>

                    <div className="border border-amber-100 bg-amber-50/50 p-2.5 rounded-md">
                      <div className="font-semibold text-amber-900 mb-1 flex items-center justify-between">
                        <span>Under-Sampled Classes (&lt; 10 samples)</span>
                        <span className="font-mono">{Object.keys(status.insufficient_classes).length}</span>
                      </div>
                      {Object.keys(status.insufficient_classes).length > 0 ? (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {Object.entries(status.insufficient_classes).map(([cls, cnt]) => (
                            <div key={cls} className="flex justify-between items-center text-[11px] text-amber-800">
                              <span>{cls}</span>
                              <span className="font-mono font-medium">{cnt} / 10 min</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-700 italic">All classes meet minimum requirements.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Train Action Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    Engine: <code className="font-mono text-indigo-600">scikit-learn MLPClassifier (128x64)</code>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTrain}
                    disabled={!status.can_train || training}
                    leftIcon={training ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  >
                    {training ? 'Training MLP Model...' : 'Train Baseline Classifier'}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Results card when training completes */}
          {result && (
            <Card title="Training Execution Report" className="border-emerald-300">
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Model successfully trained and persisted. The live recognition engine has reloaded the new classifier artifact.
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block font-sans">Train Accuracy</span>
                    <span className="font-bold text-emerald-700 text-sm">{result.train_accuracy}%</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block font-sans">Test Accuracy</span>
                    <span className="font-bold text-emerald-700 text-sm">{result.test_accuracy}%</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block font-sans">Train / Test Split</span>
                    <span className="text-slate-800 text-xs">{result.train_samples} / {result.test_samples}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block font-sans">Classes</span>
                    <span className="text-indigo-700 font-bold text-sm">{result.num_classes}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div><strong>Architecture:</strong> <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{result.architecture}</code></div>
                  <div><strong>Input Dimension:</strong> <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{result.input_features} features (Wrist-normalized 3D coordinates)</code></div>
                  <div><strong>Trained Classes:</strong> <span className="font-mono text-slate-800">{result.classes.join(', ')}</span></div>
                  <div><strong>Saved Artifact:</strong> <span className="font-mono text-slate-500 break-all">{result.model_path}</span></div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Mathematical & Pipeline Specifications */}
        <div className="space-y-4 text-xs">
          <Card title="Feature Pipeline Specification" compact>
            <div className="space-y-2.5 text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2">
                <Cpu className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">1. 3D Landmark Extraction</strong>
                  MediaPipe Tasks extracts 21 anatomical landmarks per hand <code className="font-mono text-[10px]">(x, y, z)</code>.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">2. Invariant Normalization</strong>
                  All coordinates are shifted relative to wrist index 0 <code className="font-mono text-[10px]">(x - x0, y - y0, z - z0)</code>, then divided by the scale distance between wrist (0) and middle MCP (9).
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">3. Multi-Layer Perceptron</strong>
                  Input vector <code className="font-mono text-[10px]">R^63</code> connects to Hidden Layer 1 (128 ReLU), Hidden Layer 2 (64 ReLU), and Softmax output.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">4. Temporal Stability Buffer</strong>
                  A 5-frame moving window applies modal voting across consecutive video frames to prevent high-frequency jitter.
                </div>
              </div>
            </div>
          </Card>

          <Card title="Dataset Integrity Safeguards" compact>
            <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
              <li>Empty detections are never imputed with synthetic defaults.</li>
              <li>Only valid non-zero landmarks pass feature engineering.</li>
              <li>Stratified 80/20 train/test split evaluates generalizability.</li>
              <li>Minimum confidence threshold of 60% rejects unknown signs.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};
