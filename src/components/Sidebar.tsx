import React, { useEffect, useState } from 'react';
import {
  Mic,
  Search,
  UserPlus,
  Truck,
  CalendarDays,
  Wrench,
  Users,
  Building2,
  History,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Wallet,
  FlaskConical,
  BarChart3,
  FileText,
  AlertCircle,
  CalendarCheck2,
  Stethoscope,
  XCircle,
  TrendingUp,
  CreditCard,
  TrendingDown,
  Receipt,
  HandCoins,
  Banknote,
  UserCheck,
  CalendarX2,
  Home,
  LayoutGrid,
  Cake,
  CalendarCheck,
} from 'lucide-react';
import { resolvePractitionerDisplay, toLocalIsoDate } from '../core/clinic/clinicHelpers';
import { REPORT_DEFINITIONS, ReportTypeId } from '../core/clinic/reportEngine';
import { AppView, useAppStore } from '../store/useAppStore';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const DICTATE_VIEWS: AppView[] = ['home', 'recording', 'detail', 'downloads', 'privacy'];

const REPORT_ICONS: Record<ReportTypeId, React.ComponentType<{ className?: string }>> = {
  caja: Wallet,
  generado: BarChart3,
  pacientes_nuevos: UserPlus,
  pacientes_atendidos: Users,
  pacientes_sin_anotacion: AlertCircle,
  citas_agendadas: CalendarCheck2,
  prestaciones_realizadas: Stethoscope,
  presupuestos_no_aceptados: XCircle,
  cuentas_por_cobrar: TrendingUp,
  pacientes_deudores: CreditCard,
  cuentas_por_pagar: TrendingDown,
  facturas_por_pagar: Receipt,
  pago_de_pacientes: HandCoins,
  pago_a_proveedores: Banknote,
  pacientes_que_asistieron: UserCheck,
  pacientes_sin_cita: CalendarX2,
};

