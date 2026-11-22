import React, { useMemo, useState } from 'react';
import {
  Plus,
  Printer,
  Trash2,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  COMMON_DENTAL_PROCEDURES,
  DEFAULT_CURRENCY,
  calculateTreatmentItemSubtotal,
  calculateTreatmentPlanTotals,
  compareTableValues,
  formatMoney,
  generateWhatsAppUrl,
  getCurrencyMeta,
} from '../core/clinic/clinicHelpers';
import {
  Patient,
  TreatmentItem,
  TreatmentPlan,
  TreatmentPlanStatus,
} from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { SortDirection, SortHeaderIcon } from './ui/DataTable';
import { FilterBar } from './ui/FilterBar';
import { Modal } from './ui/Modal';
import { Pagination } from './ui/Pagination';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import {
  BadgeTone,
  buttonClass,
  cardClass,
  emptyStateClass,
  inputClass,
  inputMonoClass,
  labelClass,
  pageContainerClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
  selectClass,
  tableBodyClass,
  tableCellClass,
  tableHeadClass,
  tableHeadRowClass,
  tableHeaderButtonClass,
  tableRowClass,
  tableThClass,
  tableWrapperClass,
} from './ui/uiClasses';

const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, { label: string; tone: BadgeTone }> = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  presentado: { label: 'Presentado', tone: 'blue' },
  aprobado: { label: 'Aprobado', tone: 'teal' },
  en_curso: { label: 'En curso', tone: 'amber' },
  finalizado: { label: 'Finalizado', tone: 'emerald' },
};

interface TreatmentPlanModalProps {
  initialPatientId?: string;
  onClose: () => void;
}

