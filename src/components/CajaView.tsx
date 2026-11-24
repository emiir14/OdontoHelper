import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Printer,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  formatCurrencyHeading,
  formatMoney,
  generateAppointmentMailtoUrl,
  generateWhatsAppUrl,
  getCurrencyMeta,
} from '../core/clinic/clinicHelpers';
import { FinancialTransaction, Patient, PaymentMethod, TransactionType } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  DataTable,
  DataTableColumn,
  DataTableSortState,
  parseSortState,
  serializeSortState,
} from './ui/DataTable';
import { Modal } from './ui/Modal';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import {
  buttonClass,
  dropdownClass,
  emptyStateClass,
  inputClass,
  inputMonoClass,
  kpiCardClass,
  labelClass,
  pageContainerClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
  selectClass,
} from './ui/uiClasses';

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
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);
  const currencyMeta = getCurrencyMeta(activeCurrency);

  const [type, setType] = useState<TransactionType>(initialType);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialType === 'charge' ? 'cargo_clinico' : 'efectivo'
  );
  const [concept, setConcept] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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
    const prof =
      professionals.find((p) => p.id === activeProfessionalId) || professionals[0];
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
    <Modal
      onClose={onClose}
      size="lg"
      title="Registrar movimiento en Caja / Cuenta Corriente"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="transaction-modal-form" variant="primary">
            Guardar movimiento
          </Button>
        </>
      }
    >
      <form id="transaction-modal-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                type === opt.id
                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {type !== 'expense' && (
          <div>
            <label className={labelClass}>
              Paciente {type === 'charge' ? '*' : '(opcional si es cobro directo)'}
            </label>
            <select
              required={type === 'charge'}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className={selectClass}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Moneda</label>
            <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-200 truncate">
              {showCurrencyCode
                ? `${currencyMeta.code} (${currencyMeta.symbol})`
                : `${currencyMeta.symbol} ${currencyMeta.name}`}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Monto *</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputMonoClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Medio de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className={selectClass}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputMonoClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Concepto *</label>
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
            className={inputClass}
          />
        </div>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas u observaciones del comprobante..."
          className={inputClass}
        />
      </form>
    </Modal>
  );
};

interface DebtorRow {
  patient: Patient;
  bal: {
    charged: number;
    paid: number;
    balance: number;
  };
}

