import React, { useMemo, useState } from 'react';
import {
  Cake,
  CalendarCheck,
  Search,
  User,
  ExternalLink,
  CalendarPlus,
} from 'lucide-react';
import {
  MONTHS_ES,
  calculateAgeFromBirthDate,
  formatBirthDateDisplay,
  generateWhatsAppUrl,
  toLocalIsoDate,
} from '../core/clinic/clinicHelpers';
import { Patient } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { PatientNextControlModal } from './patient/PatientNextControlModal';
import { Button } from './ui/Button';
import { Pagination } from './ui/Pagination';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import {
  buttonClass,
  cardClass,
  emptyStateClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
  searchInputClass,
  segmentedTabClass,
  segmentedTrackClass,
  selectClass,
} from './ui/uiClasses';

function computeNextBirthdayInfo(birthDate: string, now: Date): { daysUntil: number; nextDateLabel: string; monthIndex: number } | null {
  const parts = birthDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextBday = new Date(now.getFullYear(), month - 1, day);
  if (nextBday < today) {
    nextBday = new Date(now.getFullYear() + 1, month - 1, day);
  }
  const daysUntil = Math.round((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return {
    daysUntil,
    nextDateLabel: `${dd}/${mm}`,
    monthIndex: month - 1,
  };
}

export const CumpleanosView: React.FC = () => {
  const { patients, selectPatient, setView, moduleQuery, setModuleQuery } = useAppStore();
  const monthFilter: 'upcoming' | 'all' | number = useMemo(() => {
    if (!moduleQuery.month || moduleQuery.month === 'upcoming') return 'upcoming';
    if (moduleQuery.month === 'all') return 'all';
    const num = Number(moduleQuery.month);
    return Number.isInteger(num) && num >= 0 && num <= 11 ? num : 'upcoming';
  }, [moduleQuery.month]);
  const [query, setQuery] = useState('');
  const page = moduleQuery.page || 1;
  const pageSize = moduleQuery.pageSize || 25;

  const now = new Date();

  const birthdayEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .map((patient) => {
        if (!patient.birthDate) return null;
        const info = computeNextBirthdayInfo(patient.birthDate, now);
        if (!info) return null;
        return {
          patient,
          ...info,
          currentAge: calculateAgeFromBirthDate(patient.birthDate),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => {
        if (q && !item.patient.fullName.toLowerCase().includes(q) && !(item.patient.phone || '').includes(q)) {
          return false;
        }
        if (monthFilter === 'upcoming') return item.daysUntil <= 30;
        if (typeof monthFilter === 'number') return item.monthIndex === monthFilter;
        return true;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [patients, monthFilter, query]);

  const totalBirthdayPages = Math.max(1, Math.ceil(birthdayEntries.length / pageSize));
  const safeBirthdayPage = Math.min(page, totalBirthdayPages);
  const pagedBirthdayEntries = useMemo(
    () =>
      birthdayEntries.slice(
        (safeBirthdayPage - 1) * pageSize,
        safeBirthdayPage * pageSize
      ),
    [birthdayEntries, safeBirthdayPage, pageSize]
  );

  const handleOpenPatient = (patientId: string) => {
    selectPatient(patientId);
    setView('patients-search');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>
            Cumpleaños
          </h1>
          <p className={pageSubtitleClass}>
            Listado de cumpleaños de tus pacientes para seguimiento y saludo directo.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <Button
            variant={monthFilter === 'upcoming' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setModuleQuery({ month: undefined, page: undefined })}
          >
            Próximos 30 días
          </Button>
          <Button
            variant={monthFilter === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setModuleQuery({ month: 'all', page: undefined })}
          >
            Todos
          </Button>
          <select
            aria-label="Filtrar por mes"
            value={typeof monthFilter === 'number' ? String(monthFilter) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setModuleQuery({ month: val === '' ? 'all' : val, page: undefined });
            }}
            className={`${selectClass} w-full sm:w-auto bg-white dark:bg-slate-900 min-h-[38px]`}
          >
            <option value="">Filtrar por mes...</option>
            {MONTHS_ES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (moduleQuery.page) setModuleQuery({ page: undefined });
          }}
          placeholder="Buscar paciente por nombre o teléfono..."
          className={searchInputClass}
        />
      </div>

      {birthdayEntries.length === 0 ? (
        <div className={`${emptyStateClass} space-y-2`}>
          <Cake className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hay cumpleaños de pacientes registrados para el filtro seleccionado.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden`}>
          {pagedBirthdayEntries.map(({ patient, daysUntil, nextDateLabel, currentAge }) => {
            const waUrl = generateWhatsAppUrl(
              patient.phone,
              `¡Muy feliz cumpleaños ${patient.fullName}! Te deseamos un excelente día.`
            );
            return (
              <div
                key={patient.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                    {patient.photoDataUrl ? (
                      <img
                        src={patient.photoDataUrl}
                        alt={patient.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {patient.fullName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {patient.birthDate ? formatBirthDateDisplay(patient.birthDate) : nextDateLabel}
                      {currentAge !== null ? ` · ${currentAge} años` : ''}
                      {patient.phone ? ` · ${patient.phone}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0">
                  <span
                    className={`text-xs font-mono tabular-nums font-semibold ${
                      daysUntil === 0
                        ? 'text-teal-700 dark:text-teal-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {daysUntil === 0
                      ? 'Hoy cumple años'
                      : daysUntil === 1
                      ? 'Mañana'
                      : `En ${daysUntil} días (${nextDateLabel})`}
                  </span>

                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass({ variant: 'whatsapp', size: 'xs' })}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>Saludar</span>
                    </a>
                  )}

                  <Button
                    variant="subtle"
                    size="xs"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenPatient(patient.id)}
                  >
                    Ver ficha
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {birthdayEntries.length > 0 && (
        <Pagination
          currentPage={safeBirthdayPage}
          totalItems={birthdayEntries.length}
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
          itemLabel="cumpleaños"
        />
      )}
    </div>
  );
};

export const ProximoControlView: React.FC = () => {
  const { patients, selectPatient, setView, moduleQuery, setModuleQuery } = useAppStore();
  const filter: 'assigned' | 'overdue' | 'unassigned' =
    moduleQuery.status === 'overdue' || moduleQuery.status === 'unassigned'
      ? moduleQuery.status
      : 'assigned';
  const [query, setQuery] = useState('');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const page = moduleQuery.page || 1;
  const pageSize = moduleQuery.pageSize || 25;

  const todayStr = toLocalIsoDate();

  const counts = useMemo(() => {
    const assigned = patients.filter((p) => Boolean(p.nextControlDate));
    const overdue = assigned.filter((p) => (p.nextControlDate || '') < todayStr);
    const unassigned = patients.filter((p) => !p.nextControlDate);
    return {
      assigned: assigned.length,
      overdue: overdue.length,
      unassigned: unassigned.length,
    };
  }, [patients, todayStr]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .filter((p) => {
        if (filter === 'assigned' && !p.nextControlDate) return false;
        if (filter === 'overdue' && (!p.nextControlDate || p.nextControlDate >= todayStr)) {
          return false;
        }
        if (filter === 'unassigned' && p.nextControlDate) return false;
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          (p.nextControlNote || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.nextControlDate && b.nextControlDate) {
          return a.nextControlDate.localeCompare(b.nextControlDate);
        }
        if (a.nextControlDate) return -1;
        if (b.nextControlDate) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [patients, filter, query, todayStr]);

  const totalControlPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safeControlPage = Math.min(page, totalControlPages);
  const pagedPatients = useMemo(
    () =>
      filteredPatients.slice(
        (safeControlPage - 1) * pageSize,
        safeControlPage * pageSize
      ),
    [filteredPatients, safeControlPage, pageSize]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>
            Próximo Control
          </h1>
          <p className={pageSubtitleClass}>
            Seguimiento de fechas de próximo control asignadas a tus pacientes y recordatorios pendientes.
          </p>
        </div>

        <div className={`${segmentedTrackClass} w-full sm:w-auto`}>
          <button
            type="button"
            onClick={() => setModuleQuery({ status: undefined, page: undefined })}
            className={segmentedTabClass(filter === 'assigned')}
          >
            Asignados ({counts.assigned})
          </button>
          <button
            type="button"
            onClick={() => setModuleQuery({ status: 'overdue', page: undefined })}
            className={segmentedTabClass(filter === 'overdue')}
          >
            Vencidos ({counts.overdue})
          </button>
          <button
            type="button"
            onClick={() => setModuleQuery({ status: 'unassigned', page: undefined })}
            className={segmentedTabClass(filter === 'unassigned')}
          >
            Sin asignar ({counts.unassigned})
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (moduleQuery.page) setModuleQuery({ page: undefined });
          }}
          placeholder="Buscar por paciente, nota de control o teléfono..."
          className={searchInputClass}
        />
      </div>

      {filteredPatients.length === 0 ? (
        <div className={`${emptyStateClass} space-y-2`}>
          <CalendarCheck className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hay pacientes en esta vista de Próximo Control.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden`}>
          {pagedPatients.map((patient) => {
            const isOverdue = Boolean(
              patient.nextControlDate && patient.nextControlDate < todayStr
            );
            const waReminder = patient.nextControlDate
              ? generateWhatsAppUrl(
                  patient.phone,
                  `Hola ${patient.fullName}, te recordamos tu próximo control odontológico previsto para el ${formatBirthDateDisplay(
                    patient.nextControlDate
                  )}.`
                )
              : null;

            return (
              <div
                key={patient.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {patient.fullName}
                    </span>
                    {patient.nextControlDate ? (
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold ${
                          isOverdue
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {formatBirthDateDisplay(patient.nextControlDate)}
                        {isOverdue ? ' · Vencido' : ''}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">SIN ASIGNAR</span>
                    )}
                  </div>
                  {patient.nextControlNote && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {patient.nextControlNote}
                    </p>
                  )}
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {patient.phone || 'Sin teléfono'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0">
                  {waReminder && (
                    <a
                      href={waReminder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass({ variant: 'whatsapp', size: 'xs' })}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>Recordar</span>
                    </a>
                  )}

                  <Button
                    variant="soft"
                    size="xs"
                    icon={<CalendarPlus className="w-3.5 h-3.5" />}
                    onClick={() => setEditingPatient(patient)}
                  >
                    {patient.nextControlDate ? 'Modificar' : 'Asignar control'}
                  </Button>

                  <Button
                    variant="subtle"
                    size="xs"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => {
                      selectPatient(patient.id);
                      setView('patients-search');
                    }}
                  >
                    Ver ficha
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredPatients.length > 0 && (
        <Pagination
          currentPage={safeControlPage}
          totalItems={filteredPatients.length}
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
          itemLabel="pacientes"
        />
      )}

      {editingPatient && (
        <PatientNextControlModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
        />
      )}
    </div>
  );
};
