import { DEFAULT_DENTAL_GLOSSARY } from '../../../config/glossary';
import {
  IAuthProvider,
  IGlossaryRepository,
  IPatientFileStore,
  ISessionRepository,
  ISettingsRepository,
  ITranscriptRepository,
} from '../../core/interfaces';
import {
  DEFAULT_CURRENCY,
  packPatientAnamnesis,
  unpackPatientProfileMeta,
} from '../../core/clinic/clinicHelpers';
import { getDefaultModelTier } from '../../core/runtime/platform';
import {
  ActivityActionType,
  ActivityEntityType,
  ActivityLogEntry,
  Appointment,
  AppointmentStatus,
  AppSettings,
  ClinicalEvolutionEntry,
  ClinicalNote,
  ClinicProfessional,
  ClinicRole,
  CurrencyCode,
  EvolutionHighlightColor,
  FinancialTransaction,
  GlossaryEntry,
  LabOrder,
  LabOrderStatus,
  ModelTier,
  OdontogramRecord,
  PaidSubscriptionPlanTier,
  Patient,
  PatientAnamnesis,
  PatientFileAttachment,
  PatientFileCategory,
  PatientShareLink,
  PatientSharePreview,
  PatientShareStatus,
  PaymentMethod,
  PeriodontogramRecord,
  PeriodontogramToothData,
  Profile,
  Provider,
  ProviderCategory,
  Session,
  SessionStatus,
  SubscriptionBillingCycle,
  SubscriptionPlanTier,
  SubscriptionStatus,
  SubscriptionTransferRequest,
  ToothRecord,
  TranscriptSegment,
  TranscriptionMode,
  TransactionType,
  TransferRequestStatus,
  TreatmentItem,
  TreatmentPlan,
  TreatmentPlanStatus,
  Workspace,
  WorkspaceSubscription,
} from '../../core/types';
import { getSupabaseClient } from './supabaseClient';

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase no está configurado en las variables de entorno.');
  }
  return client;
}

/* ============================================================================
 * Row Mappers (PostgreSQL snake_case <-> TypeScript camelCase)
 * ============================================================================ */

