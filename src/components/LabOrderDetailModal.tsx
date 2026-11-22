import React from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  FlaskConical,
  Pencil,
  Phone,
  User,
} from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  formatBirthDateDisplay,
  formatMoney,
  toLocalIsoDate,
} from '../core/clinic/clinicHelpers';
import { LabOrder, LabOrderStatus } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

const LAB_STATUS_BADGE: Record<
  LabOrderStatus,
  { label: string; className: string }
> = {
  sin_enviar: {
    label: 'Sin enviar',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
  },
  en_laboratorio: {
    label: 'En laboratorio',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  },
  en_clinica: {
    label: 'En clínica (listo)',
    className:
      'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60',
  },
  instalado: {
    label: 'Instalado',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  },
};

interface LabOrderDetailModalProps {
  order: LabOrder;
  onClose: () => void;
  onEdit: (order: LabOrder) => void;
  onOpenPatient?: (patientId: string) => void;
}

export const LabOrderDetailModal: React.FC<LabOrderDetailModalProps> = ({
  order,
  onClose,
  onEdit,
  onOpenPatient,
}) => {
  const { providers, settings, updateLabOrderStatus } = useAppStore();
  const activeCurrency = order.currency || settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);

  const provider = order.providerId
    ? providers.find((p) => p.id === order.providerId)
    : undefined;

  const todayIso = toLocalIsoDate();
  const isDelayed =
    Boolean(order.dueDate) &&
    (order.status === 'sin_enviar' || order.status === 'en_laboratorio') &&
    (order.dueDate || '') < todayIso;

  const statusMeta = LAB_STATUS_BADGE[order.status];

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title={order.workType}
      subtitle={`Orden de laboratorio · Paciente: ${order.patientName}`}
      headerActions={
        <span
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            icon={<Pencil className="w-3.5 h-3.5" />}
            onClick={() => onEdit(order)}
          >
            Editar orden
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Status switcher for quick state updates */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Estado actual del trabajo
          </div>
          <select
            value={order.status}
            onChange={(e) => updateLabOrderStatus(order.id, e.target.value as LabOrderStatus)}
            aria-label={`Cambiar estado de ${order.workType}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value="sin_enviar">Sin enviar</option>
            <option value="en_laboratorio">En laboratorio</option>
            <option value="en_clinica">En clínica (listo)</option>
            <option value="instalado">Instalado</option>
          </select>
        </div>

        {/* Core Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Patient */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>Paciente</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {order.patientName}
            </div>
            {order.patientId && onOpenPatient && (
              <button
                type="button"
                onClick={() => onOpenPatient(order.patientId!)}
                className="text-xs font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
              >
                Abrir ficha del paciente →
              </button>
            )}
          </div>

          {/* Lab Provider */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
              <span>Laboratorio asignado</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {provider?.name || order.providerName || 'Sin asignar'}
            </div>
            {(provider?.contactName || provider?.phone) && (
              <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                {provider.contactName && <span>Contacto: {provider.contactName}</span>}
                {provider.phone && (
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <Phone className="w-3 h-3" />
                    {provider.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Technical Specs & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400">Pieza FDI</div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {order.toothFdi || 'General'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Color (Vita)</div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {order.shade || '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Costo registrado</div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {order.cost != null ? formatMoney(order.cost, activeCurrency, showCurrencyCode) : '—'}
            </div>
          </div>
        </div>

        {/* Tracking Dates */}
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>Fechas de seguimiento</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-slate-400">Fecha de envío</div>
              <div className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                {order.sentDate ? formatBirthDateDisplay(order.sentDate) : '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Entrega estimada</div>
              <div
                className={`font-mono tabular-nums font-semibold mt-0.5 inline-flex items-center gap-1 ${
                  isDelayed
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                {isDelayed && <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{order.dueDate ? formatBirthDateDisplay(order.dueDate) : '—'}</span>
                {isDelayed && <span className="text-[10px] font-sans">(Atrasado)</span>}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Fecha de recepción</div>
              <div className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                {order.receivedDate ? formatBirthDateDisplay(order.receivedDate) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Lab Instructions / Notes */}
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-teal-600" />
            <span>Indicaciones para el laboratorio</span>
          </div>
          {order.notes ? (
            <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
              {order.notes}
            </p>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin indicaciones adicionales registradas.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
