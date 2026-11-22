import {
  ClinicalEvolutionEntry,
  OdontogramRecord,
  Patient,
  PatientAnamnesis,
  PatientFileAttachment,
  ToothRecord,
  ToothStatus,
  ToothSurfaceKey,
} from '../types';
import { calculateAgeFromBirthDate, formatBirthDateDisplay } from './clinicHelpers';

export const TOOTH_STATUS_LABELS: Record<ToothStatus, string> = {
  sano: 'Sano',
  caries: 'Caries / Lesión',
  obturada: 'Obturación / Composite',
  endodoncia: 'Endodoncia',
  corona: 'Corona',
  implante: 'Implante',
  protesis: 'Prótesis / Puente',
  sellante: 'Sellante',
  extraccion_indicada: 'Extracción indicada',
  ausente: 'Pieza ausente',
};

const SURFACE_LABELS: Record<ToothSurfaceKey, string> = {
  V: 'Vestibular',
  L: 'Lingual/Palatino',
  M: 'Mesial',
  D: 'Distal',
  O: 'Oclusal/Incisal',
};

const ANAMNESIS_FLAG_LABELS: Array<{ key: keyof PatientAnamnesis; label: string }> = [
  { key: 'hypertension', label: 'Hipertensión arterial' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'heartCondition', label: 'Cardiopatías / Marcapasos' },
  { key: 'coagulationDisorder', label: 'Trastornos de coagulación' },
  { key: 'anesthesiaReaction', label: 'Reacción a anestesia' },
  { key: 'bruxism', label: 'Bruxismo / ATM' },
  { key: 'smoking', label: 'Tabaquismo' },
  { key: 'pregnancy', label: 'Embarazo / Lactancia' },
  { key: 'infectiousHistory', label: 'Antecedentes infecciosos' },
  { key: 'takesMedication', label: 'Medicación habitual' },
];

/**
 * Generates a cryptographically random, URL-safe single-use invite token.
 * Matches OPAQUE_ID_REGEX (/^[a-zA-Z0-9_-]{2,80}$/).
 */
export function generateShareInviteToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `shr_${hex}`;
}

/**
 * Strict immutability check: a colleague can ONLY edit/delete clinical records they authored.
 * Legacy records without authorUserId/authorWorkspaceId remain editable only by the owning workspace.
 */
export function canMutateClinicalRecord(
  record: { workspaceId: string; authorUserId?: string; authorWorkspaceId?: string },
  activeWorkspaceId: string | undefined | null,
  authUserId: string | undefined | null
): boolean {
  if (record.authorUserId) {
    return Boolean(authUserId && record.authorUserId === authUserId);
  }
  if (record.authorWorkspaceId) {
    return Boolean(activeWorkspaceId && record.authorWorkspaceId === activeWorkspaceId);
  }
  return Boolean(activeWorkspaceId && record.workspaceId === activeWorkspaceId);
}

export function getPatientActiveAnamnesisAlerts(patient: Patient): string[] {
  if (!patient.anamnesis) return [];
  return ANAMNESIS_FLAG_LABELS.filter((item) => Boolean(patient.anamnesis?.[item.key])).map((item) =>
    item.key === 'takesMedication' && patient.anamnesis?.medicationDetail?.trim()
      ? `${item.label}: ${patient.anamnesis.medicationDetail.trim()}`
      : item.label
  );
}

export interface OdontogramFindingItem {
  fdi: string;
  summary: string;
  notes?: string;
}

/**
 * Extracts clinical tooth/treatment findings from an odontogram without any pricing or budget data.
 */