function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    fullName: String(row.full_name),
    role: (row.role as Profile['role']) || 'owner',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    reference: (row.reference as string | null) ?? undefined,
    patientId: (row.patient_id as string | null) ?? undefined,
    intakeTarget: (row.intake_target as Session['intakeTarget'] | null) ?? undefined,
    status: (row.status as SessionStatus) || 'recorded',
    durationSec: Number(row.duration_sec || 0),
    consentGiven: Boolean(row.consent_given),
    modelTierUsed: (row.model_tier_used as ModelTier | null) ?? undefined,
    audioDeleted: Boolean(row.audio_deleted),
    audioFileName: (row.audio_file_name as string | null) ?? undefined,
    recordedDeviceId: (row.recorded_device_id as string | null) ?? undefined,
    recordedDeviceLabel: (row.recorded_device_label as string | null) ?? undefined,
    audioCloudStatus: (row.audio_cloud_status as Session['audioCloudStatus'] | null) ?? undefined,
    clinicalNote: (row.clinical_note as ClinicalNote | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapSegment(row: Record<string, unknown>): TranscriptSegment {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    start: Number(row.start_sec),
    end: Number(row.end_sec),
    text: String(row.text),
    originalText: String(row.original_text),
    speaker: (row.speaker as string | null) ?? undefined,
    edited: Boolean(row.edited),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function getStoredCurrencyFallback(workspaceId: string): CurrencyCode {
  if (typeof localStorage === 'undefined') return DEFAULT_CURRENCY;
  const raw = localStorage.getItem(`odontohelper_currency_${workspaceId}`);
  return (raw as CurrencyCode) || DEFAULT_CURRENCY;
}

function setStoredCurrencyFallback(workspaceId: string, currency?: CurrencyCode): void {
  if (typeof localStorage === 'undefined' || !currency) return;
  localStorage.setItem(`odontohelper_currency_${workspaceId}`, currency);
}

function getStoredShowCurrencyFallback(workspaceId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`odontohelper_show_currency_${workspaceId}`) === '1';
}

function setStoredShowCurrencyFallback(workspaceId: string, show?: boolean): void {
  if (typeof localStorage === 'undefined' || show === undefined) return;
  localStorage.setItem(`odontohelper_show_currency_${workspaceId}`, show ? '1' : '0');
}

function mapSettings(row: Record<string, unknown>): AppSettings {
  const wsId = String(row.workspace_id);
  const currency = (row.currency as CurrencyCode | undefined) || getStoredCurrencyFallback(wsId);
  const showCurrencyCode =
    row.show_currency_code !== undefined && row.show_currency_code !== null
      ? Boolean(row.show_currency_code)
      : getStoredShowCurrencyFallback(wsId);
  return {
    id: String(row.id),
    workspaceId: wsId,
    modelTier: (row.model_tier as ModelTier) || getDefaultModelTier(),
    noiseSuppression: Boolean(row.noise_suppression),
    selectedAudioDeviceId: (row.selected_audio_device_id as string | null) ?? undefined,
    requireConsent: row.require_consent !== false,
    autoTranscribeOnStop: Boolean(row.auto_transcribe_on_stop),
    progressiveTranscription: row.progressive_transcription !== false,
    transcriptionMode: (row.transcription_mode as TranscriptionMode) || 'dental',
    theme: (row.theme as AppSettings['theme']) || 'light',
    currency,
    showCurrencyCode,
    audioCloudTier:
      row.audio_cloud_tier === 'premium_audio' ? 'premium_audio' : 'free',
    audioCloudAutoSync: Boolean(row.audio_cloud_auto_sync),
    updatedAt: Number(row.updated_at),
  };
}

function mapGlossary(row: Record<string, unknown>): GlossaryEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    incorrect: String(row.incorrect),
    correct: String(row.correct),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapPatient(row: Record<string, unknown>): Patient {
  const anamnesis = (row.anamnesis as PatientAnamnesis | null) ?? undefined;
  const meta = unpackPatientProfileMeta(anamnesis);
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    fullName: String(row.full_name),
    dni: (row.dni as string | null) ?? undefined,
    birthDate: (row.birth_date as string | null) ?? undefined,
    age: (row.age as string | null) ?? undefined,
    gender: meta.gender,
    phone: (row.phone as string | null) ?? undefined,
    secondaryPhone: meta.secondaryPhone,
    email: (row.email as string | null) ?? undefined,
    address: (row.address as string | null) ?? undefined,
    groupTag: meta.groupTag,
    photoDataUrl: meta.photoDataUrl,
    insuranceProvider: (row.insurance_provider as string | null) ?? undefined,
    insuranceNumber: (row.insurance_number as string | null) ?? undefined,
    allergies: (row.allergies as string | null) ?? undefined,
    medicalHistory: (row.medical_history as string | null) ?? undefined,
    chiefComplaint: (row.chief_complaint as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    anamnesis,
    physicalExam: meta.physicalExam,
    nextControlDate: meta.nextControlDate,
    nextControlNote: meta.nextControlNote,
    sourceSessionId: (row.source_session_id as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapProvider(row: Record<string, unknown>): Provider {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    category: (row.category as ProviderCategory) || 'otro',
    contactName: (row.contact_name as string | null) ?? undefined,
    taxId: (row.tax_id as string | null) ?? undefined,
    phone: (row.phone as string | null) ?? undefined,
    email: (row.email as string | null) ?? undefined,
    address: (row.address as string | null) ?? undefined,
    specialtyOrProducts: (row.specialty_or_products as string | null) ?? undefined,
    paymentTerms: (row.payment_terms as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    sourceSessionId: (row.source_session_id as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: (row.patient_id as string | null) ?? undefined,
    patientName: String(row.patient_name),
    providerId: (row.provider_id as string | null) ?? undefined,
    providerName: (row.provider_name as string | null) ?? undefined,
    professionalId: (row.professional_id as string | null) ?? undefined,
    professionalName: (row.professional_name as string | null) ?? undefined,
    date: String(row.date),
    startTime: String(row.start_time),
    durationMin: Number(row.duration_min || 30),
    procedure: String(row.procedure),
    status: (row.status as AppointmentStatus) || 'confirmed',
    notes: (row.notes as string | null) ?? undefined,
    sourceSessionId: (row.source_session_id as string | null) ?? undefined,
    autoCaptured: Boolean(row.auto_captured),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapActivity(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    actionType: row.action_type as ActivityActionType,
    entityType: row.entity_type as ActivityEntityType,
    entityId: (row.entity_id as string | null) ?? undefined,
    summary: String(row.summary),
    details: (row.details as string | null) ?? undefined,
    createdAt: Number(row.created_at),
  };
}

function mapProfessional(row: Record<string, unknown>): ClinicProfessional {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    fullName: String(row.full_name),
    specialty: (row.specialty as string | null) ?? undefined,
    licenseNumber: (row.license_number as string | null) ?? undefined,
    email: (row.email as string | null) ?? undefined,
    phone: (row.phone as string | null) ?? undefined,
    role: (row.role as ClinicRole) || 'odontologo',
    agendaColor: String(row.agenda_color || '#0d9488'),
    canViewFinance: row.can_view_finance !== false,
    active: row.active !== false,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapEvolution(row: Record<string, unknown>): ClinicalEvolutionEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: String(row.patient_id),
    date: String(row.date),
    toothFdi: (row.tooth_fdi as string | null) ?? undefined,
    procedure: String(row.procedure),
    description: String(row.description),
    highlightColor: (row.highlight_color as EvolutionHighlightColor) || 'default',
    professionalId: (row.professional_id as string | null) ?? undefined,
    professionalName: (row.professional_name as string | null) ?? undefined,
    authorUserId: (row.author_user_id as string | null) ?? undefined,
    authorWorkspaceId: (row.author_workspace_id as string | null) ?? undefined,
    sourceSessionId: (row.source_session_id as string | null) ?? undefined,
    sourceTreatmentPlanId: (row.source_treatment_plan_id as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapOdontogram(row: Record<string, unknown>): OdontogramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: String(row.patient_id),
    label: String(row.label),
    dentition: (row.dentition as OdontogramRecord['dentition']) || 'adulto',
    teeth: ((row.teeth as Record<string, ToothRecord> | null) || {}),
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as string | null) ?? undefined,
    authorUserId: (row.author_user_id as string | null) ?? undefined,
    authorWorkspaceId: (row.author_workspace_id as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapPeriodontogram(row: Record<string, unknown>): PeriodontogramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: String(row.patient_id),
    label: String(row.label),
    teeth: ((row.teeth as Record<string, PeriodontogramToothData> | null) || {}),
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as string | null) ?? undefined,
    authorUserId: (row.author_user_id as string | null) ?? undefined,
    authorWorkspaceId: (row.author_workspace_id as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapTreatmentPlan(row: Record<string, unknown>): TreatmentPlan {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: String(row.patient_id),
    patientName: String(row.patient_name),
    title: String(row.title),
    currency: (row.currency as CurrencyCode) || DEFAULT_CURRENCY,
    status: (row.status as TreatmentPlanStatus) || 'presentado',
    professionalId: (row.professional_id as string | null) ?? undefined,
    professionalName: (row.professional_name as string | null) ?? undefined,
    items: Array.isArray(row.items) ? (row.items as TreatmentItem[]) : [],
    notes: (row.notes as string | null) ?? undefined,
    validUntil: (row.valid_until as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapFinancialTx(row: Record<string, unknown>): FinancialTransaction {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: (row.patient_id as string | null) ?? undefined,
    patientName: (row.patient_name as string | null) ?? undefined,
    type: row.type as TransactionType,
    currency: (row.currency as CurrencyCode) || DEFAULT_CURRENCY,
    amount: Number(row.amount || 0),
    paymentMethod: (row.payment_method as PaymentMethod) || 'efectivo',
    concept: String(row.concept),
    date: String(row.date),
    professionalId: (row.professional_id as string | null) ?? undefined,
    professionalName: (row.professional_name as string | null) ?? undefined,
    receiptNumber: (row.receipt_number as string | null) ?? undefined,
    sourceTreatmentPlanId: (row.source_treatment_plan_id as string | null) ?? undefined,
    sourceTreatmentItemId: (row.source_treatment_item_id as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

function mapLabOrder(row: Record<string, unknown>): LabOrder {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: (row.patient_id as string | null) ?? undefined,
    patientName: String(row.patient_name),
    providerId: (row.provider_id as string | null) ?? undefined,
    providerName: (row.provider_name as string | null) ?? undefined,
    workType: String(row.work_type),
    toothFdi: (row.tooth_fdi as string | null) ?? undefined,
    shade: (row.shade as string | null) ?? undefined,
    sentDate: (row.sent_date as string | null) ?? undefined,
    dueDate: (row.due_date as string | null) ?? undefined,
    receivedDate: (row.received_date as string | null) ?? undefined,
    cost: row.cost != null ? Number(row.cost) : undefined,
    currency: (row.currency as CurrencyCode) || DEFAULT_CURRENCY,
    status: (row.status as LabOrderStatus) || 'sin_enviar',
    notes: (row.notes as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

/* ============================================================================
 * Supabase Auth & Workspace Provider
 * ============================================================================ */

export class SupabaseAuthProvider implements IAuthProvider {
  private async ensureProvisioned(): Promise<{ workspace: Workspace; profile: Profile }> {
    const supabase = requireClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error('AUTH_REQUIRED');
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', existingProfile.workspace_id)
        .maybeSingle();

      if (existingWs) {
        return {
          workspace: mapWorkspace(existingWs),
          profile: mapProfile(existingProfile),
        };
      }
    }

    // Fallback bootstrap in case user existed before trigger installation
    const now = Date.now();
    const compactId = user.id.replace(/-/g, '');
    const wsId = `ws_${compactId}`;
    const profId = `prof_${compactId}`;
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Odontólogo';

    const wsPayload = {
      id: wsId,
      owner_id: user.id,
      name: `Consultorio ${fullName}`,
      slug: `consultorio-${compactId.slice(0, 8)}`,
      created_at: now,
      updated_at: now,
    };

    const { error: wsInsertErr } = await supabase
      .from('workspaces')
      .upsert(wsPayload, { onConflict: 'id' });
    if (wsInsertErr) throw wsInsertErr;

    const profPayload = {
      id: profId,
      user_id: user.id,
      workspace_id: wsId,
      full_name: fullName,
      role: 'owner',
      created_at: now,
      updated_at: now,
    };

    const { error: profInsertErr } = await supabase
      .from('profiles')
      .upsert(profPayload, { onConflict: 'user_id' });
    if (profInsertErr) throw profInsertErr;

    return {
      workspace: mapWorkspace(wsPayload),
      profile: mapProfile(profPayload),
    };
  }

  public async getCurrentWorkspace(): Promise<Workspace> {
    const { workspace } = await this.ensureProvisioned();
    return workspace;
  }

  public async getCurrentProfile(): Promise<Profile> {
    const { profile } = await this.ensureProvisioned();
    return profile;
  }
}

/* ============================================================================
 * Sessions & Transcripts
 * ============================================================================ */

export class SupabaseSessionRepository implements ISessionRepository {
  public async getAll(workspaceId: string): Promise<Session[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSession);
  }

  public async getById(id: string): Promise<Session | undefined> {
    const supabase = requireClient();
    const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : undefined;
  }

  public async create(session: Session): Promise<void> {
    const supabase = requireClient();
    const row: Record<string, unknown> = {
      id: session.id,
      workspace_id: session.workspaceId,
      title: session.title,
      reference: session.reference ?? null,
      patient_id: session.patientId ?? null,
      intake_target: session.intakeTarget ?? null,
      status: session.status,
      duration_sec: session.durationSec,
      consent_given: session.consentGiven,
      model_tier_used: session.modelTierUsed ?? null,
      audio_deleted: session.audioDeleted,
      audio_file_name: session.audioFileName ?? null,
      recorded_device_id: session.recordedDeviceId ?? null,
      recorded_device_label: session.recordedDeviceLabel ?? null,
      audio_cloud_status: session.audioCloudStatus ?? 'local_only',
      clinical_note: session.clinicalNote ?? null,
      error: session.error ?? null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      deleted_at: session.deletedAt ?? null,
    };
    const { error } = await supabase.from('sessions').upsert(row);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (
        msg.includes('audio_file_name') ||
        msg.includes('recorded_device') ||
        msg.includes('audio_cloud_status')
      ) {
        delete row.audio_file_name;
        delete row.recorded_device_id;
        delete row.recorded_device_label;
        delete row.audio_cloud_status;
        const { error: retryErr } = await supabase.from('sessions').upsert(row);
        if (retryErr) throw retryErr;
        return;
      }
      throw error;
    }
  }

  public async update(id: string, patch: Partial<Session>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.reference !== undefined) payload.reference = patch.reference;
    if (patch.patientId !== undefined) payload.patient_id = patch.patientId ?? null;
    if (patch.intakeTarget !== undefined) payload.intake_target = patch.intakeTarget ?? null;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.durationSec !== undefined) payload.duration_sec = patch.durationSec;
    if (patch.consentGiven !== undefined) payload.consent_given = patch.consentGiven;
    if (patch.modelTierUsed !== undefined) payload.model_tier_used = patch.modelTierUsed ?? null;
    if (patch.audioDeleted !== undefined) payload.audio_deleted = patch.audioDeleted;
    if (patch.audioFileName !== undefined) payload.audio_file_name = patch.audioFileName ?? null;
    if (patch.recordedDeviceId !== undefined) {
      payload.recorded_device_id = patch.recordedDeviceId ?? null;
    }
    if (patch.recordedDeviceLabel !== undefined) {
      payload.recorded_device_label = patch.recordedDeviceLabel ?? null;
    }
    if (patch.audioCloudStatus !== undefined) {
      payload.audio_cloud_status = patch.audioCloudStatus ?? 'local_only';
    }
    if (patch.clinicalNote !== undefined) payload.clinical_note = patch.clinicalNote ?? null;
    if (patch.error !== undefined) payload.error = patch.error ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;

    const { error } = await supabase.from('sessions').update(payload).eq('id', id);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (
        msg.includes('audio_file_name') ||
        msg.includes('recorded_device') ||
        msg.includes('audio_cloud_status')
      ) {
        delete payload.audio_file_name;
        delete payload.recorded_device_id;
        delete payload.recorded_device_label;
        delete payload.audio_cloud_status;
        const { error: retryErr } = await supabase.from('sessions').update(payload).eq('id', id);
        if (retryErr) throw retryErr;
        return;
      }
      throw error;
    }
  }

  public async delete(id: string): Promise<void> {
    const now = Date.now();
    await this.update(id, { deletedAt: now, updatedAt: now });
  }

  public async findUnclosedRecording(workspaceId: string): Promise<Session | undefined> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'recording')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : undefined;
  }
}

export class SupabaseTranscriptRepository implements ITranscriptRepository {
  public async getBySessionId(sessionId: string): Promise<TranscriptSegment[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('transcript_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('start_sec', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSegment);
  }

  public async addSegment(segment: TranscriptSegment): Promise<void> {
    await this.saveSegments([segment]);
  }

  public async saveSegments(segments: TranscriptSegment[]): Promise<void> {
    if (segments.length === 0) return;
    const supabase = requireClient();
    const rows = segments.map((seg) => ({
      id: seg.id,
      session_id: seg.sessionId,
      start_sec: seg.start,
      end_sec: seg.end,
      text: seg.text,
      original_text: seg.originalText,
      speaker: seg.speaker ?? null,
      edited: seg.edited,
      created_at: seg.createdAt,
      updated_at: seg.updatedAt,
    }));
    const { error } = await supabase.from('transcript_segments').upsert(rows);
    if (error) throw error;
  }

  public async updateSegment(id: string, text: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('transcript_segments')
      .update({ text, edited: true, updated_at: Date.now() })
      .eq('id', id);
    if (error) throw error;
  }

  public async updateSegmentSpeaker(id: string, speaker: string | undefined): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('transcript_segments')
      .update({ speaker: speaker ?? null, updated_at: Date.now() })
      .eq('id', id);
    if (error) throw error;
  }

  public async deleteSegment(id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('transcript_segments').delete().eq('id', id);
    if (error) throw error;
  }

  public async deleteBySessionId(sessionId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('transcript_segments')
      .delete()
      .eq('session_id', sessionId);
    if (error) throw error;
  }
}

/* ============================================================================
 * Settings & Glossary
 * ============================================================================ */

export class SupabaseSettingsRepository implements ISettingsRepository {
  public async get(workspaceId: string): Promise<AppSettings> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (data) return mapSettings(data);

    const defaults: AppSettings = {
      id: `settings_${workspaceId}`,
      workspaceId,
      modelTier: getDefaultModelTier(),
      noiseSuppression: false,
      selectedAudioDeviceId: undefined,
      requireConsent: true,
      autoTranscribeOnStop: false,
      progressiveTranscription: true,
      transcriptionMode: 'dental',
      theme: 'light',
      currency: getStoredCurrencyFallback(workspaceId),
      showCurrencyCode: getStoredShowCurrencyFallback(workspaceId),
      audioCloudTier: 'free',
      audioCloudAutoSync: false,
      updatedAt: Date.now(),
    };

    const row: Record<string, unknown> = {
      id: defaults.id,
      workspace_id: defaults.workspaceId,
      model_tier: defaults.modelTier,
      noise_suppression: defaults.noiseSuppression,
      selected_audio_device_id: null,
      require_consent: defaults.requireConsent,
      auto_transcribe_on_stop: defaults.autoTranscribeOnStop,
      progressive_transcription: defaults.progressiveTranscription,
      transcription_mode: defaults.transcriptionMode,
      theme: defaults.theme,
      currency: defaults.currency,
      show_currency_code: Boolean(defaults.showCurrencyCode),
      audio_cloud_tier: defaults.audioCloudTier,
      audio_cloud_auto_sync: Boolean(defaults.audioCloudAutoSync),
      updated_at: defaults.updatedAt,
    };

    const { error: insertErr } = await supabase.from('settings').upsert(row);
    if (insertErr) {
      const msg = String(insertErr.message || '').toLowerCase();
      if (
        msg.includes('currency') ||
        msg.includes('show_currency_code') ||
        msg.includes('audio_cloud_')
      ) {
        delete row.currency;
        delete row.show_currency_code;
        delete row.audio_cloud_tier;
        delete row.audio_cloud_auto_sync;
        const { error: retryErr } = await supabase.from('settings').upsert(row);
        if (retryErr) throw retryErr;
      } else {
        throw insertErr;
      }
    }
    return defaults;
  }

  public async update(workspaceId: string, patch: Partial<AppSettings>): Promise<void> {
    const current = await this.get(workspaceId);
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.modelTier !== undefined) payload.model_tier = patch.modelTier;
    if (patch.noiseSuppression !== undefined) payload.noise_suppression = patch.noiseSuppression;
    if ('selectedAudioDeviceId' in patch) {
      payload.selected_audio_device_id = patch.selectedAudioDeviceId ?? null;
    }
    if (patch.requireConsent !== undefined) payload.require_consent = patch.requireConsent;
    if (patch.autoTranscribeOnStop !== undefined) {
      payload.auto_transcribe_on_stop = patch.autoTranscribeOnStop;
    }
    if (patch.progressiveTranscription !== undefined) {
      payload.progressive_transcription = patch.progressiveTranscription;
    }
    if (patch.transcriptionMode !== undefined) {
      payload.transcription_mode = patch.transcriptionMode;
    }
    if (patch.theme !== undefined) payload.theme = patch.theme;
    if (patch.currency !== undefined) {
      payload.currency = patch.currency;
      setStoredCurrencyFallback(workspaceId, patch.currency);
    }
    if (patch.showCurrencyCode !== undefined) {
      payload.show_currency_code = patch.showCurrencyCode;
      setStoredShowCurrencyFallback(workspaceId, patch.showCurrencyCode);
    }
    if (patch.audioCloudTier !== undefined) {
      payload.audio_cloud_tier = patch.audioCloudTier;
    }
    if (patch.audioCloudAutoSync !== undefined) {
      payload.audio_cloud_auto_sync = patch.audioCloudAutoSync;
    }

    const { error } = await supabase.from('settings').update(payload).eq('id', current.id);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (
        msg.includes('currency') ||
        msg.includes('show_currency_code') ||
        msg.includes('audio_cloud_')
      ) {
        delete payload.currency;
        delete payload.show_currency_code;
        delete payload.audio_cloud_tier;
        delete payload.audio_cloud_auto_sync;
        if (Object.keys(payload).length > 1) {
          const { error: retryErr } = await supabase
            .from('settings')
            .update(payload)
            .eq('id', current.id);
          if (retryErr) throw retryErr;
        }
        return;
      }
      throw error;
    }
  }
}

export class SupabaseGlossaryRepository implements IGlossaryRepository {
  public async getAll(workspaceId: string): Promise<GlossaryEntry[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('glossary')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('incorrect', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapGlossary);
  }

  public async add(entry: GlossaryEntry): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('glossary').upsert({
      id: entry.id,
      workspace_id: entry.workspaceId,
      incorrect: entry.incorrect,
      correct: entry.correct,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    });
    if (error) throw error;
  }

  public async remove(id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('glossary').delete().eq('id', id);
    if (error) throw error;
  }

  public async update(id: string, incorrect: string, correct: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('glossary')
      .update({ incorrect, correct, updated_at: Date.now() })
      .eq('id', id);
    if (error) throw error;
  }

  public async seedDefaultsIfEmpty(workspaceId: string): Promise<void> {
    const existing = await this.getAll(workspaceId);
    const existingSet = new Set(existing.map((e) => e.incorrect.toLowerCase().trim()));
    const now = Date.now();
    const toInsert = DEFAULT_DENTAL_GLOSSARY.filter(
      (g) => !existingSet.has(g.incorrect.toLowerCase().trim())
    ).map((g, idx) => ({
      id: `glossary_${workspaceId.slice(0, 12)}_${idx}_${now}`,
      workspace_id: workspaceId,
      incorrect: g.incorrect,
      correct: g.correct,
      created_at: now,
      updated_at: now,
    }));

    if (toInsert.length > 0) {
      const supabase = requireClient();
      const { error } = await supabase.from('glossary').upsert(toInsert);
      if (error) throw error;
    }
  }
}

/* ============================================================================
 * EMR Repositories (Patients, Providers, Appointments, Activity Logs)
 * ============================================================================ */

export class SupabasePatientRepository {
  public async getAll(_workspaceId: string): Promise<Patient[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPatient);
  }

  public async getById(id: string): Promise<Patient | undefined> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPatient(data) : undefined;
  }

  public async create(patient: Patient): Promise<void> {
    const supabase = requireClient();
    const packedAnamnesis = packPatientAnamnesis(patient, patient.anamnesis);
    const { error } = await supabase.from('patients').upsert({
      id: patient.id,
      workspace_id: patient.workspaceId,
      full_name: patient.fullName,
      dni: patient.dni ?? null,
      birth_date: patient.birthDate ?? null,
      age: patient.age ?? null,
      phone: patient.phone ?? null,
      email: patient.email ?? null,
      address: patient.address ?? null,
      insurance_provider: patient.insuranceProvider ?? null,
      insurance_number: patient.insuranceNumber ?? null,
      allergies: patient.allergies ?? null,
      medical_history: patient.medicalHistory ?? null,
      chief_complaint: patient.chiefComplaint ?? null,
      notes: patient.notes ?? null,
      anamnesis: packedAnamnesis ?? null,
      source_session_id: patient.sourceSessionId ?? null,
      created_at: patient.createdAt,
      updated_at: patient.updatedAt,
      deleted_at: patient.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<Patient>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.fullName !== undefined) payload.full_name = patch.fullName;
    if (patch.dni !== undefined) payload.dni = patch.dni ?? null;
    if (patch.birthDate !== undefined) payload.birth_date = patch.birthDate ?? null;
    if (patch.age !== undefined) payload.age = patch.age ?? null;
    if (patch.phone !== undefined) payload.phone = patch.phone ?? null;
    if (patch.email !== undefined) payload.email = patch.email ?? null;
    if (patch.address !== undefined) payload.address = patch.address ?? null;
    if (patch.insuranceProvider !== undefined) {
      payload.insurance_provider = patch.insuranceProvider ?? null;
    }
    if (patch.insuranceNumber !== undefined) {
      payload.insurance_number = patch.insuranceNumber ?? null;
    }
    if (patch.allergies !== undefined) payload.allergies = patch.allergies ?? null;
    if (patch.medicalHistory !== undefined) payload.medical_history = patch.medicalHistory ?? null;
    if (patch.chiefComplaint !== undefined) payload.chief_complaint = patch.chiefComplaint ?? null;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    const hasMetaPatch =
      'gender' in patch ||
      'secondaryPhone' in patch ||
      'groupTag' in patch ||
      'photoDataUrl' in patch ||
      'physicalExam' in patch ||
      'nextControlDate' in patch ||
      'nextControlNote' in patch;
    if (patch.anamnesis !== undefined || hasMetaPatch) {
      const existing = await this.getById(id);
      payload.anamnesis = packPatientAnamnesis(patch, existing?.anamnesis) ?? null;
    }
    if (patch.sourceSessionId !== undefined) {
      payload.source_session_id = patch.sourceSessionId ?? null;
    }
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;

    const { error } = await supabase.from('patients').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseProviderRepository {
  public async getAll(workspaceId: string): Promise<Provider[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProvider);
  }

  public async getById(id: string): Promise<Provider | undefined> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProvider(data) : undefined;
  }

  public async create(provider: Provider): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('providers').upsert({
      id: provider.id,
      workspace_id: provider.workspaceId,
      name: provider.name,
      category: provider.category,
      contact_name: provider.contactName ?? null,
      tax_id: provider.taxId ?? null,
      phone: provider.phone ?? null,
      email: provider.email ?? null,
      address: provider.address ?? null,
      specialty_or_products: provider.specialtyOrProducts ?? null,
      payment_terms: provider.paymentTerms ?? null,
      notes: provider.notes ?? null,
      source_session_id: provider.sourceSessionId ?? null,
      created_at: provider.createdAt,
      updated_at: provider.updatedAt,
      deleted_at: provider.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<Provider>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.contactName !== undefined) payload.contact_name = patch.contactName ?? null;
    if (patch.taxId !== undefined) payload.tax_id = patch.taxId ?? null;
    if (patch.phone !== undefined) payload.phone = patch.phone ?? null;
    if (patch.email !== undefined) payload.email = patch.email ?? null;
    if (patch.address !== undefined) payload.address = patch.address ?? null;
    if (patch.specialtyOrProducts !== undefined) {
      payload.specialty_or_products = patch.specialtyOrProducts ?? null;
    }
    if (patch.paymentTerms !== undefined) payload.payment_terms = patch.paymentTerms ?? null;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.sourceSessionId !== undefined) {
      payload.source_session_id = patch.sourceSessionId ?? null;
    }
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;

    const { error } = await supabase.from('providers').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseAppointmentRepository {
  public async getAll(workspaceId: string): Promise<Appointment[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapAppointment);
  }

  public async create(appointment: Appointment): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('appointments').upsert({
      id: appointment.id,
      workspace_id: appointment.workspaceId,
      patient_id: appointment.patientId ?? null,
      patient_name: appointment.patientName,
      provider_id: appointment.providerId ?? null,
      provider_name: appointment.providerName ?? null,
      professional_id: appointment.professionalId ?? null,
      professional_name: appointment.professionalName ?? null,
      date: appointment.date,
      start_time: appointment.startTime,
      duration_min: appointment.durationMin,
      procedure: appointment.procedure,
      status: appointment.status,
      notes: appointment.notes ?? null,
      source_session_id: appointment.sourceSessionId ?? null,
      auto_captured: Boolean(appointment.autoCaptured),
      created_at: appointment.createdAt,
      updated_at: appointment.updatedAt,
      deleted_at: appointment.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<Appointment>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.patientId !== undefined) payload.patient_id = patch.patientId ?? null;
    if (patch.patientName !== undefined) payload.patient_name = patch.patientName;
    if (patch.providerId !== undefined) payload.provider_id = patch.providerId ?? null;
    if (patch.providerName !== undefined) payload.provider_name = patch.providerName ?? null;
    if (patch.professionalId !== undefined) payload.professional_id = patch.professionalId ?? null;
    if (patch.professionalName !== undefined) payload.professional_name = patch.professionalName ?? null;
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.startTime !== undefined) payload.start_time = patch.startTime;
    if (patch.durationMin !== undefined) payload.duration_min = patch.durationMin;
    if (patch.procedure !== undefined) payload.procedure = patch.procedure;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.sourceSessionId !== undefined) {
      payload.source_session_id = patch.sourceSessionId ?? null;
    }
    if (patch.autoCaptured !== undefined) payload.auto_captured = patch.autoCaptured;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;

    const { error } = await supabase.from('appointments').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseActivityRepository {
  public async getAll(workspaceId: string, limit = 250): Promise<ActivityLogEntry[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(mapActivity);
  }

  public async add(entry: ActivityLogEntry): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('activity_logs').upsert({
      id: entry.id,
      workspace_id: entry.workspaceId,
      action_type: entry.actionType,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      summary: entry.summary,
      details: entry.details ?? null,
      created_at: entry.createdAt,
    });
    if (error) throw error;
  }

  public async clearAll(workspaceId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }
}

