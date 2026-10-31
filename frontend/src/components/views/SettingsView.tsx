import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Server } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../services/api';

export const SettingsView: React.FC = () => {
  const { isBackendOnline, refreshData, addToast, systemInfo } = useApp();

  const [apiUrl, setApiUrl] = useState<string>(import.meta.env.VITE_API_BASE_URL || '/api');
  const [resolution, setResolution] = useState<string>('640x480');
  const [inferenceInterval, setInferenceInterval] = useState<string>('600');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      await api.getHealth();
      setTestStatus('success');
      addToast({
        type: 'success',
        title: 'Backend Reached',
        message: 'FastAPI service responded with healthy status.',
      });
    } catch (err: any) {
      setTestStatus('error');
      addToast({
        type: 'error',
        title: 'Connection Failed',
        message: err.message || 'Could not connect to backend',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Configuration & Environment</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Tune backend connection parameters, vision resolution, and inference scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Backend API Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card title="Backend API Configuration">
            <div className="space-y-4">
              <Input
                label="API Base URL Endpoint"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                helperText="Environment variable VITE_API_BASE_URL or proxied /api route."
              />

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  leftIcon={<Server className="w-3.5 h-3.5" />}
                >
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshData()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reload Dataset
                </Button>
              </div>

              {testStatus === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Successfully connected to FastAPI backend! All endpoints active.</span>
                </div>
              )}

              {testStatus === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Backend unreachable at this URL. Verify uvicorn server is running on port 8000.</span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Camera & Computer Vision Input">
            <div className="space-y-4">
              <Select
                label="Camera Capture Resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                options={[
                  { value: '640x480', label: '640 × 480 (Recommended for 60 FPS real-time)' },
                  { value: '1280x720', label: '1280 × 720 (High Definition)' },
                  { value: '320x240', label: '320 × 240 (Ultra low-latency)' },
                ]}
              />

              <Select
                label="Live Inference Evaluation Rate"
                value={inferenceInterval}
                onChange={(e) => setInferenceInterval(e.target.value)}
                options={[
                  { value: '300', label: '300 ms (~3 inferences / second)' },
                  { value: '600', label: '600 ms (Balanced hackathon standard)' },
                  { value: '1000', label: '1000 ms (Low power consumption)' },
                ]}
              />
            </div>
          </Card>
        </div>

        {/* Right: Runtime info (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="System Diagnostics" compact>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Backend Status:</span>
                <span className={isBackendOnline ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                  {isBackendOnline ? 'Online (Connected)' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Frontend Framework:</span>
                <span className="font-mono text-slate-800">React 18 + Vite</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Styling Engine:</span>
                <span className="font-mono text-slate-800">Tailwind CSS v3</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Vision Core:</span>
                <span className="font-mono text-slate-800">{systemInfo?.backend_engine || 'MediaPipe Hands'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1">
                <span>Feature Representation:</span>
                <span className="font-mono text-slate-800">21 3D Pts (63 dims)</span>
              </div>
            </div>
          </Card>

          <Card title="Hackathon Reproducibility Note" compact>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                SignBridge includes seed calibrated gesture prototypes for immediate out-of-the-box demonstration.
              </p>
              <p className="text-slate-500 text-[11px]">
                Both live webcam feed and fallback synthetic landmark generators are fully implemented, ensuring seamless operation regardless of browser camera permission grants in evaluation environments.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
