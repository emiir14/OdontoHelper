import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileDown,
  Search,
  CalendarRange,
  RefreshCw,
} from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  compareTableValues,
  downloadCsvFile,
  formatCurrencyHeading,
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
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  SortDirection,
  SortHeaderIcon,
  parseSortState,
  serializeSortState,
} from './ui/DataTable';
import { Pagination } from './ui/Pagination';
import {
  BadgeTone,
  cardClass,
  dropdownClass,
  inputClass,
  kpiCardClass,
  labelCompactClass,
  pageContainerClass,
  pageSubtitleClass,
  pageTitleClass,
  tableBodyClass,
  tableCellClass,
  tableHeadClass,
  tableHeadRowClass,
  tableHeaderButtonClass,
  tableRowClass,
  tableThClass,
} from './ui/uiClasses';

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

const STATUS_BADGE_MAP: Record<string, BadgeTone> = {
  Ingreso: 'emerald',
  Egreso: 'rose',
  Vencida: 'rose',
  'Por vencer': 'amber',
  'Al día': 'emerald',
  Realizada: 'emerald',
  Completada: 'emerald',
  Asistió: 'emerald',
  Instalado: 'emerald',
  Finalizado: 'emerald',
  Confirmada: 'teal',
  Aprobado: 'teal',
  'En clínica': 'teal',
  'En curso': 'amber',
  'En laboratorio': 'amber',
  Programada: 'blue',
  Presentado: 'blue',
  Cancelada: 'rose',
  Ausente: 'rose',
  'Sin enviar': 'rose',
  Borrador: 'neutral',
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
    showToast,
    moduleQuery,
    setModuleQuery,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);

  const validPresets = new Set<DatePreset>([
    'this_month',
    'last_month',
    'last_30',
    'this_year',
    'all',
    'custom',
  ]);
  const datePreset: DatePreset =
    moduleQuery.period && validPresets.has(moduleQuery.period as DatePreset)
      ? (moduleQuery.period as DatePreset)
      : 'this_month';

  const presetDates = useMemo(
    () =>
      datePreset === 'custom'
        ? getPresetDates('this_month')
        : getPresetDates(datePreset),
    [datePreset]
  );

  const fromDate =
    datePreset === 'custom' ? moduleQuery.from || presetDates.from : presetDates.from;
  const toDate =
    datePreset === 'custom' ? moduleQuery.to || presetDates.to : presetDates.to;
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sortState = useMemo(() => {
    const parsed = parseSortState(moduleQuery.sort);
    if (!parsed || !parsed.columnId.startsWith('col_')) return null;
    const idx = Number(parsed.columnId.slice(4));
    if (!Number.isInteger(idx) || idx < 0) return null;
    return { colIndex: idx, direction: parsed.direction };
  }, [moduleQuery.sort]);

  const currentPage = moduleQuery.page || 1;
  const pageSize = moduleQuery.pageSize || 25;

  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    setModuleQuery({
      period: preset === 'this_month' ? undefined : preset,
      from: undefined,
      to: undefined,
      page: undefined,
    });
  };

  const reportData = useMemo(
    () =>
      buildReportData({
        reportId: activeReportType,
        fromDate,
        toDate,
        professionalFilter: 'all',
        currency: activeCurrency,
        showCurrencyCode,
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
      activeCurrency,
      showCurrencyCode,
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
    const base = !q
      ? reportData.rows
      : reportData.rows.filter((row) =>
          row.some((cell) => cell.toLowerCase().includes(q))
        );

    if (!sortState) return base;
    const { colIndex, direction } = sortState;
    const copy = [...base];
    copy.sort((a, b) => {
      const cmp = compareTableValues(a[colIndex], b[colIndex]);
      return direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [reportData.rows, searchQuery, sortState]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const handleSortCol = (colIndex: number) => {
    const nextDirection: SortDirection | null =
      !sortState || sortState.colIndex !== colIndex
        ? 'asc'
        : sortState.direction === 'asc'
        ? 'desc'
        : null;
    const serialized = nextDirection
      ? serializeSortState({ columnId: `col_${colIndex}`, direction: nextDirection })
      : null;
    setModuleQuery({ sort: serialized || undefined, page: undefined });
  };

  // Extra visual breakdown for Cash & Patient Payments
  const cashBreakdown = useMemo(() => {
    if (activeReportType !== 'caja' && activeReportType !== 'pago_de_pacientes') {
      return null;
    }
    const byMethod = new Map<PaymentMethod, number>();
    let totalAmount = 0;

    financialTransactions.forEach((tx) => {
      if (tx.deletedAt || tx.type !== 'payment') return;
      if (fromDate && tx.date < fromDate) return;
      if (toDate && tx.date > toDate) return;

      totalAmount += tx.amount;
      byMethod.set(tx.paymentMethod, (byMethod.get(tx.paymentMethod) || 0) + tx.amount);
    });

    return {
      totalAmount,
      methodRows: Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [activeReportType, financialTransactions, fromDate, toDate]);

  const currentOperatorName = useMemo(() => {
    return (
      professionals.find((p) => p.id === activeProfessionalId)?.fullName ||
      professionals[0]?.fullName ||
      'Odontólogo'
    );
  }, [professionals, activeProfessionalId]);

  const handleExportCsv = () => {
    downloadCsvFile(
      `odontohelper_${activeReportType}_${fromDate}_${toDate}.csv`,
      reportData.columns,
      filteredRows,
      true
    );
    showToast(`Reporte "${reportData.definition.label}" exportado a CSV`, 'success');
  };

  const handleExportPdf = () => {
    window.print();
  };

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

  const tipoColIdx = reportData.columns.findIndex((c) => c.toLowerCase() === 'tipo');

  return (
    <div className={pageContainerClass}>
      {/* Formal Clinical PDF Print Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Reporte de Gestión
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
              <strong>Profesional:</strong> {currentOperatorName}
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
          <h1 className={`${pageTitleClass} mt-0.5`}>
            {reportData.definition.label}
          </h1>
          <p className={pageSubtitleClass}>
            {reportData.definition.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full lg:w-auto shrink-0">
          <select
            aria-label="Seleccionar tipo de reporte"
            value={activeReportType}
            onChange={(e) => setReportType(e.target.value as ReportTypeId)}
            className={`${dropdownClass} w-full sm:w-auto sm:max-w-[260px]`}
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

          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
          >
            Exportar CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FileDown className="w-3.5 h-3.5" />}
            onClick={handleExportPdf}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <section className={`${cardClass} p-4 space-y-3 no-print`}>
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
          {/* Search FIRST on left for quick filtering */}
          <div className="lg:col-span-6">
            <label className={labelCompactClass}>
              Filtrar en resultados
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (moduleQuery.page) setModuleQuery({ page: undefined });
                }}
                placeholder="Paciente, CI, concepto, proveedor..."
                className={`${inputClass} pl-8 bg-white dark:bg-slate-900`}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className={labelCompactClass}>Desde</label>
            <input
              type="date"
              value={fromDate}
              disabled={!reportData.definition.usesDateRange}
              onChange={(e) => {
                setModuleQuery({
                  period: 'custom',
                  from: e.target.value || undefined,
                  to: toDate || undefined,
                  page: undefined,
                });
              }}
              className={`${inputClass} tabular-nums bg-white dark:bg-slate-900 disabled:opacity-45`}
            />
          </div>

          <div className="lg:col-span-2">
            <label className={labelCompactClass}>Hasta</label>
            <input
              type="date"
              value={toDate}
              disabled={!reportData.definition.usesDateRange}
              onChange={(e) => {
                setModuleQuery({
                  period: 'custom',
                  from: fromDate || undefined,
                  to: e.target.value || undefined,
                  page: undefined,
                });
              }}
              className={`${inputClass} tabular-nums bg-white dark:bg-slate-900 disabled:opacity-45`}
            />
          </div>

          <div className="lg:col-span-2 flex items-end">
            <Button
              variant="subtle"
              size="sm"
              fullWidth
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => {
                setSearchQuery('');
                setModuleQuery({
                  period: undefined,
                  from: undefined,
                  to: undefined,
                  prof: undefined,
                  sort: undefined,
                  page: undefined,
                });
                showToast(`Reporte actualizado (${reportData.rows.length} registros)`, 'info');
              }}
            >
              Restablecer
            </Button>
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
          <div key={kpi.label} className={kpiCardClass}>
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
      {cashBreakdown && cashBreakdown.methodRows.length > 0 && (
        <section className={`${cardClass} p-4 sm:p-5 space-y-3 print-break-inside-avoid`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {formatCurrencyHeading('Ingresos por medio de pago', activeCurrency, showCurrencyCode)}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
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
                      {formatMoney(amount, activeCurrency, showCurrencyCode)} ({pct}%)
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
      )}

      {/* Full Preview Data Table with Sortable Columns & Crisp Dividers */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
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
          <div className="overflow-x-auto scrollbar-thin print-overflow-visible">
            <table className="w-full text-left border-collapse text-xs">
              <thead className={tableHeadClass}>
                <tr className={tableHeadRowClass}>
                  {reportData.columns.map((col, colIdx) => {
                    const isSorted = sortState?.colIndex === colIdx;
                    return (
                      <th key={col} className={tableThClass}>
                        <button
                          type="button"
                          onClick={() => handleSortCol(colIdx)}
                          title={`Ordenar por ${col}`}
                          className={`${tableHeaderButtonClass} justify-between`}
                        >
                          <span>{col}</span>
                          <SortHeaderIcon
                            active={isSorted}
                            direction={isSorted ? sortState!.direction : null}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {pagedRows.map((row, rIdx) => {
                  const rowTipo = tipoColIdx >= 0 ? row[tipoColIdx] : '';
                  return (
                    <tr key={`${(safePage - 1) * pageSize + rIdx}-${row[0]}-${row[1] || ''}`} className={tableRowClass}>
                      {row.map((cell, cIdx) => {
                        const isNumericLike =
                          /^[-+]?\s*(\$|R\$|S\/|₡|₲|Bs|Q|B\/\.|UYU|USD|ARS|BRL|CLP|COP|MXN|PEN|PYG|BOB|CRC|DOP|GTQ|PAB|VES|\d{4}-\d{2}-\d{2}|\d{2}:\d{2})/.test(
                            cell
                          );
                        const colHeader = (reportData.columns[cIdx] || '').toLowerCase();
                        const badgeTone = STATUS_BADGE_MAP[cell];
                        const isStatusOrTypeCol =
                          colHeader === 'tipo' ||
                          colHeader === 'estado' ||
                          colHeader === 'ficha';

                        const isNegativeCell = cell.trim().startsWith('-');
                        const isMontoCol =
                          colHeader.includes('monto') ||
                          colHeader.includes('saldo') ||
                          colHeader.includes('importe') ||
                          colHeader.includes('total') ||
                          colHeader.includes('costo');

                        let amountToneClass = 'text-slate-800 dark:text-slate-200';
                        if (isNegativeCell || (isMontoCol && rowTipo === 'Egreso')) {
                          amountToneClass = 'text-rose-700 dark:text-rose-400 font-semibold';
                        } else if (isMontoCol && rowTipo === 'Ingreso') {
                          amountToneClass = 'text-emerald-700 dark:text-emerald-400 font-semibold';
                        }

                        return (
                          <td
                            key={cIdx}
                            className={`${tableCellClass} ${amountToneClass} ${
                              isNumericLike ? 'font-mono tabular-nums whitespace-nowrap' : ''
                            } ${cIdx === row.length - 1 && isNumericLike ? 'font-semibold' : ''}`}
                          >
                            {isStatusOrTypeCol && badgeTone ? (
                              <Badge tone={badgeTone} size="xs">
                                {cell}
                              </Badge>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {filteredRows.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={filteredRows.length}
          pageSize={pageSize}
          onPageChange={(nextPage) =>
            setModuleQuery({ page: nextPage <= 1 ? undefined : nextPage })
          }
          onPageSizeChange={(nextSize) =>
            setModuleQuery({
              pageSize: nextSize === 25 ? undefined : nextSize,
              page: undefined,
            })
          }
          pageSizeOptions={[25, 50, 100, 250]}
          itemLabel="filas"
        />
      )}
    </div>
  );
};