/* ============================================================================
 * OdontoHelper Extended Clinic Repositories
 * ============================================================================ */

export class SupabaseProfessionalRepository {
  public async getAll(workspaceId: string): Promise<ClinicProfessional[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('clinic_professionals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapProfessional);
  }

  public async create(prof: ClinicProfessional): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('clinic_professionals').upsert({
      id: prof.id,
      workspace_id: prof.workspaceId,
      full_name: prof.fullName,
      specialty: prof.specialty ?? null,
      license_number: prof.licenseNumber ?? null,
      email: prof.email ?? null,
      phone: prof.phone ?? null,
      role: prof.role,
      agenda_color: prof.agendaColor,
      can_view_finance: prof.canViewFinance,
      active: prof.active,
      created_at: prof.createdAt,
      updated_at: prof.updatedAt,
      deleted_at: prof.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<ClinicProfessional>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.fullName !== undefined) payload.full_name = patch.fullName;
    if (patch.specialty !== undefined) payload.specialty = patch.specialty ?? null;
    if (patch.licenseNumber !== undefined) payload.license_number = patch.licenseNumber ?? null;
    if (patch.email !== undefined) payload.email = patch.email ?? null;
    if (patch.phone !== undefined) payload.phone = patch.phone ?? null;
    if (patch.role !== undefined) payload.role = patch.role;
    if (patch.agendaColor !== undefined) payload.agenda_color = patch.agendaColor;
    if (patch.canViewFinance !== undefined) payload.can_view_finance = patch.canViewFinance;
    if (patch.active !== undefined) payload.active = patch.active;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('clinic_professionals').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseEvolutionRepository {
  public async getAll(_workspaceId: string): Promise<ClinicalEvolutionEntry[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('clinical_evolutions')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapEvolution);
  }

  public async create(entry: ClinicalEvolutionEntry): Promise<void> {
    const supabase = requireClient();
    const row: Record<string, unknown> = {
      id: entry.id,
      workspace_id: entry.workspaceId,
      patient_id: entry.patientId,
      date: entry.date,
      tooth_fdi: entry.toothFdi ?? null,
      procedure: entry.procedure,
      description: entry.description,
      highlight_color: entry.highlightColor,
      professional_id: entry.professionalId ?? null,
      professional_name: entry.professionalName ?? null,
      source_session_id: entry.sourceSessionId ?? null,
      source_treatment_plan_id: entry.sourceTreatmentPlanId ?? null,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      deleted_at: entry.deletedAt ?? null,
    };
    if (entry.authorUserId) row.author_user_id = entry.authorUserId;
    if (entry.authorWorkspaceId) row.author_workspace_id = entry.authorWorkspaceId;
    const { error } = await supabase.from('clinical_evolutions').upsert(row);
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<ClinicalEvolutionEntry>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.toothFdi !== undefined) payload.tooth_fdi = patch.toothFdi ?? null;
    if (patch.procedure !== undefined) payload.procedure = patch.procedure;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.highlightColor !== undefined) payload.highlight_color = patch.highlightColor;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('clinical_evolutions').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseOdontogramRepository {
  public async getAll(_workspaceId: string): Promise<OdontogramRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('odontograms')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapOdontogram);
  }

