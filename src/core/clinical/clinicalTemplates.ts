import { calculateAgeFromBirthDate, toLocalIsoDate } from '../clinic/clinicHelpers';
import {
  ClinicalNote,
  ClinicalNoteConsultationType,
  ClinicalNoteDocumentType,
  ClinicalNotePatient,
  ClinicalTemplateId,
  Patient,
  Session,
  TranscriptSegment,
} from '../types';

export interface ClinicalTemplateDefinition {
  id: ClinicalTemplateId;
  label: string;
  description: string;
  defaultProcedureHint: string;
}

export const CLINICAL_TEMPLATES: ClinicalTemplateDefinition[] = [
  {
    id: 'general',
    label: 'Consulta general',
    description: 'Anamnesis, examen clínico, procedimiento y seguimiento.',
    defaultProcedureHint: 'Diagnóstico clínico, higiene o maniobras realizadas.',
  },
  {
    id: 'endodoncia',
    label: 'Endodoncia',
    description: 'Conductometría, instrumentación, irrigación y obturación.',
    defaultProcedureHint: 'Apertura, conductometría, irrigación, medicación intraconducto / obturación.',
  },
  {
    id: 'operatoria',
    label: 'Operatoria / Caries',
    description: 'Remoción de caries, aislamiento, adhesión y restauración.',
    defaultProcedureHint: 'Aislamiento, remoción de tejido cariado, protección pulpar, composite/resina.',
  },
  {
    id: 'cirugia',
    label: 'Cirugía / Implantes',
    description: 'Anestesia, exodoncia o colocación, sutura e indicaciones.',
    defaultProcedureHint: 'Técnica anestésica, exodoncia/osteotomía, sutura y hemostasia.',
  },
  {
    id: 'periodoncia',
    label: 'Periodoncia',
    description: 'Sondaje, raspaje, alisado radicular y control de placa.',
    defaultProcedureHint: 'Raspaje y alisado radicular, ultrasonido, pulido e higiene oral.',
  },
];

export const CLINICAL_CONSULTATION_TYPES: Array<{
  id: ClinicalNoteConsultationType;
  label: string;
}> = [
  { id: 'primera_consulta', label: 'Primera consulta' },
  { id: 'control', label: 'Control' },
  { id: 'urgencia', label: 'Urgencia' },
  { id: 'tratamiento', label: 'Sesión de tratamiento' },
  { id: 'interconsulta', label: 'Interconsulta / derivación' },
];

export const CLINICAL_DOCUMENT_TYPES: ClinicalNoteDocumentType[] = [
  'CI',
  'DNI',
  'Pasaporte',
  'Otro',
];

export function clinicalConsultationTypeLabel(
  type?: ClinicalNoteConsultationType
): string {
  return CLINICAL_CONSULTATION_TYPES.find((t) => t.id === type)?.label || 'Primera consulta';
}

