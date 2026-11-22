import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Patient } from '../../core/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { inputClass, inputMonoClass, labelClass } from '../ui/uiClasses';

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
    <Modal
      onClose={onClose}
      size="md"
      title="Próximo Control"
      subtitle={patient.fullName}
      icon={<CalendarCheck className="w-4 h-4 text-teal-600" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" form="next-control-form" variant="primary" loading={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="next-control-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Siguiente control:
            </span>
            <Button
              variant={assigned ? 'soft' : 'subtle'}
              size="xs"
              onClick={() => setAssigned((v) => !v)}
            >
              {assigned ? 'Fecha asignada' : 'Sin asignar'}
            </Button>
          </div>

          {assigned && (
            <input
              type="date"
              value={controlDate}
              onChange={(e) => setControlDate(e.target.value)}
              required
              className={inputMonoClass}
            />
          )}
        </div>

        <div>
          <label className={labelClass}>Nota</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Control radiográfico post-endodoncia o profilaxis semestral..."
            className={inputClass}
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
      </form>
    </Modal>
  );
};
