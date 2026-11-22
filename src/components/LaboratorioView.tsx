import React, { useMemo, useState } from 'react';
import { FlaskConical, Plus, Trash2, AlertTriangle, Pencil, Eye } from 'lucide-react';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  toLocalIsoDate,
} from '../core/clinic/clinicHelpers';
import { LabOrder, LabOrderStatus } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { LabOrderDetailModal } from './LabOrderDetailModal';
import { LabOrderModal } from './LabOrderModal';
import { Button } from './ui/Button';
import {
  DataTable,
  DataTableColumn,
  DataTableSortState,
  parseSortState,
  serializeSortState,
} from './ui/DataTable';
import { FilterBar } from './ui/FilterBar';
import {
  emptyStateClass,
  kpiCardClass,
  pageContainerClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
} from './ui/uiClasses';

const LAB_STATUS_META: Record<LabOrderStatus, { label: string; textClass: string }> = {
  sin_enviar: { label: 'Sin enviar', textClass: 'text-rose-700 dark:text-rose-400' },
  en_laboratorio: { label: 'En laboratorio', textClass: 'text-amber-700 dark:text-amber-400' },
  en_clinica: { label: 'En clínica (listo)', textClass: 'text-teal-700 dark:text-teal-400' },
  instalado: { label: 'Instalado', textClass: 'text-emerald-700 dark:text-emerald-400' },
};

