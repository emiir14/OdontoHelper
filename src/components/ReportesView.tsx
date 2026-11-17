import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileDown,
  Lock,
  Search,
  CalendarRange,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  formatMoney,
} from '../core/clinic/clinicHelpers';
import {
  REPORT_DEFINITIONS,
  ReportDefinition,
  ReportKpi,
  ReportTypeId,
  buildReportData,
} from '../core/clinic/reportEngine';
import { PaymentMethod } from '../core/types';
import { useAppStore } from '../store/useAppStore';

type DatePreset = 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'all' | 'custom';

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getPresetDates(preset: Exclude<DatePreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const todayStr = toIsoDate(now);

  switch (preset) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toIsoDate(start), to: toIsoDate(end) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIsoDate(start), to: toIsoDate(end) };
    }
    case 'last_30': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      return { from: toIsoDate(start), to: todayStr };
    }
    case 'this_year': {
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    }
    case 'all': {
      return { from: '2000-01-01', to: '2099-12-31' };
    }
  }
}

const CATEGORY_LABELS: Record<ReportDefinition['category'], string> = {
  finanzas: 'Finanzas y Cobranzas',
  pacientes: 'Pacientes y Asistencia',
  agenda_clinica: 'Agenda y Prestaciones',
  proveedores: 'Proveedores y Laboratorio',
};

const KPI_TONE_CLASSES: Record<NonNullable<ReportKpi['tone']>, string> = {
  default: 'text-slate-900 dark:text-slate-100',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  teal: 'text-teal-700 dark:text-teal-400',
};

