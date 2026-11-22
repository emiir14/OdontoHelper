import Dexie, { Table } from 'dexie';
import {
  ActivityLogEntry,
  Appointment,
  AppSettings,
  AudioChunk,
  ClinicalEvolutionEntry,
  ClinicProfessional,
  FinancialTransaction,
  GlossaryEntry,
  LabOrder,
  OdontogramRecord,
  Patient,
  PatientFileAttachment,
  PatientShareLink,
  PeriodontogramRecord,
  Profile,
  Provider,
  Session,
  TranscriptSegment,
  TreatmentPlan,
  Workspace,
} from '../../core/types';

export class EscribaDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  profiles!: Table<Profile, string>;
  sessions!: Table<Session, string>;
  audioChunks!: Table<AudioChunk, string>;
  transcriptSegments!: Table<TranscriptSegment, string>;
  settings!: Table<AppSettings, string>;
  glossary!: Table<GlossaryEntry, string>;
  patients!: Table<Patient, string>;
  providers!: Table<Provider, string>;
  appointments!: Table<Appointment, string>;
  activityLogs!: Table<ActivityLogEntry, string>;
  clinicProfessionals!: Table<ClinicProfessional, string>;
  clinicalEvolutions!: Table<ClinicalEvolutionEntry, string>;
  odontograms!: Table<OdontogramRecord, string>;
  periodontograms!: Table<PeriodontogramRecord, string>;
  treatmentPlans!: Table<TreatmentPlan, string>;
  financialTransactions!: Table<FinancialTransaction, string>;
  labOrders!: Table<LabOrder, string>;
  patientFiles!: Table<PatientFileAttachment, string>;
  patientShares!: Table<PatientShareLink, string>;

  constructor() {
    super('EscribaDentalDB');

    this.version(1).stores({
      workspaces: 'id, slug, createdAt',
      profiles: 'id, workspaceId',
      sessions: 'id, workspaceId, status, createdAt, updatedAt, deletedAt',
      audioChunks: 'id, sessionId, chunkIndex, createdAt',
      transcriptSegments: 'id, sessionId, start, end, createdAt',
      settings: 'id, workspaceId',
      glossary: 'id, workspaceId, incorrect',
    });

    this.version(2).stores({
      workspaces: 'id, slug, createdAt',
      profiles: 'id, workspaceId',
      sessions: 'id, workspaceId, patientId, status, createdAt, updatedAt, deletedAt',
      audioChunks: 'id, sessionId, chunkIndex, createdAt',
      transcriptSegments: 'id, sessionId, start, end, createdAt',
      settings: 'id, workspaceId',
      glossary: 'id, workspaceId, incorrect',
      patients: 'id, workspaceId, fullName, dni, phone, insuranceProvider, createdAt, updatedAt, deletedAt',
      providers: 'id, workspaceId, name, category, taxId, createdAt, updatedAt, deletedAt',
      appointments: 'id, workspaceId, patientId, providerId, date, status, createdAt, deletedAt',
      activityLogs: 'id, workspaceId, actionType, entityType, entityId, createdAt',
    });

    this.version(3).stores({
      workspaces: 'id, slug, createdAt',
      profiles: 'id, workspaceId',
      sessions: 'id, workspaceId, patientId, status, createdAt, updatedAt, deletedAt',
      audioChunks: 'id, sessionId, chunkIndex, createdAt',
      transcriptSegments: 'id, sessionId, start, end, createdAt',
      settings: 'id, workspaceId',
      glossary: 'id, workspaceId, incorrect',
      patients: 'id, workspaceId, fullName, dni, phone, insuranceProvider, createdAt, updatedAt, deletedAt',
      providers: 'id, workspaceId, name, category, taxId, createdAt, updatedAt, deletedAt',
      appointments: 'id, workspaceId, patientId, providerId, professionalId, date, status, createdAt, deletedAt',
      activityLogs: 'id, workspaceId, actionType, entityType, entityId, createdAt',
      clinicProfessionals: 'id, workspaceId, fullName, role, active, deletedAt',
      clinicalEvolutions: 'id, workspaceId, patientId, date, createdAt, deletedAt',
      odontograms: 'id, workspaceId, patientId, createdAt, deletedAt',
      periodontograms: 'id, workspaceId, patientId, createdAt, deletedAt',
      treatmentPlans: 'id, workspaceId, patientId, status, createdAt, deletedAt',
      financialTransactions: 'id, workspaceId, patientId, type, date, currency, createdAt, deletedAt',
      labOrders: 'id, workspaceId, patientId, providerId, status, dueDate, createdAt, deletedAt',
      patientFiles: 'id, workspaceId, patientId, category, createdAt',
    });

    this.version(4).stores({
      workspaces: 'id, slug, createdAt',
      profiles: 'id, workspaceId',
      sessions: 'id, workspaceId, patientId, status, createdAt, updatedAt, deletedAt',
      audioChunks: 'id, sessionId, chunkIndex, createdAt',
      transcriptSegments: 'id, sessionId, start, end, createdAt',
      settings: 'id, workspaceId',
      glossary: 'id, workspaceId, incorrect',
      patients: 'id, workspaceId, fullName, dni, phone, insuranceProvider, createdAt, updatedAt, deletedAt',
      providers: 'id, workspaceId, name, category, taxId, createdAt, updatedAt, deletedAt',
      appointments: 'id, workspaceId, patientId, providerId, professionalId, date, status, createdAt, deletedAt',
      activityLogs: 'id, workspaceId, actionType, entityType, entityId, createdAt',
      clinicProfessionals: 'id, workspaceId, fullName, role, active, deletedAt',
      clinicalEvolutions: 'id, workspaceId, patientId, date, createdAt, deletedAt',
      odontograms: 'id, workspaceId, patientId, createdAt, deletedAt',
      periodontograms: 'id, workspaceId, patientId, createdAt, deletedAt',
      treatmentPlans: 'id, workspaceId, patientId, status, createdAt, deletedAt',
      financialTransactions: 'id, workspaceId, patientId, type, date, currency, createdAt, deletedAt',
      labOrders: 'id, workspaceId, patientId, providerId, status, dueDate, createdAt, deletedAt',
      patientFiles: 'id, workspaceId, patientId, category, createdAt',
      patientShares: 'id, ownerWorkspaceId, patientId, inviteToken, status, recipientWorkspaceId, createdAt',
    });
  }
}

export const db = new EscribaDatabase();