export const TreatmentPlanModal: React.FC<TreatmentPlanModalProps> = ({
  initialPatientId,
  onClose,
}) => {
  const {
    patients,
    professionals,
    activeProfessionalId,
    settings,
    createTreatmentPlan,
    showToast,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const [patientId, setPatientId] = useState(initialPatientId || patients[0]?.id || '');
  const [title, setTitle] = useState('Plan de tratamiento integral');
  const [status, setStatus] = useState<TreatmentPlanStatus>('presentado');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<TreatmentItem[]>([
    {
      id: `item_${Date.now()}_1`,
      procedure: COMMON_DENTAL_PROCEDURES[0].name,
      toothFdi: '',
      quantity: 1,
      unitPrice: COMMON_DENTAL_PROCEDURES[0].defaultPrice,
      discountPct: 0,
      completed: false,
    },
  ]);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        procedure: '',
        toothFdi: '',
        quantity: 1,
        unitPrice: 0,
        discountPct: 0,
        completed: false,
      },
    ]);
  };

  const updateItem = (id: string, patch: Partial<TreatmentItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const totalAmount = items.reduce((sum, it) => sum + calculateTreatmentItemSubtotal(it), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      showToast('Seleccioná un paciente para el presupuesto.', 'warning');
      return;
    }
    const validItems = items.filter((it) => it.procedure.trim());
    if (validItems.length === 0) {
      showToast('Agregá al menos una prestación al presupuesto.', 'warning');
      return;
    }
    const prof =
      professionals.find((p) => p.id === activeProfessionalId) || professionals[0];
    await createTreatmentPlan({
      patientId: patient.id,
      patientName: patient.fullName,
      title: title.trim() || 'Presupuesto odontológico',
      currency: activeCurrency,
      status,
      professionalId: prof?.id,
      professionalName: prof?.fullName,
      items: validItems,
      validUntil: validUntil || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="3xl"
      title="Nuevo presupuesto / Plan de tratamiento"
      subtitle="Cada prestación marcada como realizada se evoluciona e imputa automáticamente en Cuenta Corriente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="treatment-plan-form" variant="primary">
            Guardar presupuesto
          </Button>
        </>
      }
    >
      <form id="treatment-plan-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Paciente *</label>
            <select
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className={selectClass}
            >
              <option value="">Seleccionar paciente...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.dni ? `(DNI ${p.dni})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Moneda</label>
            <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono truncate">
              {showCurrencyCode
                ? `${currencyMeta.code} (${currencyMeta.symbol})`
                : `${currencyMeta.symbol} ${currencyMeta.name}`}
            </div>
          </div>

          <div>
            <label className={labelClass}>Estado inicial</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TreatmentPlanStatus)}
              className={selectClass}
            >
              <option value="borrador">Borrador</option>
              <option value="presentado">Presentado</option>
              <option value="aprobado">Aprobado</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass}>Título del presupuesto *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Rehabilitación sector anterior / Opción implantes"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Válido hasta</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputMonoClass}
            />
          </div>
        </div>

        {/* Items Builder */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Prestaciones incluidas ({items.length})
            </span>
            <Button
              variant="soft"
              size="xs"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={addItemRow}
            >
              Agregar ítem
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {items.map((item) => {
              const sub = calculateTreatmentItemSubtotal(item);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700"
                >
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <select
                      value=""
                      onChange={(e) => {
                        const preset = COMMON_DENTAL_PROCEDURES.find(
                          (p) => p.name === e.target.value
                        );
                        if (preset) {
                          updateItem(item.id, {
                            procedure: preset.name,
                            unitPrice: preset.defaultPrice,
                          });
                        }
                      }}
                      className="w-full px-2 py-1 text-[10px] rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer"
                    >
                      <option value="">-- Arancel rápido / Catálogo --</option>
                      {COMMON_DENTAL_PROCEDURES.map((proc) => (
                        <option key={proc.code} value={proc.name}>
                          {proc.code} · {proc.name} (
                          {formatMoney(proc.defaultPrice, activeCurrency, showCurrencyCode)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={item.procedure}
                      onChange={(e) => updateItem(item.id, { procedure: e.target.value })}
                      placeholder="Descripción del tratamiento"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400">Pieza</label>
                    <input
                      type="text"
                      value={item.toothFdi || ''}
                      onChange={(e) => updateItem(item.id, { toothFdi: e.target.value })}
                      placeholder="Ej: 1.6"
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-1">
                    <label className="block text-[10px] text-slate-400">Cant.</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400">Valor unit.</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-1">
                    <label className="block text-[10px] text-slate-400">Desc%</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountPct || 0}
                      onChange={(e) =>
                        updateItem(item.id, {
                          discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-1 flex items-center justify-end gap-1 pt-2 sm:pt-3">
                    <span className="sm:hidden text-[11px] font-mono tabular-nums font-semibold mr-auto">
                      Subtotal: {formatMoney(sub, activeCurrency, showCurrencyCode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Quitar prestación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="sm:col-span-7">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condiciones de pago, cuotas o notas del presupuesto..."
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-5 text-left sm:text-right font-mono tabular-nums">
            <div className="text-[11px] text-slate-500">Total presupuestado</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatMoney(totalAmount, activeCurrency, showCurrencyCode)}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

type PlanSortCol = 'procedure' | 'toothFdi' | 'quantity' | 'unitPrice' | 'subtotal';

interface PlanCardProps {
  plan: TreatmentPlan;
  patient?: Patient;
  onToggleItem: (planId: string, itemId: string) => void;
  onChangeStatus: (planId: string, status: TreatmentPlanStatus) => void;
  onDelete: (planId: string) => void;
}

export const TreatmentPlanCard: React.FC<PlanCardProps> = ({
  plan,
  patient,
  onToggleItem,
  onChangeStatus,
  onDelete,
}) => {
  const settings = useAppStore((s) => s.settings);
  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);
  const totals = calculateTreatmentPlanTotals(plan);
  const statusInfo = PLAN_STATUS_LABELS[plan.status];

  const [sortState, setSortState] = useState<{
    col: PlanSortCol;
    direction: SortDirection;
  } | null>(null);

  const sortedItems = useMemo(() => {
    if (!sortState) return plan.items;
    const copy = [...plan.items];
    copy.sort((a, b) => {
      const getVal = (it: TreatmentItem) => {
        if (sortState.col === 'subtotal') return calculateTreatmentItemSubtotal(it);
        return it[sortState.col] ?? '';
      };
      const cmp = compareTableValues(getVal(a), getVal(b));
      return sortState.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [plan.items, sortState]);

  const toggleSort = (col: PlanSortCol) => {
    setSortState((prev) => {
      if (!prev || prev.col !== col) return { col, direction: 'asc' };
      if (prev.direction === 'asc') return { col, direction: 'desc' };
      return null;
    });
  };

  const shareMessage =
    `Hola ${plan.patientName}, te compartimos el presupuesto "${plan.title}":\n` +
    plan.items
      .map(
        (it) =>
          `• ${it.procedure}${it.toothFdi ? ` (Pieza ${it.toothFdi})` : ''}: ${formatMoney(
            calculateTreatmentItemSubtotal(it),
            activeCurrency,
            showCurrencyCode
          )}`
      )
      .join('\n') +
    `\nTotal: ${formatMoney(totals.total, activeCurrency, showCurrencyCode)}`;

  const waUrl = generateWhatsAppUrl(patient?.phone, shareMessage);

  return (
    <div className={`${cardClass} p-4 sm:p-5 space-y-4 print-break-inside-avoid`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={statusInfo.tone} size="xs">
              {statusInfo.label}
            </Badge>
            <span className="font-mono tabular-nums text-slate-500">
              {new Date(plan.createdAt).toLocaleDateString('es-AR')}
            </span>
            {plan.professionalName && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500">{plan.professionalName}</span>
              </>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5">
            {plan.title}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Paciente: <strong className="text-slate-700 dark:text-slate-200">{plan.patientName}</strong>
            {plan.validUntil ? ` · Válido hasta ${plan.validUntil}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <select
            value={plan.status}
            onChange={(e) => onChangeStatus(plan.id, e.target.value as TreatmentPlanStatus)}
            aria-label="Cambiar estado del presupuesto"
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="borrador">Borrador</option>
            <option value="presentado">Presentado</option>
            <option value="aprobado">Aprobado</option>
            <option value="en_curso">En curso</option>
            <option value="finalizado">Finalizado</option>
          </select>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: 'whatsapp', size: 'xs' })}
              title="Enviar presupuesto por WhatsApp"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}

          <Button
            variant="subtle"
            size="xs"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
            title="Imprimir / Guardar PDF"
          >
            PDF
          </Button>

          <Button
            variant="icon"
            size="xs"
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            onClick={() => onDelete(plan.id)}
            title="Eliminar presupuesto"
            aria-label="Eliminar presupuesto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Items Table (Sortable + Crisp Dividers) */}
      <div className={tableWrapperClass}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs text-left border-collapse">
            <thead className={tableHeadClass}>
              <tr className={tableHeadRowClass}>
                <th className={`${tableThClass} w-12 text-center no-print`}>Hecho</th>
                <th className={tableThClass}>
                  <button
                    type="button"
                    onClick={() => toggleSort('procedure')}
                    className={`${tableHeaderButtonClass} justify-between`}
                  >
                    <span>Prestación</span>
                    <SortHeaderIcon
                      active={sortState?.col === 'procedure'}
                      direction={sortState?.col === 'procedure' ? sortState.direction : null}
                    />
                  </button>
                </th>
                <th className={tableThClass}>
                  <button
                    type="button"
                    onClick={() => toggleSort('toothFdi')}
                    className={`${tableHeaderButtonClass} justify-between`}
                  >
                    <span>Pieza</span>
                    <SortHeaderIcon
                      active={sortState?.col === 'toothFdi'}
                      direction={sortState?.col === 'toothFdi' ? sortState.direction : null}
                    />
                  </button>
                </th>
                <th className={`${tableThClass} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort('quantity')}
                    className={`${tableHeaderButtonClass} justify-end`}
                  >
                    <span>Cant.</span>
                    <SortHeaderIcon
                      active={sortState?.col === 'quantity'}
                      direction={sortState?.col === 'quantity' ? sortState.direction : null}
                    />
                  </button>
                </th>
                <th className={`${tableThClass} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort('unitPrice')}
                    className={`${tableHeaderButtonClass} justify-end`}
                  >
                    <span>Valor</span>
                    <SortHeaderIcon
                      active={sortState?.col === 'unitPrice'}
                      direction={sortState?.col === 'unitPrice' ? sortState.direction : null}
                    />
                  </button>
                </th>
                <th className={`${tableThClass} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort('subtotal')}
                    className={`${tableHeaderButtonClass} justify-end`}
                  >
                    <span>Subtotal</span>
                    <SortHeaderIcon
                      active={sortState?.col === 'subtotal'}
                      direction={sortState?.col === 'subtotal' ? sortState.direction : null}
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {sortedItems.map((item) => {
                const sub = calculateTreatmentItemSubtotal(item);
                return (
                  <tr key={item.id} className={tableRowClass}>
                    <td className={`${tableCellClass} text-center no-print`}>
                      <button
                        type="button"
                        onClick={() => onToggleItem(plan.id, item.id)}
                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                          item.completed
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-slate-300 dark:text-slate-600 hover:text-teal-600'
                        }`}
                        title={
                          item.completed
                            ? 'Realizado (clic para revertir)'
                            : 'Marcar como realizado (evoluciona y carga a Cuenta Corriente)'
                        }
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            item.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'font-medium text-slate-800 dark:text-slate-200'
                          }
                        >
                          {item.procedure}
                        </span>
                        {item.completed && (
                          <Badge tone="teal" size="xs">
                            Realizado
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={`${tableCellClass} font-mono tabular-nums text-slate-500`}>
                      {item.toothFdi || '—'}
                    </td>
                    <td className={`${tableCellClass} font-mono tabular-nums text-right text-slate-600 dark:text-slate-300`}>
                      {item.quantity}
                    </td>
                    <td className={`${tableCellClass} font-mono tabular-nums text-right text-slate-600 dark:text-slate-300 whitespace-nowrap`}>
                      {formatMoney(item.unitPrice, activeCurrency, showCurrencyCode)}
                    </td>
                    <td className={`${tableCellClass} font-mono tabular-nums text-right font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap`}>
                      {formatMoney(sub, activeCurrency, showCurrencyCode)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Totals */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Avance: <strong>{totals.completedCount}/{totals.totalCount}</strong> ({totals.progressPct}%)
          {plan.notes ? ` · ${plan.notes}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
          <span className="text-slate-500">
            Realizado:{' '}
            <strong className="text-teal-700 dark:text-teal-400">
              {formatMoney(totals.completedTotal, activeCurrency, showCurrencyCode)}
            </strong>
          </span>
          <span className="text-slate-900 dark:text-slate-100 text-sm font-bold">
            Total: {formatMoney(totals.total, activeCurrency, showCurrencyCode)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const PresupuestosView: React.FC = () => {
  const {
    treatmentPlans,
    patients,
    settings,
    toggleTreatmentItemCompleted,
    updateTreatmentPlan,
    deleteTreatmentPlan,
    openConfirm,
    setView,
    moduleQuery,
    setModuleQuery,
  } = useAppStore();

  const activeCurrencyMeta = getCurrencyMeta(settings?.currency || DEFAULT_CURRENCY);
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);

  const statusFilter: 'all' | TreatmentPlanStatus =
    moduleQuery.status && moduleQuery.status in PLAN_STATUS_LABELS
      ? (moduleQuery.status as TreatmentPlanStatus)
      : 'all';
  const [query, setQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentPage = moduleQuery.page || 1;
  const pageSize = moduleQuery.pageSize || 25;

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return treatmentPlans.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.patientName.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.items.some((i) => i.procedure.toLowerCase().includes(q))
      );
    });
  }, [treatmentPlans, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedPlans = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPlans.slice(start, start + pageSize);
  }, [filteredPlans, safePage, pageSize]);

  return (
    <div className={pageContainerClass}>
      <div className={`${pageHeaderClass} no-print`}>
        <div>
          <h1 className={pageTitleClass}>
            Presupuestos y planes de tratamiento
          </h1>
          <p className={pageSubtitleClass}>
            Armá presupuestos en {activeCurrencyMeta.name}
            {showCurrencyCode ? ` (${activeCurrencyMeta.code})` : ''}; al tildar cada prestación realizada se actualiza la Historia Clínica y la Cuenta Corriente.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          disabled={patients.length === 0}
          icon={<Plus className="w-4 h-4" />}
          className="w-full sm:w-auto justify-center"
          onClick={() => setShowCreateModal(true)}
        >
          Nuevo presupuesto
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={query}
        onSearchChange={(val) => {
          setQuery(val);
          if (moduleQuery.page) setModuleQuery({ page: undefined });
        }}
        searchPlaceholder="Buscar por paciente, plan o prestación..."
        dropdowns={[
          {
            id: 'plan-status',
            value: statusFilter,
            onChange: (val) =>
              setModuleQuery({ status: val === 'all' ? undefined : val, page: undefined }),
            ariaLabel: 'Filtrar por estado de presupuesto',
            className: 'sm:w-52',
            options: [
              { value: 'all', label: 'Todos los estados' },
              { value: 'borrador', label: 'Borradores' },
              { value: 'presentado', label: 'Presentados' },
              { value: 'aprobado', label: 'Aprobados' },
              { value: 'en_curso', label: 'En curso' },
              { value: 'finalizado', label: 'Finalizados' },
            ],
          },
        ]}
        resultCountLabel={`${filteredPlans.length} de ${treatmentPlans.length} presupuestos`}
        className="no-print"
      />

      {/* Plans List */}
      {patients.length === 0 ? (
        <div className={`${emptyStateClass} space-y-3`}>
          <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registrá un paciente primero
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Para generar un presupuesto odontológico necesitás al menos un paciente en la base.
          </p>
          <Button variant="primary" size="md" onClick={() => setView('patient-new')}>
            Crear primer paciente
          </Button>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className={`${emptyStateClass} space-y-3`}>
          <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500">No hay presupuestos que coincidan con el filtro.</p>
          <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
            Crear primer presupuesto
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedPlans.map((plan) => (
            <TreatmentPlanCard
              key={plan.id}
              plan={plan}
              patient={patients.find((p) => p.id === plan.patientId)}
              onToggleItem={(pId, itId) => toggleTreatmentItemCompleted(pId, itId)}
              onChangeStatus={(pId, st) => updateTreatmentPlan(pId, { status: st })}
              onDelete={(pId) =>
                openConfirm({
                  title: '¿Eliminar presupuesto?',
                  description: `Se eliminará "${plan.title}" (${plan.patientName}).`,
                  confirmText: 'Eliminar',
                  cancelText: 'Cancelar',
                  isDestructive: true,
                  onConfirm: () => deleteTreatmentPlan(pId),
                })
              }
            />
          ))}

          <Pagination
            currentPage={safePage}
            totalItems={filteredPlans.length}
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
            itemLabel="presupuestos"
          />
        </div>
      )}

      {showCreateModal && (
        <TreatmentPlanModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};
