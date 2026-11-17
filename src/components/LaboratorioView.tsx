import React, { useMemo, useState } from 'react';
import { FlaskConical, Plus, Trash2, X, AlertTriangle } from 'lucide-react';
import { DEFAULT_CURRENCY, formatMoney, getCurrencyMeta } from '../core/clinic/clinicHelpers';
import { LabOrderStatus } from '../core/types';
import { useAppStore } from '../store/useAppStore';

const LAB_STATUS_META: Record<LabOrderStatus, { label: string; textClass: string }> = {
  sin_enviar: { label: 'Sin enviar', textClass: 'text-rose-700 dark:text-rose-400' },
  en_laboratorio: { label: 'En laboratorio', textClass: 'text-amber-700 dark:text-amber-400' },
  en_clinica: { label: 'En clínica (listo)', textClass: 'text-teal-700 dark:text-teal-400' },
  instalado: { label: 'Instalado', textClass: 'text-emerald-700 dark:text-emerald-400' },
};

export const LaboratorioView: React.FC = () => {
  const {
    labOrders,
    patients,
    providers,
    settings,
    createLabOrder,
    updateLabOrderStatus,
    deleteLabOrder,
    openConfirm,
    showToast,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const labProviders = useMemo(
    () => providers.filter((p) => p.category === 'laboratorio' || providers.length > 0),
    [providers]
  );

  const [statusFilter, setStatusFilter] = useState<'all' | LabOrderStatus>('all');
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [patientId, setPatientId] = useState('');
  const [patientNameInput, setPatientNameInput] = useState('');
  const [providerId, setProviderId] = useState('');
  const [workType, setWorkType] = useState('');
  const [toothFdi, setToothFdi] = useState('');
  const [shade, setShade] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cost, setCost] = useState('');
  const [status, setStatus] = useState<LabOrderStatus>('sin_enviar');
  const [notes, setNotes] = useState('');

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.patientName.toLowerCase().includes(q) ||
        o.workType.toLowerCase().includes(q) ||
        (o.providerName || '').toLowerCase().includes(q) ||
        (o.toothFdi || '').toLowerCase().includes(q)
      );
    });
  }, [labOrders, statusFilter, query]);

  const counts = useMemo(() => {
    return {
      pending: labOrders.filter((o) => o.status === 'sin_enviar' || o.status === 'en_laboratorio').length,
      ready: labOrders.filter((o) => o.status === 'en_clinica').length,
      installed: labOrders.filter((o) => o.status === 'instalado').length,
    };
  }, [labOrders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === patientId);
    const resolvedPatientName = pat?.fullName || patientNameInput.trim();
    if (!resolvedPatientName || !workType.trim()) {
      showToast('Completá el paciente y el tipo de trabajo protésico.', 'warning');
      return;
    }
    const prov = providers.find((p) => p.id === providerId);
    await createLabOrder({
      patientId: pat?.id,
      patientName: resolvedPatientName,
      providerId: prov?.id,
      providerName: prov?.name,
      workType: workType.trim(),
      toothFdi: toothFdi.trim() || undefined,
      shade: shade.trim() || undefined,
      dueDate: dueDate || undefined,
      sentDate: status === 'en_laboratorio' ? new Date().toISOString().slice(0, 10) : undefined,
      cost: cost ? Number(cost) : undefined,
      currency: activeCurrency,
      status,
      notes: notes.trim() || undefined,
    });
    setShowModal(false);
    setWorkType('');
    setToothFdi('');
    setShade('');
    setCost('');
    setNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Laboratorio dental y prótesis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controlá envíos, fechas de entrega y estados. La Agenda muestra alertas automáticas si el trabajo aún no llegó a clínica.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva orden de laboratorio</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pendientes de recepción</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {counts.pending}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Listos en clínica</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-1">
            {counts.ready}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Instalados en boca</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {counts.installed}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por paciente, laboratorio, trabajo o pieza..."
          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | LabOrderStatus)}
          className="px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        >
          <option value="all">Todos los estados</option>
          <option value="sin_enviar">Sin enviar</option>
          <option value="en_laboratorio">En laboratorio</option>
          <option value="en_clinica">En clínica</option>
          <option value="instalado">Instalado</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <FlaskConical className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500">
            No hay trabajos de laboratorio registrados con los filtros actuales.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Paciente</th>
                <th className="px-4 py-3 font-semibold">Trabajo / Pieza / Color</th>
                <th className="px-4 py-3 font-semibold">Laboratorio</th>
                <th className="px-4 py-3 font-semibold">Entrega est.</th>
                <th className="px-4 py-3 font-semibold text-right">Costo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.map((order) => {
                const meta = LAB_STATUS_META[order.status];
                const isDelayed =
                  order.dueDate &&
                  (order.status === 'sin_enviar' || order.status === 'en_laboratorio') &&
                  order.dueDate < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {order.patientName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {order.workType}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {order.toothFdi ? `Pieza ${order.toothFdi}` : 'Arcada / General'}
                        {order.shade ? ` · Color ${order.shade}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {order.providerName || 'Sin asignar'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      <span className={isDelayed ? 'text-rose-600 font-semibold inline-flex items-center gap-1' : 'text-slate-600 dark:text-slate-300'}>
                        {isDelayed && <AlertTriangle className="w-3.5 h-3.5" />}
                        {order.dueDate || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {order.cost != null ? formatMoney(order.cost, activeCurrency) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateLabOrderStatus(order.id, e.target.value as LabOrderStatus)
                        }
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${meta.textClass}`}
                      >
                        <option value="sin_enviar">Sin enviar</option>
                        <option value="en_laboratorio">En laboratorio</option>
                        <option value="en_clinica">En clínica</option>
                        <option value="instalado">Instalado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: '¿Eliminar orden de laboratorio?',
                            description: `Se eliminará "${order.workType}" de ${order.patientName}.`,
                            confirmText: 'Eliminar',
                            cancelText: 'Cancelar',
                            isDestructive: true,
                            onConfirm: () => deleteLabOrder(order.id),
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Nueva Orden de Laboratorio */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nueva orden de laboratorio
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {patients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Paciente registrado
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => {
                      setPatientId(e.target.value);
                      const pat = patients.find((p) => p.id === e.target.value);
                      if (pat) setPatientNameInput(pat.fullName);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Seleccionar o escribir --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del paciente *
                </label>
                <input
                  type="text"
                  required
                  value={patientNameInput}
                  onChange={(e) => setPatientNameInput(e.target.value)}
                  placeholder="Ej: Lucas Pereyra"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Trabajo protésico *
                  </label>
                  <input
                    type="text"
                    required
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    placeholder="Ej: Corona zirconio / Placa"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Laboratorio / Proveedor
                  </label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Sin especificar</option>
                    {labProviders.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pieza FDI
                  </label>
                  <input
                    type="text"
                    value={toothFdi}
                    onChange={(e) => setToothFdi(e.target.value)}
                    placeholder="2.1"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Color (Vita)
                  </label>
                  <input
                    type="text"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    placeholder="A2 / B1"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Entrega est.
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Costo lab
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Moneda
                  </label>
                  <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-200">
                    {currencyMeta.code} ({currencyMeta.symbol})
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LabOrderStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="sin_enviar">Sin enviar</option>
                    <option value="en_laboratorio">En laboratorio</option>
                    <option value="en_clinica">En clínica</option>
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicaciones de laboratorio..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
                >
                  Guardar orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
