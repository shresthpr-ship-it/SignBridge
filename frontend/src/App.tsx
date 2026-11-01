import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Shell } from './components/layout/Shell';
import { OverviewView } from './components/views/OverviewView';
import { RecognitionView } from './components/views/RecognitionView';
import { SentenceModeView } from './components/views/SentenceModeView';
import { TutorialView } from './components/views/TutorialView';
import { StudioView } from './components/views/StudioView';
import { VideoProcessingView } from './components/views/VideoProcessingView';
import { DatasetView } from './components/views/DatasetView';
import { LabelManagementView } from './components/views/LabelManagementView';
import { AugmentationLabView } from './components/views/AugmentationLabView';
import { ReviewQueueView } from './components/views/ReviewQueueView';
import { ModelTrainingView } from './components/views/ModelTrainingView';
import { ExportCenterView } from './components/views/ExportCenterView';
import { SettingsView } from './components/views/SettingsView';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './components/ui/Button';

const MainContent: React.FC = () => {
  const { activeTab, isBackendOnline, isLoading, refreshData } = useApp();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-xs font-medium">Initializing SignBridge workspace...</span>
      </div>
    );
  }

  return (
    <>
      {/* Backend connection warning banner if offline */}
      {!isBackendOnline && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Backend Disconnected:</strong> FastAPI backend is not responding. Ensure the server is running on <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">http://127.0.0.1:8001</code>.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            className="border-amber-300 text-amber-900 hover:bg-amber-100"
            leftIcon={<RefreshCw className="w-3 h-3" />}
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* Active Tab View */}
      {activeTab === 'overview' && <OverviewView />}
      {activeTab === 'recognition' && <RecognitionView />}
      {activeTab === 'sentence-mode' && <SentenceModeView />}
      {activeTab === 'tutorial' && <TutorialView />}
      {activeTab === 'studio' && <StudioView />}
      {activeTab === 'video' && <VideoProcessingView />}
      {activeTab === 'dataset' && <DatasetView />}
      {activeTab === 'labels' && <LabelManagementView />}
      {activeTab === 'review' && <ReviewQueueView />}
      {activeTab === 'augmentation' && <AugmentationLabView />}
      {activeTab === 'training' && <ModelTrainingView />}
      {activeTab === 'export' && <ExportCenterView />}
      {activeTab === 'settings' && <SettingsView />}
    </>
  );
};

export const App: React.FC = () => {
  const isTutorialWindow = window.location.search.includes('window=tutorial');

  if (isTutorialWindow) {
    return (
      <AppProvider>
        <TutorialView isPopout={true} />
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <Shell>
        <MainContent />
      </Shell>
    </AppProvider>
  );
};

export default App;
