import React, { useEffect, useState } from 'react';
import { Save, UserPlus, ArrowLeft } from 'lucide-react';
import { extractPatientFromTranscript } from '../core/clinical/entityExtractor';
import { PatientDraftInput } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { VoiceIntakePanel } from './VoiceIntakePanel';

const EMPTY_FORM: PatientDraftInput = {
  fullName: '',
  dni: '',
  birthDate: '',
  age: '',
  gender: undefined,
  phone: '',
  secondaryPhone: '',
  email: '',
  address: '',
  groupTag: '',
  insuranceProvider: '',
  insuranceNumber: '',
  allergies: '',
  medicalHistory: '',
  chiefComplaint: '',
  notes: '',
  anamnesis: {},
  sourceSessionId: undefined,
};

const ANAMNESIS_FLAGS: Array<{ key: keyof NonNullable<PatientDraftInput['anamnesis']>; label: string }> = [
  { key: 'hypertension', label: 'Hipertensión arterial' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'heartCondition', label: 'Cardiopatías / Marcapasos' },
  { key: 'coagulationDisorder', label: 'Trastornos de coagulación' },
  { key: 'anesthesiaReaction', label: 'Reacción adversa a anestesia' },
  { key: 'bruxism', label: 'Bruxismo / Dolor ATM' },
  { key: 'smoking', label: 'Tabaquismo' },
  { key: 'pregnancy', label: 'Embarazo / Lactancia' },
  { key: 'infectiousHistory', label: 'Antecedentes infecciosos' },
  { key: 'takesMedication', label: 'Toma medicación habitual' },
];

