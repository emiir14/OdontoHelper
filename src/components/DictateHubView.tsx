import React from 'react';
import { Mic, Shield, Download } from 'lucide-react';
import { shouldShowDownloadsTab } from '../core/runtime/platform';
import { useAppStore } from '../store/useAppStore';
import { DetailView } from './DetailView';
import { DownloadsView } from './DownloadsView';
import { HomeView } from './HomeView';
import { PrivacyView } from './PrivacyView';
import { RecordingView } from './RecordingView';

import { segmentedTabClass, segmentedTrackClass } from './ui/uiClasses';

export const DictateHubView: React.FC = () => {
  const { currentView, setView } = useAppStore();
  const showDownloads = shouldShowDownloadsTab();

  const showSubTabs =
    currentView === 'home' || currentView === 'privacy' || currentView === 'downloads';

  return (
    <div className="flex flex-col h-full">
      {showSubTabs && (
        <div className="no-print border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-3">
            <div className={`${segmentedTrackClass} w-full sm:w-auto`}>
              <button
                type="button"
                onClick={() => setView('home')}
                className={`inline-flex items-center gap-1.5 ${segmentedTabClass(currentView === 'home')}`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Grabaciones y dictado</span>
              </button>

              <button
                type="button"
                onClick={() => setView('privacy')}
                className={`inline-flex items-center gap-1.5 ${segmentedTabClass(currentView === 'privacy')}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Privacidad</span>
              </button>

              {showDownloads && (
                <button
                  type="button"
                  onClick={() => setView('downloads')}
                  className={`inline-flex items-center gap-1.5 ${segmentedTabClass(currentView === 'downloads')}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargas nativas</span>
                </button>
              )}
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Transcripción Whisper 100% local en este dispositivo
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {currentView === 'home' && <HomeView />}
        {currentView === 'recording' && <RecordingView />}
        {currentView === 'detail' && <DetailView />}
        {currentView === 'privacy' && <PrivacyView />}
        {currentView === 'downloads' && (showDownloads ? <DownloadsView /> : <HomeView />)}
      </div>
    </div>
  );
};