export function summarizeOdontogramFindings(
  odontogram?: OdontogramRecord
): OdontogramFindingItem[] {
  if (!odontogram || !odontogram.teeth) return [];
  const findings: OdontogramFindingItem[] = [];

  const sortedEntries = Object.values(odontogram.teeth as Record<string, ToothRecord>).sort((a, b) =>
    a.fdi.localeCompare(b.fdi, undefined, { numeric: true })
  );

  for (const tooth of sortedEntries) {
    const parts: string[] = [];
    if (tooth.status && tooth.status !== 'sano') {
      parts.push(TOOTH_STATUS_LABELS[tooth.status] || tooth.status);
    }
    const surfaceEntries = Object.entries(tooth.surfaces || {}).filter(
      ([, st]) => Boolean(st && st !== 'sano')
    ) as Array<[ToothSurfaceKey, ToothStatus]>;
    if (surfaceEntries.length > 0) {
      const grouped = surfaceEntries
        .map(
          ([surf, st]) =>
            `${SURFACE_LABELS[surf] || surf}: ${TOOTH_STATUS_LABELS[st] || st}`
        )
        .join(', ');
      parts.push(grouped);
    }
    const noteText = tooth.notes?.trim() || undefined;
    if (parts.length > 0 || noteText) {
      findings.push({
        fdi: tooth.fdi,
        summary: parts.length > 0 ? parts.join(' · ') : 'Observación clínica',
        notes: noteText,
      });
    }
  }

  return findings;
}

export interface ExternalReferralInput {
  patient: Patient;
  practitionerName: string;
  practitionerSpecialty?: string;
  practitionerLicense?: string;
  referralNote?: string;
  latestOdontogram?: OdontogramRecord;
  evolutions: ClinicalEvolutionEntry[];
  files: PatientFileAttachment[];
}

/**
 * Builds a complete clinical summary for WhatsApp sharing with an external colleague.
 * Strictly excludes budgets, prices, balances, and financial transactions.
 */
