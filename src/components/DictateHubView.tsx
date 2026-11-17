import React from 'react';
import { Mic, Shield, Download } from 'lucide-react';
import { shouldShowDownloadsTab } from '../core/runtime/platform';
import { useAppStore } from '../store/useAppStore';
import { DetailView } from './DetailView';
import { DownloadsView } from './DownloadsView';
import { HomeView } from './HomeView';
import { PrivacyView } from './PrivacyView';
import { RecordingView } from './RecordingView';

export const DictateHubView: React.FC = () => {
  const { currentView, setView } = useAppStore();
  const showDownloads = shouldShowDownloadsTab();

  const showSubTabs =
    currentView === 'home' || currentView === 'privacy' || currentView === 'downloads';

  return (
    <div className="flex flex-col h-full">
      {showSubTabs && (
        <div className="no-print border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
              <button
                type="button"
                onClick={() => setView('home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentView === 'home'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Grabaciones y dictado</span>
              </button>

              <button
                type="button"
                onClick={() => setView('privacy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentView === 'privacy'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Privacidad</span>
              </button>

              {showDownloads && (
                <button
                  type="button"
                  onClick={() => setView('downloads')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'downloads'
                      ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
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