  public async create(rec: OdontogramRecord): Promise<void> {
    const supabase = requireClient();
    const row: Record<string, unknown> = {
      id: rec.id,
      workspace_id: rec.workspaceId,
      patient_id: rec.patientId,
      label: rec.label,
      dentition: rec.dentition,
      teeth: rec.teeth,
      notes: rec.notes ?? null,
      created_by: rec.createdBy ?? null,
      created_at: rec.createdAt,
      updated_at: rec.updatedAt,
      deleted_at: rec.deletedAt ?? null,
    };
    if (rec.authorUserId) row.author_user_id = rec.authorUserId;
    if (rec.authorWorkspaceId) row.author_workspace_id = rec.authorWorkspaceId;
    const { error } = await supabase.from('odontograms').upsert(row);
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<OdontogramRecord>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.label !== undefined) payload.label = patch.label;
    if (patch.dentition !== undefined) payload.dentition = patch.dentition;
    if (patch.teeth !== undefined) payload.teeth = patch.teeth;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('odontograms').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabasePeriodontogramRepository {
  public async getAll(_workspaceId: string): Promise<PeriodontogramRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('periodontograms')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPeriodontogram);
  }

  public async create(rec: PeriodontogramRecord): Promise<void> {
    const supabase = requireClient();
    const row: Record<string, unknown> = {
      id: rec.id,
      workspace_id: rec.workspaceId,
      patient_id: rec.patientId,
      label: rec.label,
      teeth: rec.teeth,
      notes: rec.notes ?? null,
      created_by: rec.createdBy ?? null,
      created_at: rec.createdAt,
      updated_at: rec.updatedAt,
      deleted_at: rec.deletedAt ?? null,
    };
    if (rec.authorUserId) row.author_user_id = rec.authorUserId;
    if (rec.authorWorkspaceId) row.author_workspace_id = rec.authorWorkspaceId;
    const { error } = await supabase.from('periodontograms').upsert(row);
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<PeriodontogramRecord>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.label !== undefined) payload.label = patch.label;
    if (patch.teeth !== undefined) payload.teeth = patch.teeth;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('periodontograms').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseTreatmentPlanRepository {
  public async getAll(workspaceId: string): Promise<TreatmentPlan[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTreatmentPlan);
  }

  public async create(plan: TreatmentPlan): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('treatment_plans').upsert({
      id: plan.id,
      workspace_id: plan.workspaceId,
      patient_id: plan.patientId,
      patient_name: plan.patientName,
      title: plan.title,
      currency: plan.currency,
      status: plan.status,
      professional_id: plan.professionalId ?? null,
      professional_name: plan.professionalName ?? null,
      items: plan.items,
      notes: plan.notes ?? null,
      valid_until: plan.validUntil ?? null,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
      deleted_at: plan.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<TreatmentPlan>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.currency !== undefined) payload.currency = patch.currency;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.professionalId !== undefined) payload.professional_id = patch.professionalId ?? null;
    if (patch.professionalName !== undefined) payload.professional_name = patch.professionalName ?? null;
    if (patch.items !== undefined) payload.items = patch.items;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.validUntil !== undefined) payload.valid_until = patch.validUntil ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('treatment_plans').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseFinancialTransactionRepository {
  public async getAll(workspaceId: string): Promise<FinancialTransaction[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFinancialTx);
  }

  public async create(tx: FinancialTransaction): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('financial_transactions').upsert({
      id: tx.id,
      workspace_id: tx.workspaceId,
      patient_id: tx.patientId ?? null,
      patient_name: tx.patientName ?? null,
      type: tx.type,
      currency: tx.currency,
      amount: tx.amount,
      payment_method: tx.paymentMethod,
      concept: tx.concept,
      date: tx.date,
      professional_id: tx.professionalId ?? null,
      professional_name: tx.professionalName ?? null,
      receipt_number: tx.receiptNumber ?? null,
      source_treatment_plan_id: tx.sourceTreatmentPlanId ?? null,
      source_treatment_item_id: tx.sourceTreatmentItemId ?? null,
      notes: tx.notes ?? null,
      created_at: tx.createdAt,
      updated_at: tx.updatedAt,
      deleted_at: tx.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<FinancialTransaction>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if (patch.amount !== undefined) payload.amount = patch.amount;
    if (patch.paymentMethod !== undefined) payload.payment_method = patch.paymentMethod;
    if (patch.concept !== undefined) payload.concept = patch.concept;
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('financial_transactions').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseLabOrderRepository {
  public async getAll(workspaceId: string): Promise<LabOrder[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('lab_orders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapLabOrder);
  }

  public async create(order: LabOrder): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('lab_orders').upsert({
      id: order.id,
      workspace_id: order.workspaceId,
      patient_id: order.patientId ?? null,
      patient_name: order.patientName,
      provider_id: order.providerId ?? null,
      provider_name: order.providerName ?? null,
      work_type: order.workType,
      tooth_fdi: order.toothFdi ?? null,
      shade: order.shade ?? null,
      sent_date: order.sentDate ?? null,
      due_date: order.dueDate ?? null,
      received_date: order.receivedDate ?? null,
      cost: order.cost ?? null,
      currency: order.currency,
      status: order.status,
      notes: order.notes ?? null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      deleted_at: order.deletedAt ?? null,
    });
    if (error) throw error;
  }

  public async update(id: string, patch: Partial<LabOrder>): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = { updated_at: Date.now() };
    if ('patientId' in patch) payload.patient_id = patch.patientId ?? null;
    if ('patientName' in patch && patch.patientName !== undefined) payload.patient_name = patch.patientName;
    if ('providerId' in patch) payload.provider_id = patch.providerId ?? null;
    if ('providerName' in patch) payload.provider_name = patch.providerName ?? null;
    if ('workType' in patch && patch.workType !== undefined) payload.work_type = patch.workType;
    if ('toothFdi' in patch) payload.tooth_fdi = patch.toothFdi ?? null;
    if ('shade' in patch) payload.shade = patch.shade ?? null;
    if ('sentDate' in patch) payload.sent_date = patch.sentDate ?? null;
    if ('dueDate' in patch) payload.due_date = patch.dueDate ?? null;
    if ('receivedDate' in patch) payload.received_date = patch.receivedDate ?? null;
    if ('cost' in patch) payload.cost = patch.cost ?? null;
    if ('currency' in patch && patch.currency !== undefined) payload.currency = patch.currency;
    if ('status' in patch && patch.status !== undefined) payload.status = patch.status;
    if ('notes' in patch) payload.notes = patch.notes ?? null;
    if ('deletedAt' in patch) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('lab_orders').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

const PATIENT_FILES_BUCKET = 'patient-files';

function mapPatientFile(row: Record<string, unknown>): PatientFileAttachment {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    patientId: String(row.patient_id),
    name: String(row.name),
    category: (row.category as PatientFileCategory) || 'radiografia',
    mimeType: String(row.mime_type || 'application/octet-stream'),
    sizeBytes: Number(row.size_bytes || 0),
    dataUrl: String(row.data_url || ''),
    storagePath: (row.storage_path as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    uploadedBy: (row.uploaded_by as string | null) ?? undefined,
    authorUserId: (row.author_user_id as string | null) ?? undefined,
    authorWorkspaceId: (row.author_workspace_id as string | null) ?? undefined,
    capturedAt: String(row.captured_at || ''),
    createdAt: Number(row.created_at),
  };
}

function isMissingPatientFilesTable(error: unknown): boolean {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '').toLowerCase()
      : '';
  return (
    msg.includes('patient_files') &&
    (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache'))
  );
}

function buildMissingTableError(): Error {
  return new Error(
    "La tabla 'patient_files' no existe en Supabase. Ejecutá el esquema SQL para almacenar radiografías y archivos clínicos en la nube."
  );
}

function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || fallbackMime || 'application/octet-stream';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function sanitizeStorageExt(name: string, mimeType: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx >= 0) {
    const ext = name.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext) return ext;
  }
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'bin';
}

async function resolveStorageSignedUrls(
  supabase: ReturnType<typeof requireClient>,
  files: PatientFileAttachment[]
): Promise<PatientFileAttachment[]> {
  if (!supabase.storage || typeof supabase.storage.from !== 'function') {
    return files;
  }
  const pathsNeedingUrl = files
    .filter((f) => Boolean(f.storagePath) && !f.dataUrl)
    .map((f) => f.storagePath!);
  if (pathsNeedingUrl.length === 0) return files;

  try {
    const bucket = supabase.storage.from(PATIENT_FILES_BUCKET);
    if (typeof bucket.createSignedUrls === 'function') {
      const { data } = await bucket.createSignedUrls(pathsNeedingUrl, 3600);
      if (Array.isArray(data)) {
        const urlMap = new Map<string, string>();
        data.forEach((entry: { path?: string | null; signedUrl?: string | null }) => {
          if (entry?.path && entry?.signedUrl) {
            urlMap.set(entry.path, entry.signedUrl);
          }
        });
        return files.map((f) =>
          f.storagePath && !f.dataUrl && urlMap.has(f.storagePath)
            ? { ...f, dataUrl: urlMap.get(f.storagePath)! }
            : f
        );
      }
    }
  } catch {
    // Keep existing metadata if signed URL batch fails
  }
  return files;
}

/**
 * Radiographs, clinical photos, and patient documents MUST live in Supabase
 * (`patient_files` + Supabase Storage bucket `patient-files`).
 * Never falls back to IndexedDB so files are always stored exclusively in the cloud.
 */
export class SupabasePatientFileStore implements IPatientFileStore {
  public async getAll(_workspaceId: string): Promise<PatientFileAttachment[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patient_files')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingPatientFilesTable(error)) {
        throw buildMissingTableError();
      }
      throw error;
    }
    return resolveStorageSignedUrls(supabase, (data || []).map(mapPatientFile));
  }

  public async getByPatientId(
    _workspaceId: string,
    patientId: string
  ): Promise<PatientFileAttachment[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patient_files')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingPatientFilesTable(error)) {
        throw buildMissingTableError();
      }
      throw error;
    }
    return resolveStorageSignedUrls(supabase, (data || []).map(mapPatientFile));
  }

  public async add(file: PatientFileAttachment): Promise<void> {
    const supabase = requireClient();
    let storagePath: string | undefined = file.storagePath;
    let persistedDataUrl = file.dataUrl;

    // Prefer Supabase Storage for binary blobs so Postgres rows remain lightweight
    if (
      !storagePath &&
      file.dataUrl.startsWith('data:') &&
      supabase.storage &&
      typeof supabase.storage.from === 'function'
    ) {
      const blob = dataUrlToBlob(file.dataUrl, file.mimeType);
      if (blob) {
        const ext = sanitizeStorageExt(file.name, file.mimeType);
        const candidatePath = `${file.workspaceId}/${file.patientId}/${file.id}.${ext}`;
        const bucket = supabase.storage.from(PATIENT_FILES_BUCKET);
        const { error: uploadErr } = await bucket.upload(candidatePath, blob, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: true,
        });
        if (!uploadErr) {
          storagePath = candidatePath;
          persistedDataUrl = '';
          file.storagePath = candidatePath;
          const { data: signed } = await bucket.createSignedUrl(candidatePath, 3600);
          if (signed?.signedUrl) {
            file.dataUrl = signed.signedUrl;
          }
        }
      }
    }

    const rowPayload: Record<string, unknown> = {
      id: file.id,
      workspace_id: file.workspaceId,
      patient_id: file.patientId,
      name: file.name,
      category: file.category,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      data_url: persistedDataUrl,
      notes: file.notes ?? null,
      captured_at: file.capturedAt,
      created_at: file.createdAt,
    };
    if (file.uploadedBy) rowPayload.uploaded_by = file.uploadedBy;
    if (file.authorUserId) rowPayload.author_user_id = file.authorUserId;
    if (file.authorWorkspaceId) rowPayload.author_workspace_id = file.authorWorkspaceId;
    if (storagePath) {
      rowPayload.storage_path = storagePath;
    }

    const { error } = await supabase.from('patient_files').upsert(rowPayload);
    if (error) {
      if (isMissingPatientFilesTable(error)) {
        throw buildMissingTableError();
      }
      throw error;
    }
  }

  public async delete(id: string): Promise<void> {
    const supabase = requireClient();
    let storagePathToRemove: string | null = null;
    if (supabase.storage && typeof supabase.storage.from === 'function') {
      const { data: existing } = await supabase
        .from('patient_files')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();
      storagePathToRemove = (existing?.storage_path as string | null) ?? null;
    }

    const { error } = await supabase.from('patient_files').delete().eq('id', id);
    if (error) {
      if (isMissingPatientFilesTable(error)) {
        throw buildMissingTableError();
      }
      throw error;
    }

    if (storagePathToRemove && supabase.storage && typeof supabase.storage.from === 'function') {
      await supabase.storage
        .from(PATIENT_FILES_BUCKET)
        .remove([storagePathToRemove])
        .catch(() => {});
    }
  }
}

