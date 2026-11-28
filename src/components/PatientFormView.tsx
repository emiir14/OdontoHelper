import React, { useEffect, useRef, useState } from 'react';
import { Save, UserPlus, ArrowLeft, RotateCcw } from 'lucide-react';
import { extractPatientFromTranscript } from '../core/clinical/entityExtractor';
import { PatientDraftInput } from '../core/types';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from '../core/utils/localDrafts';
import { useAppStore } from '../store/useAppStore';
import { VoiceIntakePanel } from './VoiceIntakePanel';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { Button } from './ui/Button';
import {
  cardClass,
  inputClass,
  labelClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
} from './ui/uiClasses';

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
    setDraftDirty,
    guardNavigation,
  } = useAppStore();

  const editingPatient = editingPatientId
    ? patients.find((p) => p.id === editingPatientId)
    : undefined;

  const draftKey = `patient_form:${editingPatient?.id || 'new'}`;
  const dirtyKey = `patient_form:${editingPatient?.id || 'new'}`;
  const dirtyLabel = editingPatient ? `Edición de ${editingPatient.fullName}` : 'Nuevo paciente';

  const [form, setForm] = useState<PatientDraftInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const baselineSnapshotRef = useRef<string>(JSON.stringify(EMPTY_FORM));
  const baselineFormRef = useRef<PatientDraftInput>(EMPTY_FORM);
  const initializedKeyRef = useRef<string>('');

  // Sync form when editing an existing patient, recovering any auto-saved local draft
  useEffect(() => {
    const initialForm: PatientDraftInput = editingPatient
      ? {
          fullName: editingPatient.fullName || '',
          dni: editingPatient.dni || '',
          documentType: editingPatient.documentType,
          birthDate: editingPatient.birthDate || '',
          age: editingPatient.age || '',
          gender: editingPatient.gender,
          phone: editingPatient.phone || '',
          secondaryPhone: editingPatient.secondaryPhone || '',
          email: editingPatient.email || '',
          address: editingPatient.address || '',
          groupTag: editingPatient.groupTag || '',
          occupation: editingPatient.occupation || '',
          maritalStatus: editingPatient.maritalStatus || '',
          emergencyContactName: editingPatient.emergencyContactName || '',
          emergencyContactPhone: editingPatient.emergencyContactPhone || '',
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
        }
      : voiceIntakeDraft?.target === 'patient' && voiceIntakeDraft.extractedPatient
      ? {
          ...EMPTY_FORM,
          ...voiceIntakeDraft.extractedPatient,
          anamnesis: {},
          sourceSessionId: voiceIntakeDraft.sessionId,
        }
      : EMPTY_FORM;

    baselineFormRef.current = initialForm;
    baselineSnapshotRef.current = JSON.stringify(initialForm);
    initializedKeyRef.current = draftKey;

    if (!(voiceIntakeDraft?.target === 'patient' && voiceIntakeDraft.extractedPatient)) {
      const savedDraft = loadLocalDraft<PatientDraftInput>(draftKey);
      if (savedDraft?.data && JSON.stringify(savedDraft.data) !== baselineSnapshotRef.current) {
        setForm(savedDraft.data);
        setRestoredDraftAt(savedDraft.updatedAt);
        setIsDirty(true);
        setDraftDirty(dirtyKey, dirtyLabel);
      } else {
        setForm(initialForm);
        setRestoredDraftAt(null);
        setIsDirty(false);
        setDraftDirty(dirtyKey, null);
      }
    } else {
      setForm(initialForm);
      setRestoredDraftAt(null);
      setIsDirty(true);
      setDraftDirty(dirtyKey, dirtyLabel);
    }

    return () => {
      setDraftDirty(dirtyKey, null);
    };
  }, [editingPatient?.id, voiceIntakeDraft?.createdAt, draftKey, dirtyKey]);

  // Persist unsaved edits locally & update dirty state
  useEffect(() => {
    if (initializedKeyRef.current !== draftKey) return;
    const dirty = JSON.stringify(form) !== baselineSnapshotRef.current;
    setIsDirty(dirty);
    if (dirty) {
      saveLocalDraft(draftKey, form);
      setDraftDirty(dirtyKey, dirtyLabel);
    } else {
      clearLocalDraft(draftKey);
      setRestoredDraftAt(null);
      setDraftDirty(dirtyKey, null);
    }
  }, [form, draftKey, dirtyKey, dirtyLabel, setDraftDirty]);

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
        clearLocalDraft(draftKey);
        setDraftDirty(dirtyKey, null);
        setIsDirty(false);
        setRestoredDraftAt(null);
        setView('patients-search');
      } else {
        const created = await createPatient(payload);
        if (created) {
          clearLocalDraft(draftKey);
          setDraftDirty(dirtyKey, null);
          setIsDirty(false);
          setRestoredDraftAt(null);
          baselineFormRef.current = EMPTY_FORM;
          baselineSnapshotRef.current = JSON.stringify(EMPTY_FORM);
          setForm(EMPTY_FORM);
          setView('patients-search');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = () => {
    clearLocalDraft(draftKey);
    setDraftDirty(dirtyKey, null);
    setRestoredDraftAt(null);
    setIsDirty(false);
    setForm(baselineFormRef.current);
    showToast('Borrador local descartado', 'info');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className={pageHeaderClass}>
        <div className="flex items-center gap-3">
          {editingPatient && (
            <Button
              variant="icon"
              size="md"
              onClick={() => guardNavigation(() => setView('patients-search'))}
              aria-label="Volver a pacientes"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className={pageTitleClass}>
              {editingPatient ? `Editar paciente · ${editingPatient.fullName}` : 'Nuevo paciente'}
            </h1>
            <p className={pageSubtitleClass}>
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
        className={`${cardClass} p-4 sm:p-6 space-y-6`}
      >
        {(restoredDraftAt || isDirty) && (
          <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              {restoredDraftAt
                ? 'Se recuperó un borrador local sin guardar de este paciente.'
                : 'Borrador guardado localmente en este dispositivo (falta confirmar los cambios).'}
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Descartar borrador</span>
            </button>
          </div>
        )}
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
              <label className={labelClass}>Tipo de documento</label>
              <select
                value={form.documentType || 'CI'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    documentType: e.target.value as PatientDraftInput['documentType'],
                  })
                }
                className={inputClass}
              >
                {(['CI', 'DNI', 'Pasaporte', 'Otro'] as const).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Cédula de identidad</label>
              <input
                type="text"
                value={form.dni || ''}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                placeholder="Ej: 3.456.789-0"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
              <div className="flex flex-wrap items-center gap-3 pt-1.5">
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
              <AutoResizeTextarea
                minRows={1}
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle, número, localidad"
              />
            </div>

            <div>
              <label className={labelClass}>Obra social / Prepaga</label>
              <input
                type="text"
                value={form.insuranceProvider || ''}
                onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                placeholder="FONASA / Mutualista / ASSE / Particular"
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

            <div>
              <label className={labelClass}>Ocupación</label>
              <input
                type="text"
                value={form.occupation || ''}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                placeholder="Ej: Docente"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estado civil</label>
              <input
                type="text"
                value={form.maritalStatus || ''}
                onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                placeholder="Ej: Casada/o"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Contacto de emergencia</label>
              <input
                type="text"
                value={form.emergencyContactName || ''}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="Nombre y vínculo"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono de emergencia</label>
              <input
                type="tel"
                value={form.emergencyContactPhone || ''}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="Ej: 098 123 456"
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
              <AutoResizeTextarea
                minRows={1}
                value={form.allergies || ''}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="Ej: Penicilina, látex, anestésicos o sin alergias"
              />
            </div>

            <div>
              <label className={labelClass}>Medicación / Antecedentes médicos</label>
              <AutoResizeTextarea
                minRows={1}
                value={form.medicalHistory || ''}
                onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })}
                placeholder="Ej: Losartán 50mg, anticoagulantes, diabetes"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Motivo de consulta inicial</label>
              <AutoResizeTextarea
                minRows={2}
                value={form.chiefComplaint || ''}
                onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                placeholder="Motivo principal de ingreso o síntomas referidos..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Notas clínicas adicionales</label>
              <AutoResizeTextarea
                minRows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones, piezas FDI detectadas o resumen de dictado..."
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => {
              if (editingPatient) {
                guardNavigation(() => setView('patients-search'));
              } else {
                clearLocalDraft(draftKey);
                setDraftDirty(dirtyKey, null);
                setRestoredDraftAt(null);
                setIsDirty(false);
                setForm(EMPTY_FORM);
                clearVoiceIntakeDraft();
              }
            }}
          >
            {editingPatient ? 'Cancelar' : 'Limpiar formulario'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={saving}
            icon={editingPatient ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          >
            {editingPatient ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </div>
      </form>
    </div>
  );
};
