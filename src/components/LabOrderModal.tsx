import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CURRENCY, getCurrencyMeta, toLocalIsoDate } from '../core/clinic/clinicHelpers';
import { LabOrder, LabOrderStatus } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { inputClass, inputMonoClass, labelClass, selectClass } from './ui/uiClasses';

interface LabOrderModalProps {
  order?: LabOrder | null;
  lockedPatient?: { id: string; fullName: string };
  onClose: () => void;
}

export const LabOrderModal: React.FC<LabOrderModalProps> = ({
  order,
  lockedPatient,
  onClose,
}) => {
  const {
    patients,
    providers,
    settings,
    createLabOrder,
    updateLabOrder,
    showToast,
  } = useAppStore();

  const isEditing = Boolean(order);
  const activeCurrency = order?.currency || settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const { labProvidersOnly, otherProviders } = useMemo(() => {
    const labs = providers.filter((p) => p.category === 'laboratorio');
    const others = providers.filter((p) => p.category !== 'laboratorio');
    return { labProvidersOnly: labs, otherProviders: others };
  }, [providers]);

  const [patientId, setPatientId] = useState(order?.patientId || lockedPatient?.id || '');
  const [patientNameInput, setPatientNameInput] = useState(
    order?.patientName || lockedPatient?.fullName || ''
  );
  const [providerId, setProviderId] = useState(order?.providerId || '');
  const [workType, setWorkType] = useState(order?.workType || '');
  const [toothFdi, setToothFdi] = useState(order?.toothFdi || '');
  const [shade, setShade] = useState(order?.shade || '');
  const [sentDate, setSentDate] = useState(order?.sentDate || '');
  const [dueDate, setDueDate] = useState(order?.dueDate || '');
  const [receivedDate, setReceivedDate] = useState(order?.receivedDate || '');
  const [cost, setCost] = useState(order?.cost != null ? String(order.cost) : '');
  const [status, setStatus] = useState<LabOrderStatus>(order?.status || 'sin_enviar');
  const [notes, setNotes] = useState(order?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPatientId(order?.patientId || lockedPatient?.id || '');
    setPatientNameInput(order?.patientName || lockedPatient?.fullName || '');
    setProviderId(order?.providerId || '');
    setWorkType(order?.workType || '');
    setToothFdi(order?.toothFdi || '');
    setShade(order?.shade || '');
    setSentDate(order?.sentDate || '');
    setDueDate(order?.dueDate || '');
    setReceivedDate(order?.receivedDate || '');
    setCost(order?.cost != null ? String(order.cost) : '');
    setStatus(order?.status || 'sin_enviar');
    setNotes(order?.notes || '');
  }, [order, lockedPatient]);

  const handleStatusChange = (nextStatus: LabOrderStatus) => {
    setStatus(nextStatus);
    const todayStr = toLocalIsoDate();
    if (nextStatus === 'en_laboratorio' && !sentDate) {
      setSentDate(todayStr);
    }
    if ((nextStatus === 'en_clinica' || nextStatus === 'instalado') && !receivedDate) {
      setReceivedDate(todayStr);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = lockedPatient
      ? patients.find((p) => p.id === lockedPatient.id) || {
          id: lockedPatient.id,
          fullName: lockedPatient.fullName,
        }
      : patients.find((p) => p.id === patientId);

    const resolvedPatientName = (pat?.fullName || patientNameInput).trim();
    if (!resolvedPatientName || !workType.trim()) {
      showToast('Completá el paciente y el tipo de trabajo protésico.', 'warning');
      return;
    }

    const prov = providers.find((p) => p.id === providerId);
    const resolvedProviderName = prov?.name || (order && providerId === order.providerId ? order.providerName : undefined);
    const parsedCost = cost.trim() !== '' ? Number(cost) : undefined;
    if (parsedCost !== undefined && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      showToast('Ingresá un costo válido mayor o igual a 0.', 'warning');
      return;
    }

    const payload = {
      patientId: pat?.id || undefined,
      patientName: resolvedPatientName,
      providerId: prov?.id || (providerId ? providerId : undefined),
      providerName: resolvedProviderName || undefined,
      workType: workType.trim(),
      toothFdi: toothFdi.trim() || undefined,
      shade: shade.trim() || undefined,
      sentDate: sentDate || undefined,
      dueDate: dueDate || undefined,
      receivedDate: receivedDate || undefined,
      cost: parsedCost,
      currency: activeCurrency,
      status,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (order) {
        await updateLabOrder(order.id, payload);
      } else {
        await createLabOrder(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title={isEditing ? 'Editar trabajo de laboratorio' : 'Nueva orden de laboratorio'}
      subtitle={
        isEditing
          ? 'Actualizá indicaciones, fechas de seguimiento, costo registrado o estado del trabajo.'
          : 'Registrá un envío protésico, indicaciones técnicas y fecha estimada de entrega.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="lab-order-form" variant="primary" disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar orden'}
          </Button>
        </>
      }
    >
      <form id="lab-order-form" onSubmit={handleSubmit} className="space-y-3.5">
        {!lockedPatient && patients.length > 0 && (
          <div>
            <label className={labelClass}>Paciente registrado</label>
            <select
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                const pat = patients.find((p) => p.id === e.target.value);
                if (pat) setPatientNameInput(pat.fullName);
              }}
              className={selectClass}
            >
              <option value="">-- Seleccionar o escribir manualmente --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Paciente *</label>
          <input
            type="text"
            required
            disabled={Boolean(lockedPatient)}
            value={patientNameInput}
            onChange={(e) => {
              setPatientNameInput(e.target.value);
              if (patientId) setPatientId('');
            }}
            placeholder="Ej: Lucas Pereyra"
            className={`${inputClass} ${lockedPatient ? 'opacity-75 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Trabajo protésico *</label>
            <input
              type="text"
              required
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              placeholder="Ej: Corona zirconio / Placa"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Laboratorio</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className={selectClass}
            >
              <option value="">Sin especificar</option>
              {labProvidersOnly.length > 0 && (
                <optgroup label="Laboratorios dentales">
                  {labProvidersOnly.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherProviders.length > 0 && (
                <optgroup
                  label={
                    labProvidersOnly.length > 0
                      ? 'Otros proveedores registrados'
                      : 'Proveedores registrados'
                  }
                >
                  {otherProviders.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Pieza FDI</label>
            <input
              type="text"
              value={toothFdi}
              onChange={(e) => setToothFdi(e.target.value)}
              placeholder="2.1"
              className={inputMonoClass}
            />
          </div>
          <div>
            <label className={labelClass}>Color (Vita)</label>
            <input
              type="text"
              value={shade}
              onChange={(e) => setShade(e.target.value)}
              placeholder="A2 / B1"
              className={inputMonoClass}
            />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as LabOrderStatus)}
              className={selectClass}
            >
              <option value="sin_enviar">Sin enviar</option>
              <option value="en_laboratorio">En laboratorio</option>
              <option value="en_clinica">En clínica (listo)</option>
              <option value="instalado">Instalado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Fecha de envío</label>
            <input
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
              className={inputMonoClass}
            />
          </div>
          <div>
            <label className={labelClass}>Entrega estimada</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputMonoClass}
            />
          </div>
          <div>
            <label className={labelClass}>Fecha de recepción</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className={inputMonoClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Costo del laboratorio (registro)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
              className={inputMonoClass}
            />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-200 truncate">
              {showCurrencyCode
                ? `${currencyMeta.code} (${currencyMeta.symbol})`
                : `${currencyMeta.symbol} ${currencyMeta.name}`}
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Indicaciones para el laboratorio</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Terminación subgingival, mapa de color cervical A3 / incisal A2, prueba de bizcocho previa..."
            className={`${inputClass} resize-y`}
          />
        </div>
      </form>
    </Modal>
  );
};