export const ReportesView: React.FC = () => {
  const {
    activeReportType,
    setReportType,
    patients,
    providers,
    appointments,
    clinicalEvolutions,
    sessions,
    treatmentPlans,
    financialTransactions,
    labOrders,
    professionals,
    activeProfessionalId,
    settings,
    canAccessFinance,
    showToast,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;

  const initialDates = useMemo(() => getPresetDates('this_month'), []);
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allowed = canAccessFinance();

  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    const range = getPresetDates(preset);
    setDatePreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const reportData = useMemo(
    () =>
      buildReportData({
        reportId: activeReportType,
        fromDate,
        toDate,
        professionalFilter,
        currency: activeCurrency,
        patients,
        providers,
        appointments,
        evolutions: clinicalEvolutions,
        sessions,
        treatmentPlans,
        transactions: financialTransactions,
        labOrders,
      }),
    [
      activeReportType,
      fromDate,
      toDate,
      professionalFilter,
      activeCurrency,
      patients,
      providers,
      appointments,
      clinicalEvolutions,
      sessions,
      treatmentPlans,
      financialTransactions,
      labOrders,
    ]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reportData.rows;
    return reportData.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q))
    );
  }, [reportData.rows, searchQuery]);

  // Extra visual breakdown for Cash & Patient Payments
  const cashBreakdown = useMemo(() => {
    if (activeReportType !== 'caja' && activeReportType !== 'pago_de_pacientes') {
      return null;
    }
    const byMethod = new Map<PaymentMethod, number>();
    const byProfessional = new Map<string, number>();
    let totalAmount = 0;

    financialTransactions.forEach((tx) => {
      if (tx.deletedAt || tx.type !== 'payment') return;
      if (fromDate && tx.date < fromDate) return;
      if (toDate && tx.date > toDate) return;
      if (professionalFilter !== 'all' && tx.professionalId !== professionalFilter) return;

      totalAmount += tx.amount;
      byMethod.set(tx.paymentMethod, (byMethod.get(tx.paymentMethod) || 0) + tx.amount);
      const profKey = tx.professionalName || 'Sin profesional';
      byProfessional.set(profKey, (byProfessional.get(profKey) || 0) + tx.amount);
    });

    return {
      totalAmount,
      methodRows: Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]),
      profRows: Array.from(byProfessional.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [activeReportType, financialTransactions, fromDate, toDate, professionalFilter]);

  const activeProfName = useMemo(() => {
    if (professionalFilter === 'all') return 'Todos los profesionales';
    return (
      professionals.find((p) => p.id === professionalFilter)?.fullName || 'Profesional seleccionado'
    );
  }, [professionalFilter, professionals]);

  const currentOperatorName = useMemo(() => {
    return professionals.find((p) => p.id === activeProfessionalId)?.fullName || 'Odontólogo';
  }, [professionals, activeProfessionalId]);

  const handleExportCsv = () => {
    const escapeCell = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
    const csvLines = [
      reportData.columns.map(escapeCell).join(','),
      ...filteredRows.map((row) => row.map(escapeCell).join(',')),
    ];
    const csvContent = `\uFEFF${csvLines.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `odontohelper_${activeReportType}_${fromDate}_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Reporte "${reportData.definition.label}" exportado a CSV`, 'success');
  };

  const handleExportPdf = () => {
    window.print();
  };

  if (!allowed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto text-slate-400" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Acceso a reportes restringido
        </h1>
        <p className="text-xs text-slate-500">
          Cambiá de operador o habilitá permisos económicos en Configuración para acceder a reportes.
        </p>
      </div>
    );
  }

  const categoriesOrder: ReportDefinition['category'][] = [
    'finanzas',
    'pacientes',
    'agenda_clinica',
    'proveedores',
  ];

  const periodDescription = reportData.definition.usesDateRange
    ? datePreset === 'all'
      ? 'Todo el historial'
      : `${fromDate} al ${toDate}`
    : `Estado actual al ${toIsoDate(new Date())}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Formal Clinical PDF Print Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              OdontoHelper · Reporte de Gestión
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              {reportData.definition.label}
            </h1>
            <p className="text-xs text-slate-600 mt-1">{reportData.definition.description}</p>
          </div>
          <div className="text-right text-[11px] text-slate-600 space-y-0.5 tabular-nums">
            <div>
              <strong>Período:</strong> {periodDescription}
            </div>
            <div>
              <strong>Profesional:</strong> {activeProfName}
            </div>
            <div>
              <strong>Generado por:</strong> {currentOperatorName}
            </div>
            <div>
              <strong>Emisión:</strong> {new Date().toLocaleString('es-AR')}
            </div>
            <div>
              <strong>Registros:</strong> {filteredRows.length}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
            <span>{CATEGORY_LABELS[reportData.definition.category]}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{filteredRows.length} registros</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
            {reportData.definition.label}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {reportData.definition.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Seleccionar tipo de reporte"
            value={activeReportType}
            onChange={(e) => setReportType(e.target.value as ReportTypeId)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-w-[260px]"
          >
            {categoriesOrder.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                {REPORT_DEFINITIONS.filter((r) => r.category === cat).map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 disabled:opacity-45"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
              <CalendarRange className="w-3.5 h-3.5 text-teal-600" />
              Período:
            </span>
            {(
              [
                ['this_month', 'Este mes'],
                ['last_month', 'Mes pasado'],
                ['last_30', 'Últimos 30 días'],
                ['this_year', 'Este año'],
                ['all', 'Todo'],
              ] as const
            ).map(([presetId, label]) => (
              <button
                key={presetId}
                type="button"
                disabled={!reportData.definition.usesDateRange}
                onClick={() => applyPreset(presetId)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-45 ${
                  datePreset === presetId && reportData.definition.usesDateRange
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!reportData.definition.usesDateRange && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Este reporte muestra la foto actual de saldos/estados sin corte por fecha.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={fromDate}
              disabled={!reportData.definition.usesDateRange}
              onChange={(e) => {
                setDatePreset('custom');
                setFromDate(e.target.value);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-45"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={toDate}
              disabled={!reportData.definition.usesDateRange}
              onChange={(e) => {
                setDatePreset('custom');
                setToDate(e.target.value);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-45"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Profesional
            </label>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={professionalFilter}
                onChange={(e) => setProfessionalFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">Todos los profesionales</option>
                {professionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Filtrar en resultados
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Paciente, DNI, concepto, proveedor..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setProfessionalFilter('all');
                applyPreset('this_month');
                showToast(`Reporte actualizado (${reportData.rows.length} registros)`, 'info');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      </section>

      {/* KPI Summary Cards */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          reportData.kpis.length >= 4
            ? 'lg:grid-cols-4'
            : reportData.kpis.length === 3
            ? 'lg:grid-cols-3'
            : 'lg:grid-cols-2'
        } gap-3 print-break-inside-avoid`}
      >
        {reportData.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</div>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                KPI_TONE_CLASSES[kpi.tone || 'default']
              }`}
            >
              {kpi.value}
            </div>
            {kpi.sublabel && (
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                {kpi.sublabel}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Extra Breakdown Grid for Cash & Patient Payments */}
      {cashBreakdown && (cashBreakdown.methodRows.length > 0 || cashBreakdown.profRows.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ingresos ({activeCurrency}) por medio de pago
              </h2>
            </div>
            <div className="space-y-2.5">
              {cashBreakdown.methodRows.map(([method, amount]) => {
                const pct =
                  cashBreakdown.totalAmount > 0
                    ? Math.round((amount / cashBreakdown.totalAmount) * 100)
                    : 0;
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {PAYMENT_METHOD_LABELS[method] || method}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatMoney(amount, activeCurrency)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ingresos ({activeCurrency}) por profesional
              </h2>
            </div>
            <div className="space-y-2.5">
              {cashBreakdown.profRows.map(([profName, amount]) => {
                const pct =
                  cashBreakdown.totalAmount > 0
                    ? Math.round((amount / cashBreakdown.totalAmount) * 100)
                    : 0;
                return (
                  <div key={profName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {profName}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatMoney(amount, activeCurrency)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Full Preview Data Table */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Detalle del reporte: {reportData.definition.label}
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {filteredRows.length}{' '}
            {filteredRows.length === 1 ? 'fila' : 'filas'}
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            {searchQuery.trim()
              ? 'No hay registros que coincidan con el filtro de búsqueda.'
              : reportData.emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto print-overflow-visible">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                  {reportData.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRows.map((row, rIdx) => (
                  <tr
                    key={`${rIdx}-${row[0]}-${row[1] || ''}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {row.map((cell, cIdx) => {
                      const isNumericLike =
                        /^[-+]?\s*(\$|US\$|R\$|S\/|₡|₲|Bs|Q|B\/\.|RD\$|ARS|CLP|COP|MXN|PEN|PYG|BOB|CRC|DOP|GTQ|PAB|VES|\d{4}-\d{2}-\d{2}|\d{2}:\d{2})/.test(
                          cell
                        );
                      return (
                        <td
                          key={cIdx}
                          className={`px-4 py-2.5 text-slate-800 dark:text-slate-200 ${
                            isNumericLike ? 'font-mono tabular-nums whitespace-nowrap' : ''
                          } ${cIdx === row.length - 1 && isNumericLike ? 'font-semibold' : ''}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
