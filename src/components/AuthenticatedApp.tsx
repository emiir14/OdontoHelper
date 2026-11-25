import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Menu, Mic, Sun, Moon, RotateCw } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { OnboardingModal } from './OnboardingModal';
import { ShareInviteModal } from './ShareInviteModal';
import { OdontoHelperLogo, Sidebar } from './Sidebar';
import { SubscriptionBanner } from './SubscriptionBanner';
import { Toast } from './Toast';
import { TransferPaymentModal } from './TransferPaymentModal';
import { isTestAuthActive } from '../core/auth/testAuth';
import { getSupabaseClient, isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import { resolvePractitionerDisplay } from '../core/clinic/clinicHelpers';
import { REPORT_DEFINITIONS } from '../core/clinic/reportEngine';
import {
  LOGIN_ROUTE,
  buildAppUrl,
  getModuleDocumentTitle,
  parseAppLocation,
  sanitizeInternalNextPath,
} from '../core/routing/appRoutes';
import { applyPrivateNoIndexMetadata } from '../core/seo/seoManager';
import { AppView, useAppStore } from '../store/useAppStore';

const ActivityLogView = lazy(() =>
  import('./ActivityLogView').then((m) => ({ default: m.ActivityLogView }))
);
const AgendaView = lazy(() =>
  import('./AgendaView').then((m) => ({ default: m.AgendaView }))
);
const CajaView = lazy(() =>
  import('./CajaView').then((m) => ({ default: m.CajaView }))
);
const DictateHubView = lazy(() =>
  import('./DictateHubView').then((m) => ({ default: m.DictateHubView }))
);
const LaboratorioView = lazy(() =>
  import('./LaboratorioView').then((m) => ({ default: m.LaboratorioView }))
);
const ManageProvidersView = lazy(() =>
  import('./ManageProvidersView').then((m) => ({ default: m.ManageProvidersView }))
);
const PatientFormView = lazy(() =>
  import('./PatientFormView').then((m) => ({ default: m.PatientFormView }))
);
const PatientSearchView = lazy(() =>
  import('./PatientSearchView').then((m) => ({ default: m.PatientSearchView }))
);
const PresupuestosView = lazy(() =>
  import('./PresupuestosView').then((m) => ({ default: m.PresupuestosView }))
);
const ProviderFormView = lazy(() =>
  import('./ProviderFormView').then((m) => ({ default: m.ProviderFormView }))
);
const ReportesView = lazy(() =>
  import('./ReportesView').then((m) => ({ default: m.ReportesView }))
);
const SettingsView = lazy(() =>
  import('./SettingsView').then((m) => ({ default: m.SettingsView }))
);
const CumpleanosView = lazy(() =>
  import('./VentanaViews').then((m) => ({ default: m.CumpleanosView }))
);
const ProximoControlView = lazy(() =>
  import('./VentanaViews').then((m) => ({ default: m.ProximoControlView }))
);

const ViewLoadingFallback: React.FC = () => (
  <div className="min-h-[45vh] flex items-center justify-center px-4">
    <div className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
      <span>Cargando módulo...</span>
    </div>
  </div>
);

const VIEW_TITLES: Record<AppView, string> = {
  home: 'Dictar historia clínica',
  recording: 'Grabación en curso',
  detail: 'Dictar historia clínica / Detalle de sesión',
  downloads: 'Dictar historia clínica / Descargas nativas',
  privacy: 'Dictar historia clínica / Privacidad',
  'patients-search': 'Pacientes',
  'patient-new': 'Nuevo Paciente',
  'provider-new': 'Nuevo Proveedor',
  agenda: 'Agenda',
  budgets: 'Presupuestos',
  finance: 'Caja',
  lab: 'Trabajos de Laboratorio',
  birthdays: 'Ventana / Cumpleaños',
  'next-controls': 'Ventana / Próximo Control',
  reports: 'Reportes',
  'manage-patients': 'Pacientes / Tabla masiva',
  'manage-providers': 'Herramientas / Administrar Proveedores',
  'activity-log': 'Herramientas / Historial de actividad',
  settings: 'Herramientas / Configuración',
};

const DICTATE_VIEWS: AppView[] = ['home', 'recording', 'detail', 'downloads', 'privacy'];

interface AuthenticatedAppProps {
  onSignedOut: () => void;
}

export const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ onSignedOut }) => {
  const {
    currentView,
    activeReportType,
    currentSessionId,
    selectedPatientId,
    selectedPatientSubView,
    editingPatientId,
    editingProviderId,
    selectedAgendaDate,
    shareInviteToken,
    postLoginRedirect,
    moduleQuery,
    applyParsedRoute,
    setPostLoginRedirect,
    setView,
    init,
    authRequired,
    isRecording,
    transcribingSessionId,
    dirtyDraftKeys,
    guardNavigation,
    settings,
    updateSettings,
    professionals,
    activeProfessionalId,
    profile,
    workspace,
  } = useAppStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const isApplyingPopStateRef = useRef(false);
  const hadWorkspaceOnceRef = useRef(false);

  useEffect(() => {
    if (workspace && !authRequired) {
      hadWorkspaceOnceRef.current = true;
    } else if (hadWorkspaceOnceRef.current && authRequired) {
      hadWorkspaceOnceRef.current = false;
      onSignedOut();
    }
  }, [workspace, authRequired, onSignedOut]);

  useEffect(() => {
    const initialParsed = parseAppLocation(window.location.pathname, window.location.search);
    if (initialParsed.hadForbiddenPii) {
      const cleanedUrl = buildAppUrl({
        authRequired: false,
        currentView: initialParsed.currentView,
        activeReportType: initialParsed.activeReportType,
        currentSessionId: initialParsed.currentSessionId,
        selectedPatientId: initialParsed.selectedPatientId,
        selectedPatientSubView: initialParsed.selectedPatientSubView,
        editingPatientId: initialParsed.editingPatientId,
        editingProviderId: initialParsed.editingProviderId,
        selectedAgendaDate: initialParsed.selectedAgendaDate,
        shareInviteToken: initialParsed.shareInviteToken,
        postLoginRedirect: initialParsed.nextPath,
        moduleQuery: initialParsed.moduleQuery,
      });
      window.history.replaceState(null, '', cleanedUrl);
    }

    if (initialParsed.isLoginRoute) {
      if (initialParsed.nextPath) {
        setPostLoginRedirect(initialParsed.nextPath);
      }
    } else {
      applyParsedRoute(initialParsed);
    }
    setRouteHydrated(true);

    init();

    const handlePopState = () => {
      const parsed = parseAppLocation(window.location.pathname, window.location.search);
      if (parsed.isLoginRoute && !isTestAuthActive() && !isSupabaseConfigured()) {
        if (parsed.nextPath) setPostLoginRedirect(parsed.nextPath);
        onSignedOut();
        return;
      }
      if (useAppStore.getState().authRequired && !parsed.isLoginRoute) {
        const safeNext = sanitizeInternalNextPath(
          `${window.location.pathname}${window.location.search}`
        );
        setPostLoginRedirect(safeNext);
        const loginUrl = buildAppUrl({
          authRequired: true,
          currentView: 'home',
          postLoginRedirect: safeNext,
        });
        window.history.replaceState(null, '', loginUrl);
        return;
      }
      isApplyingPopStateRef.current = true;
      applyParsedRoute(parsed);
    };

    window.addEventListener('popstate', handlePopState);

    const supabase = getSupabaseClient();
    const authSub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        onSignedOut();
      } else if (event === 'SIGNED_IN') {
        init();
      }
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      authSub?.data.subscription.unsubscribe();
    };
  }, [init, applyParsedRoute, setPostLoginRedirect, onSignedOut]);

  // Bidirectional URL synchronization & private route noindex enforcement
  useEffect(() => {
    if (!routeHydrated || authRequired) return;

    const routeInput = {
      authRequired: false,
      currentView,
      activeReportType,
      currentSessionId,
      selectedPatientId,
      selectedPatientSubView,
      editingPatientId,
      editingProviderId,
      selectedAgendaDate,
      shareInviteToken,
      postLoginRedirect,
      moduleQuery,
    };

    const targetUrl = buildAppUrl(routeInput);
    applyPrivateNoIndexMetadata(getModuleDocumentTitle(routeInput));

    const currentBrowserUrl = `${window.location.pathname}${window.location.search}`;
    if (currentBrowserUrl !== targetUrl) {
      const qIdx = targetUrl.indexOf('?');
      const targetPath = qIdx >= 0 ? targetUrl.slice(0, qIdx) : targetUrl;
      const samePathname = window.location.pathname === targetPath;
      const shouldReplace =
        isApplyingPopStateRef.current ||
        currentBrowserUrl === '/' ||
        window.location.pathname === LOGIN_ROUTE ||
        samePathname;

      if (shouldReplace) {
        window.history.replaceState(null, '', targetUrl);
      } else {
        window.history.pushState(null, '', targetUrl);
      }
    }

    isApplyingPopStateRef.current = false;
  }, [
    routeHydrated,
    authRequired,
    currentView,
    activeReportType,
    currentSessionId,
    selectedPatientId,
    selectedPatientSubView,
    editingPatientId,
    editingProviderId,
    selectedAgendaDate,
    shareInviteToken,
    postLoginRedirect,
    moduleQuery,
  ]);

  // Prevent accidental tab closure or refresh during recording, transcription, or unsaved drafts
  useEffect(() => {
    const hasDirtyDrafts = Object.keys(dirtyDraftKeys).length > 0;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || transcribingSessionId || hasDirtyDrafts) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording, transcribingSessionId, dirtyDraftKeys]);

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
  const practitioner = resolvePractitionerDisplay(professionals, activeProfessionalId, profile);

  return (
    <div
      className={`flex bg-[#EDEFEA] text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors ${
        isDetailView
          ? 'min-h-full overflow-x-clip lg:h-dvh lg:overflow-hidden print:h-auto print:overflow-visible'
          : 'min-h-full overflow-x-clip'
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
          <header className="no-print sticky top-0 z-30 h-16 px-3 sm:px-6 lg:px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Abrir menú lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="lg:hidden">
                <OdontoHelperLogo />
              </div>

              <nav
                aria-label="Ubicación actual"
                className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate"
              >
                {breadcrumbTitle.split(' / ').map((segment, index, arr) => {
                  const isLast = index === arr.length - 1;
                  return (
                    <React.Fragment key={`${segment}-${index}`}>
                      {index > 0 && (
                        <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                          /
                        </span>
                      )}
                      <span
                        className={
                          isLast
                            ? 'font-semibold text-slate-800 dark:text-slate-200 truncate'
                            : 'text-slate-500 dark:text-slate-400 truncate'
                        }
                      >
                        {segment}
                      </span>
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => guardNavigation(() => setView('settings'))}
                title={`${practitioner.name} · ${practitioner.meta}`}
                className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors max-w-[220px] cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-teal-600/12 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold text-[10px] flex items-center justify-center shrink-0">
                  {practitioner.initials}
                </span>
                <span className="font-medium truncate">{practitioner.name}</span>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isDark ? 'Cambiar a tema claro cálido' : 'Cambiar a tema oscuro'}
                aria-label="Cambiar tema visual"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {!isDictateView && (
                <button
                  type="button"
                  onClick={() => {
                    guardNavigation(() => {
                      setView('home');
                    });
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dictar historia</span>
                  <span className="sm:hidden">Dictar</span>
                </button>
              )}
            </div>
          </header>
        )}

        {/* Cross-Tier Expiration Notice & Trial Banner */}
        {currentView !== 'recording' && <SubscriptionBanner />}

        {/* Main View Router */}
        <main
          className={`flex-1 min-w-0 ${
            isDetailView ? 'lg:min-h-0 lg:overflow-hidden print:overflow-visible' : ''
          }`}
        >
          <Suspense fallback={<ViewLoadingFallback />}>
            {isDictateView && <DictateHubView />}
            {(currentView === 'patients-search' || currentView === 'manage-patients') && (
              <PatientSearchView />
            )}
            {currentView === 'patient-new' && <PatientFormView />}
            {currentView === 'provider-new' && <ProviderFormView />}
            {currentView === 'agenda' && <AgendaView />}
            {currentView === 'budgets' && <PresupuestosView />}
            {currentView === 'finance' && <CajaView />}
            {currentView === 'lab' && <LaboratorioView />}
            {currentView === 'birthdays' && <CumpleanosView />}
            {currentView === 'next-controls' && <ProximoControlView />}
            {currentView === 'reports' && <ReportesView />}
            {currentView === 'manage-providers' && <ManageProvidersView />}
            {currentView === 'activity-log' && <ActivityLogView />}
            {currentView === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Global Modals & Toast */}
      <ShareInviteModal />
      <TransferPaymentModal />
      <OnboardingModal />
      <ConfirmModal />
      <Toast />
    </div>
  );
};
