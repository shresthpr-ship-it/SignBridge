import React from 'react';
import { User, Globe, Camera, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatusIndicator } from '../ui/StatusIndicator';
import { ActiveTab } from '../../types';
import { useCameraPermissions } from '../../hooks/useCameraPermissions';

interface PageMeta {
  title: string;
  description: string;
}

const PRESET_LANGUAGES = [
  { code: 'ISL', name: 'ISL (Indian Sign Language - हिन्दी)' },
  { code: 'ASL', name: 'ASL (American)' },
  { code: 'BSL', name: 'BSL (British)' },
  { code: 'AUSLAN', name: 'AUSLAN (Australian)' },
  { code: 'LSF', name: 'LSF (French)' },
  { code: 'CUSTOM', name: 'Custom Vocabulary' },
];

const PAGE_METADATA: Record<ActiveTab, PageMeta> = {
  overview: {
    title: 'Overview',
    description: 'Corpus health, governance statistics, and sign intelligence dashboard.',
  },
  recognition: {
    title: 'Live Recognition',
    description: 'Real-time gesture inference and candidate scoring on 21-point hand topology.',
  },
  'sentence-mode': {
    title: 'Sentence Mode',
    description: 'Record complete sign-language messages, translate to sentence text, edit, and listen.',
  },
  studio: {
    title: 'Capture Studio',
    description: 'Collect, label, and partition calibrated hand landmark sequences.',
  },
  video: {
    title: 'Video Processing',
    description: 'Decompose sign language recordings and extract normalized landmark keypoints.',
  },
  dataset: {
    title: 'Dataset Explorer',
    description: 'Audit registered classes, inspect 3D landmark skeletons, and export data.',
  },
  augmentation: {
    title: 'Augmentation Lab',
    description: 'Generate geometric transformations to improve gesture classifier invariance.',
  },
  review: {
    title: 'Review Queue',
    description: 'Quality-check and approve incoming samples before training inclusion.',
  },
  labels: {
    title: 'Sign Label Management',
    description: 'Manage sign vocabulary, target languages, and class sample distributions.',
  },
  training: {
    title: 'Model Training & Evaluation',
    description: 'Train supervised gesture classification baselines and evaluate model accuracy.',
  },
  export: {
    title: 'Export Center',
    description: 'Package and export structured dataset metadata, landmark sequences, and CSVs.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure API endpoints, camera capture resolution, and inference throttles.',
  },
};

export const AppHeader: React.FC = () => {
  const { activeTab, isBackendOnline, selectedLanguage, setSelectedLanguage } = useApp();
  const meta = PAGE_METADATA[activeTab] || PAGE_METADATA.overview;
  const cameraPermission = useCameraPermissions();

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 select-none">
      {/* Current Page Title & Contextual Description */}
      <div className="flex flex-col justify-center">
        <h1 className="text-sm font-semibold tracking-tight text-slate-900 leading-tight">
          {meta.title}
        </h1>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5 hidden sm:block">
          {meta.description}
        </p>
      </div>

      {/* Right Controls: Sign Language Selector, Backend Status & User Profile */}
      <div className="flex items-center gap-3">
        {/* Pre-available Sign Language Selector */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
          <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[10px] uppercase font-bold text-slate-400">Lang:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
            title="Active Sign Language System"
          >
            {PRESET_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Permission / Context Badge */}
        <div className="flex items-center pl-2 border-l border-slate-200">
          {cameraPermission.state === 'granted' ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
              title="Camera access granted"
            >
              <Camera className="w-3 h-3 text-emerald-600" />
              <span>Camera Ready</span>
            </span>
          ) : cameraPermission.state === 'insecure-context' ? (
            <button
              type="button"
              onClick={cameraPermission.switchToHttps}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors"
              title="Click to switch to HTTPS for camera access on remote devices"
            >
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Enable HTTPS</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => cameraPermission.requestPermission('user')}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
              title="Request camera permission on this device"
            >
              <Camera className="w-3 h-3 text-indigo-600" />
              <span>Allow Camera</span>
            </button>
          )}
        </div>

        {/* Backend Connection Status */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <StatusIndicator
            status={isBackendOnline ? 'operational' : 'offline'}
            label={isBackendOnline ? 'Online' : 'Offline'}
            pulse={isBackendOnline}
          />
        </div>

        {/* User Profile Placeholder without fabricated personal details */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-medium text-slate-800 leading-none">Researcher</span>
            <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">Local Session</span>
          </div>
        </div>
      </div>
    </header>
  );
};
