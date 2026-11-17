import { create } from 'zustand';
import { applyGlossary } from '../../config/glossary';
import { isConsecutiveDuplicate, isHallucination } from '../../config/hallucinations';
import {
  sharedActivityRepo,
  sharedAppointmentRepo,
  sharedAudioStore,
  sharedAuthProvider,
  sharedEvolutionRepo,
  sharedFinancialTxRepo,
  sharedGlossaryRepo,
  sharedLabOrderRepo,
  sharedOdontogramRepo,
  sharedPatientFileStore,
  sharedPatientRepo,
  sharedPeriodontogramRepo,
  sharedProfessionalRepo,
  sharedProviderRepo,
  sharedSessionRepo,
  sharedSettingsRepo,
  sharedTranscriptRepo,
  sharedTreatmentPlanRepo,
} from '../adapters/repositoryRegistry';
import {
  clearNeonSession,
  getNeonToken,
  getNeonUserEmail,
  neonFetch,
  probeBackendHealth,
  setNeonSession,
} from '../adapters/neon/neonClient';
import { getSupabaseClient, isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import {
  extractAppointmentFromTranscript,
  extractPatientFromTranscript,
  extractProviderFromTranscript,
} from '../core/clinical/entityExtractor';
import { RecordingController, VuData } from '../core/audio/recordingController';
import {
  exportFullBackup,
  exportGlossaryJson,
  importGlossaryJson,
  restoreFullBackup,
} from '../core/export/backup';
import {
  DEFAULT_CURRENCY,
  calculateTreatmentItemSubtotal,
  getCurrencyMeta,
} from '../core/clinic/clinicHelpers';
import { seedDemoClinicData } from '../core/clinic/mockDataSeeder';
import { ReportTypeId } from '../core/clinic/reportEngine';
import {
  getSharedWhisperEngine,
  ProgressCallbackData,
  WhisperTranscriptionEngine,
} from '../core/transcription/engine';
import { BackgroundChunkTranscriber } from '../core/transcription/backgroundQueue';
import { checkModelCacheStatus, ModelCacheStatus } from '../core/transcription/modelCache';
import { PipelineProgress, TranscriptionPipeline } from '../core/transcription/pipeline';
import { getDefaultModelTier, shouldShowDownloadsTab } from '../core/runtime/platform';
import {
  ActivityActionType,
  ActivityEntityType,
  ActivityLogEntry,
  Appointment,
  AppointmentDraftInput,
  AppointmentStatus,
  AppSettings,
  AudioChunk,
  ClinicalEvolutionDraftInput,
  ClinicalEvolutionEntry,
  ClinicalNote,
  ClinicProfessional,
  ClinicProfessionalDraftInput,
  FinancialTransaction,
  FinancialTransactionDraftInput,
  GlossaryEntry,
  LabOrder,
  LabOrderDraftInput,
  LabOrderStatus,
  ModelTier,
  OdontogramRecord,
  Patient,
  PatientDraftInput,
  PatientFileAttachment,
  PatientFileCategory,
  PeriodontogramRecord,
  Profile,
  Provider,
  ProviderDraftInput,
  Session,
  TranscriptSegment,
  TranscriptionMode,
  TreatmentPlan,
  TreatmentPlanDraftInput,
  Workspace,
} from '../core/types';
import { wakeLockManager } from '../core/utils/wakeLockManager';

// Global singletons for repositories (structured EMR data -> Supabase when configured; audio & local imaging -> IndexedDB)
export const sessionRepo = sharedSessionRepo;
export const transcriptRepo = sharedTranscriptRepo;
export const audioStore = sharedAudioStore;
export const patientFileStore = sharedPatientFileStore;
export const glossaryRepo = sharedGlossaryRepo;
export const settingsRepo = sharedSettingsRepo;
export const authProvider = sharedAuthProvider;
export const patientRepo = sharedPatientRepo;
export const providerRepo = sharedProviderRepo;
export const appointmentRepo = sharedAppointmentRepo;
export const activityRepo = sharedActivityRepo;
export const professionalRepo = sharedProfessionalRepo;
export const evolutionRepo = sharedEvolutionRepo;
export const odontogramRepo = sharedOdontogramRepo;
export const periodontogramRepo = sharedPeriodontogramRepo;
export const treatmentPlanRepo = sharedTreatmentPlanRepo;
export const financialTxRepo = sharedFinancialTxRepo;
export const labOrderRepo = sharedLabOrderRepo;

export const backgroundChunkTranscriber = new BackgroundChunkTranscriber({
  getEngine: () => getSharedWhisperEngine(),
  getSettings: () => useAppStore.getState().settings,
  getCurrentSessionId: () => useAppStore.getState().currentSessionId,
  transcriptRepo,
  glossaryRepo,
  isModelCached: async (tier) => {
    const resolvedKey = tier === 'max' ? 'max' : 'balanced';
    const cachedInStore = useAppStore.getState().modelCacheStatuses[resolvedKey];
    if (cachedInStore) return cachedInStore.isCached;
    const status = await checkModelCacheStatus(resolvedKey);
    return status.isCached;
  },
  onSegmentAdded: (sessionId, segment) => {
    if (useAppStore.getState().currentSessionId === sessionId) {
      useAppStore.setState((state) => ({
        activeTranscript: [...state.activeTranscript, segment].sort((a, b) => a.start - b.start),
      }));
    }
  },
});

export type AppView =
  | 'home'
  | 'recording'
  | 'detail'
  | 'downloads'
  | 'privacy'
  | 'patients-search'
  | 'patient-new'
  | 'provider-new'
  | 'agenda'
  | 'budgets'
  | 'finance'
  | 'lab'
  | 'reports'
  | 'manage-patients'
  | 'manage-providers'
  | 'activity-log'
  | 'settings';

export interface VoiceIntakeDraft {
  target: 'patient' | 'provider';
  sessionId?: string;
  transcriptText: string;
  extractedPatient?: Partial<PatientDraftInput>;
  extractedProvider?: Partial<ProviderDraftInput>;
  createdAt: number;
}

interface AppState {
  currentView: AppView;
  currentSessionId: string | null;
  workspace: Workspace | null;
  profile: Profile | null;
  sessions: Session[];
  activeSession: Session | null;
  activeTranscript: TranscriptSegment[];
  settings: AppSettings | null;
  glossary: GlossaryEntry[];

  // EMR & Clinic State
  patients: Patient[];
  providers: Provider[];
  appointments: Appointment[];
  activityLogs: ActivityLogEntry[];
  professionals: ClinicProfessional[];
  activeProfessionalId: string | null;
  clinicalEvolutions: ClinicalEvolutionEntry[];
  odontograms: OdontogramRecord[];
  periodontograms: PeriodontogramRecord[];
  treatmentPlans: TreatmentPlan[];
  financialTransactions: FinancialTransaction[];
  labOrders: LabOrder[];
  patientFiles: PatientFileAttachment[];
  selectedPatientId: string | null;
  editingPatientId: string | null;
  editingProviderId: string | null;
  activeIntakeRecordingTarget: 'patient' | 'provider' | null;
  voiceIntakeDraft: VoiceIntakeDraft | null;

  // Recording State
  recordingController: RecordingController | null;
  isRecording: boolean;
  isPaused: boolean;
  isQuickDictationMode: boolean;
  appendingToSessionId: string | null;
  recordingDurationSec: number;
  dayPatientIndex: number;
  vu: VuData;
  lastSavedAt: number | null;
  silenceWarning: boolean;
  trackDisconnectedWarning: string | null;
  wakeLockActive: boolean;

  // Transcription & Model Cache State
  transcriptionPipeline: TranscriptionPipeline | null;
  transcribingSessionId: string | null;
  transcriptionProgress: PipelineProgress | null;
  transcriptionFallbackNotice: string | null;
  modelCacheStatuses: Record<'balanced' | 'max', ModelCacheStatus | null>;
  downloadingModelTier: 'balanced' | 'max' | null;
  modelDownloadProgress: number;

  // Auth & Agenda Navigation State
  authRequired: boolean;
  authEmail: string | null;
  micPermissionStatus: 'unknown' | 'granted' | 'denied';
  selectedAgendaDate: string | null;
  activeReportType: ReportTypeId;

  // Recovery & Modals
  unclosedSession: Session | null;
  showOnboarding: boolean;
  toastMessage: { text: string; type: 'info' | 'success' | 'warning' } | null;

  // Storage
  storageUsage: { usedBytes: number; quotaBytes: number };

  // Actions
  init: () => Promise<void>;
  signOutSupabase: () => Promise<void>;
  requestMicrophonePermission: () => Promise<boolean>;
  setAgendaDate: (date: string | null) => void;
  setReportType: (reportType: ReportTypeId) => void;
  setView: (view: AppView, sessionId?: string) => void;
  loadSessions: () => Promise<void>;
  loadEmrData: () => Promise<void>;
  loadSessionDetail: (sessionId: string) => Promise<void>;
  startRecording: (
    reference?: string,
    consentGiven?: boolean,
    options?: { isQuickDictation?: boolean; patientId?: string; intakeTarget?: 'consultation' | 'patient' | 'provider' }
  ) => Promise<void>;
  startIntakeRecording: (target: 'patient' | 'provider') => Promise<void>;
  applyTranscriptToIntake: (
    target: 'patient' | 'provider',
    transcriptText: string,
    sessionId?: string
  ) => void;
  clearVoiceIntakeDraft: () => void;
  appendRecordingToSession: (sessionId: string) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  nextPatient: () => Promise<void>;
  pendingNextPatientModal: { sessionId: string; patientIndex: number; timeStr: string } | null;
  confirmNextPatientName: (customName?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => Promise<void>;
  recoverRecording: (session: Session) => Promise<void>;
  dismissRecovery: () => Promise<void>;
  startTranscription: (
    sessionId: string,
    options?: { forceRetranscribe?: boolean; modeOverride?: TranscriptionMode }
  ) => Promise<void>;
  cancelTranscription: () => void;
  updateSessionMeta: (
    sessionId: string,
    patch: { title?: string; reference?: string; patientId?: string }
  ) => Promise<void>;
  saveClinicalNote: (sessionId: string, note: ClinicalNote) => Promise<void>;
  updateSegmentText: (segmentId: string, newText: string) => Promise<void>;
  updateSegmentSpeaker: (segmentId: string, speaker: string | undefined) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteAudioForSession: (sessionId: string) => Promise<void>;
  clearTranscribedAudioAll: () => Promise<void>;
  clearAllData: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addGlossaryEntry: (incorrect: string, correct: string) => Promise<void>;
  removeGlossaryEntry: (id: string) => Promise<void>;
  importAudioFile: (file: File, reference?: string) => Promise<void>;
  refreshModelCacheStatuses: () => Promise<void>;
  downloadModelForOffline: (tier: 'balanced' | 'max') => Promise<void>;
  exportLocalBackup: () => Promise<string>;
  importLocalBackup: (jsonText: string) => Promise<void>;
  exportGlossaryBackup: () => string;
  importGlossaryBackup: (jsonText: string) => Promise<void>;
  showToast: (text: string, type?: 'info' | 'success' | 'warning') => void;
  closeOnboarding: () => void;

  // EMR Actions
  selectPatient: (patientId: string | null) => void;
  startEditPatient: (patientId: string) => void;
  createPatient: (input: PatientDraftInput) => Promise<Patient | null>;
  updatePatient: (id: string, patch: Partial<PatientDraftInput>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  startEditProvider: (providerId: string) => void;
  createProvider: (input: ProviderDraftInput) => Promise<Provider | null>;
  updateProvider: (id: string, patch: Partial<ProviderDraftInput>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  createAppointment: (input: AppointmentDraftInput) => Promise<Appointment | null>;
  updateAppointment: (id: string, patch: Partial<AppointmentDraftInput>) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  captureAppointmentFromTranscript: (
    transcriptText: string,
    options?: {
      sessionId?: string;
      patientId?: string;
      patientName?: string;
      referenceDate?: Date;
      silentIfNone?: boolean;
    }
  ) => Promise<Appointment | null>;
  logActivity: (
    actionType: ActivityActionType,
    entityType: ActivityEntityType,
    summary: string,
    entityId?: string,
    details?: string
  ) => Promise<void>;
  clearActivityLogs: () => Promise<void>;

  // Clinic Practice Actions
  setActiveProfessional: (id: string | null) => void;
  canAccessFinance: () => boolean;
  createProfessional: (input: ClinicProfessionalDraftInput) => Promise<ClinicProfessional | null>;
  updateProfessional: (id: string, patch: Partial<ClinicProfessionalDraftInput>) => Promise<void>;
  deleteProfessional: (id: string) => Promise<void>;

  saveOdontogramSnapshot: (
    record: Omit<OdontogramRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<OdontogramRecord | null>;
  deleteOdontogramSnapshot: (id: string) => Promise<void>;

  savePeriodontogramSnapshot: (
    record: Omit<PeriodontogramRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<PeriodontogramRecord | null>;
  deletePeriodontogramSnapshot: (id: string) => Promise<void>;

  createEvolutionEntry: (
    input: ClinicalEvolutionDraftInput,
    pinAttempt?: string
  ) => Promise<ClinicalEvolutionEntry | null>;
  deleteEvolutionEntry: (id: string) => Promise<void>;

  addPatientFile: (input: {
    patientId: string;
    name: string;
    category: PatientFileCategory;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
    notes?: string;
    capturedAt?: string;
  }) => Promise<PatientFileAttachment | null>;
  deletePatientFile: (id: string) => Promise<void>;

  createTreatmentPlan: (input: TreatmentPlanDraftInput) => Promise<TreatmentPlan | null>;
  updateTreatmentPlan: (id: string, patch: Partial<TreatmentPlanDraftInput>) => Promise<void>;
  deleteTreatmentPlan: (id: string) => Promise<void>;
  toggleTreatmentItemCompleted: (planId: string, itemId: string) => Promise<void>;

  createFinancialTransaction: (
    input: FinancialTransactionDraftInput
  ) => Promise<FinancialTransaction | null>;
  deleteFinancialTransaction: (id: string) => Promise<void>;

  createLabOrder: (input: LabOrderDraftInput) => Promise<LabOrder | null>;
  updateLabOrder: (id: string, patch: Partial<LabOrderDraftInput>) => Promise<void>;
  updateLabOrderStatus: (id: string, status: LabOrderStatus) => Promise<void>;
  deleteLabOrder: (id: string) => Promise<void>;
  seedDemoData: () => Promise<void>;

  // Global Confirm Dialog
  confirmDialog: ConfirmDialogConfig | null;
  openConfirm: (config: ConfirmDialogConfig) => void;
  closeConfirm: () => void;
}

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'home',
  currentSessionId: null,
  workspace: null,
  profile: null,
  sessions: [],
  activeSession: null,
  activeTranscript: [],
  settings: null,
  glossary: [],

  patients: [],
  providers: [],
  appointments: [],
  activityLogs: [],
  professionals: [],
  activeProfessionalId: null,
  clinicalEvolutions: [],
  odontograms: [],
  periodontograms: [],
  treatmentPlans: [],
  financialTransactions: [],
  labOrders: [],
  patientFiles: [],
  selectedPatientId: null,
  editingPatientId: null,
  editingProviderId: null,
  activeIntakeRecordingTarget: null,
  voiceIntakeDraft: null,

  recordingController: null,
  isRecording: false,
  isPaused: false,
  isQuickDictationMode: false,
  appendingToSessionId: null,
  dayPatientIndex: 1,
  recordingDurationSec: 0,
  vu: { rms: 0, peak: 0 },
  lastSavedAt: null,
  silenceWarning: false,
  trackDisconnectedWarning: null,
  wakeLockActive: false,

  transcriptionPipeline: null,
  transcribingSessionId: null,
  transcriptionProgress: null,
  transcriptionFallbackNotice: null,
  modelCacheStatuses: { balanced: null, max: null },
  downloadingModelTier: null,
  modelDownloadProgress: 0,

  authRequired: false,
  authEmail: null,
  micPermissionStatus: 'unknown',
  selectedAgendaDate: null,
  activeReportType: 'caja',

  unclosedSession: null,
  showOnboarding: false,
  toastMessage: null,
  storageUsage: { usedBytes: 0, quotaBytes: 0 },
  confirmDialog: null,
  pendingNextPatientModal: null,

  init: async () => {
    try {
      applyThemeClass('light');
      const health = await probeBackendHealth();

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            clearNeonSession();
            set({ authRequired: true, authEmail: null });
            return;
          }
          if (health.neonConfigured && !getNeonToken() && session.access_token) {
            try {
              const synced = await neonFetch<{ token?: string; user?: { email?: string } }>(
                '/api/auth/neon',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'supabase-sync',
                    supabaseAccessToken: session.access_token,
                  }),
                }
              );
              if (synced?.token) {
                setNeonSession(synced.token, synced.user?.email || session.user.email || null);
              }
            } catch {
              // keep Supabase session active even if optional Neon mirror fails
            }
          }
          set({ authRequired: false, authEmail: session.user.email || null });
        }
      } else if (health.neonConfigured) {
        const token = getNeonToken();
        if (!token) {
          set({ authRequired: true, authEmail: null });
          return;
        }
        try {
          const me = await neonFetch<{ user?: { email?: string } }>('/api/auth/neon');
          set({
            authRequired: false,
            authEmail: me.user?.email || getNeonUserEmail() || null,
          });
        } catch {
          clearNeonSession();
          set({ authRequired: true, authEmail: null });
          return;
        }
      }

      const ws = await authProvider.getCurrentWorkspace();
      const prof = await authProvider.getCurrentProfile();
      await glossaryRepo.seedDefaultsIfEmpty(ws.id);
      const sets = await settingsRepo.get(ws.id);
      const gloss = await glossaryRepo.getAll(ws.id);
      const unclosed = await sessionRepo.findUnclosedRecording(ws.id);
      const storageEst = await audioStore.getStorageEstimate();

      const seenOnboarding = localStorage.getItem('escriba_onboarding_done');
      const showOnboarding = !seenOnboarding;

      applyThemeClass(sets.theme || 'light');

      const allUserSessions = await sessionRepo.getAll(ws.id);
      const interruptedSession = allUserSessions.find((s) => s.status === 'transcribing');
      if (interruptedSession) {
        await sessionRepo.update(interruptedSession.id, { status: 'recorded' });
      }

      set({
        workspace: ws,
        profile: prof,
        settings: sets,
        glossary: gloss,
        unclosedSession: unclosed || null,
        showOnboarding,
        storageUsage: storageEst,
        authRequired: false,
      });

      if (typeof window !== 'undefined') {
        await seedDemoClinicData(ws.id, {
          currency: sets.currency || DEFAULT_CURRENCY,
          ownerName: prof?.fullName,
        }).catch(() => false);
      }

      await get().loadSessions();
      await get().loadEmrData();
      await get().refreshModelCacheStatuses();

      wakeLockManager.subscribe((active) => {
        set({ wakeLockActive: active });
      });

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const activeTier = sets.modelTier || getDefaultModelTier();
          const resolvedKey = activeTier === 'max' ? 'max' : 'balanced';
          const isAlreadyCached = get().modelCacheStatuses[resolvedKey]?.isCached;
          // Only warm up cached models silently on startup so uncached 240-480 MB downloads
          // never lock the engine queue without visible progress.
          if (isAlreadyCached) {
            getSharedWhisperEngine().load(activeTier).catch(() => {});
          }
        }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'AUTH_REQUIRED') {
        clearNeonSession();
        set({ authRequired: true, authEmail: null });
        return;
      }
      console.error('Initialization error:', err);
      get().showToast(
        msg || 'No se pudo inicializar el espacio de trabajo.',
        'warning'
      );
    }
  },

  signOutSupabase: async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearNeonSession();
    const health = await probeBackendHealth().catch(() => ({
      ok: false,
      neonConfigured: false,
      supabaseConfigured: false,
      dbProvider: 'local' as const,
    }));
    set({
      authRequired: isSupabaseConfigured() || health.neonConfigured,
      authEmail: null,
      workspace: null,
      profile: null,
      sessions: [],
      patients: [],
      providers: [],
      appointments: [],
      activityLogs: [],
      professionals: [],
      activeProfessionalId: null,
      clinicalEvolutions: [],
      odontograms: [],
      periodontograms: [],
      treatmentPlans: [],
      financialTransactions: [],
      labOrders: [],
      patientFiles: [],
      activeSession: null,
      activeTranscript: [],
    });
  },

  requestMicrophonePermission: async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      get().showToast('Tu navegador no soporta captura de micrófono.', 'warning');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      set({ micPermissionStatus: 'granted' });
      return true;
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      set({ micPermissionStatus: 'denied' });
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        get().showToast('No se detectó ningún micrófono conectado en este equipo.', 'warning');
      } else {
        get().showToast(
          'Permiso de micrófono denegado. Habilitalo desde la barra del navegador para dictar.',
          'warning'
        );
      }
      return false;
    }
  },

  setAgendaDate: (date: string | null) => {
    set({ selectedAgendaDate: date });
  },

  setReportType: (reportType: ReportTypeId) => {
    set({
      activeReportType: reportType,
      currentView: 'reports',
      currentSessionId: null,
      editingPatientId: null,
      editingProviderId: null,
    });
  },

  setView: (view: AppView, sessionId?: string) => {
    const safeView: AppView =
      view === 'downloads' && !shouldShowDownloadsTab() ? 'home' : view;
    set({
      currentView: safeView,
      currentSessionId: sessionId || null,
      ...(safeView === 'patient-new' ? {} : { editingPatientId: null }),
      ...(safeView === 'provider-new' ? {} : { editingProviderId: null }),
    });
    if (safeView === 'detail' && sessionId) {
      get().loadSessionDetail(sessionId);
    }
    if (safeView === 'home') {
      get().loadSessions();
    }
    if (safeView === 'settings') {
      get().refreshModelCacheStatuses();
    }
  },

  loadSessions: async () => {
    const ws = get().workspace;
    if (!ws) return;
    const list = await sessionRepo.getAll(ws.id);
    const storage = await audioStore.getStorageEstimate();
    set({ sessions: list, storageUsage: storage });
  },

  loadEmrData: async () => {
    const ws = get().workspace;
    if (!ws) return;
    const [
      patients,
      providers,
      appointments,
      activityLogs,
      professionalsRaw,
      clinicalEvolutions,
      odontograms,
      periodontograms,
      treatmentPlans,
      financialTransactions,
      labOrders,
      patientFiles,
    ] = await Promise.all([
      patientRepo.getAll(ws.id),
      providerRepo.getAll(ws.id),
      appointmentRepo.getAll(ws.id),
      activityRepo.getAll(ws.id),
      professionalRepo.getAll(ws.id),
      evolutionRepo.getAll(ws.id),
      odontogramRepo.getAll(ws.id),
      periodontogramRepo.getAll(ws.id),
      treatmentPlanRepo.getAll(ws.id),
      financialTxRepo.getAll(ws.id),
      labOrderRepo.getAll(ws.id),
      patientFileStore.getAll(ws.id),
    ]);

    let professionals = professionalsRaw;
    const prof = get().profile;
    if (professionals.length === 0) {
      const now = Date.now();
      const starter: ClinicProfessional = {
        id: `cprof_owner_${ws.id.slice(0, 12)}`,
        workspaceId: ws.id,
        fullName: prof?.fullName || 'Odontólogo Titular',
        specialty: 'Odontología General',
        role: 'owner',
        agendaColor: '#0d9488',
        pinCode: '1234',
        canViewFinance: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await professionalRepo.create(starter);
      professionals = [starter];
    } else if (prof?.fullName && prof.fullName !== 'Dra. Titular') {
      const ownerPlaceholder = professionals.find(
        (p) =>
          p.role === 'owner' &&
          (p.fullName === 'Odontólogo Titular' || p.fullName === 'Dra. Titular')
      );
      if (ownerPlaceholder) {
        await professionalRepo.update(ownerPlaceholder.id, { fullName: prof.fullName });
        professionals = professionals.map((p) =>
          p.id === ownerPlaceholder.id ? { ...p, fullName: prof.fullName } : p
        );
      }
    }

    const storedActiveId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(`odontohelper_active_prof_${ws.id}`)
        : null;
    const currentActiveId = get().activeProfessionalId || storedActiveId;
    const resolvedActiveId =
      professionals.find((p) => p.id === currentActiveId && p.active)?.id ||
      professionals.find((p) => p.active)?.id ||
      professionals[0]?.id ||
      null;

    set({
      patients,
      providers,
      appointments,
      activityLogs,
      professionals,
      activeProfessionalId: resolvedActiveId,
      clinicalEvolutions,
      odontograms,
      periodontograms,
      treatmentPlans,
      financialTransactions,
      labOrders,
      patientFiles,
    });
  },

  loadSessionDetail: async (sessionId: string) => {
    const session = await sessionRepo.getById(sessionId);
    if (!session) return;
    const segments = await transcriptRepo.getBySessionId(sessionId);
    set({
      activeSession: session,
      activeTranscript: segments,
      currentSessionId: sessionId,
    });
  },

  startRecording: async (reference = '', consentGiven = true, options = {}) => {
    const ws = get().workspace;
    if (!ws) return;

    backgroundChunkTranscriber.resetSessionContext();
    const isQuick = Boolean(options.isQuickDictation);
    const intakeTarget = options.intakeTarget || 'consultation';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const sessionId = `session_${Date.now()}`;

    const defaultTitle =
      intakeTarget === 'patient'
        ? `Ficha por voz · Nuevo paciente (${timeStr} hs)`
        : intakeTarget === 'provider'
        ? `Ficha por voz · Nuevo proveedor (${timeStr} hs)`
        : isQuick
        ? `Dictado rápido (${timeStr} hs)`
        : reference.trim()
        ? `Consulta ${reference.trim()}`
        : `Consulta del ${now.toLocaleDateString('es-AR')}`;

    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: defaultTitle,
      reference:
        reference.trim() ||
        (intakeTarget === 'patient'
          ? `Dictado paciente ${timeStr}`
          : intakeTarget === 'provider'
          ? `Dictado proveedor ${timeStr}`
          : isQuick
          ? `Dictado rápido ${timeStr}`
          : ''),
      patientId: options.patientId,
      intakeTarget,
      status: 'recording',
      durationSec: 0,
      consentGiven,
      audioDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const controller = new RecordingController(sessionRepo, audioStore);

    controller.setCallbacks({
      onTimeUpdate: (sec) => set({ recordingDurationSec: sec }),
      onVuUpdate: (vu) => set({ vu }),
      onChunkSaved: (lastSavedAt, _totalChunks, chunk) => {
        set({ lastSavedAt });
        const settings = get().settings;
        if ((settings?.progressiveTranscription ?? true) && chunk) {
          backgroundChunkTranscriber.enqueue(chunk, chunk.sessionId, ws.id);
        }
      },
      onSilenceWarning: (silent) => set({ silenceWarning: silent }),
      onTrackEnded: (reason) => {
        set({ trackDisconnectedWarning: reason });
        get().showToast(reason, 'warning');
      },
      onWakeLockChange: (active) => set({ wakeLockActive: active }),
      onError: (err) => {
        get().showToast(err.message || 'Error en la grabación', 'warning');
      },
    });

    const settings = get().settings;
    try {
      await controller.startRecording(newSession, {
        noiseSuppression: settings?.noiseSuppression ?? false,
        audioDeviceId: settings?.selectedAudioDeviceId,
      });

      set({
        recordingController: controller,
        isRecording: true,
        isPaused: false,
        isQuickDictationMode: isQuick,
        activeIntakeRecordingTarget:
          intakeTarget === 'patient' || intakeTarget === 'provider' ? intakeTarget : null,
        appendingToSessionId: null,
        dayPatientIndex: 1,
        recordingDurationSec: 0,
        currentView: 'recording',
        activeSession: newSession,
        currentSessionId: sessionId,
        lastSavedAt: Date.now(),
        silenceWarning: false,
        trackDisconnectedWarning: null,
      });

      await get().logActivity(
        'recorded',
        'session',
        `Grabación iniciada: ${newSession.reference || newSession.title}`,
        sessionId
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      console.error('Failed to start recording:', err);
      get().showToast(
        msg || 'No se pudo acceder al micrófono. Por favor verifica los permisos en tu navegador.',
        'warning'
      );
    }
  },

  startIntakeRecording: async (target: 'patient' | 'provider') => {
    set({ activeIntakeRecordingTarget: target });
    await get().startRecording('', true, {
      isQuickDictation: true,
      intakeTarget: target,
    });
  },

  applyTranscriptToIntake: (
    target: 'patient' | 'provider',
    transcriptText: string,
    sessionId?: string
  ) => {
    const clean = transcriptText.trim();
    if (!clean) {
      get().showToast('No hay texto transcrito para extraer datos.', 'warning');
      return;
    }

    if (target === 'patient') {
      const extractedPatient = extractPatientFromTranscript(clean);
      set({
        voiceIntakeDraft: {
          target: 'patient',
          sessionId,
          transcriptText: clean,
          extractedPatient,
          createdAt: Date.now(),
        },
        editingPatientId: null,
        currentView: 'patient-new',
      });
      get().showToast('Datos del paciente completados desde la transcripción', 'success');
    } else {
      const extractedProvider = extractProviderFromTranscript(clean);
      set({
        voiceIntakeDraft: {
          target: 'provider',
          sessionId,
          transcriptText: clean,
          extractedProvider,
          createdAt: Date.now(),
        },
        editingProviderId: null,
        currentView: 'provider-new',
      });
      get().showToast('Datos del proveedor completados desde la transcripción', 'success');
    }
  },

  clearVoiceIntakeDraft: () => {
    set({ voiceIntakeDraft: null, activeIntakeRecordingTarget: null });
  },

  appendRecordingToSession: async (sessionId: string) => {
    const ws = get().workspace;
    if (!ws) return;

    const existingSession = await sessionRepo.getById(sessionId);
    if (!existingSession || existingSession.audioDeleted) {
      get().showToast('No es posible anexar audio a esta consulta.', 'warning');
      return;
    }

    const existingChunks = await audioStore.getChunks(sessionId);
    const initialChunkIndex =
      existingChunks.length > 0
        ? Math.max(...existingChunks.map((c) => c.chunkIndex)) + 1
        : 0;
    const initialOffsetSec = existingChunks.reduce(
      (sum, c) => sum + Math.max(0, c.endTime - c.startTime),
      0
    );

    backgroundChunkTranscriber.resetSessionContext();
    const controller = new RecordingController(sessionRepo, audioStore);

    controller.setCallbacks({
      onTimeUpdate: (sec) => set({ recordingDurationSec: sec }),
      onVuUpdate: (vu) => set({ vu }),
      onChunkSaved: (lastSavedAt, _totalChunks, chunk) => {
        set({ lastSavedAt });
        const settings = get().settings;
        if ((settings?.progressiveTranscription ?? true) && chunk) {
          backgroundChunkTranscriber.enqueue(chunk, chunk.sessionId, ws.id);
        }
      },
      onSilenceWarning: (silent) => set({ silenceWarning: silent }),
      onTrackEnded: (reason) => {
        set({ trackDisconnectedWarning: reason });
        get().showToast(reason, 'warning');
      },
      onWakeLockChange: (active) => set({ wakeLockActive: active }),
      onError: (err) => {
        get().showToast(err.message || 'Error en la grabación', 'warning');
      },
    });

    const settings = get().settings;
    try {
      await controller.startRecording(existingSession, {
        noiseSuppression: settings?.noiseSuppression ?? false,
        audioDeviceId: settings?.selectedAudioDeviceId,
        initialChunkIndex,
        initialOffsetSec,
        skipSessionCreate: true,
      });

      set({
        recordingController: controller,
        isRecording: true,
        isPaused: false,
        isQuickDictationMode: false,
        appendingToSessionId: sessionId,
        dayPatientIndex: 1,
        recordingDurationSec: Math.round(initialOffsetSec),
        currentView: 'recording',
        activeSession: existingSession,
        currentSessionId: sessionId,
        lastSavedAt: Date.now(),
        silenceWarning: false,
        trackDisconnectedWarning: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      get().showToast(
        msg || 'No se pudo acceder al micrófono para anexar audio.',
        'warning'
      );
    }
  },

  pauseRecording: () => {
    const controller = get().recordingController;
    if (controller) {
      controller.pauseRecording();
      set({ isPaused: true });
    }
  },

  resumeRecording: () => {
    const controller = get().recordingController;
    if (controller) {
      controller.resumeRecording();
      set({ isPaused: false, trackDisconnectedWarning: null });
    }
  },

  nextPatient: async () => {
    const controller = get().recordingController;
    const ws = get().workspace;
    if (!controller || !ws || get().pendingNextPatientModal) return;

    backgroundChunkTranscriber.resetSessionContext();
    const nextIndex = get().dayPatientIndex + 1;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const sessionId = `session_${Date.now()}`;

    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: `Consulta #${nextIndex} (${timeStr} hs)`,
      reference: `Paciente #${nextIndex}`,
      status: 'recording',
      durationSec: 0,
      consentGiven: true,
      audioDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await controller.switchNextPatient(newSession, { startPaused: true });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          // ignore
        }
      }

      set({
        dayPatientIndex: nextIndex,
        isPaused: true,
        isQuickDictationMode: false,
        appendingToSessionId: null,
        activeSession: newSession,
        currentSessionId: sessionId,
        recordingDurationSec: 0,
        lastSavedAt: Date.now(),
        silenceWarning: false,
        pendingNextPatientModal: { sessionId, patientIndex: nextIndex, timeStr },
      });

      await get().loadSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar de paciente';
      console.error('Error switching to next patient:', err);
      get().showToast(msg, 'warning');
    }
  },

  confirmNextPatientName: async (customName?: string) => {
    const pending = get().pendingNextPatientModal;
    if (!pending) return;

    set({ pendingNextPatientModal: null });

    const trimmed = customName?.trim() || '';
    if (trimmed) {
      const patch = {
        reference: trimmed,
        title: `Consulta ${trimmed} (${pending.timeStr} hs)`,
      };
      await sessionRepo.update(pending.sessionId, patch);
      const currentActive = get().activeSession;
      if (currentActive && currentActive.id === pending.sessionId) {
        set({ activeSession: { ...currentActive, ...patch } });
      }
      await get().loadSessions();
    }

    get().resumeRecording();
    get().showToast(
      `¡Consulta anterior guardada! Grabando ${trimmed || `Paciente #${pending.patientIndex}`}`,
      'success'
    );
  },

  stopRecording: async () => {
    const controller = get().recordingController;
    const wasQuickDictation = get().isQuickDictationMode;
    const wasAppending = Boolean(get().appendingToSessionId);
    const intakeTarget = get().activeIntakeRecordingTarget;

    if (controller) {
      const finishedSession = await controller.stopRecording();
      set({
        isRecording: false,
        isPaused: false,
        isQuickDictationMode: false,
        appendingToSessionId: null,
        trackDisconnectedWarning: null,
        recordingController: null,
        pendingNextPatientModal: null,
      });

      await get().loadSessions();

      const settings = get().settings;
      if (settings?.autoTranscribeOnStop || wasQuickDictation || wasAppending || intakeTarget) {
        get().setView('detail', finishedSession.id);
        get().startTranscription(finishedSession.id);
      } else {
        get().setView('detail', finishedSession.id);
      }
    }
  },

  discardRecording: async () => {
    const controller = get().recordingController;
    const appendingId = get().appendingToSessionId;
    const intakeTarget = get().activeIntakeRecordingTarget;
    if (controller) {
      if (appendingId) {
        // When discarding an appended recording, finalize existing session safely without deleting original audio
        await controller.stopRecording();
        set({
          isRecording: false,
          isPaused: false,
          isQuickDictationMode: false,
          activeIntakeRecordingTarget: null,
          appendingToSessionId: null,
          trackDisconnectedWarning: null,
          recordingController: null,
          pendingNextPatientModal: null,
        });
        get().setView('detail', appendingId);
        get().showToast('Anexo detenido', 'info');
        return;
      }

      await controller.discardRecording();
      set({
        isRecording: false,
        isPaused: false,
        isQuickDictationMode: false,
        activeIntakeRecordingTarget: null,
        appendingToSessionId: null,
        trackDisconnectedWarning: null,
        recordingController: null,
        activeSession: null,
        pendingNextPatientModal: null,
      });
      get().setView(
        intakeTarget === 'patient'
          ? 'patient-new'
          : intakeTarget === 'provider'
          ? 'provider-new'
          : 'home'
      );
      get().showToast('Grabación descartada', 'info');
    }
  },

  recoverRecording: async (session: Session) => {
    await sessionRepo.update(session.id, { status: 'recorded' });
    set({ unclosedSession: null });
    get().showToast('Grabación recuperada con éxito', 'success');
    get().setView('detail', session.id);
  },

  dismissRecovery: async () => {
    const unclosed = get().unclosedSession;
    if (unclosed) {
      await sessionRepo.delete(unclosed.id);
      await audioStore.deleteAudio(unclosed.id);
      set({ unclosedSession: null });
    }
  },

  startTranscription: async (sessionId: string, options = {}) => {
    const ws = get().workspace;
    if (!ws) return;

    // Prevent concurrent pipeline collision if a transcription is already running
    if (get().transcribingSessionId) {
      get().showToast('Ya hay una transcripción en curso.', 'info');
      return;
    }

    // Prioritize foreground transcription: clear pending background queue items across sessions
    backgroundChunkTranscriber.clearAllPending();

    const pipeline = new TranscriptionPipeline(
      sessionRepo,
      transcriptRepo,
      audioStore,
      glossaryRepo,
      settingsRepo,
      {
        onCorruptionFallback: (reason) => {
          set({
            transcriptionFallbackNotice: `WebGPU generó salida o latencia inestable (${reason}). Se cambió automáticamente a WASM para garantizar fidelidad.`,
          });
        },
      }
    );

    set({
      transcriptionPipeline: pipeline,
      transcribingSessionId: sessionId,
      ...(options.forceRetranscribe ? { activeTranscript: [] } : {}),
      transcriptionProgress: {
        sessionId,
        percent: 0,
        currentSegment: 0,
        totalSegments: 1,
        estimatedRemainingSec: 0,
        statusText: 'Sincronizando cola y preparando motor...',
      },
    });

    await wakeLockManager.acquire('transcription');
    try {
      await backgroundChunkTranscriber.waitForIdle({
        maxWaitMs: 3500,
        shouldAbort: () => get().transcriptionPipeline !== pipeline,
      });

      if (get().transcriptionPipeline !== pipeline) {
        return;
      }

      const segments = await pipeline.run(
        sessionId,
        ws.id,
        (prog) => {
          set({ transcriptionProgress: prog });
        },
        (newSegment) => {
          set((state) => {
            const exists = state.activeTranscript.some((s) => s.id === newSegment.id);
            const updated = exists ? state.activeTranscript : [...state.activeTranscript, newSegment];
            return {
              activeTranscript: updated.sort((a, b) => a.start - b.start),
            };
          });
        },
        {
          forceRetranscribe: options.forceRetranscribe,
          modeOverride: options.modeOverride,
        }
      );

      set({
        activeTranscript: segments,
        transcribingSessionId: null,
        transcriptionProgress: null,
        transcriptionPipeline: null,
      });

      await get().loadSessionDetail(sessionId);
      await get().loadSessions();
      await get().refreshModelCacheStatuses();
      await get().logActivity(
        'transcribed',
        'session',
        `Transcripción completada (${segments.length} fragmentos)`,
        sessionId
      );

      const currentSession = await sessionRepo.getById(sessionId);
      const intakeTarget =
        get().activeIntakeRecordingTarget ||
        (currentSession?.intakeTarget === 'patient' || currentSession?.intakeTarget === 'provider'
          ? currentSession.intakeTarget
          : null);

      if (intakeTarget && segments.length > 0) {
        const joinedText = segments.map((s) => s.text).join(' ').trim();
        set({ activeIntakeRecordingTarget: null });
        get().applyTranscriptToIntake(intakeTarget, joinedText, sessionId);
      } else {
        set({ activeIntakeRecordingTarget: null });
        const joinedText = segments.map((s) => s.text).join(' ').trim();
        const alreadyLinked = get().appointments.some((a) => a.sourceSessionId === sessionId);
        let autoAppt: Appointment | null = null;
        if (joinedText && !alreadyLinked) {
          const linkedPatient = currentSession?.patientId
            ? get().patients.find((p) => p.id === currentSession.patientId)
            : undefined;
          const refLabel =
            linkedPatient?.fullName ||
            (currentSession?.reference &&
            !/^dictado r[aá]pido/i.test(currentSession.reference)
              ? currentSession.reference
              : undefined);
          autoAppt = await get().captureAppointmentFromTranscript(joinedText, {
            sessionId,
            patientId: linkedPatient?.id,
            patientName: refLabel,
            referenceDate: new Date(currentSession?.createdAt || Date.now()),
            silentIfNone: true,
          });
        }
        if (autoAppt) {
          get().showToast(
            `Turno captado en la conversación: ${autoAppt.date} a las ${autoAppt.startTime} hs`,
            'success'
          );
        } else {
          get().showToast('Transcripción completada con éxito', 'success');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la transcripción';
      console.error('Transcription error:', err);
      set({
        transcribingSessionId: null,
        transcriptionProgress: null,
        transcriptionPipeline: null,
      });
      if (!msg.includes('cancelada')) {
        await sessionRepo.update(sessionId, { status: 'error', error: msg });
      }
      await get().loadSessionDetail(sessionId);
      await get().loadSessions();
      get().showToast(msg, msg.includes('cancelada') ? 'info' : 'warning');
    } finally {
      await wakeLockManager.release('transcription');
    }
  },

  cancelTranscription: () => {
    const pipeline = get().transcriptionPipeline;
    const sessionId = get().transcribingSessionId;
    backgroundChunkTranscriber.clearAllPending();

    if (pipeline) {
      pipeline.cancel();
      const engine = getSharedWhisperEngine();
      if (engine instanceof WhisperTranscriptionEngine && engine.isLoadInProgress()) {
        engine.abortLoad();
      }
      wakeLockManager.release('transcription').catch(() => {});
      set({
        transcribingSessionId: null,
        transcriptionProgress: null,
        transcriptionPipeline: null,
      });
      if (sessionId) {
        sessionRepo.update(sessionId, { status: 'recorded' }).catch(() => {});
      }
      get().showToast('Transcripción detenida', 'info');
    }
  },

  updateSessionMeta: async (
    sessionId: string,
    patch: { title?: string; reference?: string; patientId?: string }
  ) => {
    await sessionRepo.update(sessionId, patch);
    const updated = await sessionRepo.getById(sessionId);
    if (updated && get().activeSession?.id === sessionId) {
      set({ activeSession: updated });
    }
    await get().loadSessions();
    get().showToast('Datos de la consulta actualizados', 'success');
  },

  saveClinicalNote: async (sessionId: string, note: ClinicalNote) => {
    await sessionRepo.update(sessionId, { clinicalNote: note });
    const updated = await sessionRepo.getById(sessionId);
    if (updated && get().activeSession?.id === sessionId) {
      set({ activeSession: updated });
    }
    await get().loadSessions();
    get().showToast('Ficha clínica guardada', 'success');
  },

  updateSegmentText: async (segmentId: string, newText: string) => {
    await transcriptRepo.updateSegment(segmentId, newText);
    const active = get().activeTranscript.map((s) =>
      s.id === segmentId ? { ...s, text: newText, edited: true } : s
    );
    set({ activeTranscript: active });
  },

  updateSegmentSpeaker: async (segmentId: string, speaker: string | undefined) => {
    await transcriptRepo.updateSegmentSpeaker(segmentId, speaker);
    const active = get().activeTranscript.map((s) =>
      s.id === segmentId ? { ...s, speaker } : s
    );
    set({ activeTranscript: active });
  },

  deleteSession: async (sessionId: string) => {
    await audioStore.deleteAudio(sessionId);
    await transcriptRepo.deleteBySessionId(sessionId);
    await sessionRepo.delete(sessionId);
    if (get().currentSessionId === sessionId) {
      set({ activeSession: null, activeTranscript: [], currentSessionId: null });
      get().setView('home');
    }
    await get().loadSessions();
    get().showToast('Consulta y datos asociados eliminados', 'info');
  },

  deleteAudioForSession: async (sessionId: string) => {
    await audioStore.deleteAudio(sessionId);
    await sessionRepo.update(sessionId, { audioDeleted: true });
    if (get().activeSession?.id === sessionId) {
      set({ activeSession: { ...get().activeSession!, audioDeleted: true } });
    }
    await get().loadSessions();
    get().showToast('Audio eliminado para ahorrar espacio. Transcripción intacta.', 'success');
  },

  clearTranscribedAudioAll: async () => {
    const sessions = get().sessions.filter((s) => s.status === 'completed' && !s.audioDeleted);
    const ids = sessions.map((s) => s.id);
    await audioStore.deleteAllTranscribedAudio(ids);
    if (isSupabaseConfigured()) {
      await Promise.all(ids.map((id) => sessionRepo.update(id, { audioDeleted: true })));
    }
    await get().loadSessions();
    get().showToast(`Audio local de ${ids.length} consultas eliminado.`, 'success');
  },

  clearAllData: async () => {
    const sessions = get().sessions;
    await audioStore.clearAll();
    if (isSupabaseConfigured()) {
      await Promise.all(
        sessions.filter((s) => !s.audioDeleted).map((s) => sessionRepo.update(s.id, { audioDeleted: true }))
      );
      await get().loadSessions();
      get().showToast('Audio local eliminado del navegador. Tus historias clínicas en Supabase siguen seguras.', 'info');
      return;
    }
    await get().loadSessions();
    set({ activeSession: null, activeTranscript: [] });
    get().setView('home');
    get().showToast('Todos los datos locales han sido eliminados.', 'info');
  },

  updateSettings: async (patch: Partial<AppSettings>) => {
    const ws = get().workspace;
    if (!ws) return;
    await settingsRepo.update(ws.id, patch);
    const updated = await settingsRepo.get(ws.id);
    if (patch.theme) {
      applyThemeClass(patch.theme);
    }
    set({ settings: updated });
    get().showToast('Ajustes guardados', 'success');
  },

  addGlossaryEntry: async (incorrect: string, correct: string) => {
    const ws = get().workspace;
    if (!ws) return;
    const entry: GlossaryEntry = {
      id: `glossary_${Date.now()}`,
      workspaceId: ws.id,
      incorrect: incorrect.trim(),
      correct: correct.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await glossaryRepo.add(entry);
    const updated = await glossaryRepo.getAll(ws.id);
    set({ glossary: updated });
  },

  removeGlossaryEntry: async (id: string) => {
    const ws = get().workspace;
    if (!ws) return;
    await glossaryRepo.remove(id);
    const updated = await glossaryRepo.getAll(ws.id);
    set({ glossary: updated });
  },

  importAudioFile: async (file: File, reference = '') => {
    const ws = get().workspace;
    if (!ws) return;

    const sessionId = `session_import_${Date.now()}`;
    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: reference.trim() ? `Archivo ${reference.trim()}` : `Audio importado ${file.name}`,
      reference: reference.trim(),
      status: 'recording',
      durationSec: 0,
      consentGiven: true,
      audioDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      get().showToast('Decodificando y remuestreando audio...', 'info');
      const finished = await RecordingController.importAudioFile(
        file,
        newSession,
        sessionRepo,
        audioStore
      );
      await get().loadSessions();
      get().setView('detail', finished.id);
      get().showToast('Audio importado correctamente', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al importar audio';
      console.error('Import error:', err);
      get().showToast(msg, 'warning');
    }
  },

  refreshModelCacheStatuses: async () => {
    try {
      const [balanced, max] = await Promise.all([
        checkModelCacheStatus('balanced'),
        checkModelCacheStatus('max'),
      ]);
      set({
        modelCacheStatuses: { balanced, max },
      });
    } catch {
      // ignore cache check failure
    }
  },

  downloadModelForOffline: async (tier: 'balanced' | 'max') => {
    if (get().downloadingModelTier) return;
    set({ downloadingModelTier: tier, modelDownloadProgress: 0 });
    try {
      const engine = getSharedWhisperEngine();
      await engine.load(tier, (p: ProgressCallbackData) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          const nextPct = Math.min(100, Math.round(p.progress));
          set((state) => ({
            modelDownloadProgress: Math.max(state.modelDownloadProgress, nextPct),
          }));
        }
      });
      await get().refreshModelCacheStatuses();
      get().showToast('Modelo listo y guardado para usar sin internet', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar modelo';
      get().showToast(msg, 'warning');
    } finally {
      set({ downloadingModelTier: null, modelDownloadProgress: 0 });
    }
  },

  exportLocalBackup: async () => {
    const ws = get().workspace;
    if (!ws) throw new Error('Espacio de trabajo no inicializado');
    return await exportFullBackup(ws.id);
  },

  importLocalBackup: async (jsonText: string) => {
    const ws = get().workspace;
    if (!ws) return;
    const summary = await restoreFullBackup(jsonText, ws.id);
    const updatedGlossary = await glossaryRepo.getAll(ws.id);
    set({ glossary: updatedGlossary });
    await get().loadSessions();
    get().showToast(
      `Respaldo importado: ${summary.sessionsRestored} consultas y ${summary.glossaryRestored} términos nuevos`,
      'success'
    );
  },

  exportGlossaryBackup: () => {
    return exportGlossaryJson(get().glossary);
  },

  importGlossaryBackup: async (jsonText: string) => {
    const ws = get().workspace;
    if (!ws) return;
    const added = await importGlossaryJson(jsonText, ws.id);
    const updatedGlossary = await glossaryRepo.getAll(ws.id);
    set({ glossary: updatedGlossary });
    get().showToast(
      added > 0
        ? `Se agregaron ${added} términos nuevos al glosario`
        : 'El glosario ya contenía todos esos términos',
      'success'
    );
  },

  showToast: (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    set({ toastMessage: { text, type } });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 4000);
  },

  closeOnboarding: () => {
    localStorage.setItem('escriba_onboarding_done', 'true');
    set({ showOnboarding: false });
  },

  selectPatient: (patientId: string | null) => {
    set({ selectedPatientId: patientId });
  },

  startEditPatient: (patientId: string) => {
    set({ editingPatientId: patientId, voiceIntakeDraft: null, currentView: 'patient-new' });
  },

  createPatient: async (input: PatientDraftInput) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const patient: Patient = {
      ...input,
      id: `pat_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      fullName: input.fullName.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await patientRepo.create(patient);
    await get().logActivity(
      'created',
      'patient',
      `Nuevo paciente registrado: ${patient.fullName}`,
      patient.id,
      patient.dni ? `DNI: ${patient.dni}` : undefined
    );
    await get().loadEmrData();
    set({ voiceIntakeDraft: null, selectedPatientId: patient.id });
    get().showToast(`Paciente ${patient.fullName} guardado`, 'success');
    return patient;
  },

  updatePatient: async (id: string, patch: Partial<PatientDraftInput>) => {
    await patientRepo.update(id, patch);
    await get().logActivity(
      'updated',
      'patient',
      `Ficha de paciente actualizada${patch.fullName ? `: ${patch.fullName}` : ''}`,
      id
    );
    await get().loadEmrData();
    set({ editingPatientId: null, voiceIntakeDraft: null });
    get().showToast('Datos del paciente actualizados', 'success');
  },

  deletePatient: async (id: string) => {
    const target = get().patients.find((p) => p.id === id);
    await patientRepo.delete(id);
    await get().logActivity(
      'deleted',
      'patient',
      `Paciente eliminado: ${target?.fullName || id}`,
      id
    );
    if (get().selectedPatientId === id) {
      set({ selectedPatientId: null });
    }
    await get().loadEmrData();
    get().showToast('Paciente eliminado', 'info');
  },

  startEditProvider: (providerId: string) => {
    set({ editingProviderId: providerId, voiceIntakeDraft: null, currentView: 'provider-new' });
  },

  createProvider: async (input: ProviderDraftInput) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const provider: Provider = {
      ...input,
      id: `prov_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await providerRepo.create(provider);
    await get().logActivity(
      'created',
      'provider',
      `Nuevo proveedor registrado: ${provider.name}`,
      provider.id,
      provider.category
    );
    await get().loadEmrData();
    set({ voiceIntakeDraft: null });
    get().showToast(`Proveedor ${provider.name} guardado`, 'success');
    return provider;
  },

  updateProvider: async (id: string, patch: Partial<ProviderDraftInput>) => {
    await providerRepo.update(id, patch);
    await get().logActivity(
      'updated',
      'provider',
      `Proveedor actualizado${patch.name ? `: ${patch.name}` : ''}`,
      id
    );
    await get().loadEmrData();
    set({ editingProviderId: null, voiceIntakeDraft: null });
    get().showToast('Datos del proveedor actualizados', 'success');
  },

  deleteProvider: async (id: string) => {
    const target = get().providers.find((p) => p.id === id);
    await providerRepo.delete(id);
    await get().logActivity(
      'deleted',
      'provider',
      `Proveedor eliminado: ${target?.name || id}`,
      id
    );
    await get().loadEmrData();
    get().showToast('Proveedor eliminado', 'info');
  },

  createAppointment: async (input: AppointmentDraftInput) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeProf =
      get().professionals.find((p) => p.id === get().activeProfessionalId) ||
      get().professionals.find((p) => p.role === 'owner') ||
      get().professionals[0];
    const appointment: Appointment = {
      ...input,
      id: `appt_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      professionalId: input.professionalId ?? activeProf?.id,
      professionalName: input.professionalName ?? activeProf?.fullName ?? get().profile?.fullName,
      createdAt: now,
      updatedAt: now,
    };
    await appointmentRepo.create(appointment);
    await get().logActivity(
      'created',
      'appointment',
      `Turno agendado: ${appointment.patientName} (${appointment.date} ${appointment.startTime})`,
      appointment.id,
      appointment.procedure
    );
    await get().loadEmrData();
    get().showToast('Turno agendado correctamente', 'success');
    return appointment;
  },

  updateAppointment: async (id: string, patch: Partial<AppointmentDraftInput>) => {
    await appointmentRepo.update(id, patch);
    await get().logActivity('updated', 'appointment', 'Turno modificado en agenda', id);
    await get().loadEmrData();
    get().showToast('Turno actualizado', 'success');
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus) => {
    const target = get().appointments.find((a) => a.id === id);
    await appointmentRepo.update(id, { status });
    await get().logActivity(
      'status_changed',
      'appointment',
      `Turno de ${target?.patientName || 'paciente'} marcado como ${status}`,
      id
    );
    await get().loadEmrData();
  },

  deleteAppointment: async (id: string) => {
    const target = get().appointments.find((a) => a.id === id);
    await appointmentRepo.delete(id);
    await get().logActivity(
      'deleted',
      'appointment',
      `Turno eliminado: ${target?.patientName || id}`,
      id
    );
    await get().loadEmrData();
    get().showToast('Turno eliminado', 'info');
  },

  captureAppointmentFromTranscript: async (transcriptText, options = {}) => {
    const ws = get().workspace;
    if (!ws) return null;

    const extracted = extractAppointmentFromTranscript(
      transcriptText,
      options.referenceDate || new Date()
    );
    if (!extracted) {
      if (!options.silentIfNone) {
        get().showToast(
          'No se detectó ninguna fecha u horario de próximo turno en el texto.',
          'info'
        );
      }
      return null;
    }

    const extractedPatient = extractPatientFromTranscript(transcriptText);
    const resolvedName =
      options.patientName?.trim() ||
      extractedPatient.fullName?.trim() ||
      'Paciente de consulta';

    const matchedPatient = options.patientId
      ? get().patients.find((p) => p.id === options.patientId)
      : get().patients.find(
          (p) => p.fullName.trim().toLowerCase() === resolvedName.toLowerCase()
        );

    const activeProf =
      get().professionals.find((p) => p.id === get().activeProfessionalId) ||
      get().professionals.find((p) => p.role === 'owner') ||
      get().professionals[0];

    const duplicate = get().appointments.find(
      (a) =>
        a.status !== 'cancelled' &&
        a.date === extracted.date &&
        a.startTime === extracted.startTime &&
        a.patientName.toLowerCase() === (matchedPatient?.fullName || resolvedName).toLowerCase()
    );
    if (duplicate) {
      if (!options.silentIfNone) {
        get().showToast(
          `Ya existe un turno agendado para ${matchedPatient?.fullName || resolvedName} el ${extracted.date} a las ${extracted.startTime} hs.`,
          'info'
        );
      }
      return duplicate;
    }

    const now = Date.now();
    const appointment: Appointment = {
      id: `appt_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      patientId: matchedPatient?.id || options.patientId,
      patientName: matchedPatient?.fullName || resolvedName,
      professionalId: activeProf?.id,
      professionalName: activeProf?.fullName || get().profile?.fullName,
      date: extracted.date,
      startTime: extracted.startTime,
      durationMin: extracted.durationMin,
      procedure: extracted.procedure,
      status: 'pending',
      notes: `Captado de conversación ("${extracted.matchedText}")`,
      sourceSessionId: options.sessionId,
      autoCaptured: true,
      createdAt: now,
      updatedAt: now,
    };

    await appointmentRepo.create(appointment);
    await get().logActivity(
      'created',
      'appointment',
      `Turno captado por voz: ${appointment.patientName} (${appointment.date} ${appointment.startTime})`,
      appointment.id,
      appointment.procedure
    );
    await get().loadEmrData();
    set({ selectedAgendaDate: appointment.date });

    if (!options.silentIfNone) {
      get().showToast(
        `Turno agregado a Agenda: ${appointment.date} · ${appointment.startTime} hs`,
        'success'
      );
    }
    return appointment;
  },

  logActivity: async (
    actionType: ActivityActionType,
    entityType: ActivityEntityType,
    summary: string,
    entityId?: string,
    details?: string
  ) => {
    const ws = get().workspace;
    if (!ws) return;
    const entry: ActivityLogEntry = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      actionType,
      entityType,
      entityId,
      summary,
      details,
      createdAt: Date.now(),
    };
    await activityRepo.add(entry);
    const logs = await activityRepo.getAll(ws.id);
    set({ activityLogs: logs });
  },

  clearActivityLogs: async () => {
    const ws = get().workspace;
    if (!ws) return;
    await activityRepo.clearAll(ws.id);
    set({ activityLogs: [] });
    get().showToast('Historial de actividad limpiado', 'info');
  },

  setActiveProfessional: (id: string | null) => {
    const ws = get().workspace;
    if (ws && typeof localStorage !== 'undefined') {
      if (id) {
        localStorage.setItem(`odontohelper_active_prof_${ws.id}`, id);
      } else {
        localStorage.removeItem(`odontohelper_active_prof_${ws.id}`);
      }
    }
    set({ activeProfessionalId: id });
  },

  canAccessFinance: () => {
    const { professionals, activeProfessionalId } = get();
    if (professionals.length === 0 || !activeProfessionalId) return true;
    const active = professionals.find((p) => p.id === activeProfessionalId);
    if (!active) return true;
    if (active.role === 'owner') return true;
    return Boolean(active.canViewFinance);
  },

  createProfessional: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const prof: ClinicProfessional = {
      ...input,
      id: `cprof_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      fullName: input.fullName.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await professionalRepo.create(prof);
    await get().logActivity(
      'created',
      'professional',
      `Profesional agregado: ${prof.fullName} (${prof.role})`,
      prof.id
    );
    await get().loadEmrData();
    get().showToast(`Profesional ${prof.fullName} guardado`, 'success');
    return prof;
  },

  updateProfessional: async (id, patch) => {
    await professionalRepo.update(id, patch);
    await get().logActivity('updated', 'professional', 'Datos de profesional actualizados', id);
    await get().loadEmrData();
    get().showToast('Profesional actualizado', 'success');
  },

  deleteProfessional: async (id) => {
    const target = get().professionals.find((p) => p.id === id);
    await professionalRepo.delete(id);
    await get().logActivity(
      'deleted',
      'professional',
      `Profesional dado de baja: ${target?.fullName || id}`,
      id
    );
    await get().loadEmrData();
    get().showToast('Profesional eliminado', 'info');
  },

  saveOdontogramSnapshot: async (record) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeProf = get().professionals.find((p) => p.id === get().activeProfessionalId);
    const fullRecord: OdontogramRecord = {
      ...record,
      id: `odon_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      createdBy: record.createdBy || activeProf?.fullName,
      createdAt: now,
      updatedAt: now,
    };
    await odontogramRepo.create(fullRecord);
    const pat = get().patients.find((p) => p.id === fullRecord.patientId);
    await get().logActivity(
      'created',
      'odontogram',
      `Odontograma guardado (${fullRecord.label})${pat ? ` · ${pat.fullName}` : ''}`,
      fullRecord.id
    );
    await get().loadEmrData();
    get().showToast('Medición de odontograma guardada', 'success');
    return fullRecord;
  },

  deleteOdontogramSnapshot: async (id) => {
    await odontogramRepo.delete(id);
    await get().loadEmrData();
    get().showToast('Medición de odontograma eliminada', 'info');
  },

  savePeriodontogramSnapshot: async (record) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeProf = get().professionals.find((p) => p.id === get().activeProfessionalId);
    const fullRecord: PeriodontogramRecord = {
      ...record,
      id: `perio_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      createdBy: record.createdBy || activeProf?.fullName,
      createdAt: now,
      updatedAt: now,
    };
    await periodontogramRepo.create(fullRecord);
    const pat = get().patients.find((p) => p.id === fullRecord.patientId);
    await get().logActivity(
      'created',
      'periodontogram',
      `Periodontograma registrado (${fullRecord.label})${pat ? ` · ${pat.fullName}` : ''}`,
      fullRecord.id
    );
    await get().loadEmrData();
    get().showToast('Medición de periodontograma guardada', 'success');
    return fullRecord;
  },

  deletePeriodontogramSnapshot: async (id) => {
    await periodontogramRepo.delete(id);
    await get().loadEmrData();
    get().showToast('Periodontograma eliminado', 'info');
  },

  createEvolutionEntry: async (input, pinAttempt) => {
    const ws = get().workspace;
    if (!ws) return null;
    const prof = get().professionals.find(
      (p) => p.id === (input.professionalId || get().activeProfessionalId)
    );

    let signedWithPin = Boolean(input.signedWithPin);
    let signedAt = input.signedAt;

    if (pinAttempt !== undefined) {
      if (!prof?.pinCode) {
        get().showToast('El profesional seleccionado no tiene PIN configurado.', 'warning');
        return null;
      }
      if (pinAttempt.trim() !== prof.pinCode.trim()) {
        get().showToast('PIN de firma clínica incorrecto.', 'warning');
        return null;
      }
      signedWithPin = true;
      signedAt = Date.now();
    }

    const now = Date.now();
    const entry: ClinicalEvolutionEntry = {
      ...input,
      id: `evol_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      professionalId: input.professionalId || prof?.id,
      professionalName: input.professionalName || prof?.fullName,
      signedWithPin,
      signedAt,
      createdAt: now,
      updatedAt: now,
    };
    await evolutionRepo.create(entry);
    const pat = get().patients.find((p) => p.id === entry.patientId);
    await get().logActivity(
      'created',
      'evolution',
      `Evolución clínica: ${entry.procedure}${pat ? ` · ${pat.fullName}` : ''}`,
      entry.id,
      signedWithPin ? `Firmado con PIN (${entry.professionalName || 'Profesional'})` : undefined
    );
    await get().loadEmrData();
    get().showToast(
      signedWithPin ? 'Evolución clínica firmada con PIN y guardada' : 'Evolución clínica guardada',
      'success'
    );
    return entry;
  },

  deleteEvolutionEntry: async (id) => {
    await evolutionRepo.delete(id);
    await get().logActivity('deleted', 'evolution', 'Nota de evolución eliminada', id);
    await get().loadEmrData();
    get().showToast('Evolución eliminada', 'info');
  },

  addPatientFile: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const file: PatientFileAttachment = {
      id: `pfile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      patientId: input.patientId,
      name: input.name,
      category: input.category,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      dataUrl: input.dataUrl,
      notes: input.notes,
      capturedAt: input.capturedAt || new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    };
    await patientFileStore.add(file);
    await get().logActivity('created', 'file', `Archivo clínico adjunto: ${file.name}`, file.id);
    await get().loadEmrData();
    get().showToast('Imagen / archivo guardado en la ficha local', 'success');
    return file;
  },

  deletePatientFile: async (id) => {
    await patientFileStore.delete(id);
    await get().loadEmrData();
    get().showToast('Archivo eliminado', 'info');
  },

  createTreatmentPlan: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeProf = get().professionals.find((p) => p.id === get().activeProfessionalId);
    const activeCurrency = input.currency || get().settings?.currency || DEFAULT_CURRENCY;
    const plan: TreatmentPlan = {
      ...input,
      currency: activeCurrency,
      id: `plan_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      professionalId: input.professionalId || activeProf?.id,
      professionalName: input.professionalName || activeProf?.fullName,
      createdAt: now,
      updatedAt: now,
    };
    await treatmentPlanRepo.create(plan);
    await get().logActivity(
      'created',
      'treatment_plan',
      `Presupuesto creado: ${plan.title} · ${plan.patientName}`,
      plan.id,
      `${plan.items.length} prestaciones (${plan.currency})`
    );
    await get().loadEmrData();
    get().showToast('Presupuesto y plan de tratamiento creado', 'success');
    return plan;
  },

  updateTreatmentPlan: async (id, patch) => {
    await treatmentPlanRepo.update(id, patch);
    await get().logActivity('updated', 'treatment_plan', 'Plan de tratamiento actualizado', id);
    await get().loadEmrData();
    get().showToast('Plan de tratamiento actualizado', 'success');
  },

  deleteTreatmentPlan: async (id) => {
    await treatmentPlanRepo.delete(id);
    await get().logActivity('deleted', 'treatment_plan', 'Presupuesto eliminado', id);
    await get().loadEmrData();
    get().showToast('Presupuesto eliminado', 'info');
  },

  toggleTreatmentItemCompleted: async (planId, itemId) => {
    const ws = get().workspace;
    if (!ws) return;
    const plan = get().treatmentPlans.find((p) => p.id === planId);
    if (!plan) return;

    const targetItem = plan.items.find((it) => it.id === itemId);
    if (!targetItem) return;

    const nextCompleted = !targetItem.completed;
    const now = Date.now();
    const activeProf = get().professionals.find(
      (p) => p.id === (targetItem.professionalId || plan.professionalId || get().activeProfessionalId)
    );

    const updatedItems = plan.items.map((it) =>
      it.id === itemId
        ? {
            ...it,
            completed: nextCompleted,
            completedAt: nextCompleted ? now : undefined,
            professionalId: it.professionalId || activeProf?.id,
            professionalName: it.professionalName || activeProf?.fullName,
          }
        : it
    );

    const allDone = updatedItems.length > 0 && updatedItems.every((it) => it.completed);
    const anyDone = updatedItems.some((it) => it.completed);
    const nextStatus = allDone ? 'finalizado' : anyDone ? 'en_curso' : plan.status === 'finalizado' ? 'aprobado' : plan.status;

    await treatmentPlanRepo.update(plan.id, { items: updatedItems, status: nextStatus });

    if (nextCompleted) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const amount = calculateTreatmentItemSubtotal(targetItem);

      // 1. Auto-sync to Historia Clínica (Evolución)
      const evolution: ClinicalEvolutionEntry = {
        id: `evol_${now}_${Math.random().toString(36).slice(2, 6)}`,
        workspaceId: ws.id,
        patientId: plan.patientId,
        date: todayStr,
        toothFdi: targetItem.toothFdi,
        procedure: targetItem.procedure,
        description: `Prestación realizada del presupuesto "${plan.title}"${
          targetItem.toothFdi ? ` en pieza ${targetItem.toothFdi}` : ''
        }.`,
        highlightColor: 'teal',
        professionalId: activeProf?.id,
        professionalName: activeProf?.fullName,
        signedWithPin: false,
        sourceTreatmentPlanId: plan.id,
        createdAt: now,
        updatedAt: now,
      };
      await evolutionRepo.create(evolution);

      // 2. Auto-sync to Cuenta Corriente if not already charged for this item
      const alreadyCharged = get().financialTransactions.some(
        (tx) =>
          !tx.deletedAt &&
          tx.sourceTreatmentPlanId === plan.id &&
          tx.sourceTreatmentItemId === itemId
      );
      if (!alreadyCharged && amount > 0) {
        const chargeTx: FinancialTransaction = {
          id: `ftx_${now}_${Math.random().toString(36).slice(2, 6)}`,
          workspaceId: ws.id,
          patientId: plan.patientId,
          patientName: plan.patientName,
          type: 'charge',
          currency: plan.currency,
          amount,
          paymentMethod: 'cargo_clinico',
          concept: `${targetItem.procedure}${targetItem.toothFdi ? ` (Pieza ${targetItem.toothFdi})` : ''}`,
          date: todayStr,
          professionalId: activeProf?.id,
          professionalName: activeProf?.fullName,
          sourceTreatmentPlanId: plan.id,
          sourceTreatmentItemId: itemId,
          createdAt: now,
          updatedAt: now,
        };
        await financialTxRepo.create(chargeTx);
      }

      await get().logActivity(
        'status_changed',
        'treatment_plan',
        `Tratamiento realizado: ${targetItem.procedure} · ${plan.patientName}`,
        plan.id,
        'Sincronizado automáticamente en Evolución y Cuenta Corriente'
      );
      get().showToast(
        'Tratamiento marcado realizado · Agregado a Historia Clínica y Cuenta Corriente',
        'success'
      );
    } else {
      await get().loadEmrData();
      get().showToast('Prestación marcada como pendiente', 'info');
      return;
    }

    await get().loadEmrData();
  },

  createFinancialTransaction: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeProf = get().professionals.find((p) => p.id === get().activeProfessionalId);
    const activeCurrency = input.currency || get().settings?.currency || DEFAULT_CURRENCY;
    const tx: FinancialTransaction = {
      ...input,
      currency: activeCurrency,
      id: `ftx_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      professionalId: input.professionalId || activeProf?.id,
      professionalName: input.professionalName || activeProf?.fullName,
      receiptNumber:
        input.receiptNumber ||
        (input.type === 'payment' ? `REC-${String(now).slice(-6)}` : undefined),
      createdAt: now,
      updatedAt: now,
    };
    await financialTxRepo.create(tx);
    await get().logActivity(
      'created',
      'finance',
      `${tx.type === 'payment' ? 'Cobro registrado' : tx.type === 'expense' ? 'Egreso registrado' : 'Cargo agregado'}: ${tx.concept}`,
      tx.id,
      `${tx.currency} ${tx.amount}`
    );
    await get().loadEmrData();
    get().showToast(
      tx.type === 'payment'
        ? 'Cobro registrado en Caja y Cuenta Corriente'
        : tx.type === 'expense'
        ? 'Egreso registrado en Caja'
        : 'Cargo agregado a Cuenta Corriente',
      'success'
    );
    return tx;
  },

  deleteFinancialTransaction: async (id) => {
    await financialTxRepo.delete(id);
    await get().logActivity('deleted', 'finance', 'Movimiento financiero anulado', id);
    await get().loadEmrData();
    get().showToast('Movimiento eliminado', 'info');
  },

  createLabOrder: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const activeCurrency = input.currency || get().settings?.currency || DEFAULT_CURRENCY;
    const order: LabOrder = {
      ...input,
      currency: activeCurrency,
      id: `lab_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: ws.id,
      createdAt: now,
      updatedAt: now,
    };
    await labOrderRepo.create(order);
    await get().logActivity(
      'created',
      'lab_order',
      `Orden de laboratorio: ${order.workType} · ${order.patientName}`,
      order.id,
      order.providerName
    );
    await get().loadEmrData();
    get().showToast('Orden de laboratorio creada', 'success');
    return order;
  },

  updateLabOrder: async (id, patch) => {
    await labOrderRepo.update(id, patch);
    await get().logActivity('updated', 'lab_order', 'Orden de laboratorio actualizada', id);
    await get().loadEmrData();
    get().showToast('Orden actualizada', 'success');
  },

  updateLabOrderStatus: async (id, status) => {
    const target = get().labOrders.find((o) => o.id === id);
    const todayStr = new Date().toISOString().slice(0, 10);
    const patch: Partial<LabOrder> = { status };
    if (status === 'en_laboratorio' && !target?.sentDate) patch.sentDate = todayStr;
    if (status === 'en_clinica' && !target?.receivedDate) patch.receivedDate = todayStr;
    await labOrderRepo.update(id, patch);
    await get().logActivity(
      'status_changed',
      'lab_order',
      `Laboratorio (${target?.workType || id}): estado cambiado a ${status}`,
      id
    );
    await get().loadEmrData();
  },

  deleteLabOrder: async (id) => {
    await labOrderRepo.delete(id);
    await get().logActivity('deleted', 'lab_order', 'Orden de laboratorio eliminada', id);
    await get().loadEmrData();
    get().showToast('Orden de laboratorio eliminada', 'info');
  },

  seedDemoData: async () => {
    const ws = get().workspace;
    if (!ws) return;
    const activeCurrency = get().settings?.currency || DEFAULT_CURRENCY;
    await seedDemoClinicData(ws.id, {
      force: true,
      currency: activeCurrency,
      ownerName: get().profile?.fullName,
    });
    await Promise.all([get().loadSessions(), get().loadEmrData()]);
    get().showToast(
      `Datos de demostración cargados (${getCurrencyMeta(activeCurrency).name})`,
      'success'
    );
  },

  openConfirm: (config) => {
    set({ confirmDialog: config });
  },

  closeConfirm: () => {
    set({ confirmDialog: null });
  },
}));

function applyThemeClass(theme: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}