/* ============================================================================
 * Colleague Patient Sharing (Single-use WhatsApp Invites & Permanent Links)
 * ============================================================================ */

function mapPatientShare(row: Record<string, unknown>): PatientShareLink {
  return {
    id: String(row.id),
    ownerWorkspaceId: String(row.owner_workspace_id),
    ownerUserId: (row.owner_user_id as string | null) ?? undefined,
    ownerName: String(row.owner_name),
    ownerSpecialty: (row.owner_specialty as string | null) ?? undefined,
    ownerLicense: (row.owner_license as string | null) ?? undefined,
    patientId: String(row.patient_id),
    patientNameSnapshot: String(row.patient_name_snapshot),
    inviteToken: String(row.invite_token),
    referralNote: (row.referral_note as string | null) ?? undefined,
    status: (row.status as PatientShareStatus) || 'pending',
    recipientWorkspaceId: (row.recipient_workspace_id as string | null) ?? undefined,
    recipientUserId: (row.recipient_user_id as string | null) ?? undefined,
    recipientName: (row.recipient_name as string | null) ?? undefined,
    recipientSpecialty: (row.recipient_specialty as string | null) ?? undefined,
    recipientLicense: (row.recipient_license as string | null) ?? undefined,
    acceptedAt: row.accepted_at != null ? Number(row.accepted_at) : undefined,
    revokedAt: row.revoked_at != null ? Number(row.revoked_at) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class SupabasePatientShareRepository {
  public async getAllForWorkspace(_workspaceId: string): Promise<PatientShareLink[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patient_shares')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('patient_shares') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
        return [];
      }
      throw error;
    }
    return (data || []).map(mapPatientShare);
  }

  public async create(share: PatientShareLink): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('patient_shares').insert({
      id: share.id,
      owner_workspace_id: share.ownerWorkspaceId,
      owner_user_id: share.ownerUserId,
      owner_name: share.ownerName,
      owner_specialty: share.ownerSpecialty ?? null,
      owner_license: share.ownerLicense ?? null,
      patient_id: share.patientId,
      patient_name_snapshot: share.patientNameSnapshot,
      invite_token: share.inviteToken,
      referral_note: share.referralNote ?? null,
      status: share.status,
      created_at: share.createdAt,
      updated_at: share.updatedAt,
    });
    if (error) throw error;
  }

  public async getPreviewByToken(
    token: string,
    _callerWorkspaceId?: string
  ): Promise<PatientSharePreview | null> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('get_patient_share_preview', {
      p_token: token,
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const raw = data as Record<string, unknown>;
    return {
      id: String(raw.id),
      ownerName: String(raw.ownerName || ''),
      ownerSpecialty: (raw.ownerSpecialty as string | null) ?? undefined,
      ownerLicense: (raw.ownerLicense as string | null) ?? undefined,
      patientId: String(raw.patientId),
      patientNameSnapshot: String(raw.patientNameSnapshot || ''),
      referralNote: (raw.referralNote as string | null) ?? undefined,
      status: (raw.status as PatientShareStatus) || 'pending',
      createdAt: Number(raw.createdAt || Date.now()),
      isOwnShare: Boolean(raw.isOwnShare),
    };
  }

  public async acceptShare(input: {
    token: string;
    recipientWorkspaceId: string;
    recipientUserId?: string;
    recipientName: string;
    recipientSpecialty?: string;
    recipientLicense?: string;
  }): Promise<{ id: string; patientId: string; ownerWorkspaceId: string }> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('accept_patient_share', {
      p_token: input.token,
      p_recipient_ws: input.recipientWorkspaceId,
      p_recipient_name: input.recipientName,
      p_recipient_specialty: input.recipientSpecialty ?? null,
      p_recipient_license: input.recipientLicense ?? null,
    });
    if (error) throw error;
    const raw = (data || {}) as Record<string, unknown>;
    return {
      id: String(raw.id || ''),
      patientId: String(raw.patientId || ''),
      ownerWorkspaceId: String(raw.ownerWorkspaceId || ''),
    };
  }

  public async unlinkShare(shareId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.rpc('unlink_patient_share', {
      p_share_id: shareId,
    });
    if (error) throw error;
  }
}

