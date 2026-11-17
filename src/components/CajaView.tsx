import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Printer,
  MessageCircle,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  X,
} from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  calculateSingleCurrencyBalance,
  formatMoney,
  generateAppointmentMailtoUrl,
  generateWhatsAppUrl,
  getCurrencyMeta,
} from '../core/clinic/clinicHelpers';
import { PaymentMethod, TransactionType } from '../core/types';
import { useAppStore } from '../store/useAppStore';

interface TransactionModalProps {
  initialType?: TransactionType;
  initialPatientId?: string;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  initialType = 'payment',
  initialPatientId = '',
  onClose,
}) => {
  const {
    patients,
    professionals,
    activeProfessionalId,
    settings,
    createFinancialTransaction,
    showToast,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const [type, setType] = useState<TransactionType>(initialType);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialType === 'charge' ? 'cargo_clinico' : 'efectivo'
  );
  const [concept, setConcept] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [professionalId, setProfessionalId] = useState(
    activeProfessionalId || professionals[0]?.id || ''
  );
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || !concept.trim()) {
      showToast('Ingresá un monto válido mayor a 0 y un concepto.', 'warning');
      return;
    }
    const pat = patients.find((p) => p.id === patientId);
    if ((type === 'charge' || type === 'payment') && patientId && !pat) {
      showToast('Paciente no encontrado.', 'warning');
      return;
    }
    const prof = professionals.find((p) => p.id === professionalId);
    await createFinancialTransaction({
      patientId: type === 'expense' ? undefined : pat?.id,
      patientName: type === 'expense' ? undefined : pat?.fullName,
      type,
      currency: activeCurrency,
      amount: numAmount,
      paymentMethod,
      concept: concept.trim(),
      date,
      professionalId: prof?.id,
      professionalName: prof?.fullName,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Registrar movimiento en Caja / Cuenta Corriente
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'payment' as const, label: 'Cobro / Abono' },
              { id: 'charge' as const, label: 'Cargo a paciente' },
              { id: 'expense' as const, label: 'Egreso / Gasto' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setType(opt.id);
                  if (opt.id === 'charge') setPaymentMethod('cargo_clinico');
                  else if (paymentMethod === 'cargo_clinico') setPaymentMethod('efectivo');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                  type === opt.id
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {type !== 'expense' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Paciente {type === 'charge' ? '*' : '(opcional si es cobro directo)'}
              </label>
              <select
                required={type === 'charge'}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Sin paciente asociado / Particular --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} {p.dni ? `(DNI ${p.dni})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Moneda
              </label>
              <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-200">
                {currencyMeta.code} ({currencyMeta.symbol})
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Monto *
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Medio de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Concepto *
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={
                type === 'expense'
                  ? 'Ej: Compra de insumos descartables / Laboratorio dental'
                  : 'Ej: Entrega a cuenta / Pago sesión endodoncia'
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          {professionals.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Profesional asociado
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
          )}

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas u observaciones del comprobante..."
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
            >
              Guardar movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CajaView: React.FC = () => {
  const {
    financialTransactions,
    patients,
    professionals,
    settings,
    canAccessFinance,
    deleteFinancialTransaction,
    selectPatient,
    setView,
    openConfirm,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;

  const [activeTab, setActiveTab] = useState<'caja' | 'deudores'>('caja');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodMode, setPeriodMode] = useState<'day' | 'month' | 'all'>('day');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [profFilter, setProfFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const allowed = canAccessFinance();

  const cashMovements = useMemo(() => {
    const monthPrefix = selectedDate.slice(0, 7);
    return financialTransactions.filter((tx) => {
      if (tx.type === 'charge') return false; // Charges are receivable postings, not cash in drawer
      if (periodMode === 'day' && tx.date !== selectedDate) return false;
      if (periodMode === 'month' && !tx.date.startsWith(monthPrefix)) return false;
      if (methodFilter !== 'all' && tx.paymentMethod !== methodFilter) return false;
      if (profFilter !== 'all' && tx.professionalId !== profFilter) return false;
      return true;
    });
  }, [financialTransactions, selectedDate, periodMode, methodFilter, profFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    cashMovements.forEach((tx) => {
      if (tx.type === 'payment') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    return {
      income,
      expense,
      net: income - expense,
    };
  }, [cashMovements]);

  const debtors = useMemo(() => {
    return patients
      .map((patient) => {
        const bal = calculateSingleCurrencyBalance(patient.id, financialTransactions);
        return { patient, bal };
      })
      .filter((row) => row.bal.balance > 0)
      .sort((a, b) => b.bal.balance - a.bal.balance);
  }, [patients, financialTransactions]);

  if (!allowed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto text-slate-400" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Acceso económico restringido
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          El perfil del profesional activo no tiene permisos habilitados para visualizar Caja y Cobros. Podés modificar permisos o cambiar de operador en Configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Caja diaria, cobros y deudores
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controlá ingresos por forma de pago y profesional, egresos del consultorio y saldos pendientes de pacientes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 min-h-[40px]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir arqueo</span>
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-xs min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar cobro / gasto</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('caja')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'caja'
              ? 'border-teal-600 text-teal-700 dark:text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Caja y movimientos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('deudores')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors font-mono tabular-nums ${
            activeTab === 'deudores'
              ? 'border-teal-600 text-teal-700 dark:text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span className="font-sans">Deudores ({debtors.length})</span>
        </button>
      </div>

      {activeTab === 'caja' ? (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500">Ingresos del período ({activeCurrency})</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {formatMoney(totals.income, activeCurrency)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500">Egresos / Gastos ({activeCurrency})</div>
              <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                {formatMoney(totals.expense, activeCurrency)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500">Saldo neto en caja ({activeCurrency})</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatMoney(totals.net, activeCurrency)}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 no-print">
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs">
              {[
                { id: 'day' as const, label: 'Día' },
                { id: 'month' as const, label: 'Mes' },
                { id: 'all' as const, label: 'Histórico' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPeriodMode(m.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium ${
                    periodMode === m.id
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {periodMode !== 'all' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums text-slate-900 dark:text-slate-100"
              />
            )}

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)}
              className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Todos los medios de pago</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
                .filter((m) => m !== 'cargo_clinico')
                .map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
            </select>

            {professionals.length > 0 && (
              <select
                value={profFilter}
                onChange={(e) => setProfFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Todos los profesionales</option>
                {professionals.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Movements Table */}
          {cashMovements.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <Wallet className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500">No hay ingresos o egresos registrados para este filtro.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-500 border-b border-slate-200/70 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Concepto / Paciente</th>
                    <th className="px-4 py-3 font-semibold">Medio / Prof.</th>
                    <th className="px-4 py-3 font-semibold">Recibo</th>
                    <th className="px-4 py-3 font-semibold text-right">Importe</th>
                    <th className="px-4 py-3 text-right font-semibold no-print">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cashMovements.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-500">{tx.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                          {tx.type === 'payment' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>{tx.concept}</span>
                        </div>
                        {tx.patientName && (
                          <div className="text-[11px] text-slate-500 pl-5">{tx.patientName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div>{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</div>
                        {tx.professionalName && (
                          <div className="text-[11px] text-slate-400">{tx.professionalName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-500">
                        {tx.receiptNumber || '—'}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono tabular-nums text-right font-bold ${
                          tx.type === 'payment'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}
                        {formatMoney(tx.amount, activeCurrency)}
                      </td>
                      <td className="px-4 py-3 text-right no-print">
                        <button
                          type="button"
                          onClick={() =>
                            openConfirm({
                              title: '¿Anular movimiento?',
                              description: `Se eliminará "${tx.concept}" (${formatMoney(tx.amount, activeCurrency)}).`,
                              confirmText: 'Anular',
                              cancelText: 'Cancelar',
                              isDestructive: true,
                              onConfirm: () => deleteFinancialTransaction(tx.id),
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {debtors.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500">
              No hay pacientes con saldos pendientes de cobro en este momento.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-500 border-b border-slate-200/70 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Paciente</th>
                    <th className="px-4 py-3 font-semibold">Contacto</th>
                    <th className="px-4 py-3 font-semibold text-right">Saldo ({activeCurrency})</th>
                    <th className="px-4 py-3 text-right font-semibold">Recordatorio / Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {debtors.map(({ patient, bal }) => {
                    const formattedDebt = formatMoney(bal.balance, activeCurrency);
                    const reminderText = `Hola ${patient.fullName}, te recordamos desde OdontoHelper que registrás un saldo pendiente de ${formattedDebt}. ¡Muchas gracias!`;
                    const wa = generateWhatsAppUrl(patient.phone, reminderText);
                    const mail = generateAppointmentMailtoUrl(
                      patient.email,
                      'Estado de cuenta — OdontoHelper',
                      reminderText
                    );

                    return (
                      <tr key={patient.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {patient.fullName}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono tabular-nums">
                          {patient.phone || patient.email || 'Sin contacto'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                          {formattedDebt}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {wa && (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                            {mail && (
                              <a
                                href={mail}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
                              >
                                <Mail className="w-3 h-3" />
                                <span>Email</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                selectPatient(patient.id);
                                setView('patients-search');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60"
                            >
                              Ver cuenta
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
};
