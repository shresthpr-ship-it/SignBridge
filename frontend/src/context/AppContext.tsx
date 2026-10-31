import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SignClass,
  SignSample,
  DatasetStats,
  SystemInfo,
  ToastMessage,
  ActiveTab,
  LandmarkPoint,
  ActivityLogItem,
} from '../types';
import { api } from '../services/api';

interface AppContextType {
  classes: SignClass[];
  samples: SignSample[];
  stats: DatasetStats | null;
  activities: ActivityLogItem[];
  systemInfo: SystemInfo | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedSign: string;
  setSelectedSign: (sign: string) => void;
  selectedSplit: 'train' | 'val' | 'test';
  setSelectedSplit: (split: 'train' | 'val' | 'test') => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  isLoading: boolean;
  isBackendOnline: boolean;
  refreshData: () => Promise<void>;
  addClass: (name: string, category?: string, description?: string) => Promise<SignClass | null>;
  recordSample: (landmarks: LandmarkPoint[], notes?: string, reviewStatus?: 'pending_review' | 'approved') => Promise<SignSample | null>;
  removeSample: (id: string) => Promise<boolean>;
  reviewSampleAction: (id: string, status: 'approved' | 'rejected', notes?: string) => Promise<boolean>;
  augmentDataAction: (label: string, type: 'jitter' | 'scale' | 'mirror', count?: number) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [classes, setClasses] = useState<SignClass[]>([]);
  const [samples, setSamples] = useState<SignSample[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedSign, setSelectedSign] = useState<string>('Hello');
  const [selectedSplit, setSelectedSplit] = useState<'train' | 'val' | 'test'>('train');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await api.getHealth();
      setIsBackendOnline(true);

      const [clsList, smpList, st, sys, acts] = await Promise.all([
        api.getClasses(),
        api.getSamples(),
        api.getStats(),
        api.getSystemInfo(),
        api.getActivityLog(15),
      ]);

      setClasses(clsList);
      setSamples(smpList);
      setStats(st);
      setSystemInfo(sys);
      setActivities(acts);

      if (clsList.length > 0 && !clsList.some((c) => c.name === selectedSign)) {
        setSelectedSign(clsList[0].name);
      }
    } catch (err: any) {
      setIsBackendOnline(false);
      console.warn('[SignBridge] Backend unreachable or initializing:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSign]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      api.getHealth()
        .then(() => setIsBackendOnline(true))
        .catch(() => setIsBackendOnline(false));
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const addClass = async (name: string, category = 'General', description = '') => {
    try {
      const created = await api.createClass(name, category, description);
      setClasses((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      setSelectedSign(created.name);
      addToast({
        type: 'success',
        title: 'Class Added',
        message: `Sign class "${created.name}" created successfully.`,
      });
      await refreshData();
      return created;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to Add Class',
        message: err.message || 'Unknown error occurred',
      });
      return null;
    }
  };

  const recordSample = async (
    landmarks: LandmarkPoint[],
    notes = '',
    reviewStatus: 'pending_review' | 'approved' = 'pending_review'
  ) => {
    try {
      const created = await api.createSample({
        label: selectedSign,
        split: selectedSplit,
        landmarks,
        notes,
        device_info: 'Webcam-MediaPipe',
        review_status: reviewStatus,
      });
      setSamples((prev) => [created, ...prev]);
      addToast({
        type: 'success',
        title: 'Sample Saved',
        message: `Captured sample for "${selectedSign}" [${selectedSplit.toUpperCase()}]. Status: ${reviewStatus.replace('_', ' ')}.`,
      });
      await refreshData();
      return created;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Recording Error',
        message: err.message || 'Failed to save sample',
      });
      return null;
    }
  };

  const reviewSampleAction = async (id: string, status: 'approved' | 'rejected', notes = '') => {
    try {
      await api.reviewSample(id, status, notes);
      addToast({
        type: status === 'approved' ? 'success' : 'info',
        title: `Sample ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Sample ${id} status updated to ${status}.`,
      });
      await refreshData();
      return true;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Review Action Failed',
        message: err.message || 'Failed to update review status',
      });
      return false;
    }
  };

  const augmentDataAction = async (label: string, type: 'jitter' | 'scale' | 'mirror', count = 4) => {
    try {
      const created = await api.augmentDataset(label, type, count);
      addToast({
        type: 'success',
        title: 'Augmentation Generated',
        message: `Added ${created.length} synthetic variations for "${label}".`,
      });
      await refreshData();
      return true;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Augmentation Failed',
        message: err.message || 'Failed to augment data',
      });
      return false;
    }
  };

  const removeSample = async (id: string) => {
    try {
      await api.deleteSample(id);
      setSamples((prev) => prev.filter((s) => s.id !== id));
      addToast({
        type: 'info',
        title: 'Sample Deleted',
        message: `Sample removed from dataset.`,
      });
      await refreshData();
      return true;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to delete sample',
      });
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        classes,
        samples,
        stats,
        activities,
        systemInfo,
        activeTab,
        setActiveTab,
        selectedSign,
        setSelectedSign,
        selectedSplit,
        setSelectedSplit,
        toasts,
        addToast,
        dismissToast,
        isLoading,
        isBackendOnline,
        refreshData,
        addClass,
        recordSample,
        removeSample,
        reviewSampleAction,
        augmentDataAction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