/* ============================================================================
 * Workspace Subscriptions & Bank Transfer Activation Requests
 * ============================================================================ */

function mapWorkspaceSubscription(row: Record<string, unknown>): WorkspaceSubscription {
  return {
    workspaceId: String(row.workspace_id),
    planTier: (row.plan_tier as SubscriptionPlanTier) || 'trial',
    billingCycle: (row.billing_cycle as SubscriptionBillingCycle) || 'monthly',
    status: (row.status as SubscriptionStatus) || 'trialing',
    trialStartsAt: Number(row.trial_starts_at),
    trialEndsAt: Number(row.trial_ends_at),
    currentPeriodStart: row.current_period_start != null ? Number(row.current_period_start) : undefined,
    currentPeriodEnd: row.current_period_end != null ? Number(row.current_period_end) : undefined,
    lastPaymentMethod: 'bank_transfer',
    pendingTransferId: (row.pending_transfer_id as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapTransferRequest(row: Record<string, unknown>): SubscriptionTransferRequest {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: (row.user_id as string | null) ?? undefined,
    requestedTier: (row.requested_tier as PaidSubscriptionPlanTier) || 'base',
    billingCycle: (row.billing_cycle as SubscriptionBillingCycle) || 'monthly',
    amountUsd: Number(row.amount_usd || 0),
    payerName: String(row.payer_name),
    bankName: String(row.bank_name),
    transferReference: String(row.transfer_reference),
    notes: (row.notes as string | null) ?? undefined,
    status: (row.status as TransferRequestStatus) || 'pending',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class SupabaseSubscriptionRepository {
  public async getForWorkspace(workspaceId: string): Promise<WorkspaceSubscription | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('workspace_subscriptions') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
        return null;
      }
      throw error;
    }

    if (data) {
      return mapWorkspaceSubscription(data);
    }

    // Fallback idempotent RPC for workspaces created prior to schema upgrade
    const { data: rpcData, error: rpcErr } = await supabase.rpc('ensure_my_workspace_trial', {
      p_workspace_id: workspaceId,
    });
    if (rpcErr || !rpcData || typeof rpcData !== 'object') {
      return null;
    }
    return mapWorkspaceSubscription(rpcData as Record<string, unknown>);
  }

  public async listTransferRequests(workspaceId: string): Promise<SubscriptionTransferRequest[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('subscription_transfer_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('subscription_transfer_requests') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
        return [];
      }
      throw error;
    }
    return (data || []).map(mapTransferRequest);
  }

  public async submitTransferRequest(req: SubscriptionTransferRequest): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('subscription_transfer_requests').insert({
      id: req.id,
      workspace_id: req.workspaceId,
      user_id: req.userId,
      requested_tier: req.requestedTier,
      billing_cycle: req.billingCycle,
      amount_usd: req.amountUsd,
      payer_name: req.payerName,
      bank_name: req.bankName,
      transfer_reference: req.transferReference,
      notes: req.notes ?? null,
      status: 'pending',
      created_at: req.createdAt,
      updated_at: req.updatedAt,
    });
    if (error) throw error;
  }
}