const SidebarCollapsible: React.FC<{
  open: boolean;
  children: React.ReactNode;
}> = ({ open, children }) => (
  <div
    aria-hidden={!open}
    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
    }`}
  >
    <div
      className={`overflow-hidden min-h-0 transition-[visibility] duration-200 ${
        open ? 'visible' : 'invisible'
      }`}
    >
      {children}
    </div>
  </div>
);

export const OdontoHelperLogo: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
      <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 4.5C11.2 4.5 8 7.5 8 12.2C8 16.5 9.8 19.8 10.9 24.4C11.5 26.8 12.7 27.8 13.9 27.8C15 27.8 15.5 25.4 16 23.8C16.5 25.4 17 27.8 18.1 27.8C19.3 27.8 20.5 26.8 21.1 24.4C22.2 19.8 24 16.5 24 12.2C24 7.5 20.8 4.5 16 4.5Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M16 9.8V16.2M12.8 13H19.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
    {!collapsed && (
      <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
        OdontoHelper
      </span>
    )}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
}) => {
  const {
    currentView,
    setView,
    activeReportType,
    setReportType,
    requestMicrophonePermission,
    patients,
    providers,
    appointments,
    labOrders,
    professionals,
    activeProfessionalId,
    profile,
    selectPatient,
    isRecording,
    guardNavigation,
  } = useAppStore();

  const practitioner = resolvePractitionerDisplay(professionals, activeProfessionalId, profile);

  const [inicioExpanded, setInicioExpanded] = useState(true);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [windowExpanded, setWindowExpanded] = useState(true);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const isDictateActive = DICTATE_VIEWS.includes(currentView);

  const todayStr = toLocalIsoDate();
  const todayAppointmentsCount = appointments.filter(
    (a) => !a.deletedAt && a.date === todayStr && a.status !== 'cancelled'
  ).length;
  const pendingLabCount = labOrders.filter(
    (o) => !o.deletedAt && (o.status === 'sin_enviar' || o.status === 'en_laboratorio')
  ).length;
  const assignedControlsCount = patients.filter((p) => Boolean(p.nextControlDate)).length;

  const handleNavigate = (view: AppView) => {
    guardNavigation(() => {
      setView(view);
      onCloseMobile();
    });
  };

  const handleSelectReport = (reportId: ReportTypeId) => {
    guardNavigation(() => {
      setReportType(reportId);
      onCloseMobile();
    });
  };

  const handleDictateClick = () => {
    guardNavigation(() => {
      void requestMicrophonePermission();
      setView('home');
      onCloseMobile();
    });
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors min-h-[38px] cursor-pointer ${
      active
        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
    }`;

  const sectionHeaderClass =
    'w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
        <button
          type="button"
          onClick={() => {
            guardNavigation(() => {
              selectPatient(null);
              setView('patients-search');
              onCloseMobile();
            });
          }}
          className="text-left focus:outline-hidden rounded-xl cursor-pointer"
          title="OdontoHelper"
        >
          <OdontoHelperLogo collapsed={collapsed} />
        </button>

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Top Premium Action: Dictar historia clínica (Nuestra función exclusiva) */}
      <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          onClick={handleDictateClick}
          title="Dictar historia clínica (función exclusiva de voz local)"
          className={`w-full flex items-center gap-2 cursor-pointer ${
            collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          } py-2.5 rounded-xl text-[13px] font-semibold transition-all min-h-[44px] ${
            isDictateActive
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
              : 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/50'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0 text-left leading-snug">
            <Mic className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Dictar historia clínica</span>}
          </span>
          {!collapsed && isRecording && (
            <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-rose-500 text-white shrink-0">
              REC
            </span>
          )}
        </button>
      </div>

      {/* Scrollable Navigation Menu (Inicio · Reportes · Herramientas · Ventana) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
        {/* 1. INICIO */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setInicioExpanded((prev) => !prev)}
              aria-expanded={inicioExpanded}
              className={sectionHeaderClass}
            >
              <span className="flex items-center gap-2">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Inicio</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  inicioExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : null}

          <SidebarCollapsible open={inicioExpanded || collapsed}>
            <div className="space-y-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  guardNavigation(() => {
                    selectPatient(null);
                    setView('patients-search');
                    onCloseMobile();
                  });
                }}
                title="Pacientes"
                className={navItemClass(
                  currentView === 'patients-search' || currentView === 'manage-patients'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Search className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Pacientes</span>}
                </span>
                {!collapsed && patients.length > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {patients.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('patient-new')}
                title="Nuevo Paciente"
                className={navItemClass(currentView === 'patient-new')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <UserPlus className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Nuevo Paciente</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('provider-new')}
                title="Nuevo Proveedor"
                className={navItemClass(currentView === 'provider-new')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Truck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Nuevo Proveedor</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('agenda')}
                title="Agenda"
                className={navItemClass(currentView === 'agenda')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <CalendarDays className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Agenda</span>}
                </span>
                {!collapsed && todayAppointmentsCount > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-teal-700 dark:text-teal-300 font-semibold">
                    {todayAppointmentsCount}
                  </span>
                )}
              </button>
            </div>
          </SidebarCollapsible>
        </div>

        {/* 2. REPORTES (Collapsible with exact 16 items) */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {!collapsed ? (
            <>
              <button
                type="button"
                onClick={() => setReportsExpanded((prev) => !prev)}
                aria-expanded={reportsExpanded}
                className={sectionHeaderClass}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reportes</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    reportsExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <SidebarCollapsible open={reportsExpanded}>
                <div className="pl-1 space-y-0.5 pt-0.5">
                  {REPORT_DEFINITIONS.map((report) => {
                    const Icon = REPORT_ICONS[report.id];
                    const isActive = currentView === 'reports' && activeReportType === report.id;
                    return (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => handleSelectReport(report.id)}
                        title={report.description}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] leading-snug text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 font-medium'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <span className="flex-1">{report.label}</span>
                      </button>
                    );
                  })}
                </div>
              </SidebarCollapsible>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleNavigate('reports')}
              title="Reportes"
              className={navItemClass(currentView === 'reports')}
            >
              <span className="flex items-center justify-center w-full">
                <FileText className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              </span>
            </button>
          )}
        </div>

        {/* 3. HERRAMIENTAS */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setToolsExpanded((prev) => !prev)}
              aria-expanded={toolsExpanded}
              className={sectionHeaderClass}
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span>Herramientas</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  toolsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : null}

          <SidebarCollapsible open={toolsExpanded || collapsed}>
            <div className="space-y-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => handleNavigate('manage-providers')}
                title="Administrar Proveedores"
                className={navItemClass(currentView === 'manage-providers')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Building2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Administrar Proveedores</span>}
                </span>
                {!collapsed && providers.length > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {providers.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('activity-log')}
                title="Historial de actividad"
                className={navItemClass(currentView === 'activity-log')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <History className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Historial de actividad</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('settings')}
                title="Configuración"
                className={navItemClass(currentView === 'settings')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Settings className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Configuración</span>}
                </span>
              </button>
            </div>
          </SidebarCollapsible>
        </div>

        {/* 4. VENTANA */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setWindowExpanded((prev) => !prev)}
              aria-expanded={windowExpanded}
              className={sectionHeaderClass}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                <span>Ventana</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  windowExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : null}

          <SidebarCollapsible open={windowExpanded || collapsed}>
            <div className="space-y-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => handleNavigate('birthdays')}
                title="Cumpleaños"
                className={navItemClass(currentView === 'birthdays')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Cake className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Cumpleaños</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('next-controls')}
                title="Próximo Control"
                className={navItemClass(currentView === 'next-controls')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <CalendarCheck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Próximo Control</span>}
                </span>
                {!collapsed && assignedControlsCount > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {assignedControlsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('lab')}
                title="Trabajos de Laboratorio"
                className={navItemClass(currentView === 'lab')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <FlaskConical className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Trabajos de Laboratorio</span>}
                </span>
                {!collapsed && pendingLabCount > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                    {pendingLabCount}
                  </span>
                )}
              </button>
            </div>
          </SidebarCollapsible>
        </div>
      </nav>

      {/* Active Practitioner Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => handleNavigate('settings')}
          title={`${practitioner.name} · ${practitioner.meta}`}
          className={`w-full flex items-center gap-2.5 rounded-xl transition-colors cursor-pointer ${
            collapsed ? 'justify-center p-1.5' : 'px-2.5 py-2 text-left'
          } ${
            currentView === 'settings'
              ? 'bg-teal-50 dark:bg-teal-950/60'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <span className="w-8 h-8 rounded-full bg-teal-600/12 dark:bg-teal-500/20 border border-teal-600/20 dark:border-teal-400/20 text-teal-700 dark:text-teal-300 font-semibold text-xs flex items-center justify-center shrink-0">
            {practitioner.initials}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {practitioner.name}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {practitioner.meta}
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[264px]'
        } print:hidden`}
      >
        <div className="sticky top-0 h-dvh">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
