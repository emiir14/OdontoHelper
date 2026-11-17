import React, { useMemo, useState } from 'react';
import {
  Plus,
  Printer,
  Trash2,
  CheckCircle2,
  Circle,
  MessageCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  COMMON_DENTAL_PROCEDURES,
  DEFAULT_CURRENCY,
  calculateTreatmentItemSubtotal,
  calculateTreatmentPlanTotals,
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

const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, { label: string; textClass: string }> = {
  borrador: { label: 'Borrador', textClass: 'text-slate-500 dark:text-slate-400' },
  presentado: { label: 'Presentado', textClass: 'text-blue-700 dark:text-blue-400' },
  aprobado: { label: 'Aprobado', textClass: 'text-teal-700 dark:text-teal-400' },
  en_curso: { label: 'En curso', textClass: 'text-amber-700 dark:text-amber-400' },
  finalizado: { label: 'Finalizado', textClass: 'text-emerald-700 dark:text-emerald-400' },
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
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const [patientId, setPatientId] = useState(initialPatientId || patients[0]?.id || '');
  const [title, setTitle] = useState('Plan de tratamiento integral');
  const [status, setStatus] = useState<TreatmentPlanStatus>('presentado');
  const [professionalId, setProfessionalId] = useState(
    activeProfessionalId || professionals[0]?.id || ''
  );
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
    const prof = professionals.find((p) => p.id === professionalId);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Nuevo presupuesto / Plan de tratamiento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cada prestación marcada como realizada se evoluciona e imputa automáticamente en Cuenta Corriente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Paciente *
              </label>
              <select
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Moneda
              </label>
              <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono">
                {currencyMeta.code} ({currencyMeta.symbol})
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Estado inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TreatmentPlanStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="borrador">Borrador</option>
                <option value="presentado">Presentado</option>
                <option value="aprobado">Aprobado</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Título del presupuesto *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Rehabilitación sector anterior / Opción implantes"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Profesional
              </label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {professionals.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Válido hasta
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </div>
          </div>

          {/* Items Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Prestaciones incluidas ({items.length})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar ítem</span>
              </button>
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
                        className="w-full px-2 py-1 text-[10px] rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
                      >
                        <option value="">-- Arancel rápido / Catálogo --</option>
                        {COMMON_DENTAL_PROCEDURES.map((proc) => (
                          <option key={proc.code} value={proc.name}>
                            {proc.code} · {proc.name} ({formatMoney(proc.defaultPrice, activeCurrency)})
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

                    <div className="col-span-3 sm:col-span-2">
                      <label className="block text-[10px] text-slate-400">Pieza</label>
                      <input
                        type="text"
                        value={item.toothFdi || ''}
                        onChange={(e) => updateItem(item.id, { toothFdi: e.target.value })}
                        placeholder="Ej: 1.6"
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-1">
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

                    <div className="col-span-4 sm:col-span-2">
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

                    <div className="col-span-2 sm:col-span-1">
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
                        Subtotal: {formatMoney(sub, activeCurrency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
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
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-5 text-right font-mono tabular-nums">
              <div className="text-[11px] text-slate-500">Total presupuestado</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatMoney(totalAmount, activeCurrency)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              Guardar presupuesto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
  const totals = calculateTreatmentPlanTotals(plan);
  const statusInfo = PLAN_STATUS_LABELS[plan.status];

  const shareMessage = `Hola ${plan.patientName}, te compartimos el presupuesto "${plan.title}" de OdontoHelper:\n` +
    plan.items
      .map(
        (it) =>
          `• ${it.procedure}${it.toothFdi ? ` (Pieza ${it.toothFdi})` : ''}: ${formatMoney(
            calculateTreatmentItemSubtotal(it),
            activeCurrency
          )}`
      )
      .join('\n') +
    `\nTotal: ${formatMoney(totals.total, activeCurrency)}`;

  const waUrl = generateWhatsAppUrl(patient?.phone, shareMessage);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4 print-break-inside-avoid">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`font-semibold ${statusInfo.textClass}`}>{statusInfo.label}</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
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
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100"
              title="Enviar presupuesto por WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
            title="Imprimir / Guardar PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(plan.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
            title="Eliminar presupuesto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="py-1.5 pr-2 font-medium w-8 no-print">Hecho</th>
              <th className="py-1.5 pr-3 font-medium">Prestación</th>
              <th className="py-1.5 pr-3 font-medium">Pieza</th>
              <th className="py-1.5 pr-3 font-medium text-right">Cant.</th>
              <th className="py-1.5 pr-3 font-medium text-right">Valor</th>
              <th className="py-1.5 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {plan.items.map((item) => {
              const sub = calculateTreatmentItemSubtotal(item);
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2 pr-2 no-print">
                    <button
                      type="button"
                      onClick={() => onToggleItem(plan.id, item.id)}
                      className={`p-0.5 rounded transition-colors ${
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
                  <td className="py-2 pr-3">
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
                      <span className="ml-2 text-[10px] font-medium text-teal-700 dark:text-teal-400">
                        · Realizado
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-500">
                    {item.toothFdi || '—'}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-600 dark:text-slate-300">
                    {item.quantity}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-600 dark:text-slate-300">
                    {formatMoney(item.unitPrice, activeCurrency)}
                  </td>
                  <td className="py-2 font-mono tabular-nums text-right font-semibold text-slate-900 dark:text-slate-100">
                    {formatMoney(sub, activeCurrency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Totals */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Avance: <strong>{totals.completedCount}/{totals.totalCount}</strong> ({totals.progressPct}%)
          {plan.notes ? ` · ${plan.notes}` : ''}
        </div>
        <div className="flex items-center gap-4 font-mono tabular-nums">
          <span className="text-slate-500">
            Realizado: <strong className="text-teal-700 dark:text-teal-400">{formatMoney(totals.completedTotal, activeCurrency)}</strong>
          </span>
          <span className="text-slate-900 dark:text-slate-100 text-sm font-bold">
            Total: {formatMoney(totals.total, activeCurrency)}
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
  } = useAppStore();

  const activeCurrencyMeta = getCurrencyMeta(settings?.currency || DEFAULT_CURRENCY);

  const [statusFilter, setStatusFilter] = useState<'all' | TreatmentPlanStatus>('all');
  const [query, setQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Presupuestos y planes de tratamiento
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Armá presupuestos en {activeCurrencyMeta.name} ({activeCurrencyMeta.code}); al tildar cada prestación realizada se actualiza la Historia Clínica y la Cuenta Corriente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={patients.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs min-h-[40px] self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo presupuesto</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por paciente, plan o prestación..."
          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | TreatmentPlanStatus)}
          className="px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        >
          <option value="all">Todos los estados</option>
          <option value="borrador">Borradores</option>
          <option value="presentado">Presentados</option>
          <option value="aprobado">Aprobados</option>
          <option value="en_curso">En curso</option>
          <option value="finalizado">Finalizados</option>
        </select>
      </div>

      {/* Plans List */}
      {patients.length === 0 ? (
        <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registrá un paciente primero
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Para generar un presupuesto odontológico necesitás al menos un paciente en la base.
          </p>
          <button
            type="button"
            onClick={() => setView('patient-new')}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
          >
            Crear primer paciente
          </button>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500">No hay presupuestos que coincidan con el filtro.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
          >
            Crear primer presupuesto
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map((plan) => (
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
        </div>
      )}

      {showCreateModal && (
        <TreatmentPlanModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};
