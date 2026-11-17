/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Menu, Mic, Sun, Moon } from 'lucide-react';
import { ActivityLogView } from './components/ActivityLogView';
import { AgendaView } from './components/AgendaView';
import { CajaView } from './components/CajaView';
import { ConfirmModal } from './components/ConfirmModal';
import { DictateHubView } from './components/DictateHubView';
import { LaboratorioView } from './components/LaboratorioView';
import { ManagePatientsView } from './components/ManagePatientsView';
import { ManageProvidersView } from './components/ManageProvidersView';
import { OnboardingModal } from './components/OnboardingModal';
import { PatientFormView } from './components/PatientFormView';
import { PatientSearchView } from './components/PatientSearchView';
import { PresupuestosView } from './components/PresupuestosView';
import { ProviderFormView } from './components/ProviderFormView';
import { ReportesView } from './components/ReportesView';
import { SettingsView } from './components/SettingsView';
import { OdontoHelperLogo, Sidebar } from './components/Sidebar';
import { SupabaseAuthView } from './components/SupabaseAuthView';
import { Toast } from './components/Toast';
import { getSupabaseClient } from './adapters/supabase/supabaseClient';
import { REPORT_DEFINITIONS } from './core/clinic/reportEngine';
import { shouldShowDownloadsTab } from './core/runtime/platform';
import { AppView, useAppStore } from './store/useAppStore';

const VIEW_TITLES: Record<AppView, string> = {
  home: 'Dictar historia clínica',
  recording: 'Grabación en curso',
  detail: 'Dictar historia clínica / Detalle de sesión',
  downloads: 'Dictar historia clínica / Descargas nativas',
  privacy: 'Dictar historia clínica / Privacidad',
  'patients-search': 'Ficha clínica del paciente',
  'patient-new': 'Nuevo paciente',
  'provider-new': 'Nuevo proveedor',
  agenda: 'Agenda y calendario',
  budgets: 'Presupuestos y tratamientos',
  finance: 'Caja diaria, cobros y deudores',
  lab: 'Órdenes de laboratorio',
  reports: 'Reportes e indicadores',
  'manage-patients': 'Herramientas / Administrar pacientes',
  'manage-providers': 'Herramientas / Administrar proveedores',
  'activity-log': 'Historial de actividad',
  settings: 'Configuración',
};

const DICTATE_VIEWS: AppView[] = ['home', 'recording', 'detail', 'downloads', 'privacy'];

export default function App() {
  const {
    currentView,
    activeReportType,
    setView,
    init,
    authRequired,
    requestMicrophonePermission,
    isRecording,
    transcribingSessionId,
    settings,
    updateSettings,
  } = useAppStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const showDownloads = shouldShowDownloadsTab();

  useEffect(() => {
    init();

    const supabase = getSupabaseClient();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        init();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [init, setView]);

  // Prevent accidental tab closure or refresh during recording or transcription
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || transcribingSessionId) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording, transcribingSessionId]);

  if (authRequired) {
    return (
      <>
        <SupabaseAuthView onAuthenticated={() => init()} />
        <Toast />
      </>
    );
  }

  const isDetailView = currentView === 'detail';
  const isDictateView = DICTATE_VIEWS.includes(currentView);
  const isDark =
    settings?.theme === 'dark' ||
    (settings?.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const activeReportLabel =
    REPORT_DEFINITIONS.find((r) => r.id === activeReportType)?.label || 'Caja';
  const breadcrumbTitle =
    currentView === 'reports'
      ? `Reportes / ${activeReportLabel}`
      : VIEW_TITLES[currentView];

  return (
    <div
      className={`flex bg-[#EDEFEA] text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors ${
        isDetailView
          ? 'min-h-full lg:h-dvh lg:overflow-hidden print:h-auto print:overflow-visible'
          : 'min-h-full'
      }`}
    >
      {/* Left Sidebar Navigation */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Right Workspace Column */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${
          isDetailView ? 'lg:h-dvh lg:overflow-hidden print:h-auto print:overflow-visible' : ''
        }`}
      >
        {/* Contextual Workspace Header (suppressed during active recording) */}
        {currentView !== 'recording' && (
          <header className="no-print sticky top-0 z-30 h-16 px-4 sm:px-6 lg:px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Abrir menú lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="lg:hidden">
                <OdontoHelperLogo />
              </div>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  OdontoHelper
                </span>
                <span aria-hidden="true">/</span>
                <span className="truncate">{breadcrumbTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={isDark ? 'Cambiar a tema claro cálido' : 'Cambiar a tema oscuro'}
                aria-label="Cambiar tema visual"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {!isDictateView && (
                <button
                  type="button"
                  onClick={() => {
                    void requestMicrophonePermission();
                    setView('home');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs whitespace-nowrap"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dictar historia</span>
                  <span className="sm:hidden">Dictar</span>
                </button>
              )}
            </div>
          </header>
        )}

        {/* Main View Router */}
        <main
          className={`flex-1 ${
            isDetailView ? 'lg:min-h-0 lg:overflow-hidden print:overflow-visible' : ''
          }`}
        >
          {isDictateView && (
            <DictateHubView />
          )}
          {currentView === 'downloads' && !showDownloads && <DictateHubView />}
          {currentView === 'patients-search' && <PatientSearchView />}
          {currentView === 'patient-new' && <PatientFormView />}
          {currentView === 'provider-new' && <ProviderFormView />}
          {currentView === 'agenda' && <AgendaView />}
          {currentView === 'budgets' && <PresupuestosView />}
          {currentView === 'finance' && <CajaView />}
          {currentView === 'lab' && <LaboratorioView />}
          {currentView === 'reports' && <ReportesView />}
          {currentView === 'manage-patients' && <ManagePatientsView />}
          {currentView === 'manage-providers' && <ManageProvidersView />}
          {currentView === 'activity-log' && <ActivityLogView />}
          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Modals & Toast */}
      <OnboardingModal />
      <ConfirmModal />
      <Toast />
    </div>
  );
}
