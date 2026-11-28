import {
  ClinicalNote,
  Patient,
  PatientDraftInput,
  PatientPhysicalExam,
  Session,
} from '../types';

function normalizeName(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDocument(value?: string): string {
  return (value || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

function extractIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return match ? match[0] : undefined;
}

/**
 * Resolves the patient a clinical note belongs to.
 * Priority: explicit session link → snapshot link → identity document → exact full name.
 */
export function findPatientForClinicalNote(
  note: ClinicalNote,
  session: Session,
  patients: Patient[]
): Patient | undefined {
  const activePatients = patients.filter((p) => !p.deletedAt);

  const linkedId = session.patientId || note.patient?.patientId;
  if (linkedId) {
    const linked = activePatients.find((p) => p.id === linkedId);
    if (linked) return linked;
  }

  const documentNumber = normalizeDocument(note.patient?.documentNumber);
  if (documentNumber) {
    const byDocument = activePatients.find(
      (p) => normalizeDocument(p.dni) === documentNumber
    );
    if (byDocument) return byDocument;
  }

  const name = normalizeName(note.patient?.fullName || session.reference);
  if (name) {
    return activePatients.find((p) => normalizeName(p.fullName) === name);
  }

  return undefined;
}

/**
 * Maps the clinical note identity/anamnesis sections to the patient model.
 * Only fields with content are returned so existing patient data is not erased.
 */
export function buildPatientFieldsFromClinicalNote(
  note: ClinicalNote
): Partial<PatientDraftInput> {
  const patient = note.patient;
  const fields: Partial<PatientDraftInput> = {};

  if (patient) {
    if (patient.fullName?.trim()) fields.fullName = patient.fullName.trim();
    if (patient.documentNumber?.trim()) fields.dni = patient.documentNumber.trim();
    if (patient.documentType !== undefined) fields.documentType = patient.documentType;
    if (patient.birthDate?.trim()) fields.birthDate = patient.birthDate;
    if (patient.age?.trim()) fields.age = patient.age;
    if (patient.gender !== undefined) fields.gender = patient.gender;
    if (patient.phone?.trim()) fields.phone = patient.phone;
    if (patient.secondaryPhone?.trim()) fields.secondaryPhone = patient.secondaryPhone;
    if (patient.email?.trim()) fields.email = patient.email;
    if (patient.address?.trim()) fields.address = patient.address;
    if (patient.insuranceProvider?.trim()) {
      fields.insuranceProvider = patient.insuranceProvider;
    }
    if (patient.insuranceNumber?.trim()) {
      fields.insuranceNumber = patient.insuranceNumber;
    }
    if (patient.occupation?.trim()) fields.occupation = patient.occupation;
    if (patient.maritalStatus?.trim()) fields.maritalStatus = patient.maritalStatus;
    if (patient.emergencyContactName?.trim()) {
      fields.emergencyContactName = patient.emergencyContactName;
    }
    if (patient.emergencyContactPhone?.trim()) {
      fields.emergencyContactPhone = patient.emergencyContactPhone;
    }
  }

  if (note.allergies?.trim()) fields.allergies = note.allergies.trim();
  if (note.medicalHistory?.trim()) fields.medicalHistory = note.medicalHistory.trim();
  if (note.chiefComplaint?.trim()) fields.chiefComplaint = note.chiefComplaint.trim();

  const physicalExam: PatientPhysicalExam = {};
  if (note.extraoralExam?.trim()) {
    physicalExam.observations = `Examen extraoral: ${note.extraoralExam.trim()}`;
  }
  if (note.findings?.trim()) {
    const intraoral = `Examen intraoral: ${note.findings.trim()}`;
    physicalExam.observations = physicalExam.observations
      ? `${physicalExam.observations}\n${intraoral}`
      : intraoral;
  }
  if (Object.keys(physicalExam).length > 0) {
    physicalExam.updatedAt = note.updatedAt;
    fields.physicalExam = physicalExam;
  }

  if (note.nextVisit?.trim()) {
    fields.nextControlNote = note.nextVisit.trim();
    const isoDate = extractIsoDate(note.nextVisit);
    if (isoDate) fields.nextControlDate = isoDate;
  }

  return fields;
}

/**
 * Display name to use when creating/linking a patient from a clinical note.
 */
export function clinicalNotePatientName(note: ClinicalNote, session: Session): string {
  return (note.patient?.fullName || session.reference || '').trim();
}
