import React, { useMemo, useState } from 'react';
import { History, Trash2 } from 'lucide-react';
import { ActivityEntityType } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { FilterBar } from './ui/FilterBar';
import { Pagination } from './ui/Pagination';
import {
  cardClass,
  emptyStateClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
} from './ui/uiClasses';

const ENTITY_FILTERS: Array<{ id: 'all' | ActivityEntityType; label: string }> = [
  { id: 'all', label: 'Todas las categorías' },
  { id: 'patient', label: 'Pacientes' },
  { id: 'share', label: 'Fichas compartidas' },
  { id: 'evolution', label: 'Evoluciones' },
  { id: 'odontogram', label: 'Odontograma' },
  { id: 'treatment_plan', label: 'Presupuestos' },
  { id: 'finance', label: 'Caja / Cobros' },
  { id: 'lab_order', label: 'Laboratorio' },
  { id: 'appointment', label: 'Agenda' },
  { id: 'provider', label: 'Proveedores' },
  { id: 'session', label: 'Dictados' },
];

const ENTITY_LABEL: Record<ActivityEntityType, string> = {
  patient: 'Paciente',
  provider: 'Proveedor',
  appointment: 'Agenda',
  session: 'Dictado',
  professional: 'Equipo',
  odontogram: 'Odontograma',
  periodontogram: 'Periodontograma',
  evolution: 'Evolución',
  file: 'Archivo',
  treatment_plan: 'Presupuesto',
  finance: 'Finanzas',
  lab_order: 'Laboratorio',
  share: 'Compartido',
  system: 'Sistema',
};

export const ActivityLogView: React.FC = () => {
  const { activityLogs, clearActivityLogs, openConfirm, moduleQuery, setModuleQuery } =
    useAppStore();
  const entityFilter: 'all' | ActivityEntityType =
    moduleQuery.entity && moduleQuery.entity in ENTITY_LABEL
      ? (moduleQuery.entity as ActivityEntityType)
      : 'all';
  const [query, setQuery] = useState('');
  const currentPage = moduleQuery.page || 1;
  const pageSize = moduleQuery.pageSize || 25;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activityLogs.filter((entry) => {
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) return false;
      if (!q) return true;
      return (
        entry.summary.toLowerCase().includes(q) ||
        (entry.details || '').toLowerCase().includes(q)
      );
    });
  }, [activityLogs, entityFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>
            Historial de actividad
          </h1>
          <p className={pageSubtitleClass}>
            Registro local cronológico de altas, modificaciones, turnos agendados y transcripciones.
          </p>
        </div>

        {activityLogs.length > 0 && (
          <Button
            variant="dangerSoft"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto justify-center"
            onClick={() =>
              openConfirm({
                title: '¿Limpiar historial de actividad?',
                description:
                  'Se borrará el registro de eventos recientes sin afectar pacientes, proveedores, turnos ni grabaciones.',
                confirmText: 'Limpiar historial',
                cancelText: 'Cancelar',
                isDestructive: true,
                onConfirm: () => clearActivityLogs(),
              })
            }
          >
            Limpiar registro
          </Button>
        )}
      </div>

      {/* Standardized FilterBar: Search first, then compact Dropdown */}
      <FilterBar
        searchValue={query}
        onSearchChange={(val) => {
          setQuery(val);
          if (moduleQuery.page) setModuleQuery({ page: undefined });
        }}
        searchPlaceholder="Buscar en el historial de actividad..."
        dropdowns={[
          {
            id: 'entity-filter',
            value: entityFilter,
            onChange: (val) =>
              setModuleQuery({ entity: val === 'all' ? undefined : val, page: undefined }),
            ariaLabel: 'Filtrar por tipo de actividad',
            className: 'sm:w-56',
            options: ENTITY_FILTERS.map((f) => ({ value: f.id, label: f.label })),
          },
        ]}
        resultCountLabel={`${filtered.length} de ${activityLogs.length} eventos`}
      />

      {/* Timeline List */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          <div className={`${cardClass} divide-y divide-slate-200/80 dark:divide-slate-800`}>
            {pagedEntries.map((entry) => {
              const dateStr = new Date(entry.createdAt).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={entry.id}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {entry.summary}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 mt-1">
                      <Badge tone="teal" size="xs">
                        {ENTITY_LABEL[entry.entityType]}
                      </Badge>
                      {entry.details && (
                        <span>{entry.details}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-slate-400 shrink-0">
                    {dateStr}
                  </span>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
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
            itemLabel="eventos"
          />
        </div>
      ) : (
        <div className={`${emptyStateClass} space-y-2.5`}>
          <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hay movimientos registrados para este filtro todavía.
          </p>
        </div>
      )}
    </div>
  );
};
