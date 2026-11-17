import React, { useState } from 'react';
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
  ChevronRight,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  FileSpreadsheet,
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
} from 'lucide-react';
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
    treatmentPlans,
    labOrders,
    professionals,
    activeProfessionalId,
    setActiveProfessional,
    canAccessFinance,
    selectPatient,
    isRecording,
  } = useAppStore();

  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [reportsExpanded, setReportsExpanded] = useState(true);

  const isDictateActive = DICTATE_VIEWS.includes(currentView);
  const financeAllowed = canAccessFinance();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppointmentsCount = appointments.filter(
    (a) => a.date === todayStr && a.status !== 'cancelled'
  ).length;
  const activePlansCount = treatmentPlans.filter(
    (p) => !p.deletedAt && p.status !== 'finalizado'
  ).length;
  const pendingLabCount = labOrders.filter(
    (o) => !o.deletedAt && (o.status === 'sin_enviar' || o.status === 'en_laboratorio')
  ).length;

  const handleNavigate = (view: AppView) => {
    setView(view);
    onCloseMobile();
  };

  const handleSelectReport = (reportId: ReportTypeId) => {
    setReportType(reportId);
    onCloseMobile();
  };

  const handleDictateClick = () => {
    void requestMicrophonePermission();
    handleNavigate('home');
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors min-h-[40px] ${
      active
        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
        <button
          type="button"
          onClick={() => {
            selectPatient(null);
            handleNavigate('patients-search');
          }}
          className="text-left focus:outline-hidden rounded-xl"
          title="OdontoHelper"
        >
          <OdontoHelperLogo collapsed={collapsed} />
        </button>

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Top Primary Action: Dictar historia clínica (contains all Escriba recorder & transcription tools) */}
      <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          onClick={handleDictateClick}
          title="Dictar historia clínica (solicita acceso al micrófono y abre el grabador local)"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          } py-2.5 rounded-xl text-[13px] font-semibold transition-all min-h-[44px] whitespace-nowrap ${
            isDictateActive
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
              : 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/50'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Mic className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Dictar historia clínica</span>}
          </span>
          {!collapsed && isRecording && (
            <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-rose-500 text-white">
              REC
            </span>
          )}
        </button>
      </div>

      {/* Scrollable Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin">
        {/* Main Clinical Section */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Gestión clínica
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              selectPatient(null);
              handleNavigate('patients-search');
            }}
            title="Buscar paciente"
            className={navItemClass(currentView === 'patients-search')}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Search className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!collapsed && <span className="truncate">Buscar paciente</span>}
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
            title="Nuevo paciente"
            className={navItemClass(currentView === 'patient-new')}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <UserPlus className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!collapsed && <span className="truncate">Nuevo paciente</span>}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('provider-new')}
            title="Nuevo proveedor"
            className={navItemClass(currentView === 'provider-new')}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Truck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!collapsed && <span className="truncate">Nuevo proveedor</span>}
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

        {/* Planes, Laboratorio y Finanzas */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Clínica y Gestión
            </div>
          )}

          <button
            type="button"
            onClick={() => handleNavigate('budgets')}
            title="Presupuestos y tratamientos"
            className={navItemClass(currentView === 'budgets')}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!collapsed && <span className="truncate">Presupuestos</span>}
            </span>
            {!collapsed && activePlansCount > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                {activePlansCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('lab')}
            title="Trabajos de laboratorio"
            className={navItemClass(currentView === 'lab')}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <FlaskConical className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!collapsed && <span className="truncate">Laboratorio</span>}
            </span>
            {!collapsed && pendingLabCount > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                {pendingLabCount}
              </span>
            )}
          </button>

          {financeAllowed && (
            <>
              <button
                type="button"
                onClick={() => handleNavigate('finance')}
                title="Caja diaria, cobros y deudores"
                className={navItemClass(currentView === 'finance')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Wallet className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Caja y cobros</span>}
                </span>
              </button>

              {/* Reportes Collapsible Section */}
              <div className="pt-1 space-y-1">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => setReportsExpanded((prev) => !prev)}
                    aria-expanded={reportsExpanded}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors min-h-[40px] ${
                      currentView === 'reports'
                        ? 'text-teal-800 dark:text-teal-200 font-semibold bg-teal-50/60 dark:bg-teal-950/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      <span className="truncate">Reportes</span>
                    </span>
                    {reportsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleNavigate('reports')}
                    title="Reportes e indicadores"
                    className={navItemClass(currentView === 'reports')}
                  >
                    <span className="flex items-center justify-center w-full">
                      <FileText className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    </span>
                  </button>
                )}

                {!collapsed && reportsExpanded && (
                  <div className="pl-2 space-y-0.5">
                    {REPORT_DEFINITIONS.map((report) => {
                      const Icon = REPORT_ICONS[report.id];
                      const isActive =
                        currentView === 'reports' && activeReportType === report.id;
                      return (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => handleSelectReport(report.id)}
                          title={report.description}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] leading-snug text-left transition-colors ${
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
                )}
              </div>
            </>
          )}
        </div>

        {/* Herramientas (Expandable Submenu) */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setToolsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" />
                <span>Herramientas</span>
              </span>
              {toolsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="px-3 pb-1 flex justify-center text-slate-400">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          )}

          {(toolsExpanded || collapsed) && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavigate('manage-patients')}
                title="Administrar pacientes"
                className={navItemClass(currentView === 'manage-patients')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Users className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Administrar pacientes</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('manage-providers')}
                title="Administrar proveedores"
                className={navItemClass(currentView === 'manage-providers')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Building2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  {!collapsed && <span className="truncate">Administrar proveedores</span>}
                </span>
                {!collapsed && providers.length > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {providers.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom System Section */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1 shrink-0">
        {!collapsed && professionals.length > 0 && (
          <div className="px-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800/80">
            <label
              htmlFor="active-operator-select"
              className="block text-[10px] font-semibold text-slate-400 mb-1"
            >
              Operador activo
            </label>
            <select
              id="active-operator-select"
              value={activeProfessionalId || ''}
              onChange={(e) => setActiveProfessional(e.target.value || null)}
              className="w-full px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 truncate"
            >
              {professionals
                .filter((p) => p.active)
                .map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.fullName}
                  </option>
                ))}
            </select>
          </div>
        )}

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