export function createEmptyClinicalNote(
  templateId: ClinicalTemplateId = 'general',
  overrides: Partial<ClinicalNote> = {}
): ClinicalNote {
  return {
    templateId,
    detectedTeeth: [],
    chiefComplaint: '',
    findings: '',
    procedure: '',
    indications: '',
    nextVisit: '',
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Valid FDI quadrants 1-4 (permanent 1..8) and 5-8 (deciduous 1..5)
function isValidFdiCode(quad: number, tooth: number): boolean {
  if (quad >= 1 && quad <= 4) return tooth >= 1 && tooth <= 8;
  if (quad >= 5 && quad <= 8) return tooth >= 1 && tooth <= 5;
  return false;
}

/**
 * Extracts valid FDI dental piece codes from clinical Spanish text without false positives
 * (e.g. matches "1.6", "pieza 36", "elemento 4.8", "molar 26", but ignores "15 días" or "500 mg").
 */
export function extractFdiTeeth(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  // 1. Dotted FDI like 1.6, 2.4, 4.8 (avoid decimals in mg/ml/mm by checking boundary & tooth range)
  const dottedRegex = /(?:^|[\s(,;:])([1-8])\.([1-8])(?=$|[\s).,;:!?])/g;
  let match: RegExpExecArray | null;
  while ((match = dottedRegex.exec(text)) !== null) {
    const q = parseInt(match[1], 10);
    const t = parseInt(match[2], 10);
    if (isValidFdiCode(q, t)) {
      found.add(`${q}.${t}`);
    }
  }

  // 2. Contextual FDI like "pieza 16", "piezas 16 y 17", "elemento 48", "diente 21", "molar 36"
  const contextRegex =
    /\b(?:pieza|piezas|elemento|elementos|diente|dientes|molar|premolar|incisivo|canino|implante|conducto|corona|raíz|raiz)\s+(?:n[°º.]?\s*)?([1-8])\.?([1-8])(?:\s*(?:,|y|e|-)\s*([1-8])\.?([1-8]))?/gi;
  while ((match = contextRegex.exec(text)) !== null) {
    const q1 = parseInt(match[1], 10);
    const t1 = parseInt(match[2], 10);
    if (isValidFdiCode(q1, t1)) {
      found.add(`${q1}.${t1}`);
    }
    if (match[3] && match[4]) {
      const q2 = parseInt(match[3], 10);
      const t2 = parseInt(match[4], 10);
      if (isValidFdiCode(q2, t2)) {
        found.add(`${q2}.${t2}`);
      }
    }
  }

  return Array.from(found).sort();
}

/**
 * Builds a structured clinical note draft 100% locally from transcript segments.
 */
export function buildDraftClinicalNote(
  segments: TranscriptSegment[],
  templateId: ClinicalTemplateId = 'general'
): ClinicalNote {
  const fullText = segments.map((s) => s.text).join(' ');
  const detectedTeeth = extractFdiTeeth(fullText);

  const patientLines: string[] = [];
  const findingsLines: string[] = [];
  const procedureLines: string[] = [];
  const indicationsLines: string[] = [];
  const nextVisitLines: string[] = [];
  const diagnosisLines: string[] = [];
  const planLines: string[] = [];
  const historyLines: string[] = [];
  const allergyLines: string[] = [];
  const medicationLines: string[] = [];
  const anesthesiaLines: string[] = [];

  const medicationOrCareRegex =
    /\b(ibuprofeno|amoxicilina|azitromicina|ketorolac|paracetamol|clorhexidina|antibiótico|analgésico|antiinflamatorio|hielo|dieta|blanda|reposo|enjuague|buches|cepillado|indicaciones)\b/i;
  const nextVisitRegex =
    /\b(próximo|próxima|control|citar|volvemos|turno|en\s+\d+\s+(?:días|semanas|meses)|sutura|retiro)\b/i;
  const findingsRegex =
    /\b(caries|dolor|sensibilidad|inflamación|edema|fístula|absceso|fractura|movilidad|bolsa|sangrado|radiografía|periapical|lesión|obturación|filtración)\b/i;
  const procedureRegex =
    /\b(anestesia|apertura|conductometría|irrigación|hipoclorito|instrumentación|obturación|gutapercha|composite|resina|aislamiento|exodoncia|extracción|implante|sutura|raspaje|alisado|ultrasonido|provisorio|ionómero|tallado|cemento)\b/i;
  const diagnosisRegex =
    /\b(diagn[oó]stico|compatible con|pulpitis|periodontitis|gingivitis|pericoronaritis|caries|absceso|fractura|lesi[oó]n periapical)\b/i;
  const planRegex =
    /\b(plan de tratamiento|plan|conducta|tratamiento|derivaci[oó]n|interconsulta|pr[oó]ximo paso)\b/i;
  const historyRegex =
    /\b(diabet|hipertens|card[ií]ac|anticoagul|coagulaci|embaraz|asma|epilep|tiroid|antecedente|cirug[ií]a|operad[oa]|medicaci[oó]n|medicamento|tomo)\b/i;
  const allergyRegex = /\b(al[eé]rgic[oa]|alergia|penicilina|l[aá]tex|reacci[oó]n anest[eé]sica)\b/i;
  const anesthesiaRegex =
    /\b(anestesia|anest[eé]sic|lidoca[ií]na|mepivaca[ií]na|articai|priloca[ií]na|infiltraci[oó]n|troncular)\b/i;

  for (const seg of segments) {
    const txt = seg.text.trim();
    if (!txt) continue;

    if (allergyRegex.test(txt)) allergyLines.push(txt);
    if (anesthesiaRegex.test(txt)) anesthesiaLines.push(txt);

    if (seg.speaker === 'Paciente') {
      if (allergyRegex.test(txt)) {
        // ya registrado como alergia
      } else {
        let classified = false;
        if (historyRegex.test(txt)) {
          historyLines.push(txt);
          classified = true;
        }
        if (/\b(tomo|medicaci[oó]n|medicamento)\b/i.test(txt)) {
          medicationLines.push(txt);
          classified = true;
        }
        if (!classified) patientLines.push(txt);
      }
      continue;
    }

    if (medicationOrCareRegex.test(txt)) {
      indicationsLines.push(txt);
    } else if (nextVisitRegex.test(txt)) {
      nextVisitLines.push(txt);
    } else if (procedureRegex.test(txt)) {
      procedureLines.push(txt);
    } else if (findingsRegex.test(txt) || diagnosisRegex.test(txt)) {
      if (findingsRegex.test(txt)) findingsLines.push(txt);
      if (diagnosisRegex.test(txt)) diagnosisLines.push(txt);
    } else if (planRegex.test(txt)) {
      planLines.push(txt);
    } else if (historyRegex.test(txt)) {
      historyLines.push(txt);
    }
  }

  return {
    templateId,
    detectedTeeth,
    chiefComplaint: patientLines.join(' ').trim(),
    findings: findingsLines.join(' ').trim(),
    procedure: procedureLines.join(' ').trim(),
    indications: indicationsLines.join(' ').trim(),
    nextVisit: nextVisitLines.join(' ').trim(),
    updatedAt: Date.now(),
    currentIllness: '',
    medicalHistory: historyLines.join(' ').trim(),
    allergies: allergyLines.join(' ').trim(),
    medications: medicationLines.join(' ').trim(),
    diagnosis: diagnosisLines.join(' ').trim(),
    treatmentPlan: planLines.join(' ').trim(),
    anesthesia: anesthesiaLines.join(' ').trim(),
  };
}

/**
 * Builds the patient identity snapshot stored inside a clinical note.
 */
export function buildPatientSnapshot(
  patient: Patient | null | undefined,
  session: Session
): ClinicalNotePatient {
  const computedAge = patient?.birthDate
    ? calculateAgeFromBirthDate(patient.birthDate)
    : null;
  return {
    patientId: patient?.id,
    fullName: patient?.fullName || session.reference?.trim() || '',
    documentType: patient?.documentType,
    documentNumber: patient?.dni,
    birthDate: patient?.birthDate,
    age: patient?.age || (computedAge != null ? String(computedAge) : undefined),
    gender: patient?.gender,
    phone: patient?.phone,
    secondaryPhone: patient?.secondaryPhone,
    email: patient?.email,
    address: patient?.address,
    insuranceProvider: patient?.insuranceProvider,
    insuranceNumber: patient?.insuranceNumber,
    occupation: patient?.occupation,
    maritalStatus: patient?.maritalStatus,
    emergencyContactName: patient?.emergencyContactName,
    emergencyContactPhone: patient?.emergencyContactPhone,
  };
}

export interface ClinicalNoteProfessionalContext {
  fullName?: string;
  specialty?: string;
  licenseNumber?: string;
}

/**
 * Completes a clinical note with patient identity, encounter date/time and
 * professional data. Existing user-entered values are preserved.
 */
export function hydrateClinicalNote(
  note: ClinicalNote,
  session: Session,
  patient?: Patient | null,
  professional?: ClinicalNoteProfessionalContext | null
): ClinicalNote {
  const basePatient = buildPatientSnapshot(patient, session);
  const mergedPatient: ClinicalNotePatient = { ...basePatient };
  if (note.patient) {
    for (const [key, value] of Object.entries(note.patient)) {
      if (value !== undefined && value !== null && value !== '') {
        (mergedPatient as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  if (patient?.id) mergedPatient.patientId = patient.id;

  const created = new Date(session.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    ...note,
    patient: mergedPatient,
    consultationDate: note.consultationDate || toLocalIsoDate(created),
    consultationTime:
      note.consultationTime || `${pad(created.getHours())}:${pad(created.getMinutes())}`,
    consultationType: note.consultationType || 'primera_consulta',
    allergies: note.allergies || patient?.allergies || '',
    medicalHistory: note.medicalHistory || patient?.medicalHistory || '',
    chiefComplaint: note.chiefComplaint || patient?.chiefComplaint || '',
    professionalName: note.professionalName || professional?.fullName || '',
    professionalSpecialty: note.professionalSpecialty || professional?.specialty || '',
    professionalLicense: note.professionalLicense || professional?.licenseNumber || '',
  };
}

export function formatClinicalNoteText(session: Session, note: ClinicalNote): string {
  const tpl = CLINICAL_TEMPLATES.find((t) => t.id === note.templateId)?.label || 'Consulta general';
  const dateStr = new Date(session.createdAt).toLocaleDateString('es-UY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const patient = note.patient;
  const patientName = patient?.fullName || session.reference || '';
  const documentLabel = patient?.documentNumber
    ? `${patient.documentType || 'CI'} ${patient.documentNumber}`
    : '';
  const encounterDate = note.consultationDate || dateStr;
  const encounterTime = note.consultationTime ? ` ${note.consultationTime} hs` : '';
  const professionalMeta = [note.professionalSpecialty, note.professionalLicense]
    .filter(Boolean)
    .join(' · ');

  const section = (title: string, rows: Array<string | undefined | false>): string => {
    const content = rows.filter((row): row is string => Boolean(row && String(row).trim()));
    if (content.length === 0) return '';
    return `${title}\n${content.join('\n')}\n`;
  };

  const lines = [
    `FICHA CLÍNICA ODONTOLÓGICA (${tpl.toUpperCase()})`,
    '========================================',
    section('DATOS DEL PACIENTE', [
      patientName ? `Nombre y apellido: ${patientName}` : '',
      documentLabel ? `Documento de identidad: ${documentLabel}` : '',
      patient?.birthDate ? `Fecha de nacimiento: ${patient.birthDate}` : '',
      patient?.age ? `Edad: ${patient.age} años` : '',
      patient?.gender ? `Sexo: ${patient.gender}` : '',
      patient?.address ? `Domicilio: ${patient.address}` : '',
      patient?.phone ? `Teléfono: ${patient.phone}` : '',
      patient?.secondaryPhone ? `Teléfono alternativo: ${patient.secondaryPhone}` : '',
      patient?.email ? `Correo electrónico: ${patient.email}` : '',
      patient?.insuranceProvider
        ? `Cobertura: ${patient.insuranceProvider}${
            patient.insuranceNumber ? ` (N° ${patient.insuranceNumber})` : ''
          }`
        : '',
      patient?.occupation ? `Ocupación: ${patient.occupation}` : '',
      patient?.maritalStatus ? `Estado civil: ${patient.maritalStatus}` : '',
      patient?.emergencyContactName
        ? `Contacto de emergencia: ${patient.emergencyContactName}${
            patient.emergencyContactPhone ? ` · ${patient.emergencyContactPhone}` : ''
          }`
        : '',
    ]),
    section('DATOS DE LA CONSULTA', [
      `Fecha: ${encounterDate}${encounterTime}`,
      `Tipo de consulta: ${clinicalConsultationTypeLabel(note.consultationType)}`,
      note.professionalName
        ? `Profesional actuante: ${note.professionalName}${
            professionalMeta ? ` (${professionalMeta})` : ''
          }`
        : '',
      note.detectedTeeth.length > 0
        ? `Piezas FDI detectadas: ${note.detectedTeeth.join(', ')}`
        : '',
    ]),
    section('ANAMNESIS', [
      note.chiefComplaint ? `Motivo de consulta / relato del paciente:\n${note.chiefComplaint}` : '',
      note.currentIllness ? `Enfermedad actual:\n${note.currentIllness}` : '',
      note.medicalHistory ? `Antecedentes médicos:\n${note.medicalHistory}` : '',
      note.allergies ? `Alergias:\n${note.allergies}` : '',
      note.medications ? `Medicación habitual:\n${note.medications}` : '',
    ]),
    section('EXAMEN CLÍNICO', [
      note.extraoralExam ? `Examen extraoral:\n${note.extraoralExam}` : '',
      note.findings ? `Hallazgos intraorales:\n${note.findings}` : '',
    ]),
    section('DIAGNÓSTICO', [note.diagnosis ? note.diagnosis : '']),
    section('PLAN DE TRATAMIENTO', [note.treatmentPlan ? note.treatmentPlan : '']),
    section('PROCEDIMIENTO REALIZADO', [
      note.procedure ? note.procedure : '',
      note.anesthesia ? `Anestesia:\n${note.anesthesia}` : '',
    ]),
    section('INDICACIONES Y CONTROL', [
      note.indications ? `Indicaciones y medicación:\n${note.indications}` : '',
      note.nextVisit ? `Próximo control:\n${note.nextVisit}` : '',
      note.observations ? `Observaciones:\n${note.observations}` : '',
    ]),
    section('CONSENTIMIENTO INFORMADO', [
      `Consentimiento informado: ${note.consentGiven ? 'Sí, otorgado' : 'No registrado'}`,
      note.consentNotes ? note.consentNotes : '',
    ]),
    section('FIRMA DEL PROFESIONAL', [
      note.professionalName ? `Nombre: ${note.professionalName}` : '',
      note.professionalLicense ? `Matrícula MSP: ${note.professionalLicense}` : '',
      'Firma: ______________________________',
    ]),
  ].filter(Boolean);

  return lines.join('\n').trim();
}