export const LaboratorioView: React.FC = () => {
  const {
    labOrders,
    settings,
    updateLabOrderStatus,
    deleteLabOrder,
    openConfirm,
    moduleQuery,
    setModuleQuery,
    selectPatient,
    setView,
  } = useAppStore();

  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);

  const statusFilter: 'all' | LabOrderStatus =
    moduleQuery.status && moduleQuery.status in LAB_STATUS_META
      ? (moduleQuery.status as LabOrderStatus)
      : 'all';
  const [query, setQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<LabOrder | null>(null);

  const viewingOrder = useMemo(
    () => (viewingOrderId ? labOrders.find((o) => o.id === viewingOrderId) || null : null),
    [viewingOrderId, labOrders]
  );

  const defaultSort: DataTableSortState = { columnId: 'dueDate', direction: 'asc' };
  const currentSort = useMemo(
    () => parseSortState(moduleQuery.sort) ?? defaultSort,
    [moduleQuery.sort]
  );
  const currentPage = moduleQuery.page || 1;
  const currentPageSize = moduleQuery.pageSize || 25;

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.patientName.toLowerCase().includes(q) ||
        o.workType.toLowerCase().includes(q) ||
        (o.providerName || '').toLowerCase().includes(q) ||
        (o.toothFdi || '').toLowerCase().includes(q) ||
        (o.shade || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q)
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

  const todayIso = toLocalIsoDate();

  const columns: DataTableColumn<LabOrder>[] = [
    {
      id: 'patientName',
      label: 'Paciente',
      sortValue: (o) => o.patientName,
      render: (o) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">{o.patientName}</span>
      ),
    },
    {
      id: 'workType',
      label: 'Trabajo / Pieza / Color',
      sortValue: (o) => o.workType,
      render: (o) => (
        <div className="min-w-0 max-w-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200">{o.workType}</div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {o.toothFdi ? `Pieza ${o.toothFdi}` : 'Arcada / General'}
            {o.shade ? ` · Color ${o.shade}` : ''}
          </div>
          {o.notes && (
            <p
              className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
              title={o.notes}
            >
              {o.notes}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'providerName',
      label: 'Laboratorio',
      sortValue: (o) => o.providerName || '',
      render: (o) => (
        <span className="text-slate-600 dark:text-slate-300">{o.providerName || 'Sin asignar'}</span>
      ),
    },
    {
      id: 'dueDate',
      label: 'Entrega est.',
      sortValue: (o) => o.dueDate || '9999-99-99',
      render: (o) => {
        const isDelayed =
          o.dueDate &&
          (o.status === 'sin_enviar' || o.status === 'en_laboratorio') &&
          o.dueDate < todayIso;
        return (
          <div>
            <span
              className={`font-mono tabular-nums ${
                isDelayed
                  ? 'text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center gap-1'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {isDelayed && <AlertTriangle className="w-3.5 h-3.5" />}
              {o.dueDate || '—'}
            </span>
            {(o.sentDate || o.receivedDate) && (
              <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                {o.sentDate ? `Env: ${o.sentDate}` : ''}
                {o.sentDate && o.receivedDate ? ' · ' : ''}
                {o.receivedDate ? `Rec: ${o.receivedDate}` : ''}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'cost',
      label: 'Costo',
      align: 'right',
      sortValue: (o) => o.cost ?? -1,
      render: (o) => (
        <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
          {o.cost != null ? formatMoney(o.cost, activeCurrency, showCurrencyCode) : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Estado',
      sortValue: (o) => LAB_STATUS_META[o.status].label,
      render: (o) => {
        const meta = LAB_STATUS_META[o.status];
        return (
          <select
            value={o.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLabOrderStatus(o.id, e.target.value as LabOrderStatus)}
            aria-label={`Estado de trabajo para ${o.patientName}`}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer ${meta.textClass}`}
          >
            <option value="sin_enviar">Sin enviar</option>
            <option value="en_laboratorio">En laboratorio</option>
            <option value="en_clinica">En clínica</option>
            <option value="instalado">Instalado</option>
          </select>
        );
      },
    },
    {
      id: 'actions',
      label: 'Acciones',
      align: 'right',
      sortable: false,
      render: (o) => (
        <div
          className="inline-flex flex-wrap items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="icon"
            size="xs"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setViewingOrderId(o.id)}
            title="Ver detalle"
            aria-label={`Ver detalle de ${o.workType} de ${o.patientName}`}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="icon"
            size="xs"
            className="text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            onClick={() => setEditingOrder(o)}
            title="Editar orden"
            aria-label={`Editar orden ${o.workType} de ${o.patientName}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="icon"
            size="xs"
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            onClick={() =>
              openConfirm({
                title: '¿Eliminar orden de laboratorio?',
                description: `Se eliminará "${o.workType}" de ${o.patientName}.`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                isDestructive: true,
                onConfirm: () => deleteLabOrder(o.id),
              })
            }
            title="Eliminar orden"
            aria-label={`Eliminar orden ${o.workType} de ${o.patientName}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={pageContainerClass}>
      <div className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>
            Laboratorio dental y prótesis
          </h1>
          <p className={pageSubtitleClass}>
            Registrá y editá órdenes protésicas, indicaciones, fechas de envío y recepción. La Agenda alerta si un trabajo aún no llegó a clínica.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          className="w-full sm:w-auto justify-center"
          onClick={() => setShowCreateModal(true)}
        >
          Nueva orden de laboratorio
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={kpiCardClass}>
          <div className="text-xs text-slate-500 dark:text-slate-400">Pendientes de recepción</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {counts.pending}
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs text-slate-500 dark:text-slate-400">Listos en clínica</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-1">
            {counts.ready}
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs text-slate-500 dark:text-slate-400">Instalados en boca</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {counts.installed}
          </div>
        </div>
      </div>

      {/* Standardized FilterBar */}
      <FilterBar
        searchValue={query}
        onSearchChange={(val) => {
          setQuery(val);
          if (moduleQuery.page) setModuleQuery({ page: undefined });
        }}
        searchPlaceholder="Buscar por paciente, laboratorio, trabajo, pieza o indicación..."
        dropdowns={[
          {
            id: 'lab-status',
            value: statusFilter,
            onChange: (val) =>
              setModuleQuery({ status: val === 'all' ? undefined : val, page: undefined }),
            ariaLabel: 'Filtrar por estado de orden',
            className: 'sm:w-52',
            options: [
              { value: 'all', label: 'Todos los estados' },
              { value: 'sin_enviar', label: 'Sin enviar' },
              { value: 'en_laboratorio', label: 'En laboratorio' },
              { value: 'en_clinica', label: 'En clínica' },
              { value: 'instalado', label: 'Instalado' },
            ],
          },
        ]}
        resultCountLabel={`${filteredOrders.length} de ${labOrders.length} órdenes`}
      />

      <DataTable
        columns={columns}
        data={filteredOrders}
        getRowKey={(o) => o.id}
        onRowClick={(o) => setViewingOrderId(o.id)}
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
        ariaLabel="Órdenes de laboratorio"
        emptyState={
          <div className={`${emptyStateClass} space-y-3`}>
            <FlaskConical className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-500">
              No hay trabajos de laboratorio registrados con los filtros actuales.
            </p>
          </div>
        }
      />

      {viewingOrder && (
        <LabOrderDetailModal
          order={viewingOrder}
          onClose={() => setViewingOrderId(null)}
          onEdit={(orderToEdit) => {
            setViewingOrderId(null);
            setEditingOrder(orderToEdit);
          }}
          onOpenPatient={(patientId) => {
            setViewingOrderId(null);
            selectPatient(patientId);
            setView('patients-search');
          }}
        />
      )}

      {(showCreateModal || editingOrder) && (
        <LabOrderModal
          order={editingOrder}
          onClose={() => {
            setShowCreateModal(false);
            setEditingOrder(null);
          }}
        />
      )}
    </div>
  );
};
