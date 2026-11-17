import React, { useState } from 'react';
import { CalendarCheck, X } from 'lucide-react';
import { Patient } from '../../core/types';
import { useAppStore } from '../../store/useAppStore';

interface PatientNextControlModalProps {
  patient: Patient;
  onClose: () => void;
}

export const PatientNextControlModal: React.FC<PatientNextControlModalProps> = ({
  patient,
  onClose,
}) => {
  const {
    updatePatient,
    createAppointment,
    professionals,
    activeProfessionalId,
    showToast,
  } = useAppStore();

  const [assigned, setAssigned] = useState(Boolean(patient.nextControlDate));
  const [controlDate, setControlDate] = useState(
    patient.nextControlDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [note, setNote] = useState(patient.nextControlNote || '');
  const [alsoAddToAgenda, setAlsoAddToAgenda] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeProf = professionals.find((p) => p.id === activeProfessionalId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nextDate = assigned && controlDate ? controlDate : undefined;
      await updatePatient(patient.id, {
        nextControlDate: nextDate,
        nextControlNote: note.trim() || undefined,
      });

      if (assigned && nextDate && alsoAddToAgenda) {
        await createAppointment({
          patientId: patient.id,
          patientName: patient.fullName,
          professionalId: activeProf?.id,
          professionalName: activeProf?.fullName,
          date: nextDate,
          startTime: '09:30',
          durationMin: 30,
          procedure: note.trim() ? `Próximo control: ${note.trim()}` : 'Próximo control odontológico',
          status: 'pending',
          notes: note.trim() || 'Control programado desde ficha del paciente.',
        });
      } else {
        showToast(
          nextDate ? `Próximo control guardado (${nextDate})` : 'Próximo control actualizado',
          'success'
        );
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Próximo Control
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Siguiente control:
              </span>
              <button
                type="button"
                onClick={() => setAssigned((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  assigned
                    ? 'border-teal-300 bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:border-teal-800 dark:text-teal-200'
                    : 'border-slate-200 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {assigned ? 'FECHA ASIGNADA' : 'SIN ASIGNAR'}
              </button>
            </div>

            {assigned && (
              <input
                type="date"
                value={controlDate}
                onChange={(e) => setControlDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-hidden focus:border-teal-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nota
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Control radiográfico post-endodoncia o profilaxis semestral..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500"
            />
          </div>

          {assigned && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoAddToAgenda}
                onChange={(e) => setAlsoAddToAgenda(e.target.checked)}
                className="accent-teal-600 rounded"
              />
              <span>Agendar también turno pendiente en Agenda</span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              CERRAR
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