export function buildExternalReferralWhatsAppText(input: ExternalReferralInput): string {
  const {
    patient,
    practitionerName,
    practitionerSpecialty,
    practitionerLicense,
    referralNote,
    latestOdontogram,
    evolutions,
    files,
  } = input;

  const lines: string[] = [
    '*Resumen Clínico / Derivación Odontológica*',
    `Emitido por: ${practitionerName}${practitionerSpecialty ? ` (${practitionerSpecialty})` : ''}${
      practitionerLicense ? ` · Mat. ${practitionerLicense}` : ''
    }`,
    `Fecha: ${new Date().toLocaleDateString('es-AR')}`,
  ];

  if (referralNote?.trim()) {
    lines.push('', `*Motivo de derivación / Nota para el colega:*`, referralNote.trim());
  }

  const birthDisplay = patient.birthDate ? formatBirthDateDisplay(patient.birthDate) : '';
  const calcAge = patient.birthDate ? calculateAgeFromBirthDate(patient.birthDate) : null;
  const ageLabel =
    calcAge !== null ? `${calcAge} años` : patient.age?.trim() ? patient.age.trim() : '';

  lines.push('', '*Datos del paciente:*');
  lines.push(`• Nombre: ${patient.fullName}`);
  if (patient.dni) lines.push(`• CI / DNI: ${patient.dni}`);
  if (birthDisplay || ageLabel) {
    lines.push(
      `• Nacimiento / Edad: ${[birthDisplay, ageLabel ? `(${ageLabel})` : ''].filter(Boolean).join(' ')}`
    );
  }
  if (patient.phone) lines.push(`• Teléfono: ${patient.phone}`);
  if (patient.insuranceProvider) {
    lines.push(
      `• Cobertura: ${patient.insuranceProvider}${
        patient.insuranceNumber ? ` (N° ${patient.insuranceNumber})` : ''
      }`
    );
  }
  if (patient.chiefComplaint) {
    lines.push(`• Motivo de consulta: ${patient.chiefComplaint}`);
  }

  const alerts = getPatientActiveAnamnesisAlerts(patient);
  if (patient.allergies || patient.medicalHistory || alerts.length > 0) {
    lines.push('', '*Alertas médicas y Anamnesis:*');
    if (patient.allergies) lines.push(`• Alergias: ${patient.allergies}`);
    if (alerts.length > 0) lines.push(`• Antecedentes marcados: ${alerts.join(', ')}`);
    if (patient.medicalHistory) lines.push(`• Observaciones médicas: ${patient.medicalHistory}`);
  }

  const pe = patient.physicalExam;
  const peLines: string[] = [];
  if (pe?.bloodPressure) peLines.push(`PA: ${pe.bloodPressure}`);
  if (pe?.mucosa) peLines.push(`Mucosas: ${pe.mucosa}`);
  if (pe?.lymphNodes) peLines.push(`Ganglios: ${pe.lymphNodes}`);
  if (pe?.tmj) peLines.push(`ATM: ${pe.tmj}`);
  if (pe?.occlusion) peLines.push(`Oclusión: ${pe.occlusion}`);
  if (pe?.oralHygiene) peLines.push(`Higiene oral: ${pe.oralHygiene}`);
  if (pe?.observations) peLines.push(`Obs.: ${pe.observations}`);
  if (peLines.length > 0) {
    lines.push('', `*Examen físico:* ${peLines.join(' · ')}`);
  }

  const odoFindings = summarizeOdontogramFindings(latestOdontogram);
  if (latestOdontogram) {
    lines.push(
      '',
      `*Odontograma (${latestOdontogram.label}${
        latestOdontogram.createdBy ? ` · ${latestOdontogram.createdBy}` : ''
      }):*`
    );
    if (odoFindings.length === 0) {
      lines.push('• Sin hallazgos patológicos o restauraciones registradas.');
    } else {
      for (const item of odoFindings) {
        lines.push(
          `• Pieza ${item.fdi}: ${item.summary}${item.notes ? ` (${item.notes})` : ''}`
        );
      }
    }
    if (latestOdontogram.notes?.trim()) {
      lines.push(`• Nota general odontograma: ${latestOdontogram.notes.trim()}`);
    }
  }

  const activeEvols = evolutions.filter((e) => !e.deletedAt);
  if (activeEvols.length > 0) {
    lines.push('', `*Evoluciones clínicas (${activeEvols.length}):*`);
    for (const ev of activeEvols.slice(0, 12)) {
      const piece = ev.toothFdi ? ` [Pieza ${ev.toothFdi}]` : '';
      const author = ev.professionalName ? ` — ${ev.professionalName}` : '';
      lines.push(
        `• ${formatBirthDateDisplay(ev.date)} · ${ev.procedure}${piece}${author}: ${ev.description}`
      );
    }
    if (activeEvols.length > 12) {
      lines.push(`... y ${activeEvols.length - 12} evoluciones anteriores en la ficha PDF.`);
    }
  }

  if (files.length > 0) {
    lines.push('', `*Estudios e imágenes adjuntos (${files.length}):*`);
    for (const f of files.slice(0, 10)) {
      lines.push(`• ${f.name} (${f.capturedAt})${f.notes ? ` — ${f.notes}` : ''}`);
    }
  }

  lines.push('', '_Ficha clínica estándar sin importes ni presupuestos · OdontoHelper_');
  return lines.join('\n');
}

export function buildInternalShareWhatsAppMessage(input: {
  ownerName: string;
  patientName: string;
  shareUrl: string;
  referralNote?: string;
}): string {
  const lines = [
    `Hola colega, te comparto la ficha clínica de *${input.patientName}* en *OdontoHelper* (derivado por ${input.ownerName}).`,
  ];
  if (input.referralNote?.trim()) {
    lines.push(`Motivo / Nota: ${input.referralNote.trim()}`);
  }
  lines.push(
    '',
    `Enlace de acceso único para vincular al paciente a tu consultorio:`,
    input.shareUrl,
    '',
    'Ambos verán las evoluciones clínicas, odontograma y radiografías en tiempo real (presupuestos y caja quedan privados).'
  );
  return lines.join('\n');
}
