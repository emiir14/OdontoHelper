import { DEFAULT_DENTAL_GLOSSARY } from '../../../config/glossary';
import {
  IAuthProvider,
  IGlossaryRepository,
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
  Patient,
  PatientAnamnesis,
  PaymentMethod,
  PeriodontogramRecord,
  PeriodontogramToothData,
  Profile,
  Provider,
  ProviderCategory,
  Session,
  SessionStatus,
  ToothRecord,
  TranscriptSegment,
  TranscriptionMode,
  TransactionType,
  TreatmentItem,
  TreatmentPlan,
  TreatmentPlanStatus,
  Workspace,
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

function mapSettings(row: Record<string, unknown>): AppSettings {
  const wsId = String(row.workspace_id);
  const currency = (row.currency as CurrencyCode | undefined) || getStoredCurrencyFallback(wsId);
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
    pinCode: (row.pin_code as string | null) ?? undefined,
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
    signedWithPin: Boolean(row.signed_with_pin),
    signedAt: row.signed_at != null ? Number(row.signed_at) : undefined,
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
    const { error } = await supabase.from('sessions').upsert({
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
      clinical_note: session.clinicalNote ?? null,
      error: session.error ?? null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      deleted_at: session.deletedAt ?? null,
    });
    if (error) throw error;
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
    if (patch.clinicalNote !== undefined) payload.clinical_note = patch.clinicalNote ?? null;
    if (patch.error !== undefined) payload.error = patch.error ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;

    const { error } = await supabase.from('sessions').update(payload).eq('id', id);
    if (error) throw error;
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
      updated_at: defaults.updatedAt,
    };

    const { error: insertErr } = await supabase.from('settings').upsert(row);
    if (insertErr) {
      if (String(insertErr.message || '').toLowerCase().includes('currency')) {
        delete row.currency;
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

    const { error } = await supabase.from('settings').update(payload).eq('id', current.id);
    if (error) {
      if (String(error.message || '').toLowerCase().includes('currency')) {
        delete payload.currency;
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
  public async getAll(workspaceId: string): Promise<Patient[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('workspace_id', workspaceId)
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
      pin_code: prof.pinCode ?? null,
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
    if (patch.pinCode !== undefined) payload.pin_code = patch.pinCode ?? null;
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
  public async getAll(workspaceId: string): Promise<ClinicalEvolutionEntry[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('clinical_evolutions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapEvolution);
  }

  public async create(entry: ClinicalEvolutionEntry): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('clinical_evolutions').upsert({
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
      signed_with_pin: entry.signedWithPin,
      signed_at: entry.signedAt ?? null,
      source_session_id: entry.sourceSessionId ?? null,
      source_treatment_plan_id: entry.sourceTreatmentPlanId ?? null,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      deleted_at: entry.deletedAt ?? null,
    });
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
    if (patch.signedWithPin !== undefined) payload.signed_with_pin = patch.signedWithPin;
    if (patch.signedAt !== undefined) payload.signed_at = patch.signedAt ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('clinical_evolutions').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}

export class SupabaseOdontogramRepository {
  public async getAll(workspaceId: string): Promise<OdontogramRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('odontograms')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapOdontogram);
  }

  public async create(rec: OdontogramRecord): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('odontograms').upsert({
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
    });
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
  public async getAll(workspaceId: string): Promise<PeriodontogramRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('periodontograms')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPeriodontogram);
  }

  public async create(rec: PeriodontogramRecord): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from('periodontograms').upsert({
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
    });
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
    if (patch.providerId !== undefined) payload.provider_id = patch.providerId ?? null;
    if (patch.providerName !== undefined) payload.provider_name = patch.providerName ?? null;
    if (patch.workType !== undefined) payload.work_type = patch.workType;
    if (patch.toothFdi !== undefined) payload.tooth_fdi = patch.toothFdi ?? null;
    if (patch.shade !== undefined) payload.shade = patch.shade ?? null;
    if (patch.sentDate !== undefined) payload.sent_date = patch.sentDate ?? null;
    if (patch.dueDate !== undefined) payload.due_date = patch.dueDate ?? null;
    if (patch.receivedDate !== undefined) payload.received_date = patch.receivedDate ?? null;
    if (patch.cost !== undefined) payload.cost = patch.cost ?? null;
    if (patch.currency !== undefined) payload.currency = patch.currency;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt ?? null;
    const { error } = await supabase.from('lab_orders').update(payload).eq('id', id);
    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    await this.update(id, { deletedAt: Date.now() });
  }
}