export const PatientFormView: React.FC = () => {
  const {
    patients,
    editingPatientId,
    voiceIntakeDraft,
    clearVoiceIntakeDraft,
    createPatient,
    updatePatient,
    setView,
    showToast,
  } = useAppStore();

  const editingPatient = editingPatientId
    ? patients.find((p) => p.id === editingPatientId)
    : undefined;

  const [form, setForm] = useState<PatientDraftInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Sync form when editing an existing patient
  useEffect(() => {
    if (editingPatient) {
      setForm({
        fullName: editingPatient.fullName || '',
        dni: editingPatient.dni || '',
        birthDate: editingPatient.birthDate || '',
        age: editingPatient.age || '',
        gender: editingPatient.gender,
        phone: editingPatient.phone || '',
        secondaryPhone: editingPatient.secondaryPhone || '',
        email: editingPatient.email || '',
        address: editingPatient.address || '',
        groupTag: editingPatient.groupTag || '',
        insuranceProvider: editingPatient.insuranceProvider || '',
        insuranceNumber: editingPatient.insuranceNumber || '',
        allergies: editingPatient.allergies || '',
        medicalHistory: editingPatient.medicalHistory || '',
        chiefComplaint: editingPatient.chiefComplaint || '',
        notes: editingPatient.notes || '',
        anamnesis: editingPatient.anamnesis || {},
        physicalExam: editingPatient.physicalExam,
        nextControlDate: editingPatient.nextControlDate,
        nextControlNote: editingPatient.nextControlNote,
        photoDataUrl: editingPatient.photoDataUrl,
        sourceSessionId: editingPatient.sourceSessionId,
      });
    } else if (voiceIntakeDraft?.target === 'patient' && voiceIntakeDraft.extractedPatient) {
      const ext = voiceIntakeDraft.extractedPatient;
      setForm({
        ...EMPTY_FORM,
        ...ext,
        anamnesis: {},
        sourceSessionId: voiceIntakeDraft.sessionId,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingPatient?.id, voiceIntakeDraft?.createdAt]);

  const handleExtractFromText = (text: string, sessionId?: string) => {
    const extracted = extractPatientFromTranscript(text);
    setForm((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(extracted).filter(([, val]) => Boolean(val && String(val).trim()))
      ),
      sourceSessionId: sessionId || prev.sourceSessionId,
    }));
    showToast('Campos del paciente completados desde el dictado', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      showToast('El nombre completo del paciente es obligatorio.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload: PatientDraftInput = {
        ...form,
        anamnesis: {
          ...(form.anamnesis || {}),
          updatedAt: Date.now(),
        },
      };
      if (editingPatient) {
        await updatePatient(editingPatient.id, payload);
        setView('patients-search');
      } else {
        const created = await createPatient(payload);
        if (created) {
          setForm(EMPTY_FORM);
          setView('patients-search');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          {editingPatient && (
            <button
              type="button"
              onClick={() => setView('patients-search')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {editingPatient ? `Editar paciente · ${editingPatient.fullName}` : 'Nuevo paciente'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Registra la historia clínica inicial manualmente o dictando por voz para autocompletar la ficha.
            </p>
          </div>
        </div>
      </div>

      {/* Voice Auto-fill Assistant */}
      {!editingPatient && (
        <VoiceIntakePanel
          target="patient"
          onExtractText={handleExtractFromText}
          onClearDraft={() => {
            clearVoiceIntakeDraft();
            setForm(EMPTY_FORM);
          }}
        />
      )}

      {/* Patient EMR Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-6"
      >
        {/* Identificación */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Datos personales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Nombre y apellido *</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ej: María Fernanda Gómez"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>DNI / Cédula</label>
              <input
                type="text"
                value={form.dni || ''}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                placeholder="Ej: 34.567.890"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelClass}>Edad</label>
                <input
                  type="text"
                  value={form.age || ''}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="33"
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className={labelClass}>Nacimiento</label>
                <input
                  type="date"
                  value={form.birthDate || ''}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contacto y Cobertura */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Contacto y cobertura médica
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Teléfono móvil / WhatsApp</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 099 412 890"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono particular</label>
              <input
                type="tel"
                value={form.secondaryPhone || ''}
                onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                placeholder="Ej: 2708 4412"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label className={labelClass}>Sexo</label>
              <div className="flex items-center gap-3 pt-1.5">
                {(['F', 'M', 'X'] as const).map((g) => (
                  <label key={g} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="patient-gender"
                      checked={form.gender === g}
                      onChange={() => setForm({ ...form, gender: g })}
                      className="accent-teal-600"
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="paciente@ejemplo.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Domicilio</label>
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle, número, localidad"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Obra social / Prepaga</label>
              <input
                type="text"
                value={form.insuranceProvider || ''}
                onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                placeholder="Ej: OSDE 310 / Swiss Medical / Particular"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>N° de afiliado</label>
              <input
                type="text"
                value={form.insuranceNumber || ''}
                onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })}
                placeholder="N° de credencial"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
          </div>
        </div>

        {/* Antecedentes y Cuestionario Anamnesis */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Anamnesis y antecedentes clínicos
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            {ANAMNESIS_FLAGS.map((flag) => {
              const checked = Boolean(form.anamnesis?.[flag.key]);
              return (
                <label
                  key={flag.key}
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        anamnesis: {
                          ...(form.anamnesis || {}),
                          [flag.key]: e.target.checked,
                        },
                      })
                    }
                    className="accent-teal-600 rounded"
                  />
                  <span>{flag.label}</span>
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Alergias conocidas</label>
              <input
                type="text"
                value={form.allergies || ''}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="Ej: Penicilina, látex, anestésicos o sin alergias"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Medicación / Antecedentes médicos</label>
              <input
                type="text"
                value={form.medicalHistory || ''}
                onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })}
                placeholder="Ej: Losartán 50mg, anticoagulantes, diabetes"
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Motivo de consulta inicial</label>
              <textarea
                rows={2}
                value={form.chiefComplaint || ''}
                onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                placeholder="Motivo principal de ingreso o síntomas referidos..."
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Notas clínicas adicionales</label>
              <textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones, piezas FDI detectadas o resumen de dictado..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              clearVoiceIntakeDraft();
              if (editingPatient) setView('patients-search');
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
          >
            {editingPatient ? 'Cancelar' : 'Limpiar formulario'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs min-h-[40px]"
          >
            {editingPatient ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{editingPatient ? 'Guardar cambios' : 'Registrar paciente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
