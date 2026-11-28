import React from 'react';
import {
  CLINICAL_CONSULTATION_TYPES,
  CLINICAL_DOCUMENT_TYPES,
  CLINICAL_TEMPLATES,
} from '../core/clinical/clinicalTemplates';
import {
  ClinicalNote,
  ClinicalNoteConsultationType,
  ClinicalNoteDocumentType,
  ClinicalNotePatient,
  ClinicalTemplateId,
  Patient,
  Session,
} from '../core/types';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';

const inputClass =
  'mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500';
const labelClass = 'text-xs font-medium text-slate-700 dark:text-slate-300';

interface SectionProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, hint, children }) => (
  <section className="space-y-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4">
    <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
        {title}
      </h3>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
    </div>
    {children}
  </section>
);

export interface ClinicalRecordFormProps {
  note: ClinicalNote;
  onChange: (updater: (prev: ClinicalNote) => ClinicalNote) => void;
  patients: Patient[];
  session: Session;
  onSelectPatient: (patientId: string) => void;
}

export const ClinicalRecordForm: React.FC<ClinicalRecordFormProps> = ({
  note,
  onChange,
  patients,
  session,
  onSelectPatient,
}) => {
  const setNote = <K extends keyof ClinicalNote>(key: K, value: ClinicalNote[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));

  const setPatient = <K extends keyof ClinicalNotePatient>(
    key: K,
    value: ClinicalNotePatient[K]
  ) =>
    onChange((prev) => ({
      ...prev,
      patient: {
        ...(prev.patient || { fullName: session.reference || '' }),
        [key]: value,
      },
    }));

  const patient = note.patient;

  return (
    <div className="space-y-4">
      <Section title="Plantilla odontológica" hint="La plantilla orienta el procedimiento y las indicaciones.">
        <div className="flex flex-wrap gap-1.5">
          {CLINICAL_TEMPLATES.map((tpl) => {
            const active = note.templateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setNote('templateId', tpl.id as ClinicalTemplateId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[36px] cursor-pointer ${
                  active
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tpl.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Datos del paciente"
        hint="Si no hay paciente vinculado, al guardar la ficha se crea uno nuevo automáticamente."
      >
        <div>
          <label className={labelClass}>Paciente vinculado</label>
          <select
            value={patient?.patientId || ''}
            onChange={(e) => onSelectPatient(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin paciente vinculado · crear nuevo al guardar</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.dni ? ` · CI ${p.dni}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nombre y apellido *</label>
            <input
              type="text"
              value={patient?.fullName || ''}
              onChange={(e) => setPatient('fullName', e.target.value)}
              placeholder="Ej: María Fernanda Gómez"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tipo de documento</label>
            <select
              value={patient?.documentType || 'CI'}
              onChange={(e) =>
                setPatient('documentType', e.target.value as ClinicalNoteDocumentType)
              }
              className={inputClass}
            >
              {CLINICAL_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>N° de documento</label>
            <input
              type="text"
              value={patient?.documentNumber || ''}
              onChange={(e) => setPatient('documentNumber', e.target.value)}
              placeholder="Ej: 3.456.789-0"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>

          <div>
            <label className={labelClass}>Fecha de nacimiento</label>
            <input
              type="date"
              value={patient?.birthDate || ''}
              onChange={(e) => setPatient('birthDate', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Edad</label>
            <input
              type="text"
              value={patient?.age || ''}
              onChange={(e) => setPatient('age', e.target.value)}
              placeholder="33"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            <select
              value={patient?.gender || ''}
              onChange={(e) =>
                setPatient('gender', (e.target.value || undefined) as 'F' | 'M' | 'X' | undefined)
              }
              className={inputClass}
            >
              <option value="">Sin especificar</option>
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="X">X</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              type="tel"
              value={patient?.phone || ''}
              onChange={(e) => setPatient('phone', e.target.value)}
              placeholder="Ej: 099 412 890"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Teléfono alternativo</label>
            <input
              type="tel"
              value={patient?.secondaryPhone || ''}
              onChange={(e) => setPatient('secondaryPhone', e.target.value)}
              placeholder="Ej: 2708 4412"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Correo electrónico</label>
            <input
              type="email"
              value={patient?.email || ''}
              onChange={(e) => setPatient('email', e.target.value)}
              placeholder="paciente@ejemplo.com"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Domicilio</label>
            <AutoResizeTextarea
              minRows={1}
              value={patient?.address || ''}
              onChange={(e) => setPatient('address', e.target.value)}
              placeholder="Calle, número, localidad"
              className="mt-1 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className={labelClass}>Cobertura</label>
            <input
              type="text"
              value={patient?.insuranceProvider || ''}
              onChange={(e) => setPatient('insuranceProvider', e.target.value)}
              placeholder="FONASA / Mutualista / ASSE / Particular"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>N° de afiliado</label>
            <input
              type="text"
              value={patient?.insuranceNumber || ''}
              onChange={(e) => setPatient('insuranceNumber', e.target.value)}
              placeholder="N° de credencial"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Ocupación</label>
            <input
              type="text"
              value={patient?.occupation || ''}
              onChange={(e) => setPatient('occupation', e.target.value)}
              placeholder="Ej: Docente"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Estado civil</label>
            <input
              type="text"
              value={patient?.maritalStatus || ''}
              onChange={(e) => setPatient('maritalStatus', e.target.value)}
              placeholder="Ej: Casada/o"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Contacto de emergencia</label>
            <input
              type="text"
              value={patient?.emergencyContactName || ''}
              onChange={(e) => setPatient('emergencyContactName', e.target.value)}
              placeholder="Nombre y vínculo"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Teléfono de emergencia</label>
            <input
              type="tel"
              value={patient?.emergencyContactPhone || ''}
              onChange={(e) => setPatient('emergencyContactPhone', e.target.value)}
              placeholder="Ej: 098 123 456"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
        </div>
      </Section>

      <Section title="Datos de la consulta">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              value={note.consultationDate || ''}
              onChange={(e) => setNote('consultationDate', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Hora</label>
            <input
              type="time"
              value={note.consultationTime || ''}
              onChange={(e) => setNote('consultationTime', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Tipo de consulta</label>
            <select
              value={note.consultationType || 'primera_consulta'}
              onChange={(e) =>
                setNote(
                  'consultationType',
                  e.target.value as ClinicalNoteConsultationType
                )
              }
              className={inputClass}
            >
              {CLINICAL_CONSULTATION_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Profesional actuante</label>
            <input
              type="text"
              value={note.professionalName || ''}
              onChange={(e) => setNote('professionalName', e.target.value)}
              placeholder="Nombre del odontólogo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Especialidad</label>
            <input
              type="text"
              value={note.professionalSpecialty || ''}
              onChange={(e) => setNote('professionalSpecialty', e.target.value)}
              placeholder="Ej: Odontología General"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Matrícula MSP</label>
            <input
              type="text"
              value={note.professionalLicense || ''}
              onChange={(e) => setNote('professionalLicense', e.target.value)}
              placeholder="Ej: 12345"
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
        </div>
      </Section>

      <Section title="Anamnesis" hint="Motivo de consulta, enfermedad actual y antecedentes relevantes.">
        <div>
          <label className={labelClass}>Motivo de consulta / relato del paciente</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.chiefComplaint}
            onChange={(e) => setNote('chiefComplaint', e.target.value)}
            placeholder="Dolor a la masticación, sensibilidad al frío, control..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className={labelClass}>Enfermedad actual</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.currentIllness || ''}
            onChange={(e) => setNote('currentIllness', e.target.value)}
            placeholder="Inicio, evolución, factores que alivian o agravan el cuadro..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Antecedentes médicos / quirúrgicos</label>
            <AutoResizeTextarea
              minRows={2}
              value={note.medicalHistory || ''}
              onChange={(e) => setNote('medicalHistory', e.target.value)}
              placeholder="Diabetes, hipertensión, cardiopatías, cirugías previas..."
              className="mt-1 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className={labelClass}>Alergias</label>
            <AutoResizeTextarea
              minRows={2}
              value={note.allergies || ''}
              onChange={(e) => setNote('allergies', e.target.value)}
              placeholder="Penicilina, látex, anestésicos..."
              className="mt-1 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Medicación habitual</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.medications || ''}
            onChange={(e) => setNote('medications', e.target.value)}
            placeholder="Anticoagulantes, antihipertensivos, otros..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>

      <Section title="Examen clínico" hint="Examen extraoral, hallazgos intraorales y piezas dentarias (FDI).">
        <div>
          <label className={labelClass}>Examen extraoral</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.extraoralExam || ''}
            onChange={(e) => setNote('extraoralExam', e.target.value)}
            placeholder="ATM, ganglios, mucosa, presión arterial, asimetrías..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className={labelClass}>Hallazgos intraorales</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.findings}
            onChange={(e) => setNote('findings', e.target.value)}
            placeholder="Caries, restauraciones, movilidad, sangrado, oclusión..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className={labelClass}>Piezas dentarias (FDI, separadas por coma)</label>
          <AutoResizeTextarea
            minRows={1}
            value={note.detectedTeeth.join(', ')}
            onChange={(e) =>
              setNote(
                'detectedTeeth',
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Ej: 1.6, 4.8"
            className="mt-1 font-mono bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>

      <Section title="Diagnóstico y plan de tratamiento">
        <div>
          <label className={labelClass}>Diagnóstico presuntivo / definitivo</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.diagnosis || ''}
            onChange={(e) => setNote('diagnosis', e.target.value)}
            placeholder="Ej: Pulpitis irreversible pieza 4.6 (K04.0)"
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className={labelClass}>Plan de tratamiento</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.treatmentPlan || ''}
            onChange={(e) => setNote('treatmentPlan', e.target.value)}
            placeholder="Endodoncia, restauración, exodoncia, derivación..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>

      <Section title="Procedimiento realizado">
        <div>
          <label className={labelClass}>Procedimiento</label>
          <AutoResizeTextarea
            minRows={3}
            value={note.procedure}
            onChange={(e) => setNote('procedure', e.target.value)}
            placeholder={
              CLINICAL_TEMPLATES.find((t) => t.id === note.templateId)?.defaultProcedureHint
            }
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className={labelClass}>Anestesia</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.anesthesia || ''}
            onChange={(e) => setNote('anesthesia', e.target.value)}
            placeholder="Técnica, fármaco, concentración y cantidad..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>

      <Section title="Indicaciones y control">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Indicaciones / medicación</label>
            <AutoResizeTextarea
              minRows={2}
              value={note.indications}
              onChange={(e) => setNote('indications', e.target.value)}
              placeholder="Ibuprofeno 600 mg c/8h si hay dolor..."
              className="mt-1 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className={labelClass}>Próximo control</label>
            <AutoResizeTextarea
              minRows={2}
              value={note.nextVisit}
              onChange={(e) => setNote('nextVisit', e.target.value)}
              placeholder="Citar en 15 días para obturación definitiva..."
              className="mt-1 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Observaciones</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.observations || ''}
            onChange={(e) => setNote('observations', e.target.value)}
            placeholder="Notas adicionales, derivaciones, interconsultas..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>

      <Section title="Consentimiento informado">
        <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(note.consentGiven)}
            onChange={(e) => setNote('consentGiven', e.target.checked)}
            className="mt-0.5 accent-teal-600"
          />
          <span>
            El paciente otorgó consentimiento informado para el procedimiento y el registro de
            sus datos clínicos.
          </span>
        </label>
        <div>
          <label className={labelClass}>Notas del consentimiento</label>
          <AutoResizeTextarea
            minRows={2}
            value={note.consentNotes || ''}
            onChange={(e) => setNote('consentNotes', e.target.value)}
            placeholder="Información brindada, riesgos explicados, testigo..."
            className="mt-1 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </Section>
    </div>
  );
};
