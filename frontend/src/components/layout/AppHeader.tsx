import React from 'react';
import { User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatusIndicator } from '../ui/StatusIndicator';
import { ActiveTab } from '../../types';

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_METADATA: Record<ActiveTab, PageMeta> = {
  overview: {
    title: 'Overview',
    description: 'Corpus health, governance statistics, and sign intelligence dashboard.',
  },
  recognition: {
    title: 'Live Recognition',
    description: 'Real-time gesture inference and candidate scoring on 21-point hand topology.',
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
  const { activeTab, isBackendOnline } = useApp();
  const meta = PAGE_METADATA[activeTab] || PAGE_METADATA.overview;

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

      {/* Right Controls: Backend Status & User Profile Placeholder */}
      <div className="flex items-center gap-4">
        {/* Backend Connection Status */}
        <div className="flex items-center gap-2 pl-3 border-l sm:border-l-0 border-slate-200">
          <StatusIndicator
            status={isBackendOnline ? 'operational' : 'offline'}
            label={isBackendOnline ? 'Connected' : 'Disconnected'}
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
