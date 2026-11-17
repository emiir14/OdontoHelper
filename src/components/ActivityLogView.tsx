import React, { useMemo, useState } from 'react';
import { History, Search, Trash2 } from 'lucide-react';
import { ActivityEntityType } from '../core/types';
import { useAppStore } from '../store/useAppStore';

const ENTITY_FILTERS: Array<{ id: 'all' | ActivityEntityType; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'patient', label: 'Pacientes' },
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
  system: 'Sistema',
};

export const ActivityLogView: React.FC = () => {
  const { activityLogs, clearActivityLogs, openConfirm } = useAppStore();
  const [entityFilter, setEntityFilter] = useState<'all' | ActivityEntityType>('all');
  const [query, setQuery] = useState('');

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Historial de actividad
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registro local cronológico de altas, modificaciones, turnos agendados y transcripciones.
          </p>
        </div>

        {activityLogs.length > 0 && (
          <button
            type="button"
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-colors min-h-[38px] self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar registro</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800/70 overflow-x-auto">
          {ENTITY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setEntityFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                entityFilter === f.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar actividad..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
          />
        </div>
      </div>

      {/* Timeline List */}
      {filtered.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((entry) => {
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
                className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {entry.summary}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {ENTITY_LABEL[entry.entityType]}
                    </span>
                    {entry.details && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{entry.details}</span>
                      </>
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
      ) : (
        <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
          <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hay movimientos registrados para este filtro todavía.
          </p>
        </div>
      )}
    </div>
  );
};