export const CajaView: React.FC = () => {
  const {
    financialTransactions,
    patients,
    patientIndexes,
    settings,
    deleteFinancialTransaction,
    selectPatient,
    setView,
    openConfirm,
    moduleQuery,
    setModuleQuery,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);

  const todayIso = new Date().toISOString().slice(0, 10);
  const activeTab: 'caja' | 'deudores' =
    moduleQuery.tab === 'deudores' ? 'deudores' : 'caja';
  const selectedDate = moduleQuery.from || todayIso;
  const periodMode: 'day' | 'month' | 'all' =
    moduleQuery.period === 'month' || moduleQuery.period === 'all' ? moduleQuery.period : 'day';
  const methodFilter: 'all' | PaymentMethod =
    moduleQuery.method && moduleQuery.method in PAYMENT_METHOD_LABELS
      ? (moduleQuery.method as PaymentMethod)
      : 'all';
  const [showModal, setShowModal] = useState(false);

  const defaultMovementSort: DataTableSortState = { columnId: 'date', direction: 'desc' };
  const defaultDebtorSort: DataTableSortState = { columnId: 'balance', direction: 'desc' };
  const currentSort = useMemo(
    () =>
      parseSortState(moduleQuery.sort) ??
      (activeTab === 'deudores' ? defaultDebtorSort : defaultMovementSort),
    [moduleQuery.sort, activeTab]
  );
  const currentPage = moduleQuery.page || 1;
  const currentPageSize = moduleQuery.pageSize || 25;

  const cashMovements = useMemo(() => {
    const monthPrefix = selectedDate.slice(0, 7);
    return financialTransactions.filter((tx) => {
      if (tx.type === 'charge') return false;
      if (periodMode === 'day' && tx.date !== selectedDate) return false;
      if (periodMode === 'month' && !tx.date.startsWith(monthPrefix)) return false;
      if (methodFilter !== 'all' && tx.paymentMethod !== methodFilter) return false;
      return true;
    });
  }, [financialTransactions, selectedDate, periodMode, methodFilter]);

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

  const debtors = useMemo<DebtorRow[]>(() => {
    const result: DebtorRow[] = [];
    for (const patient of patients) {
      const bal = patientIndexes.balancesByPatientId.get(patient.id);
      if (bal && bal.balance > 0) {
        result.push({ patient, bal });
      }
    }
    return result.sort((a, b) => b.bal.balance - a.bal.balance);
  }, [patients, patientIndexes]);

  const movementColumns: DataTableColumn<FinancialTransaction>[] = [
    {
      id: 'actions',
      label: 'Acciones',
      align: 'left',
      sortable: false,
      headerClassName: 'no-print w-px whitespace-nowrap',
      cellClassName: 'no-print w-px whitespace-nowrap',
      render: (tx) => (
        <Button
          variant="icon"
          size="xs"
          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          onClick={() =>
            openConfirm({
              title: '¿Anular movimiento?',
              description: `Se eliminará "${tx.concept}" (${formatMoney(
                tx.amount,
                activeCurrency,
                showCurrencyCode
              )}).`,
              confirmText: 'Anular',
              cancelText: 'Cancelar',
              isDestructive: true,
              onConfirm: () => deleteFinancialTransaction(tx.id),
            })
          }
          title="Anular movimiento"
          aria-label="Anular movimiento"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      ),
    },
    {
      id: 'date',
      label: 'Fecha',
      sortValue: (tx) => tx.date,
      render: (tx) => (
        <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">{tx.date}</span>
      ),
    },
    {
      id: 'type',
      label: 'Tipo',
      sortValue: (tx) => (tx.type === 'payment' ? 'Ingreso' : 'Egreso'),
      render: (tx) =>
        tx.type === 'payment' ? (
          <Badge tone="emerald" size="xs">
            <ArrowDownLeft className="w-3 h-3" />
            <span>Ingreso</span>
          </Badge>
        ) : (
          <Badge tone="rose" size="xs">
            <ArrowUpRight className="w-3 h-3" />
            <span>Egreso</span>
          </Badge>
        ),
    },
    {
      id: 'concept',
      label: 'Concepto / Paciente',
      sortValue: (tx) => tx.concept,
      render: (tx) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{tx.concept}</div>
          {tx.patientName && (
            <div className="text-[11px] text-slate-500">{tx.patientName}</div>
          )}
        </div>
      ),
    },
    {
      id: 'paymentMethod',
      label: 'Medio de pago',
      sortValue: (tx) => PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod,
      render: (tx) => (
        <span className="text-slate-600 dark:text-slate-300">
          {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
        </span>
      ),
    },
    {
      id: 'receiptNumber',
      label: 'Recibo',
      sortValue: (tx) => tx.receiptNumber || '',
      render: (tx) => (
        <span className="font-mono tabular-nums text-slate-500">{tx.receiptNumber || '—'}</span>
      ),
    },
    {
      id: 'amount',
      label: 'Importe',
      align: 'right',
      sortValue: (tx) => (tx.type === 'expense' ? -tx.amount : tx.amount),
      render: (tx) => (
        <span
          className={`font-mono tabular-nums font-bold whitespace-nowrap ${
            tx.type === 'payment'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          {formatMoney(
            tx.type === 'expense' ? -tx.amount : tx.amount,
            activeCurrency,
            showCurrencyCode
          )}
        </span>
      ),
    },
  ];

  const debtorColumns: DataTableColumn<DebtorRow>[] = [
    {
      id: 'actions',
      label: 'Acciones',
      align: 'left',
      sortable: false,
      headerClassName: 'w-px whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      render: ({ patient, bal }) => {
        const formattedDebt = formatMoney(bal.balance, activeCurrency, showCurrencyCode);
        const reminderText = `Hola ${patient.fullName}, te recordamos desde nuestro consultorio que registrás un saldo pendiente de ${formattedDebt}. ¡Muchas gracias!`;
        const wa = generateWhatsAppUrl(patient.phone, reminderText);
        const mail = generateAppointmentMailtoUrl(
          patient.email,
          'Estado de cuenta odontológica',
          reminderText
        );
        return (
          <div className="inline-flex flex-wrap items-center justify-start gap-1.5 sm:gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: 'whatsapp', size: 'xs' })}
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
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
            <Button
              variant="soft"
              size="xs"
              onClick={() => {
                selectPatient(patient.id);
                setView('patients-search');
              }}
            >
              Ver cuenta
            </Button>
          </div>
        );
      },
    },
    {
      id: 'fullName',
      label: 'Paciente',
      sortValue: (row) => row.patient.fullName,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {row.patient.fullName}
        </span>
      ),
    },
    {
      id: 'contact',
      label: 'Contacto',
      sortValue: (row) => row.patient.phone || row.patient.email || '',
      render: (row) => (
        <span className="text-slate-500 font-mono tabular-nums">
          {row.patient.phone || row.patient.email || 'Sin contacto'}
        </span>
      ),
    },
    {
      id: 'balance',
      label: formatCurrencyHeading('Saldo', activeCurrency, showCurrencyCode),
      align: 'right',
      sortValue: (row) => row.bal.balance,
      render: (row) => (
        <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
          {formatMoney(row.bal.balance, activeCurrency, showCurrencyCode)}
        </span>
      ),
    },
  ];

  return (
    <div className={pageContainerClass}>
      <div className={`${pageHeaderClass} no-print`}>
        <div>
          <h1 className={pageTitleClass}>
            Caja diaria, cobros y deudores
          </h1>
          <p className={pageSubtitleClass}>
            Controlá ingresos por forma de pago, egresos del consultorio y saldos pendientes de pacientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
          >
            Imprimir arqueo
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowModal(true)}
          >
            Registrar cobro / gasto
          </Button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 overflow-x-auto scrollbar-thin no-print">
        <button
          type="button"
          onClick={() =>
            setModuleQuery({ tab: undefined, page: undefined, sort: undefined })
          }
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'caja'
              ? 'border-teal-600 text-teal-700 dark:text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Caja y movimientos
        </button>
        <button
          type="button"
          onClick={() =>
            setModuleQuery({ tab: 'deudores', page: undefined, sort: undefined })
          }
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors font-mono tabular-nums whitespace-nowrap cursor-pointer ${
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
            <div className={kpiCardClass}>
              <div className="text-xs text-slate-500">
                {formatCurrencyHeading('Ingresos del período', activeCurrency, showCurrencyCode)}
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {formatMoney(totals.income, activeCurrency, showCurrencyCode)}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-xs text-slate-500">
                {formatCurrencyHeading('Egresos / Gastos', activeCurrency, showCurrencyCode)}
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                {formatMoney(totals.expense, activeCurrency, showCurrencyCode)}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-xs text-slate-500">
                {formatCurrencyHeading('Saldo neto en caja', activeCurrency, showCurrencyCode)}
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatMoney(totals.net, activeCurrency, showCurrencyCode)}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <select
              value={periodMode}
              onChange={(e) => {
                const nextPeriod = e.target.value as 'day' | 'month' | 'all';
                setModuleQuery({
                  period: nextPeriod === 'day' ? undefined : nextPeriod,
                  page: undefined,
                });
              }}
              aria-label="Período de caja"
              className={`${dropdownClass} w-full sm:w-auto`}
            >
              <option value="day">Por día</option>
              <option value="month">Por mes</option>
              <option value="all">Histórico completo</option>
            </select>

            {periodMode !== 'all' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) =>
                  setModuleQuery({
                    from: e.target.value === todayIso ? undefined : e.target.value,
                    page: undefined,
                  })
                }
                className={`${dropdownClass} w-full sm:w-auto tabular-nums`}
              />
            )}

            <select
              value={methodFilter}
              onChange={(e) =>
                setModuleQuery({
                  method: e.target.value === 'all' ? undefined : e.target.value,
                  page: undefined,
                })
              }
              aria-label="Filtrar por medio de pago"
              className={`${dropdownClass} w-full sm:w-auto`}
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

          </div>

          {/* Sortable Movements Table */}
          <DataTable
            columns={movementColumns}
            data={cashMovements}
            getRowKey={(tx) => tx.id}
            sortState={currentSort}
            onSortChange={(next) =>
              setModuleQuery({ sort: serializeSortState(next) || undefined, page: undefined })
            }
            page={currentPage}
            onPageChange={(nextPage) =>
              setModuleQuery({ page: nextPage <= 1 ? undefined : nextPage })
            }
            pageSize={currentPageSize}
            onPageSizeChange={(nextSize) =>
              setModuleQuery({ pageSize: nextSize === 25 ? undefined : nextSize, page: undefined })
            }
            ariaLabel="Movimientos de caja"
            emptyState={
              <div className={`${emptyStateClass} space-y-2`}>
                <Wallet className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-500">
                  No hay ingresos o egresos registrados para este filtro.
                </p>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={debtorColumns}
            data={debtors}
            getRowKey={(row) => row.patient.id}
            sortState={currentSort}
            onSortChange={(next) =>
              setModuleQuery({ sort: serializeSortState(next) || undefined, page: undefined })
            }
            page={currentPage}
            onPageChange={(nextPage) =>
              setModuleQuery({ page: nextPage <= 1 ? undefined : nextPage })
            }
            pageSize={currentPageSize}
            onPageSizeChange={(nextSize) =>
              setModuleQuery({ pageSize: nextSize === 25 ? undefined : nextSize, page: undefined })
            }
            ariaLabel="Pacientes con saldo deudor"
            emptyState={
              <div className={`${emptyStateClass} text-xs text-slate-500`}>
                No hay pacientes con saldos pendientes de cobro en este momento.
              </div>
            }
          />
        </div>
      )}

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
};
