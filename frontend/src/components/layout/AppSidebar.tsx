import React from 'react';
import {
  LayoutDashboard,
  Crosshair,
  Film,
  Video,
  FileVideo,
  Database,
  Shuffle,
  ClipboardCheck,
  Settings,
  Layers,
  Tag,
  Brain,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeVariant?: 'slate' | 'amber' | 'indigo';
}

export const AppSidebar: React.FC = () => {
  const { activeTab, setActiveTab, stats } = useApp();

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'recognition',
      label: 'Live Recognition',
      icon: <Crosshair className="w-4 h-4" />,
    },
    {
      id: 'sentence-mode',
      label: 'Sentence Mode',
      icon: <Film className="w-4 h-4" />,
      badge: 'NEW',
      badgeVariant: 'indigo',
    },
    {
      id: 'studio',
      label: 'Capture Studio',
      icon: <Video className="w-4 h-4" />,
    },
    {
      id: 'video',
      label: 'Video Processing',
      icon: <FileVideo className="w-4 h-4" />,
    },
    {
      id: 'dataset',
      label: 'Dataset Explorer',
      icon: <Database className="w-4 h-4" />,
      badge: stats ? stats.total_samples : undefined,
      badgeVariant: 'slate',
    },
    {
      id: 'labels',
      label: 'Sign Labels',
      icon: <Tag className="w-4 h-4" />,
      badge: stats ? stats.unique_labels : undefined,
      badgeVariant: 'slate',
    },
    {
      id: 'review',
      label: 'Review Queue',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: stats && stats.pending_review > 0 ? stats.pending_review : undefined,
      badgeVariant: 'amber',
    },
    {
      id: 'augmentation',
      label: 'Augmentation Lab',
      icon: <Shuffle className="w-4 h-4" />,
    },
    {
      id: 'training',
      label: 'Model Training',
      icon: <Brain className="w-4 h-4" />,
    },
    {
      id: 'export',
      label: 'Export Center',
      icon: <Download className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* SignBridge Wordmark & Subtitle */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-slate-900 block leading-tight">
                SignBridge
              </span>
              <span className="text-[10px] text-slate-500 font-medium block leading-tight mt-0.5">
                Sign Language Intelligence & Corpus Studio
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-2 space-y-0.5" aria-label="Main Navigation">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Platform
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      item.badgeVariant === 'amber'
                        ? 'bg-amber-100 text-amber-800 font-semibold'
                        : isActive
                        ? 'bg-indigo-200/70 text-indigo-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Research Workspace Footer badge */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="font-mono text-[10px] text-slate-400">RESEARCH CORPUS v1.0</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200/70 text-[10px] font-mono text-slate-700">
          LOCAL DEV
        </span>
      </div>
    </aside>
  );
};
