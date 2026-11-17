/**
 * Core Domain Entities for OdontoHelper
 * Prepared for local-first clinical records & voice transcription.
 */

export type ModelTier = 'auto' | 'fast' | 'balanced' | 'max';

export type TranscriptionMode = 'dental' | 'general';

export type SessionStatus = 'recording' | 'recorded' | 'transcribing' | 'completed' | 'error';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Profile {
  id: string;
  workspaceId: string;
  fullName: string;
  role: 'owner' | 'dentist' | 'assistant';
  createdAt: number;
  updatedAt: number;
}

export type ClinicalTemplateId = 'general' | 'endodoncia' | 'operatoria' | 'cirugia' | 'periodoncia';

export interface ClinicalNote {
  templateId: ClinicalTemplateId;
  detectedTeeth: string[];
  chiefComplaint: string;
  findings: string;
  procedure: string;
  indications: string;
  nextVisit: string;
  updatedAt: number;
}

export interface Session {
  id: string;
  workspaceId: string;
  title: string;
  reference?: string; // Clinician reference / patient name or initials
  patientId?: string;
  intakeTarget?: 'consultation' | 'patient' | 'provider';
  status: SessionStatus;
  durationSec: number;
  consentGiven: boolean;
  modelTierUsed?: ModelTier;
  audioDeleted: boolean;
  clinicalNote?: ClinicalNote;
  error?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

/**
 * AudioChunk stores 16kHz Int16 PCM chunks directly in local IndexedDB.
 * NEVER synchronized to any cloud server.
 */
export interface AudioChunk {
  id: string;
  sessionId: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  pcmData: ArrayBuffer; // 16kHz 1-channel Int16 PCM
  samples: number;
  sampleRate: number; // 16000
  createdAt: number;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  originalText: string;
  speaker?: string; // Optional speaker identifier for future diarization
  edited: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GlossaryEntry {
  id: string;
  workspaceId: string;
  incorrect: string;
  correct: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id: string;
  workspaceId: string;
  modelTier: ModelTier;
  noiseSuppression: boolean;
  selectedAudioDeviceId?: string;
  requireConsent: boolean;
  autoTranscribeOnStop: boolean;
  progressiveTranscription: boolean; // Transcribes chunks in background during recording for instant results
  transcriptionMode?: TranscriptionMode; // 'dental' uses dental prompt + glossary; 'general' avoids dental bias
  theme: 'light' | 'dark' | 'system';
  currency?: CurrencyCode;
  updatedAt: number;
}

/* ============================================================
 * OdontoHelper Clinical & Practice Entities
 * ============================================================ */

export type ClinicRole = 'owner' | 'odontologo' | 'secretaria' | 'asistente';

export interface ClinicProfessional {
  id: string;
  workspaceId: string;
  fullName: string;
  specialty?: string;
  licenseNumber?: string;
  email?: string;
  phone?: string;
  role: ClinicRole;
  agendaColor: string;
  pinCode?: string;
  canViewFinance: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type ClinicProfessionalDraftInput = Omit<
  ClinicProfessional,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface PatientPhysicalExam {
  bloodPressure?: string;
  mucosa?: string;
  lymphNodes?: string;
  tmj?: string;
  occlusion?: string;
  oralHygiene?: string;
  observations?: string;
  updatedAt?: number;
}

export interface PatientProfileMeta {
  gender?: 'F' | 'M' | 'X';
  secondaryPhone?: string;
  groupTag?: string;
  photoDataUrl?: string;
  physicalExam?: PatientPhysicalExam;
  nextControlDate?: string;
  nextControlNote?: string;
}

export interface PatientAnamnesis {
  diabetes?: boolean;
  hypertension?: boolean;
  heartCondition?: boolean;
  coagulationDisorder?: boolean;
  pregnancy?: boolean;
  bruxism?: boolean;
  smoking?: boolean;
  anesthesiaReaction?: boolean;
  infectiousHistory?: boolean;
  takesMedication?: boolean;
  medicationDetail?: string;
  otherNotes?: string;
  updatedAt?: number;
  _profileMeta?: PatientProfileMeta;
}

export interface Patient {
  id: string;
  workspaceId: string;
  fullName: string;
  dni?: string;
  birthDate?: string;
  age?: string;
  gender?: 'F' | 'M' | 'X';
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  groupTag?: string;
  photoDataUrl?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  allergies?: string;
  medicalHistory?: string;
  chiefComplaint?: string;
  notes?: string;
  anamnesis?: PatientAnamnesis;
  physicalExam?: PatientPhysicalExam;
  nextControlDate?: string;
  nextControlNote?: string;
  sourceSessionId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type PatientDraftInput = Omit<Patient, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type ProviderCategory =
  | 'laboratorio'
  | 'insumos'
  | 'especialista'
  | 'mantenimiento'
  | 'otro';

export interface Provider {
  id: string;
  workspaceId: string;
  name: string;
  category: ProviderCategory;
  contactName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  specialtyOrProducts?: string;
  paymentTerms?: string;
  notes?: string;
  sourceSessionId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type ProviderDraftInput = Omit<Provider, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'waiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Appointment {
  id: string;
  workspaceId: string;
  patientId?: string;
  patientName: string;
  providerId?: string;
  providerName?: string;
  professionalId?: string;
  professionalName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMin: number;
  procedure: string;
  status: AppointmentStatus;
  notes?: string;
  sourceSessionId?: string;
  autoCaptured?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type AppointmentDraftInput = Omit<
  Appointment,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/* ---- Odontogram (Interactive FDI & Snapshots) ---- */

export type ToothStatus =
  | 'sano'
  | 'caries'
  | 'obturada'
  | 'endodoncia'
  | 'corona'
  | 'implante'
  | 'protesis'
  | 'sellante'
  | 'extraccion_indicada'
  | 'ausente';

export type ToothSurfaceKey = 'V' | 'L' | 'M' | 'D' | 'O';

export interface ToothRecord {
  fdi: string;
  status: ToothStatus;
  surfaces: Partial<Record<ToothSurfaceKey, ToothStatus>>;
  notes?: string;
  updatedAt: number;
}

export interface OdontogramRecord {
  id: string;
  workspaceId: string;
  patientId: string;
  label: string;
  dentition: 'adulto' | 'mixto';
  teeth: Record<string, ToothRecord>;
  notes?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

/* ---- Periodontogram ---- */

export interface PeriodontogramToothData {
  fdi: string;
  probingVestibular: [number, number, number]; // Mesial, Central, Distal (mm)
  probingLingual: [number, number, number]; // Mesial, Central, Distal (mm)
  recessionMm: number;
  bleeding: boolean;
  suppuration: boolean;
  plaque: boolean;
  mobility: 0 | 1 | 2 | 3;
  furcation?: 0 | 1 | 2 | 3;
  notes?: string;
}

export interface PeriodontogramRecord {
  id: string;
  workspaceId: string;
  patientId: string;
  label: string;
  teeth: Record<string, PeriodontogramToothData>;
  notes?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

/* ---- Chronological Clinical Evolutions (with PIN Signature) ---- */

export type EvolutionHighlightColor = 'default' | 'teal' | 'amber' | 'rose' | 'blue';

export interface ClinicalEvolutionEntry {
  id: string;
  workspaceId: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  toothFdi?: string;
  procedure: string;
  description: string;
  highlightColor: EvolutionHighlightColor;
  professionalId?: string;
  professionalName?: string;
  signedWithPin: boolean;
  signedAt?: number;
  sourceSessionId?: string;
  sourceTreatmentPlanId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type ClinicalEvolutionDraftInput = Omit<
  ClinicalEvolutionEntry,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/* ---- Patient File Attachments (X-rays, Intraoral Photos, PDFs - Local IndexedDB) ---- */

export type PatientFileCategory = 'radiografia' | 'foto_clinica' | 'documento' | 'consentimiento';

export interface PatientFileAttachment {
  id: string;
  workspaceId: string;
  patientId: string;
  name: string;
  category: PatientFileCategory;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  notes?: string;
  capturedAt: string; // YYYY-MM-DD
  createdAt: number;
}

/* ---- Treatment Plans / Budgets ---- */

export type CurrencyCode =
  | 'UYU'
  | 'USD'
  | 'ARS'
  | 'BRL'
  | 'CLP'
  | 'COP'
  | 'MXN'
  | 'PEN'
  | 'PYG'
  | 'BOB'
  | 'CRC'
  | 'DOP'
  | 'GTQ'
  | 'PAB'
  | 'VES';

export type TreatmentPlanStatus =
  | 'borrador'
  | 'presentado'
  | 'aprobado'
  | 'en_curso'
  | 'finalizado';

export interface TreatmentItem {
  id: string;
  procedure: string;
  toothFdi?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  completed: boolean;
  completedAt?: number;
  professionalId?: string;
  professionalName?: string;
}

export interface TreatmentPlan {
  id: string;
  workspaceId: string;
  patientId: string;
  patientName: string;
  title: string;
  currency: CurrencyCode;
  status: TreatmentPlanStatus;
  professionalId?: string;
  professionalName?: string;
  items: TreatmentItem[];
  notes?: string;
  validUntil?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type TreatmentPlanDraftInput = Omit<
  TreatmentPlan,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/* ---- Financial Ledger (Patient Cuenta Corriente + Clinic Caja Diaria) ---- */

export type TransactionType = 'charge' | 'payment' | 'expense';

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'obra_social'
  | 'mercadopago'
  | 'cargo_clinico';

export interface FinancialTransaction {
  id: string;
  workspaceId: string;
  patientId?: string;
  patientName?: string;
  type: TransactionType;
  currency: CurrencyCode;
  amount: number;
  paymentMethod: PaymentMethod;
  concept: string;
  date: string; // YYYY-MM-DD
  professionalId?: string;
  professionalName?: string;
  receiptNumber?: string;
  sourceTreatmentPlanId?: string;
  sourceTreatmentItemId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type FinancialTransactionDraftInput = Omit<
  FinancialTransaction,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/* ---- Dental Laboratory Orders ---- */

export type LabOrderStatus = 'sin_enviar' | 'en_laboratorio' | 'en_clinica' | 'instalado';

export interface LabOrder {
  id: string;
  workspaceId: string;
  patientId?: string;
  patientName: string;
  providerId?: string;
  providerName?: string;
  workType: string;
  toothFdi?: string;
  shade?: string;
  sentDate?: string;
  dueDate?: string;
  receivedDate?: string;
  cost?: number;
  currency: CurrencyCode;
  status: LabOrderStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type LabOrderDraftInput = Omit<
  LabOrder,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type ActivityEntityType =
  | 'patient'
  | 'provider'
  | 'appointment'
  | 'session'
  | 'odontogram'
  | 'periodontogram'
  | 'evolution'
  | 'treatment_plan'
  | 'finance'
  | 'lab_order'
  | 'professional'
  | 'file'
  | 'system';

export type ActivityActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'recorded'
  | 'transcribed'
  | 'status_changed'
  | 'exported';

export interface ActivityLogEntry {
  id: string;
  workspaceId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId?: string;
  summary: string;
  details?: string;
  createdAt: number;
}
