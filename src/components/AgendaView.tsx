import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Mic,
  Trash2,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Mail,
  CalendarPlus,
  Download,
  AlertTriangle,
  Cake,
  X,
} from 'lucide-react';
import {
  buildAppointmentIcs,
  generateAppointmentMailtoUrl,
  generateGoogleCalendarUrl,
  generateWhatsAppUrl,
  getPatientPendingLabAlerts,
  getUpcomingBirthdays,
} from '../core/clinic/clinicHelpers';
import { Appointment, AppointmentStatus } from '../core/types';
import { useAppStore } from '../store/useAppStore';

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const STATUS_LABELS: Record<AppointmentStatus, { label: string; textClass: string }> = {
  pending: { label: 'Pendiente', textClass: 'text-amber-700 dark:text-amber-300' },
  confirmed: { label: 'Confirmado', textClass: 'text-teal-700 dark:text-teal-300' },
  waiting: { label: 'En sala de espera', textClass: 'text-indigo-700 dark:text-indigo-300' },
  in_progress: { label: 'En atención', textClass: 'text-blue-700 dark:text-blue-300' },
  completed: { label: 'Completado', textClass: 'text-emerald-700 dark:text-emerald-300' },
  cancelled: { label: 'Cancelado', textClass: 'text-rose-700 dark:text-rose-300' },
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const AgendaView: React.FC = () => {
  const {
    appointments,
    patients,
    providers,
    professionals,
    labOrders,
    activeProfessionalId,
    selectedAgendaDate,
    setAgendaDate,
    createAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    captureAppointmentFromTranscript,
    startRecording,
    openConfirm,
    showToast,
  } = useAppStore();

  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [professionalFilter, setProfessionalFilter] = useState<string>(
    activeProfessionalId || 'all'
  );
  const [filterCustomized, setFilterCustomized] = useState(false);
  const [cursorYear, setCursorYear] = useState(today.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [capturePatientId, setCapturePatientId] = useState('');

  useEffect(() => {
    if (!filterCustomized && activeProfessionalId) {
      setProfessionalFilter(activeProfessionalId);
    }
  }, [activeProfessionalId, filterCustomized]);

  useEffect(() => {
    if (!selectedAgendaDate) return;
    const parsed = new Date(`${selectedAgendaDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setSelectedDate(selectedAgendaDate);
      setCursorYear(parsed.getFullYear());
      setCursorMonth(parsed.getMonth());
    }
    setAgendaDate(null);
  }, [selectedAgendaDate, setAgendaDate]);

  // Appointment Form State
  const [patientId, setPatientId] = useState('');
  const [patientNameInput, setPatientNameInput] = useState('');
  const [providerId, setProviderId] = useState('');
  const [professionalId, setProfessionalId] = useState(activeProfessionalId || '');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState(30);
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');

  const activeProfessional = useMemo(
    () => professionals.find((pr) => pr.id === activeProfessionalId) || null,
    [professionals, activeProfessionalId]
  );

  const filteredAppointments = useMemo(() => {
    if (professionalFilter === 'all') return appointments;
    const isViewingOwner =
      professionals.find((pr) => pr.id === professionalFilter)?.role === 'owner';
    return appointments.filter(
      (a) => a.professionalId === professionalFilter || (isViewingOwner && !a.professionalId)
    );
  }, [appointments, professionalFilter, professionals]);

  // Calendar grid calculation (Monday-first)
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(cursorYear, cursorMonth, 1);
    const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    const startOffset = (firstOfMonth.getDay() + 6) % 7;

    const cells: Array<{ dateKey: string; dayNum: number; inMonth: boolean }> = [];

    const prevMonthLastDay = new Date(cursorYear, cursorMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dateObj = new Date(cursorYear, cursorMonth - 1, d);
      cells.push({ dateKey: toDateKey(dateObj), dayNum: d, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(cursorYear, cursorMonth, d);
      cells.push({ dateKey: toDateKey(dateObj), dayNum: d, inMonth: true });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(cursorYear, cursorMonth + 1, d);
      cells.push({ dateKey: toDateKey(dateObj), dayNum: d, inMonth: false });
    }

    return cells;
  }, [cursorYear, cursorMonth]);

  // Week days around selectedDate
  const weekDays = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    const offset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - offset);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return {
        dateKey: toDateKey(d),
        label: WEEKDAYS_ES[idx],
        dayNum: d.getDate(),
      };
    });
  }, [selectedDate]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filteredAppointments.forEach((appt) => {
      const existing = map.get(appt.date) || [];
      existing.push(appt);
      map.set(appt.date, existing);
    });
    return map;
  }, [filteredAppointments]);

  const selectedDayAppointments = useMemo(() => {
    return (appointmentsByDate.get(selectedDate) || []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }, [appointmentsByDate, selectedDate]);

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(patients, 14), [patients]);

  const prevMonth = () => {
    if (cursorMonth === 0) {
      setCursorMonth(11);
      setCursorYear((y) => y - 1);
    } else {
      setCursorMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (cursorMonth === 11) {
      setCursorMonth(0);
      setCursorYear((y) => y + 1);
    } else {
      setCursorMonth((m) => m + 1);
    }
  };

  const handleOpenNewModal = () => {
    setPatientId('');
    setPatientNameInput('');
    setProviderId('');
    setProfessionalId(activeProfessionalId || professionals[0]?.id || '');
    setStartTime('09:30');
    setDurationMin(30);
    setProcedure('');
    setNotes('');
    setShowNewModal(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenPatient = patients.find((p) => p.id === patientId);
    const resolvedName = chosenPatient?.fullName || patientNameInput.trim();
    if (!resolvedName || !procedure.trim()) {
      showToast('Completa el nombre del paciente y el motivo del turno.', 'warning');
      return;
    }

    const chosenProvider = providers.find((pr) => pr.id === providerId);
    const chosenProfessional = professionals.find((pr) => pr.id === professionalId);
    await createAppointment({
      patientId: chosenPatient?.id,
      patientName: resolvedName,
      providerId: chosenProvider?.id,
      providerName: chosenProvider?.name,
      professionalId: chosenProfessional?.id,
      professionalName: chosenProfessional?.fullName,
      date: selectedDate,
      startTime,
      durationMin,
      procedure: procedure.trim(),
      status: 'confirmed',
      notes: notes.trim() || undefined,
    });
    setShowNewModal(false);
  };

  const handleDownloadIcs = (appt: Appointment) => {
    const ics = buildAppointmentIcs(appt);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turno_${appt.date}_${appt.startTime.replace(':', '')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formattedSelectedDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const renderAppointmentCard = (appt: Appointment) => {
    const statusInfo = STATUS_LABELS[appt.status];
    const patient = patients.find(
      (p) =>
        (appt.patientId && p.id === appt.patientId) ||
        p.fullName.toLowerCase() === appt.patientName.toLowerCase()
    );
    const pendingLabAlerts = getPatientPendingLabAlerts(
      appt.patientId || patient?.id,
      appt.patientName,
      labOrders
    );
    const profObj = professionals.find((pr) => pr.id === appt.professionalId);

    const reminderMsg = `Hola ${appt.patientName}, te recordamos tu turno odontológico el ${appt.date} a las ${appt.startTime} hs (${appt.procedure}). ¡Te esperamos!`;
    const waUrl = generateWhatsAppUrl(patient?.phone, reminderMsg);
    const mailUrl = generateAppointmentMailtoUrl(
      patient?.email,
      `Recordatorio de turno · ${appt.date} ${appt.startTime}`,
      reminderMsg
    );
    const gcalUrl = generateGoogleCalendarUrl(appt);

    return (
      <div key={appt.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {appt.startTime}
              </span>
              <span aria-hidden="true">·</span>
              <span>{appt.durationMin} min</span>
              <span aria-hidden="true">·</span>
              <span className={`font-sans font-semibold ${statusInfo.textClass}`}>
                {statusInfo.label}
              </span>
              {appt.autoCaptured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans text-teal-700 dark:text-teal-300">
                    Captado por voz
                  </span>
                </>
              )}
            </div>

            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
              {profObj && (
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: profObj.agendaColor }}
                  title={profObj.fullName}
                />
              )}
              <span>{appt.patientName}</span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300">
              {appt.procedure}
              {appt.professionalName ? ` · Prof: ${appt.professionalName}` : ''}
              {appt.providerName ? ` · Lab: ${appt.providerName}` : ''}
            </div>

            {pendingLabAlerts.length > 0 && (
              <div className="mt-1.5 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Alerta laboratorio: {pendingLabAlerts[0].workType}
                  {pendingLabAlerts[0].toothFdi ? ` (${pendingLabAlerts[0].toothFdi})` : ''} aún{' '}
                  {pendingLabAlerts[0].status === 'sin_enviar' ? 'sin enviar' : 'en laboratorio'}.
                </span>
              </div>
            )}

            {appt.notes && <p className="text-[11px] text-slate-400 mt-1">{appt.notes}</p>}
          </div>

          <button
            type="button"
            onClick={() =>
              openConfirm({
                title: '¿Eliminar turno?',
                description: `Se eliminará el turno de ${appt.patientName} (${appt.date} ${appt.startTime}).`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                isDestructive: true,
                onConfirm: () => deleteAppointment(appt.id),
              })
            }
            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
            title="Eliminar turno"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={appt.status}
            onChange={(e) =>
              updateAppointmentStatus(appt.id, e.target.value as AppointmentStatus)
            }
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="waiting">En sala de espera</option>
            <option value="in_progress">En atención</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <button
            type="button"
            onClick={() =>
              startRecording(appt.patientName, true, {
                patientId: appt.patientId,
                intakeTarget: 'consultation',
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
          >
            <Mic className="w-3 h-3" />
            <span>Dictar</span>
          </button>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70"
              title="Enviar recordatorio por WhatsApp"
            >
              <MessageCircle className="w-3 h-3" />
              <span>WhatsApp</span>
            </a>
          )}

          {mailUrl && (
            <a
              href={mailUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
              title="Enviar recordatorio por Email"
            >
              <Mail className="w-3 h-3" />
              <span>Email</span>
            </a>
          )}

          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
            title="Agregar a Google Calendar"
          >
            <CalendarPlus className="w-3 h-3" />
            <span>Google Cal</span>
          </a>

          <button
            type="button"
            onClick={() => handleDownloadIcs(appt)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
            title="Descargar archivo .ics"
          >
            <Download className="w-3 h-3" />
            <span>.ics</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Agenda y calendario{activeProfessional ? ` · ${activeProfessional.fullName}` : ''}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Turnos asignados al profesional activo, sala de espera, control de cancelaciones y captura automática desde dictado clínico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setCursorYear(today.getFullYear());
              setCursorMonth(today.getMonth());
              setSelectedDate(todayKey);
            }}
            className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={() => {
              setCaptureText('');
              setCapturePatientId('');
              setShowCaptureModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors min-h-[40px] whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Captar de conversación</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar turno</span>
          </button>
        </div>
      </div>

      {/* Automatic Voice-to-Agenda Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
          <Mic className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 dark:text-slate-100">Agenda inteligente por voz:</strong>{' '}
            al dictar una consulta y mencionar una fecha y horario (ej.{' '}
            <em>"nos vemos el próximo martes a las 15:30 para control de endodoncia"</em>), el turno se crea automáticamente en tu calendario.
          </span>
        </div>
        <button
          type="button"
          onClick={() => startRecording('', true, { intakeTarget: 'consultation' })}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shrink-0"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Dictar ahora</span>
        </button>
      </div>

      {/* View Mode Switch + Professional Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 text-xs self-start">
          {[
            { id: 'month' as const, label: 'Mes' },
            { id: 'week' as const, label: 'Semana' },
            { id: 'day' as const, label: 'Día' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id)}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === m.id
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {professionals.length > 0 && (
            <select
              value={professionalFilter}
              onChange={(e) => {
                setFilterCustomized(true);
                setProfessionalFilter(e.target.value);
              }}
              className="px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
            >
              {professionals.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.id === activeProfessionalId ? `Mi agenda · ${pr.fullName}` : pr.fullName}
                </option>
              ))}
              <option value="all">Toda la clínica (todos los profesionales)</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'week' ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Semana del {weekDays[0].dateKey} al {weekDays[6].dateKey}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(`${selectedDate}T12:00:00`);
                  d.setDate(d.getDate() - 7);
                  setSelectedDate(toDateKey(d));
                }}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(`${selectedDate}T12:00:00`);
                  d.setDate(d.getDate() + 7);
                  setSelectedDate(toDateKey(d));
                }}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((wd) => {
              const items = (appointmentsByDate.get(wd.dateKey) || []).sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              );
              const isSelected = wd.dateKey === selectedDate;
              return (
                <div
                  key={wd.dateKey}
                  onClick={() => setSelectedDate(wd.dateKey)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors space-y-2 min-h-[160px] ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/40 dark:bg-teal-950/30'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{wd.label}</span>
                    <span className="font-mono tabular-nums text-slate-500">{wd.dateKey.slice(5)}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-4 text-center">Libre</div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((ap) => (
                        <div
                          key={ap.id}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-[11px] space-y-0.5"
                        >
                          <div className="font-mono tabular-nums font-bold text-teal-700 dark:text-teal-300">
                            {ap.startTime} · {STATUS_LABELS[ap.status].label}
                          </div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {ap.patientName}
                          </div>
                          <div className="text-slate-500 truncate">{ap.procedure}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {viewMode === 'month' && (
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {MONTHS_ES[cursorMonth]} {cursorYear}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 pb-1">
              {WEEKDAYS_ES.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((cell) => {
                const dayAppts = (appointmentsByDate.get(cell.dateKey) || []).filter(
                  (a) => a.status !== 'cancelled'
                );
                const isSelected = cell.dateKey === selectedDate;
                const isToday = cell.dateKey === todayKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateKey)}
                    className={`min-h-[64px] p-2 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 text-teal-900 dark:text-teal-100'
                        : cell.inMonth
                        ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                        : 'bg-transparent border-transparent text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday
                          ? 'font-bold text-teal-600 dark:text-teal-400 underline underline-offset-4'
                          : 'font-medium'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {dayAppts.length > 0 && (
                      <span className="text-[10px] font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-300 truncate">
                        {dayAppts.length} {dayAppts.length === 1 ? 'turno' : 'turnos'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Selected Day Agenda */}
        <section
          className={`${
            viewMode === 'month' ? 'lg:col-span-5' : 'lg:col-span-12'
          } bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4`}
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-400">Turnos del día</div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                {formattedSelectedDate}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'day' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                />
              )}
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {selectedDayAppointments.length} registrados
              </span>
            </div>
          </div>

          {selectedDayAppointments.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDayAppointments.map(renderAppointmentCard)}
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <CalendarDays className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No hay turnos agendados para este día.
              </p>
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 transition-colors"
              >
                Agregar turno el {selectedDate}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Upcoming Patient Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Cake className="w-4 h-4 text-teal-600" />
            <span>Próximos cumpleaños de pacientes (14 días)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {upcomingBirthdays.map(({ patient, daysUntil, nextDateLabel }) => {
              const bdayUrl = generateWhatsAppUrl(
                patient.phone,
                `¡Muy feliz cumpleaños ${patient.fullName}! Te deseamos lo mejor desde OdontoHelper.`
              );
              return (
                <div
                  key={patient.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 text-xs"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {patient.fullName}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {daysUntil === 0 ? 'Hoy' : `${nextDateLabel} (${daysUntil}d)`}
                  </span>
                  {bdayUrl && (
                    <a
                      href={bdayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-300 font-semibold hover:underline"
                    >
                      Saludar
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal: Agendar Nuevo Turno */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Agendar turno · {selectedDate}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vincula un paciente, asigna profesional y registra el motivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              {patients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Paciente registrado
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => {
                      setPatientId(e.target.value);
                      const p = patients.find((item) => item.id === e.target.value);
                      if (p) setPatientNameInput(p.fullName);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Seleccionar o escribir abajo --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.dni ? `(DNI ${p.dni})` : ''}
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
                  placeholder="Ej: Sofía Martínez"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hora de inicio
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Duración (minutos)
                  </label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              {professionals.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Profesional que atiende
                  </label>
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Sin asignar</option>
                    {professionals.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.fullName} {pr.specialty ? `(${pr.specialty})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tratamiento / Motivo *
                </label>
                <input
                  type="text"
                  required
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  placeholder="Ej: Control endodoncia 3.6, limpieza, toma de impresión"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {providers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor / Laboratorio (Opcional)
                  </label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Ninguno</option>
                    {providers.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas breves para la atención..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar turno</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Captar Turno desde Conversación */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Captar fecha desde conversación
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escribí o pegá la frase de la consulta; la agenda detectará día, hora y motivo automáticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCaptureModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const chosen = patients.find((p) => p.id === capturePatientId);
                const created = await captureAppointmentFromTranscript(captureText, {
                  patientId: chosen?.id,
                  patientName: chosen?.fullName,
                });
                if (created) {
                  setSelectedDate(created.date);
                  const d = new Date(`${created.date}T12:00:00`);
                  if (!Number.isNaN(d.getTime())) {
                    setCursorYear(d.getFullYear());
                    setCursorMonth(d.getMonth());
                  }
                  setShowCaptureModal(false);
                }
              }}
              className="space-y-4"
            >
              {patients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Paciente (opcional, si no está nombrado en el texto)
                  </label>
                  <select
                    value={capturePatientId}
                    onChange={(e) => setCapturePatientId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Detectar del texto o genérico</option>
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
                  Frase o extracto de la conversación *
                </label>
                <textarea
                  rows={3}
                  required
                  value={captureText}
                  onChange={(e) => setCaptureText(e.target.value)}
                  placeholder="Ej: Paciente Lucía Fernández, nos vemos el próximo martes a las 15:30 para control de endodoncia en pieza 3.6."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCaptureModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Detectar y agendar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
