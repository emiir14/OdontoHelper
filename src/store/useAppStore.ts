import { create } from 'zustand';
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
  sharedPatientShareRepo,
  sharedPeriodontogramRepo,
  sharedProfessionalRepo,
  sharedProviderRepo,
  sharedSessionRepo,
  sharedSettingsRepo,
  sharedSubscriptionRepo,
  sharedTranscriptRepo,
  sharedTreatmentPlanRepo,
} from '../adapters/repositoryRegistry';
import {
  clearTestAuthSession,
  getLocalTrialSession,
  getTestAuthSession,
  isTestAuthActive,
} from '../core/auth/testAuth';
import { getSupabaseClient, isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import {
  extractAppointmentFromTranscript,
  extractPatientFromTranscript,
  extractProviderFromTranscript,
} from '../core/clinical/entityExtractor';
import {
  CloudAudioUploadBlockedError,
  resolveCloudAudioCapability,
} from '../core/audio/cloudAudioSync';
import { RecordingController, VuData } from '../core/audio/recordingController';
import {
  exportGlossaryJson,
  importGlossaryJson,
} from '../core/export/backup';
import {
  ClinicPatientIndexes,
  DEFAULT_CURRENCY,
  buildClinicPatientIndexes,
  calculateTreatmentItemSubtotal,
  downloadBlob,
  resolvePractitionerDisplay,
  toLocalIsoDate,
} from '../core/clinic/clinicHelpers';
import { generateCalendarFeedToken } from '../core/clinic/calendarFeed';
import {
  buildPatientFieldsFromClinicalNote,
  clinicalNotePatientName,
  findPatientForClinicalNote,
} from '../core/clinical/clinicalRecord';
import { CLINICAL_TEMPLATES } from '../core/clinical/clinicalTemplates';
import {
  GoogleCalendarEventItem,
  deleteGoogleCalendarEvent,
  getGoogleCalendarAccessToken,
  listGoogleCalendarEvents,
  signInWithGoogleCalendar,
  signOutGoogleCalendar,
  subscribeGoogleCalendarAuthState,
  upsertAppointmentToGoogleCalendar,
} from '../core/calendar/googleCalendarClient';
import {
  canMutateClinicalRecord,
  generateShareInviteToken,
} from '../core/clinic/referralExport';
import { ReportTypeId } from '../core/clinic/reportEngine';
import {
  ModuleUrlQueryState,
  ParsedRouteState,
  PatientSubViewSlug,
  RoutableAppView,
  parseAppLocation,
  sanitizeInternalNextPath,
} from '../core/routing/appRoutes';
import {
  buildRecordingAudioFileName,
  getOrCreateLocalDeviceInfo,
} from '../core/runtime/deviceIdentity';
import {
  getSharedWhisperEngine,
  ProgressCallbackData,
  WhisperTranscriptionEngine,
} from '../core/transcription/engine';
import { BackgroundChunkTranscriber } from '../core/transcription/backgroundQueue';
import { pickPendingTranscriptionSession } from '../core/transcription/pendingResume';
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
  OdontogramRecord,
  PaidSubscriptionPlanTier,
  Patient,
  PatientDraftInput,
  PatientFileAttachment,
  PatientFileCategory,
  PatientShareLink,
  PatientSharePreview,
  PeriodontogramRecord,
  Profile,
  Provider,
  ProviderDraftInput,
  Session,
  SubscriptionBillingCycle,
  SubscriptionTransferRequest,
  TranscriptSegment,
  TranscriptionMode,
  TreatmentPlan,
  TreatmentPlanDraftInput,
  Workspace,
  WorkspaceSubscription,
} from '../core/types';
import { calculatePlanPricing } from '../core/clinic/subscriptionPlans';
import { wakeLockManager } from '../core/utils/wakeLockManager';

// Global singletons for repositories (structured EMR data -> Supabase when configured; audio & local imaging -> IndexedDB)
export const sessionRepo = sharedSessionRepo;
export const transcriptRepo = sharedTranscriptRepo;
export const audioStore = sharedAudioStore;
export const patientFileStore = sharedPatientFileStore;
export const glossaryRepo = sharedGlossaryRepo;
export const settingsRepo = sharedSettingsRepo;
const authProvider = sharedAuthProvider;
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
const patientShareRepo = sharedPatientShareRepo;

let sharedRealtimeChannel:
  | ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']>
  | null = null;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function teardownSharedRealtime() {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = null;
  }
  const client = getSupabaseClient();
  if (sharedRealtimeChannel && client) {
    void client.removeChannel(sharedRealtimeChannel);
  }
  sharedRealtimeChannel = null;
}

function setupSharedRealtime(onRefresh: () => void) {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured() || isTestAuthActive()) return;
  teardownSharedRealtime();
  const scheduleRefresh = () => {
    if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = setTimeout(() => {
      onRefresh();
    }, 350);
  };
  sharedRealtimeChannel = client
    .channel('odontohelper-shared-clinical-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, scheduleRefresh)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clinical_evolutions' },
      scheduleRefresh
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'odontograms' }, scheduleRefresh)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'periodontograms' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patient_files' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patient_shares' },
      scheduleRefresh
    )
    .subscribe();
}

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

export type AppView = RoutableAppView;

const EMPTY_PATIENT_INDEXES: ClinicPatientIndexes = {
  patientsById: new Map(),
  patientsByName: new Map(),
  transactionsByPatientId: new Map(),
  balancesByPatientId: new Map(),
  pendingLabsIndex: { byId: new Map(), byName: new Map() },
  plansByPatientId: new Map(),
  appointmentsByPatientId: new Map(),
  appointmentsByPatientName: new Map(),
};

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
  patientFilesLoading: boolean;
  patientFilesCloudError: string | null;
  patientIndexes: ClinicPatientIndexes;
  selectedPatientId: string | null;
  selectedPatientSubView: PatientSubViewSlug;
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
  autoResumeSuppressed: boolean;
  modelCacheStatuses: Record<'balanced' | 'max', ModelCacheStatus | null>;
  downloadingModelTier: 'balanced' | 'max' | null;
  modelDownloadProgress: number;

  // Auth & Agenda Navigation State
  authRequired: boolean;
  authEmail: string | null;
  authUserId: string | null;
  postLoginRedirect: string | null;
  micPermissionStatus: 'unknown' | 'granted' | 'denied';
  selectedAgendaDate: string | null;
  activeReportType: ReportTypeId;

  // External Calendar Sync (Apple webcal:// feed + Google Calendar OAuth)
  googleCalendarConnected: boolean;
  googleCalendarUserEmail: string | null;
  googleCalendarEvents: GoogleCalendarEventItem[];
  googleCalendarLoading: boolean;
  googleCalendarSyncing: boolean;

  // Subscription, 7-Day Trial & Bank Transfers
  workspaceSubscription: WorkspaceSubscription | null;
  transferRequests: SubscriptionTransferRequest[];
  isTransferModalOpen: boolean;
  transferModalTier: PaidSubscriptionPlanTier;
  transferModalCycle: SubscriptionBillingCycle;

  // Colleague Patient Sharing State
  patientShares: PatientShareLink[];
  shareInviteToken: string | null;
  shareInvitePreview: PatientSharePreview | null;
  shareInviteLoading: boolean;
  shareInviteError: string | null;

  // Recovery & Modals
  unclosedSession: Session | null;
  showOnboarding: boolean;
  toastMessage: { text: string; type: 'info' | 'success' | 'warning' } | null;

  // Storage & Local Audio Availability
  storageUsage: { usedBytes: number; quotaBytes: number };
  localAudioAvailability: Record<string, boolean>;

  // Draft Dirty Tracking & Module URL Query State
  dirtyDraftKeys: Record<string, string>;
  moduleQuery: ModuleUrlQueryState;

  // Actions
  init: () => Promise<void>;
  signOutSupabase: () => Promise<void>;
  requestMicrophonePermission: () => Promise<boolean>;
  setAgendaDate: (date: string | null) => void;
  setReportType: (reportType: ReportTypeId) => void;
  setPatientSubView: (subView: PatientSubViewSlug) => void;
  setPostLoginRedirect: (path: string | null) => void;
  setModuleQuery: (patch: Partial<ModuleUrlQueryState>) => void;
  setDraftDirty: (key: string, label: string | null) => void;
  clearAllDirtyDrafts: () => void;
  hasUnsavedChanges: () => boolean;
  guardNavigation: (action: () => void) => void;
  exportSessionAudioWav: (sessionId: string) => Promise<void>;
  syncSessionAudioToCloud: (sessionId: string) => Promise<void>;
  applyParsedRoute: (parsed: ParsedRouteState) => void;
  setView: (view: AppView, sessionId?: string) => void;
  loadSessions: () => Promise<void>;
  loadEmrData: () => Promise<void>;
  loadPatientFiles: (patientId: string) => Promise<void>;
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
  autoResumePendingTranscription: (preferredSessionId?: string) => Promise<void>;
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
  clearAllLocalAudio: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addGlossaryEntry: (incorrect: string, correct: string) => Promise<void>;
  removeGlossaryEntry: (id: string) => Promise<void>;
  importAudioFile: (file: File, reference?: string) => Promise<void>;
  refreshModelCacheStatuses: () => Promise<void>;
  downloadModelForOffline: (tier: 'balanced' | 'max') => Promise<void>;
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
  deletePatientsBulk: (ids: string[]) => Promise<void>;
  startEditProvider: (providerId: string) => void;
  createProvider: (input: ProviderDraftInput) => Promise<Provider | null>;
  updateProvider: (id: string, patch: Partial<ProviderDraftInput>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  deleteProvidersBulk: (ids: string[]) => Promise<void>;
  createAppointment: (input: AppointmentDraftInput) => Promise<Appointment | null>;
  updateAppointment: (id: string, patch: Partial<AppointmentDraftInput>) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  initGoogleCalendarListener: () => () => void;
  connectGoogleCalendar: () => Promise<boolean>;
  disconnectGoogleCalendar: () => Promise<void>;
  refreshGoogleCalendarEvents: (centerDate?: string) => Promise<void>;
  pushAppointmentToGoogleCalendar: (appointmentId: string) => Promise<boolean>;
  syncPendingAppointmentsToGoogleCalendar: (appointmentIds: string[]) => Promise<number>;
  removeAppointmentFromGoogleCalendar: (appointmentId: string) => Promise<boolean>;
  regenerateCalendarFeedToken: () => Promise<string | null>;
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

  // Personal Practitioner Actions
  setActiveProfessional: (id: string | null) => void;
  canAccessFinance: () => boolean;
  updatePersonalPractitioner: (patch: {
    fullName: string;
    specialty?: string;
    licenseNumber?: string;
  }) => Promise<void>;
  createProfessional: (input: ClinicProfessionalDraftInput) => Promise<ClinicProfessional | null>;
  updateProfessional: (id: string, patch: Partial<ClinicProfessionalDraftInput>) => Promise<void>;
  deleteProfessional: (id: string) => Promise<void>;

  saveOdontogramSnapshot: (
    record: Omit<OdontogramRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<OdontogramRecord | null>;
  deleteOdontogramSnapshot: (id: string) => Promise<void>;

  createEvolutionEntry: (input: ClinicalEvolutionDraftInput) => Promise<ClinicalEvolutionEntry | null>;
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

  // Colleague Sharing Actions
  createPatientShareInvite: (
    patientId: string,
    referralNote?: string
  ) => Promise<PatientShareLink | null>;
  unlinkPatientShare: (shareId: string) => Promise<void>;
  loadShareInvitePreview: (token: string) => Promise<void>;
  acceptShareInvite: (token: string) => Promise<void>;
  dismissShareInvite: () => void;

  // Subscription & Bank Transfer Actions
  openTransferModal: (tier?: PaidSubscriptionPlanTier, cycle?: SubscriptionBillingCycle) => void;
  closeTransferModal: () => void;
  submitBankTransferRequest: (input: {
    requestedTier: PaidSubscriptionPlanTier;
    billingCycle: SubscriptionBillingCycle;
    payerName: string;
    bankName: string;
    transferReference: string;
    notes?: string;
  }) => Promise<SubscriptionTransferRequest | null>;

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
  patientFilesLoading: false,
  patientFilesCloudError: null,
  patientIndexes: EMPTY_PATIENT_INDEXES,
  selectedPatientId: null,
  selectedPatientSubView: 'overview',
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
  autoResumeSuppressed: false,
  modelCacheStatuses: { balanced: null, max: null },
  downloadingModelTier: null,
  modelDownloadProgress: 0,

  authRequired: false,
  authEmail: null,
  authUserId: null,
  postLoginRedirect: null,
  micPermissionStatus: 'unknown',
  selectedAgendaDate: null,
  activeReportType: 'caja',

  googleCalendarConnected: false,
  googleCalendarUserEmail: null,
  googleCalendarEvents: [],
  googleCalendarLoading: false,
  googleCalendarSyncing: false,

  workspaceSubscription: null,
  transferRequests: [],
  isTransferModalOpen: false,
  transferModalTier: 'base',
  transferModalCycle: 'annual',

  patientShares: [],
  shareInviteToken: null,
  shareInvitePreview: null,
  shareInviteLoading: false,
  shareInviteError: null,

  unclosedSession: null,
  showOnboarding: false,
  toastMessage: null,
  storageUsage: { usedBytes: 0, quotaBytes: 0 },
  localAudioAvailability: {},
  dirtyDraftKeys: {},
  moduleQuery: {},
  confirmDialog: null,
  pendingNextPatientModal: null,

  init: async () => {
    try {
      applyThemeClass('light');
      let visitedLoginRoute = false;
      if (typeof window !== 'undefined') {
        const parsed = parseAppLocation(window.location.pathname, window.location.search);
        visitedLoginRoute = parsed.isLoginRoute;
        if (parsed.isLoginRoute) {
          if (parsed.nextPath) {
            set({ postLoginRedirect: parsed.nextPath });
          }
        } else {
          get().applyParsedRoute(parsed);
        }
      }

      let resolvedAuthUserId: string | null = 'local_practitioner';
      const testSession = getTestAuthSession();
      const trialSession = getLocalTrialSession();
      if (testSession) {
        resolvedAuthUserId = `test_user_${testSession.username}`;
        set({ authRequired: false, authEmail: testSession.username, authUserId: resolvedAuthUserId });
      } else if (trialSession) {
        resolvedAuthUserId = `trial_user_${trialSession.email}`;
        set({ authRequired: false, authEmail: trialSession.email, authUserId: resolvedAuthUserId });
      } else if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            const currentPath =
              typeof window !== 'undefined'
                ? sanitizeInternalNextPath(`${window.location.pathname}${window.location.search}`)
                : null;
            set((s) => ({
              authRequired: true,
              authEmail: null,
              authUserId: null,
              postLoginRedirect: s.postLoginRedirect || currentPath,
            }));
            return;
          }
          resolvedAuthUserId = session.user.id;
          set({
            authRequired: false,
            authEmail: session.user.email || null,
            authUserId: resolvedAuthUserId,
          });
        }
      } else if (visitedLoginRoute) {
        // Explicit visit to /login in local mode opens the login screen for testing (drtest / test)
        set({ authRequired: true, authEmail: null, authUserId: null });
        return;
      } else {
        set({ authUserId: resolvedAuthUserId });
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

      const [workspaceSub, transferReqs] = await Promise.all([
        sharedSubscriptionRepo.getForWorkspace(ws.id).catch(() => null),
        sharedSubscriptionRepo.listTransferRequests(ws.id).catch(() => []),
      ]);

      set({
        workspace: ws,
        profile: prof,
        settings: sets,
        glossary: gloss,
        workspaceSubscription: workspaceSub,
        transferRequests: transferReqs,
        unclosedSession: unclosed || null,
        showOnboarding,
        storageUsage: storageEst,
        authRequired: false,
      });

      if (typeof window !== 'undefined') {
        const seedFlagKey = `odontohelper_demo_seeded_${ws.id}`;
        const seedDateKey = `odontohelper_demo_seed_date_${ws.id}`;
        const todayStr = toLocalIsoDate();
        const needsSeedOrRefresh =
          localStorage.getItem(seedFlagKey) !== '1' ||
          localStorage.getItem(seedDateKey) !== todayStr;
        if (needsSeedOrRefresh) {
          const { seedDemoClinicData } = await import('../core/clinic/mockDataSeeder');
          await seedDemoClinicData(ws.id, {
            currency: sets.currency || DEFAULT_CURRENCY,
            ownerName: prof?.fullName,
          }).catch(() => false);
        }
      }

      await get().loadSessions();
      await get().loadEmrData();
      await get().refreshModelCacheStatuses();

      setupSharedRealtime(() => {
        if (get().workspace && !get().authRequired) {
          void get().loadEmrData();
        }
      });

      const pendingRedirect = get().postLoginRedirect;
      if (pendingRedirect) {
        const qIdx = pendingRedirect.indexOf('?');
        const pPath = qIdx >= 0 ? pendingRedirect.slice(0, qIdx) : pendingRedirect;
        const pSearch = qIdx >= 0 ? pendingRedirect.slice(qIdx) : '';
        get().applyParsedRoute(parseAppLocation(pPath, pSearch));
        set({ postLoginRedirect: null });
      } else if (get().shareInviteToken) {
        void get().loadShareInvitePreview(get().shareInviteToken!);
      } else if (get().currentView === 'detail' && get().currentSessionId) {
        await get().loadSessionDetail(get().currentSessionId!);
      }

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

      // Resume any transcription that was pending before a reload or that was
      // interrupted when the app closed.
      void get().autoResumePendingTranscription();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'AUTH_REQUIRED') {
        clearTestAuthSession();
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
    teardownSharedRealtime();
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearTestAuthSession();
    set({
      authRequired: true,
      authEmail: null,
      authUserId: null,
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
      patientShares: [],
      shareInvitePreview: null,
      shareInviteError: null,
      shareInviteLoading: false,
      patientFiles: [],
      patientFilesLoading: false,
      patientFilesCloudError: null,
      patientIndexes: EMPTY_PATIENT_INDEXES,
      selectedPatientId: null,
      selectedPatientSubView: 'overview',
      postLoginRedirect: null,
      activeSession: null,
      activeTranscript: [],
      workspaceSubscription: null,
      transferRequests: [],
      isTransferModalOpen: false,
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
      moduleQuery: {},
    });
  },

  setPatientSubView: (subView: PatientSubViewSlug) => {
    set({ selectedPatientSubView: subView, moduleQuery: {} });
  },

  setPostLoginRedirect: (path: string | null) => {
    set({ postLoginRedirect: sanitizeInternalNextPath(path) });
  },

  setModuleQuery: (patch: Partial<ModuleUrlQueryState>) => {
    set((state) => {
      const next: ModuleUrlQueryState = { ...state.moduleQuery };
      for (const [k, v] of Object.entries(patch) as Array<
        [keyof ModuleUrlQueryState, ModuleUrlQueryState[keyof ModuleUrlQueryState]]
      >) {
        if (v === undefined || v === null || v === '') {
          delete next[k];
        } else {
          (next as Record<string, unknown>)[k] = v;
        }
      }
      const prevKeys = Object.keys(state.moduleQuery);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every(
          (k) =>
            state.moduleQuery[k as keyof ModuleUrlQueryState] ===
            next[k as keyof ModuleUrlQueryState]
        )
      ) {
        return state;
      }
      return { moduleQuery: next };
    });
  },

  setDraftDirty: (key: string, label: string | null) => {
    set((state) => {
      const exists = key in state.dirtyDraftKeys;
      if (!label) {
        if (!exists) return state;
        const copy = { ...state.dirtyDraftKeys };
        delete copy[key];
        return { dirtyDraftKeys: copy };
      }
      if (state.dirtyDraftKeys[key] === label) return state;
      return {
        dirtyDraftKeys: {
          ...state.dirtyDraftKeys,
          [key]: label,
        },
      };
    });
  },

  clearAllDirtyDrafts: () => {
    set({ dirtyDraftKeys: {} });
  },

  hasUnsavedChanges: () => Object.keys(get().dirtyDraftKeys).length > 0,

  guardNavigation: (action: () => void) => {
    const dirty = get().dirtyDraftKeys;
    const labels = Object.values(dirty);
    if (labels.length === 0) {
      action();
      return;
    }
    const detailText =
      labels.length === 1
        ? `Tenés cambios sin confirmar en "${labels[0]}".`
        : `Tenés cambios sin confirmar en: ${labels.join(', ')}.`;
    get().openConfirm({
      title: 'Tenés cambios sin guardar',
      description: `${detailText} Tus borradores quedan guardados localmente en este equipo, pero aún no se guardaron en la historia clínica. ¿Querés salir de esta pantalla igual?`,
      confirmText: 'Salir igual',
      cancelText: 'Seguir editando',
      isDestructive: false,
      onConfirm: () => {
        get().clearAllDirtyDrafts();
        action();
      },
    });
  },

  exportSessionAudioWav: async (sessionId: string) => {
    try {
      const session =
        get().sessions.find((s) => s.id === sessionId) || (await sessionRepo.getById(sessionId));
      const hasLocal = await audioStore.hasAudio(sessionId);
      if (!hasLocal || session?.audioDeleted) {
        const origin = session?.recordedDeviceLabel
          ? ` (grabado en ${session.recordedDeviceLabel})`
          : '';
        get().showToast(
          `El audio de esta consulta no está disponible localmente en este dispositivo${origin}.`,
          'warning'
        );
        return;
      }
      const { blob } = await audioStore.createWavBlob(sessionId);
      const rawName =
        session?.audioFileName ||
        buildRecordingAudioFileName(session?.reference || session?.title, session?.createdAt);
      const fileName = rawName.toLowerCase().endsWith('.wav') ? rawName : `${rawName}.wav`;
      downloadBlob(fileName, blob);
      await get().logActivity(
        'exported',
        'session',
        `Audio WAV exportado: ${fileName}`,
        sessionId
      );
      get().showToast(`Audio exportado (${fileName})`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo exportar el audio.';
      get().showToast(msg, 'warning');
    }
  },

  syncSessionAudioToCloud: async (sessionId: string) => {
    const capability = resolveCloudAudioCapability(get().settings);
    if (!capability.canUpload) {
      const err = new CloudAudioUploadBlockedError(
        capability.tier === 'free' ? 'TIER_FREE' : 'CLOUD_NOT_CONFIGURED',
        capability.blockedReason || 'La subida de audios a la nube está deshabilitada.'
      );
      get().showToast(err.message, 'warning');
      return;
    }
    const session = await sessionRepo.getById(sessionId);
    if (!session) return;
    get().showToast('La nube del paquete Premium aún no está configurada.', 'info');
  },

  applyParsedRoute: (parsed: ParsedRouteState) => {
    if (parsed.isLoginRoute) {
      if (parsed.nextPath) {
        set({ postLoginRedirect: parsed.nextPath });
      }
      return;
    }
    const safeView: AppView =
      parsed.currentView === 'downloads' && !shouldShowDownloadsTab()
        ? 'home'
        : parsed.currentView;
    set({
      currentView: safeView,
      activeReportType: parsed.activeReportType,
      currentSessionId: parsed.currentSessionId,
      selectedPatientId: parsed.selectedPatientId,
      selectedPatientSubView: parsed.selectedPatientSubView,
      editingPatientId: parsed.editingPatientId,
      editingProviderId: parsed.editingProviderId,
      selectedAgendaDate: parsed.selectedAgendaDate,
      shareInviteToken: parsed.shareInviteToken || null,
      moduleQuery: parsed.moduleQuery || {},
    });
    if (parsed.shareInviteToken && get().workspace) {
      void get().loadShareInvitePreview(parsed.shareInviteToken);
    }
    if (safeView === 'detail' && parsed.currentSessionId && get().workspace) {
      get().loadSessionDetail(parsed.currentSessionId);
    }
    if (safeView === 'patients-search' && parsed.selectedPatientId && get().workspace) {
      void get().loadPatientFiles(parsed.selectedPatientId);
    }
    if (safeView === 'home' && get().workspace) {
      get().loadSessions();
    }
    if (safeView === 'settings' && get().workspace) {
      get().refreshModelCacheStatuses();
    }
  },

  setView: (view: AppView, sessionId?: string) => {
    const safeView: AppView =
      view === 'downloads' && !shouldShowDownloadsTab() ? 'home' : view;
    set((s) => ({
      currentView: safeView,
      currentSessionId: sessionId || null,
      editingPatientId: null,
      editingProviderId: null,
      shareInviteToken: null,
      shareInvitePreview: null,
      shareInviteError: null,
      moduleQuery: {},
      ...(safeView !== 'patients-search' && s.selectedPatientSubView !== 'overview'
        ? { selectedPatientSubView: 'overview' as PatientSubViewSlug }
        : {}),
    }));
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
    const [storage, availability] = await Promise.all([
      audioStore.getStorageEstimate(),
      audioStore.getAudioAvailabilityMap(list.map((s) => s.id)),
    ]);
    set({ sessions: list, storageUsage: storage, localAudioAvailability: availability });
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
      patientShares,
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
      patientShareRepo.getAllForWorkspace(ws.id).catch(() => [] as PatientShareLink[]),
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

    const resolvedActiveId =
      professionals.find((p) => p.role === 'owner' && p.active)?.id ||
      professionals.find((p) => p.active)?.id ||
      professionals[0]?.id ||
      null;

    const patientIndexes = buildClinicPatientIndexes({
      patients,
      transactions: financialTransactions,
      labOrders,
      treatmentPlans,
      appointments,
    });

    const selectedPatId = get().selectedPatientId;

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
      patientShares,
      patientIndexes,
      ...(selectedPatId ? {} : { patientFiles: [], patientFilesCloudError: null, patientFilesLoading: false }),
    });

    if (selectedPatId) {
      await get().loadPatientFiles(selectedPatId);
    }
  },

  loadPatientFiles: async (patientId: string) => {
    const ws = get().workspace;
    if (!ws || !patientId) return;
    set({ patientFilesLoading: true, patientFilesCloudError: null });
    try {
      const files = await patientFileStore.getByPatientId(ws.id, patientId);
      if (get().selectedPatientId === patientId) {
        set({
          patientFiles: files,
          patientFilesCloudError: null,
          patientFilesLoading: false,
        });
      } else {
        set({ patientFilesLoading: false });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Los archivos clínicos y radiografías requieren almacenamiento en la nube.';
      set({
        patientFiles: [],
        patientFilesCloudError: msg,
        patientFilesLoading: false,
      });
    }
  },

  loadSessionDetail: async (sessionId: string) => {
    const [session, segments, hasLocal] = await Promise.all([
      sessionRepo.getById(sessionId),
      transcriptRepo.getBySessionId(sessionId),
      audioStore.hasAudio(sessionId),
    ]);
    if (!session) return;
    set((state) => ({
      activeSession: session,
      activeTranscript: segments,
      currentSessionId: sessionId,
      localAudioAvailability: {
        ...state.localAudioAvailability,
        [sessionId]: hasLocal,
      },
    }));
  },

  startRecording: async (reference = '', consentGiven = true, options = {}) => {
    const ws = get().workspace;
    if (!ws) return;

    // A new recording re-enables automatic resumption for future pending sessions.
    set({ autoResumeSuppressed: false });
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

    const createdAt = Date.now();
    const deviceInfo = getOrCreateLocalDeviceInfo();
    const sessionReference =
      reference.trim() ||
      (intakeTarget === 'patient'
        ? `Dictado paciente ${timeStr}`
        : intakeTarget === 'provider'
        ? `Dictado proveedor ${timeStr}`
        : isQuick
        ? `Dictado rápido ${timeStr}`
        : '');

    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: defaultTitle,
      reference: sessionReference,
      patientId: options.patientId,
      intakeTarget,
      status: 'recording',
      durationSec: 0,
      consentGiven,
      audioDeleted: false,
      audioFileName: buildRecordingAudioFileName(sessionReference || defaultTitle, createdAt),
      recordedDeviceId: deviceInfo.deviceId,
      recordedDeviceLabel: deviceInfo.deviceLabel,
      audioCloudStatus: 'local_only',
      createdAt,
      updatedAt: createdAt,
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

      set((state) => ({
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
        localAudioAvailability: {
          ...state.localAudioAvailability,
          [sessionId]: true,
        },
      }));

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

    const createdAt = Date.now();
    const deviceInfo = getOrCreateLocalDeviceInfo();
    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: `Consulta #${nextIndex} (${timeStr} hs)`,
      reference: `Paciente #${nextIndex}`,
      status: 'recording',
      durationSec: 0,
      consentGiven: true,
      audioDeleted: false,
      audioFileName: buildRecordingAudioFileName(`paciente_${nextIndex}`, createdAt),
      recordedDeviceId: deviceInfo.deviceId,
      recordedDeviceLabel: deviceInfo.deviceLabel,
      audioCloudStatus: 'local_only',
      createdAt,
      updatedAt: createdAt,
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

      set((state) => ({
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
        localAudioAvailability: {
          ...state.localAudioAvailability,
          [sessionId]: true,
        },
      }));

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
      const currentActive = get().activeSession;
      const patch = {
        reference: trimmed,
        title: `Consulta ${trimmed} (${pending.timeStr} hs)`,
        audioFileName: buildRecordingAudioFileName(trimmed, currentActive?.createdAt || Date.now()),
      };
      await sessionRepo.update(pending.sessionId, patch);
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
      get().setView('detail', finishedSession.id);

      // Always resume the just-finished session once recording stopped, regardless
      // of the legacy `autoTranscribeOnStop` setting.
      void get().autoResumePendingTranscription(finishedSession.id);
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
    await get().loadSessions();
    void get().autoResumePendingTranscription(session.id);
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

    // Any explicit start (manual resume or automatic) cancels a previous user stop.
    if (get().autoResumeSuppressed) {
      set({ autoResumeSuppressed: false });
    }

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

    const wakeLockReason = `transcription_${sessionId}_${Date.now()}`;
    await wakeLockManager.acquire(wakeLockReason);
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
          if (get().transcriptionPipeline !== pipeline) return;
          set({ transcriptionProgress: prog });
        },
        (newSegment) => {
          if (get().transcriptionPipeline !== pipeline) return;
          if (get().currentSessionId !== sessionId) return;
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

      // A newer pipeline took over while this one was running: let it own the state.
      if (get().transcriptionPipeline !== pipeline) {
        return;
      }

      const isCurrentSession = get().currentSessionId === sessionId;
      set({
        ...(isCurrentSession ? { activeTranscript: segments } : {}),
        transcribingSessionId: null,
        transcriptionProgress: null,
        transcriptionPipeline: null,
      });

      if (isCurrentSession) {
        await get().loadSessionDetail(sessionId);
      }
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

      // Ignore failures from a pipeline that was already superseded by a newer one.
      if (get().transcriptionPipeline === pipeline) {
        set({
          transcribingSessionId: null,
          transcriptionProgress: null,
          transcriptionPipeline: null,
        });
        if (!msg.includes('cancelada')) {
          await sessionRepo.update(sessionId, { status: 'error', error: msg });
        }
        if (get().currentSessionId === sessionId) {
          await get().loadSessionDetail(sessionId);
        }
        await get().loadSessions();
        get().showToast(msg, msg.includes('cancelada') ? 'info' : 'warning');
      }
    } finally {
      await wakeLockManager.release(wakeLockReason);
    }

    // Continue with the next pending session, if any, so pending audio is never
    // left waiting for a manual click. Runs after the wake lock release so the
    // next transcription acquires it cleanly.
    void get().autoResumePendingTranscription();
  },

  cancelTranscription: () => {
    const pipeline = get().transcriptionPipeline;
    const sessionId = get().transcribingSessionId;
    backgroundChunkTranscriber.clearAllPending();

    if (pipeline || sessionId) {
      // The user explicitly stopped transcription: do not immediately restart it.
      // Starting a new recording or pressing resume clears this guard.
      set({ autoResumeSuppressed: true });
    }

    if (pipeline) {
      pipeline.cancel();
      const engine = getSharedWhisperEngine();
      if (engine instanceof WhisperTranscriptionEngine && engine.isLoadInProgress()) {
        engine.abortLoad();
      }
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

  autoResumePendingTranscription: async (preferredSessionId?: string) => {
    const state = get();
    if (state.authRequired || !state.workspace) return;
    if (state.isRecording || state.recordingController) return;
    if (state.transcribingSessionId) return;
    if (state.autoResumeSuppressed) return;

    const nextSession = pickPendingTranscriptionSession(state.sessions, {
      preferredSessionId,
      localAudioAvailability: state.localAudioAvailability,
    });
    if (!nextSession) return;

    await get().startTranscription(nextSession.id);
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
    const ws = get().workspace;
    const session =
      get().sessions.find((s) => s.id === sessionId) ||
      (get().activeSession?.id === sessionId ? get().activeSession : null);
    if (!ws || !session) {
      get().showToast('No se encontró la consulta para guardar la ficha clínica.', 'warning');
      return;
    }

    const patientName = clinicalNotePatientName(note, session);
    const patientFields = buildPatientFieldsFromClinicalNote(note);
    let patient = findPatientForClinicalNote(note, session, get().patients);
    let createdPatient = false;

    if (patient) {
      if (Object.keys(patientFields).length > 0) {
        await get().updatePatient(patient.id, patientFields);
      }
    } else if (patientName) {
      const created = await get().createPatient({
        ...patientFields,
        fullName: patientName,
        sourceSessionId: sessionId,
      } as PatientDraftInput);
      if (created) {
        patient = created;
        createdPatient = true;
      }
    }

    const linkedPatientId = patient?.id;
    const professional = resolvePractitionerDisplay(
      get().professionals,
      get().activeProfessionalId,
      get().profile
    );

    const savedNote: ClinicalNote = {
      ...note,
      patient: {
        ...(note.patient || { fullName: patientName }),
        fullName: note.patient?.fullName?.trim() || patientName,
        patientId: linkedPatientId,
      },
      professionalName: note.professionalName || professional.name,
      professionalSpecialty: note.professionalSpecialty || professional.specialty,
      professionalLicense: note.professionalLicense || professional.licenseNumber,
      updatedAt: Date.now(),
    };

    await sessionRepo.update(sessionId, {
      clinicalNote: savedNote,
      ...(linkedPatientId ? { patientId: linkedPatientId } : {}),
    });
    const updated = await sessionRepo.getById(sessionId);
    if (updated && get().activeSession?.id === sessionId) {
      set({ activeSession: updated });
    }
    await get().loadSessions();

    // Register the encounter in the patient's chronological history.
    if (linkedPatientId) {
      const templateLabel =
        CLINICAL_TEMPLATES.find((t) => t.id === savedNote.templateId)?.label ||
        'Consulta odontológica';
      const procedureLabel =
        (savedNote.procedure || savedNote.diagnosis || templateLabel)
          .trim()
          .split(/[\n.]/)[0]
          .slice(0, 120) || templateLabel;
      const description = [
        savedNote.diagnosis ? `Diagnóstico: ${savedNote.diagnosis}` : '',
        savedNote.findings ? `Hallazgos: ${savedNote.findings}` : '',
        savedNote.procedure ? `Procedimiento: ${savedNote.procedure}` : '',
        savedNote.indications ? `Indicaciones: ${savedNote.indications}` : '',
        savedNote.nextVisit ? `Próximo control: ${savedNote.nextVisit}` : '',
      ]
        .filter(Boolean)
        .join('\n') || 'Ficha clínica registrada.';

      const now = Date.now();
      const evolutionPatch: Partial<ClinicalEvolutionEntry> = {
        patientId: linkedPatientId,
        date: savedNote.consultationDate || toLocalIsoDate(),
        toothFdi: savedNote.detectedTeeth.join(', ') || undefined,
        procedure: procedureLabel,
        description,
        highlightColor: 'teal',
        professionalId: get().activeProfessionalId || undefined,
        professionalName: savedNote.professionalName || professional.name,
        sourceSessionId: sessionId,
        updatedAt: now,
      };

      const existingEvolution = get().clinicalEvolutions.find(
        (e) => e.sourceSessionId === sessionId && !e.deletedAt
      );

      if (existingEvolution) {
        await evolutionRepo.update(existingEvolution.id, evolutionPatch);
        set((s) => ({
          clinicalEvolutions: s.clinicalEvolutions.map((e) =>
            e.id === existingEvolution.id ? { ...e, ...evolutionPatch, updatedAt: now } : e
          ),
        }));
      } else {
        const pat = get().patients.find((p) => p.id === linkedPatientId);
        const entry: ClinicalEvolutionEntry = {
          id: `evol_${now}_${Math.random().toString(36).slice(2, 6)}`,
          workspaceId: pat?.workspaceId || ws.id,
          patientId: linkedPatientId,
          date: evolutionPatch.date || toLocalIsoDate(),
          toothFdi: evolutionPatch.toothFdi,
          procedure: procedureLabel,
          description,
          highlightColor: 'teal',
          professionalId: evolutionPatch.professionalId,
          professionalName: evolutionPatch.professionalName,
          sourceSessionId: sessionId,
          authorUserId: get().authUserId || undefined,
          authorWorkspaceId: ws.id,
          createdAt: now,
          updatedAt: now,
        };
        await evolutionRepo.create(entry);
        set((s) => ({ clinicalEvolutions: [entry, ...s.clinicalEvolutions] }));
        await get().logActivity(
          'created',
          'evolution',
          `Evolución clínica: ${procedureLabel}${pat ? ` · ${pat.fullName}` : ''}`,
          entry.id
        );
      }
    }

    const message = createdPatient
      ? `Ficha guardada y paciente ${patient?.fullName} creado`
      : linkedPatientId
      ? 'Ficha clínica guardada y vinculada al paciente'
      : 'Ficha clínica guardada';
    get().showToast(message, 'success');
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
    set((state) => ({
      localAudioAvailability: {
        ...state.localAudioAvailability,
        [sessionId]: false,
      },
      ...(state.activeSession?.id === sessionId
        ? { activeSession: { ...state.activeSession, audioDeleted: true } }
        : {}),
    }));
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
    set((state) => {
      const nextAvail = { ...state.localAudioAvailability };
      for (const id of ids) nextAvail[id] = false;
      return { localAudioAvailability: nextAvail };
    });
    await get().loadSessions();
    get().showToast(`Audio local de ${ids.length} consultas eliminado.`, 'success');
  },

  clearAllLocalAudio: async () => {
    const sessions = get().sessions;
    await audioStore.clearAll();
    set({ localAudioAvailability: {} });
    if (isSupabaseConfigured()) {
      await Promise.all(
        sessions.filter((s) => !s.audioDeleted).map((s) => sessionRepo.update(s.id, { audioDeleted: true }))
      );
      await get().loadSessions();
      get().showToast('Todos los audios locales fueron eliminados. Tus fichas clínicas en la nube siguen intactas.', 'info');
      return;
    }
    await get().loadSessions();
    get().showToast('Todos los audios locales fueron eliminados. Las notas y fichas clínicas siguen intactas.', 'info');
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
    const hasNonThemeChanges = Object.keys(patch).some((key) => key !== 'theme');
    if (hasNonThemeChanges) {
      get().showToast('Ajustes guardados', 'success');
    }
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
    const createdAt = Date.now();
    const deviceInfo = getOrCreateLocalDeviceInfo();
    const baseImportName = file.name.replace(/\.[^.]+$/, '') || 'audio_importado';
    const newSession: Session = {
      id: sessionId,
      workspaceId: ws.id,
      title: reference.trim() ? `Archivo ${reference.trim()}` : `Audio importado ${file.name}`,
      reference: reference.trim(),
      status: 'recording',
      durationSec: 0,
      consentGiven: true,
      audioDeleted: false,
      audioFileName: buildRecordingAudioFileName(reference.trim() || baseImportName, createdAt),
      recordedDeviceId: deviceInfo.deviceId,
      recordedDeviceLabel: deviceInfo.deviceLabel,
      audioCloudStatus: 'local_only',
      createdAt,
      updatedAt: createdAt,
    };

    try {
      get().showToast('Decodificando y remuestreando audio...', 'info');
      const finished = await RecordingController.importAudioFile(
        file,
        newSession,
        sessionRepo,
        audioStore
      );
      set((state) => ({
        localAudioAvailability: {
          ...state.localAudioAvailability,
          [finished.id]: true,
        },
      }));
      await get().loadSessions();
      get().setView('detail', finished.id);
      get().showToast('Audio importado correctamente', 'success');
      void get().autoResumePendingTranscription(finished.id);
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
    if (!patientId) {
      set({
        selectedPatientId: null,
        selectedPatientSubView: 'overview',
        moduleQuery: {},
        patientFiles: [],
        patientFilesCloudError: null,
        patientFilesLoading: false,
      });
      return;
    }
    set({
      selectedPatientId: patientId,
      selectedPatientSubView: 'overview',
      moduleQuery: {},
      patientFiles: [],
      patientFilesCloudError: null,
    });
    void get().loadPatientFiles(patientId);
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
    set((s) => {
      const nextPatients = [patient, ...s.patients];
      return {
        patients: nextPatients,
        voiceIntakeDraft: null,
        selectedPatientId: patient.id,
        patientFiles: [],
        patientFilesCloudError: null,
        patientIndexes: buildClinicPatientIndexes({
          patients: nextPatients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'patient',
      `Nuevo paciente registrado: ${patient.fullName}`,
      patient.id,
      patient.dni ? `DNI: ${patient.dni}` : undefined
    );
    get().showToast(`Paciente ${patient.fullName} guardado`, 'success');
    return patient;
  },

  updatePatient: async (id: string, patch: Partial<PatientDraftInput>) => {
    const ws = get().workspace;
    const target = get().patients.find((p) => p.id === id);
    if (target && ws && target.workspaceId !== ws.id) {
      get().showToast(
        'La ficha base pertenece al colega que derivó al paciente y no puede modificarse.',
        'warning'
      );
      return;
    }
    const now = Date.now();
    await patientRepo.update(id, patch);
    const normalizedPatch: Partial<PatientDraftInput> = {
      ...patch,
      ...(patch.fullName !== undefined ? { fullName: patch.fullName.trim() } : {}),
    };
    set((s) => {
      const nextPatients = s.patients.map((p) =>
        p.id === id ? { ...p, ...normalizedPatch, updatedAt: now } : p
      );
      return {
        patients: nextPatients,
        editingPatientId: null,
        voiceIntakeDraft: null,
        patientIndexes: buildClinicPatientIndexes({
          patients: nextPatients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'updated',
      'patient',
      `Ficha de paciente actualizada${patch.fullName ? `: ${patch.fullName}` : ''}`,
      id
    );
    get().showToast('Datos del paciente actualizados', 'success');
  },

  deletePatient: async (id: string) => {
    const ws = get().workspace;
    const target = get().patients.find((p) => p.id === id);
    if (target && ws && target.workspaceId !== ws.id) {
      get().showToast(
        'Esta ficha es compartida por otro colega. Usá "Desvincular" para quitarla de tu consultorio.',
        'warning'
      );
      return;
    }
    await patientRepo.delete(id);
    set((s) => {
      const nextPatients = s.patients.filter((p) => p.id !== id);
      const isSelected = s.selectedPatientId === id;
      return {
        patients: nextPatients,
        ...(isSelected
          ? {
              selectedPatientId: null,
              patientFiles: [],
              patientFilesCloudError: null,
              patientFilesLoading: false,
            }
          : {}),
        patientIndexes: buildClinicPatientIndexes({
          patients: nextPatients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'deleted',
      'patient',
      `Paciente eliminado: ${target?.fullName || id}`,
      id
    );
    get().showToast('Paciente eliminado', 'info');
  },

  deletePatientsBulk: async (ids: string[]) => {
    if (ids.length === 0) return;
    const wsId = get().workspace?.id;
    const ownIds = ids.filter((id) => {
      const p = get().patients.find((item) => item.id === id);
      return !wsId || !p || p.workspaceId === wsId;
    });
    if (ownIds.length === 0) {
      get().showToast(
        'Los pacientes compartidos por otro colega no se eliminan; podés desvincularlos desde su ficha.',
        'warning'
      );
      return;
    }
    await Promise.all(ownIds.map((id) => patientRepo.delete(id)));
    const idSet = new Set(ownIds);
    set((s) => {
      const nextPatients = s.patients.filter((p) => !idSet.has(p.id));
      const clearedSelected = Boolean(s.selectedPatientId && idSet.has(s.selectedPatientId));
      return {
        patients: nextPatients,
        selectedPatientId: clearedSelected ? null : s.selectedPatientId,
        ...(clearedSelected
          ? { patientFiles: [], patientFilesCloudError: null, patientFilesLoading: false }
          : {}),
        patientIndexes: buildClinicPatientIndexes({
          patients: nextPatients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'deleted',
      'patient',
      `Se eliminaron ${ids.length} pacientes seleccionados`
    );
    get().showToast(
      ids.length === 1 ? 'Paciente eliminado' : `${ids.length} pacientes eliminados`,
      'info'
    );
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
    set((s) => ({
      providers: [provider, ...s.providers],
      voiceIntakeDraft: null,
    }));
    await get().logActivity(
      'created',
      'provider',
      `Nuevo proveedor registrado: ${provider.name}`,
      provider.id,
      provider.category
    );
    get().showToast(`Proveedor ${provider.name} guardado`, 'success');
    return provider;
  },

  updateProvider: async (id: string, patch: Partial<ProviderDraftInput>) => {
    const now = Date.now();
    await providerRepo.update(id, patch);
    set((s) => ({
      providers: s.providers.map((pr) =>
        pr.id === id
          ? {
              ...pr,
              ...patch,
              ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
              updatedAt: now,
            }
          : pr
      ),
      editingProviderId: null,
      voiceIntakeDraft: null,
    }));
    await get().logActivity(
      'updated',
      'provider',
      `Proveedor actualizado${patch.name ? `: ${patch.name}` : ''}`,
      id
    );
    get().showToast('Datos del proveedor actualizados', 'success');
  },

  deleteProvider: async (id: string) => {
    const target = get().providers.find((p) => p.id === id);
    await providerRepo.delete(id);
    set((s) => ({
      providers: s.providers.filter((pr) => pr.id !== id),
    }));
    await get().logActivity(
      'deleted',
      'provider',
      `Proveedor eliminado: ${target?.name || id}`,
      id
    );
    get().showToast('Proveedor eliminado', 'info');
  },

  deleteProvidersBulk: async (ids: string[]) => {
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => providerRepo.delete(id)));
    const idSet = new Set(ids);
    set((s) => ({
      providers: s.providers.filter((p) => !idSet.has(p.id)),
    }));
    await get().logActivity(
      'deleted',
      'provider',
      `Se eliminaron ${ids.length} proveedores seleccionados`
    );
    get().showToast(
      ids.length === 1 ? 'Proveedor eliminado' : `${ids.length} proveedores eliminados`,
      'info'
    );
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
    set((s) => {
      const nextAppointments = [appointment, ...s.appointments];
      return {
        appointments: nextAppointments,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: nextAppointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'appointment',
      `Turno agendado: ${appointment.patientName} (${appointment.date} ${appointment.startTime})`,
      appointment.id,
      appointment.procedure
    );
    get().showToast('Turno agendado correctamente', 'success');
    return appointment;
  },

  updateAppointment: async (id: string, patch: Partial<AppointmentDraftInput>) => {
    const now = Date.now();
    await appointmentRepo.update(id, patch);
    set((s) => {
      const nextAppointments = s.appointments.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: now } : a
      );
      return {
        appointments: nextAppointments,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: nextAppointments,
        }),
      };
    });
    await get().logActivity('updated', 'appointment', 'Turno modificado en agenda', id);
    get().showToast('Turno actualizado', 'success');
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus) => {
    const now = Date.now();
    const target = get().appointments.find((a) => a.id === id);
    await appointmentRepo.update(id, { status });
    set((s) => {
      const nextAppointments = s.appointments.map((a) =>
        a.id === id ? { ...a, status, updatedAt: now } : a
      );
      return {
        appointments: nextAppointments,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: nextAppointments,
        }),
      };
    });
    await get().logActivity(
      'status_changed',
      'appointment',
      `Turno de ${target?.patientName || 'paciente'} marcado como ${status}`,
      id
    );
  },

  deleteAppointment: async (id: string) => {
    const target = get().appointments.find((a) => a.id === id);
    await appointmentRepo.delete(id);
    set((s) => {
      const nextAppointments = s.appointments.filter((a) => a.id !== id);
      return {
        appointments: nextAppointments,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: nextAppointments,
        }),
      };
    });
    await get().logActivity(
      'deleted',
      'appointment',
      `Turno eliminado: ${target?.patientName || id}`,
      id
    );
    get().showToast('Turno eliminado', 'info');
  },

  initGoogleCalendarListener: () => {
    return subscribeGoogleCalendarAuthState(
      (user) => {
        set({
          googleCalendarConnected: true,
          googleCalendarUserEmail: user.email || user.displayName || 'Cuenta Google',
        });
      },
      () => {
        set({
          googleCalendarConnected: false,
          googleCalendarUserEmail: null,
          googleCalendarEvents: [],
        });
      }
    );
  },

  connectGoogleCalendar: async () => {
    try {
      const { user, accessToken } = await signInWithGoogleCalendar();
      set({
        googleCalendarConnected: true,
        googleCalendarUserEmail: user.email || user.displayName || 'Cuenta Google',
      });
      await get().refreshGoogleCalendarEvents();
      if (accessToken) {
        get().showToast(
          `Google Calendar conectado (${user.email || 'cuenta Google'})`,
          'success'
        );
      }
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo conectar con Google Calendar.';
      get().showToast(msg, 'warning');
      return false;
    }
  },

  disconnectGoogleCalendar: async () => {
    await signOutGoogleCalendar();
    set({
      googleCalendarConnected: false,
      googleCalendarUserEmail: null,
      googleCalendarEvents: [],
    });
    get().showToast('Sesión de Google Calendar desconectada', 'info');
  },

  refreshGoogleCalendarEvents: async (centerDate?: string) => {
    const token = getGoogleCalendarAccessToken();
    if (!token) {
      set({ googleCalendarConnected: false, googleCalendarEvents: [] });
      return;
    }
    set({ googleCalendarLoading: true });
    try {
      const base = centerDate ? new Date(`${centerDate}T12:00:00`) : new Date();
      const validBase = Number.isNaN(base.getTime()) ? new Date() : base;
      const start = new Date(validBase);
      start.setDate(start.getDate() - 14);
      start.setHours(0, 0, 0, 0);
      const end = new Date(validBase);
      end.setDate(end.getDate() + 45);
      end.setHours(23, 59, 59, 999);

      const events = await listGoogleCalendarEvents(
        token,
        start.toISOString(),
        end.toISOString()
      );
      set({ googleCalendarEvents: events, googleCalendarLoading: false });
    } catch (err: unknown) {
      set({ googleCalendarLoading: false });
      const msg =
        err instanceof Error ? err.message : 'No se pudieron leer eventos de Google Calendar.';
      if (msg.toLowerCase().includes('expir')) {
        set({ googleCalendarConnected: false, googleCalendarEvents: [] });
      }
      get().showToast(msg, 'warning');
    }
  },

  pushAppointmentToGoogleCalendar: async (appointmentId: string) => {
    const token = getGoogleCalendarAccessToken();
    if (!token) {
      get().showToast('Conectá tu cuenta de Google Calendar primero.', 'warning');
      return false;
    }
    const appt = get().appointments.find((a) => a.id === appointmentId && !a.deletedAt);
    if (!appt) return false;
    set({ googleCalendarSyncing: true });
    try {
      const result = await upsertAppointmentToGoogleCalendar(token, appt);
      await appointmentRepo.update(appt.id, {
        googleEventId: result.googleEventId,
        googleSyncedAt: result.syncedAt,
      });
      set((s) => ({
        googleCalendarSyncing: false,
        appointments: s.appointments.map((a) =>
          a.id === appt.id
            ? {
                ...a,
                googleEventId: result.googleEventId,
                googleSyncedAt: result.syncedAt,
                updatedAt: result.syncedAt,
              }
            : a
        ),
      }));
      await get().refreshGoogleCalendarEvents(appt.date);
      get().showToast(
        appt.googleEventId
          ? 'Turno actualizado en Google Calendar'
          : 'Turno guardado en Google Calendar',
        'success'
      );
      return true;
    } catch (err: unknown) {
      set({ googleCalendarSyncing: false });
      const msg =
        err instanceof Error ? err.message : 'Error al sincronizar con Google Calendar.';
      get().showToast(msg, 'warning');
      return false;
    }
  },

  syncPendingAppointmentsToGoogleCalendar: async (appointmentIds: string[]) => {
    const token = getGoogleCalendarAccessToken();
    if (!token) {
      get().showToast('Conectá tu cuenta de Google Calendar primero.', 'warning');
      return 0;
    }
    if (appointmentIds.length === 0) return 0;
    set({ googleCalendarSyncing: true });
    let synced = 0;
    const updatedMap = new Map<string, { googleEventId: string; googleSyncedAt: number }>();
    try {
      for (const id of appointmentIds) {
        const appt = get().appointments.find((a) => a.id === id && !a.deletedAt);
        if (!appt) continue;
        const result = await upsertAppointmentToGoogleCalendar(token, appt);
        await appointmentRepo.update(appt.id, {
          googleEventId: result.googleEventId,
          googleSyncedAt: result.syncedAt,
        });
        updatedMap.set(appt.id, {
          googleEventId: result.googleEventId,
          googleSyncedAt: result.syncedAt,
        });
        synced += 1;
      }
      if (updatedMap.size > 0) {
        set((s) => ({
          appointments: s.appointments.map((a) => {
            const upd = updatedMap.get(a.id);
            return upd
              ? {
                  ...a,
                  googleEventId: upd.googleEventId,
                  googleSyncedAt: upd.googleSyncedAt,
                  updatedAt: upd.googleSyncedAt,
                }
              : a;
          }),
        }));
      }
      await get().refreshGoogleCalendarEvents();
      get().showToast(
        `${synced} ${synced === 1 ? 'turno sincronizado' : 'turnos sincronizados'} con Google Calendar`,
        'success'
      );
      return synced;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error sincronizando turnos con Google Calendar.';
      get().showToast(msg, 'warning');
      return synced;
    } finally {
      set({ googleCalendarSyncing: false });
    }
  },

  removeAppointmentFromGoogleCalendar: async (appointmentId: string) => {
    const token = getGoogleCalendarAccessToken();
    if (!token) {
      get().showToast('Conectá tu cuenta de Google Calendar primero.', 'warning');
      return false;
    }
    const appt = get().appointments.find((a) => a.id === appointmentId);
    if (!appt?.googleEventId) return false;
    set({ googleCalendarSyncing: true });
    try {
      await deleteGoogleCalendarEvent(token, appt.googleEventId);
      await appointmentRepo.update(appt.id, {
        googleEventId: undefined,
        googleSyncedAt: undefined,
      });
      set((s) => ({
        googleCalendarSyncing: false,
        appointments: s.appointments.map((a) =>
          a.id === appt.id
            ? { ...a, googleEventId: undefined, googleSyncedAt: undefined, updatedAt: Date.now() }
            : a
        ),
      }));
      await get().refreshGoogleCalendarEvents(appt.date);
      get().showToast('Evento quitado de Google Calendar', 'info');
      return true;
    } catch (err: unknown) {
      set({ googleCalendarSyncing: false });
      const msg =
        err instanceof Error ? err.message : 'No se pudo quitar el evento de Google Calendar.';
      get().showToast(msg, 'warning');
      return false;
    }
  },

  regenerateCalendarFeedToken: async () => {
    const ws = get().workspace;
    if (!ws) return null;
    const nextToken = generateCalendarFeedToken();
    await get().updateSettings({ calendarFeedToken: nextToken });
    get().showToast(
      'Enlace privado de Apple Calendar regenerado. El enlace anterior quedó revocado.',
      'success'
    );
    return nextToken;
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
        !a.deletedAt &&
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
    set((s) => {
      const nextAppointments = [appointment, ...s.appointments];
      return {
        appointments: nextAppointments,
        selectedAgendaDate: appointment.date,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: nextAppointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'appointment',
      `Turno captado por voz: ${appointment.patientName} (${appointment.date} ${appointment.startTime})`,
      appointment.id,
      appointment.procedure
    );

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
    set((s) => ({
      activityLogs: [entry, ...s.activityLogs].slice(0, 200),
    }));
  },

  clearActivityLogs: async () => {
    const ws = get().workspace;
    if (!ws) return;
    await activityRepo.clearAll(ws.id);
    set({ activityLogs: [] });
    get().showToast('Historial de actividad limpiado', 'info');
  },

  setActiveProfessional: (id: string | null) => {
    set({ activeProfessionalId: id });
  },

  // Single-practitioner personal app: finance & reports are always accessible
  canAccessFinance: () => true,

  updatePersonalPractitioner: async (patch) => {
    const ws = get().workspace;
    if (!ws) return;
    const now = Date.now();
    const cleanName = patch.fullName.trim() || 'Odontólogo Titular';
    const existing =
      get().professionals.find((p) => p.id === get().activeProfessionalId) ||
      get().professionals.find((p) => p.role === 'owner') ||
      get().professionals[0];

    if (existing) {
      const updatePatch: Partial<ClinicProfessionalDraftInput> = {
        fullName: cleanName,
        specialty: patch.specialty?.trim() || undefined,
        licenseNumber: patch.licenseNumber?.trim() || undefined,
      };
      await professionalRepo.update(existing.id, updatePatch);
      set((s) => ({
        professionals: s.professionals.map((p) =>
          p.id === existing.id ? { ...p, ...updatePatch, updatedAt: now } : p
        ),
        activeProfessionalId: existing.id,
        profile: s.profile ? { ...s.profile, fullName: cleanName, updatedAt: now } : s.profile,
      }));
    } else {
      const created: ClinicProfessional = {
        id: `cprof_owner_${ws.id.slice(0, 12)}`,
        workspaceId: ws.id,
        fullName: cleanName,
        specialty: patch.specialty?.trim() || 'Odontología General',
        licenseNumber: patch.licenseNumber?.trim() || undefined,
        role: 'owner',
        agendaColor: '#0d9488',
        canViewFinance: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await professionalRepo.create(created);
      set((s) => ({
        professionals: [created],
        activeProfessionalId: created.id,
        profile: s.profile ? { ...s.profile, fullName: cleanName, updatedAt: now } : s.profile,
      }));
    }

    await get().logActivity(
      'updated',
      'professional',
      `Perfil profesional actualizado: ${cleanName}`
    );
    get().showToast('Perfil profesional personal guardado', 'success');
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
    set((s) => ({
      professionals: [...s.professionals, prof],
    }));
    await get().logActivity(
      'created',
      'professional',
      `Profesional agregado: ${prof.fullName} (${prof.role})`,
      prof.id
    );
    get().showToast(`Profesional ${prof.fullName} guardado`, 'success');
    return prof;
  },

  updateProfessional: async (id, patch) => {
    const now = Date.now();
    await professionalRepo.update(id, patch);
    set((s) => ({
      professionals: s.professionals.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: now } : p
      ),
    }));
    await get().logActivity('updated', 'professional', 'Datos de profesional actualizados', id);
    get().showToast('Profesional actualizado', 'success');
  },

  deleteProfessional: async (id) => {
    const target = get().professionals.find((p) => p.id === id);
    await professionalRepo.delete(id);
    set((s) => ({
      professionals: s.professionals.filter((p) => p.id !== id),
    }));
    await get().logActivity(
      'deleted',
      'professional',
      `Profesional dado de baja: ${target?.fullName || id}`,
      id
    );
    get().showToast('Profesional eliminado', 'info');
  },

  saveOdontogramSnapshot: async (record) => {
    const ws = get().workspace;
    if (!ws) return null;
    const now = Date.now();
    const pat = get().patients.find((p) => p.id === record.patientId);
    const canonicalWsId = pat?.workspaceId || ws.id;
    const activeProf = get().professionals.find((p) => p.id === get().activeProfessionalId);
    const authorDisplay = resolvePractitionerDisplay(
      get().professionals,
      get().activeProfessionalId,
      get().profile
    );
    const fullRecord: OdontogramRecord = {
      ...record,
      id: `odon_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: canonicalWsId,
      createdBy: record.createdBy || activeProf?.fullName || authorDisplay.name,
      authorUserId: get().authUserId || undefined,
      authorWorkspaceId: ws.id,
      createdAt: now,
      updatedAt: now,
    };
    await odontogramRepo.create(fullRecord);
    set((s) => ({
      odontograms: [fullRecord, ...s.odontograms],
    }));
    await get().logActivity(
      'created',
      'odontogram',
      `Odontograma guardado (${fullRecord.label})${pat ? ` · ${pat.fullName}` : ''}`,
      fullRecord.id
    );
    get().showToast('Medición de odontograma guardada', 'success');
    return fullRecord;
  },

  deleteOdontogramSnapshot: async (id) => {
    const target = get().odontograms.find((o) => o.id === id);
    if (
      target &&
      !canMutateClinicalRecord(target, get().workspace?.id, get().authUserId)
    ) {
      get().showToast(
        'Solo el colega autor puede eliminar su propia medición de odontograma.',
        'warning'
      );
      return;
    }
    await odontogramRepo.delete(id);
    set((s) => ({
      odontograms: s.odontograms.filter((o) => o.id !== id),
    }));
    get().showToast('Medición de odontograma eliminada', 'info');
  },

  createEvolutionEntry: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const pat = get().patients.find((p) => p.id === input.patientId);
    const canonicalWsId = pat?.workspaceId || ws.id;
    const prof = get().professionals.find(
      (p) => p.id === (input.professionalId || get().activeProfessionalId)
    );
    const authorDisplay = resolvePractitionerDisplay(
      get().professionals,
      get().activeProfessionalId,
      get().profile
    );

    const now = Date.now();
    const entry: ClinicalEvolutionEntry = {
      ...input,
      id: `evol_${now}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: canonicalWsId,
      professionalId: input.professionalId || prof?.id,
      professionalName: input.professionalName || prof?.fullName || authorDisplay.name,
      authorUserId: get().authUserId || undefined,
      authorWorkspaceId: ws.id,
      createdAt: now,
      updatedAt: now,
    };
    await evolutionRepo.create(entry);
    set((s) => ({
      clinicalEvolutions: [entry, ...s.clinicalEvolutions],
    }));
    await get().logActivity(
      'created',
      'evolution',
      `Evolución clínica: ${entry.procedure}${pat ? ` · ${pat.fullName}` : ''}`,
      entry.id
    );
    get().showToast('Evolución clínica guardada', 'success');
    return entry;
  },

  deleteEvolutionEntry: async (id) => {
    const target = get().clinicalEvolutions.find((e) => e.id === id);
    if (
      target &&
      !canMutateClinicalRecord(target, get().workspace?.id, get().authUserId)
    ) {
      get().showToast(
        'Solo el colega autor puede eliminar su propia evolución clínica.',
        'warning'
      );
      return;
    }
    await evolutionRepo.delete(id);
    set((s) => ({
      clinicalEvolutions: s.clinicalEvolutions.filter((e) => e.id !== id),
    }));
    await get().logActivity('deleted', 'evolution', 'Nota de evolución eliminada', id);
    get().showToast('Evolución eliminada', 'info');
  },

  addPatientFile: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const pat = get().patients.find((p) => p.id === input.patientId);
    const canonicalWsId = pat?.workspaceId || ws.id;
    const authorDisplay = resolvePractitionerDisplay(
      get().professionals,
      get().activeProfessionalId,
      get().profile
    );
    const file: PatientFileAttachment = {
      id: `pfile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: canonicalWsId,
      patientId: input.patientId,
      name: input.name,
      category: input.category,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      dataUrl: input.dataUrl,
      notes: input.notes,
      uploadedBy: authorDisplay.name,
      authorUserId: get().authUserId || undefined,
      authorWorkspaceId: ws.id,
      capturedAt: input.capturedAt || toLocalIsoDate(),
      createdAt: Date.now(),
    };
    try {
      await patientFileStore.add(file);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el archivo clínico en la nube.';
      set({ patientFilesCloudError: msg });
      get().showToast(msg, 'warning');
      return null;
    }
    set((s) => ({
      patientFiles: [file, ...s.patientFiles],
      patientFilesCloudError: null,
    }));
    await get().logActivity('created', 'file', `Archivo clínico adjunto: ${file.name}`, file.id);
    get().showToast('Imagen / archivo guardado en la nube (ficha del paciente)', 'success');
    return file;
  },

  deletePatientFile: async (id) => {
    const target = get().patientFiles.find((f) => f.id === id);
    if (
      target &&
      !canMutateClinicalRecord(target, get().workspace?.id, get().authUserId)
    ) {
      get().showToast(
        'Solo el colega que subió este archivo puede eliminarlo.',
        'warning'
      );
      return;
    }
    try {
      await patientFileStore.delete(id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el archivo clínico de la nube.';
      set({ patientFilesCloudError: msg });
      get().showToast(msg, 'warning');
      return;
    }
    set((s) => ({
      patientFiles: s.patientFiles.filter((f) => f.id !== id),
    }));
    get().showToast('Archivo eliminado de la nube', 'info');
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
    set((s) => {
      const nextPlans = [plan, ...s.treatmentPlans];
      return {
        treatmentPlans: nextPlans,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: nextPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'treatment_plan',
      `Presupuesto creado: ${plan.title} · ${plan.patientName}`,
      plan.id,
      `${plan.items.length} prestaciones (${plan.currency})`
    );
    get().showToast('Presupuesto y plan de tratamiento creado', 'success');
    return plan;
  },

  updateTreatmentPlan: async (id, patch) => {
    const now = Date.now();
    await treatmentPlanRepo.update(id, patch);
    set((s) => {
      const nextPlans = s.treatmentPlans.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: now } : p
      );
      return {
        treatmentPlans: nextPlans,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: nextPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity('updated', 'treatment_plan', 'Plan de tratamiento actualizado', id);
    get().showToast('Plan de tratamiento actualizado', 'success');
  },

  deleteTreatmentPlan: async (id) => {
    await treatmentPlanRepo.delete(id);
    set((s) => {
      const nextPlans = s.treatmentPlans.filter((p) => p.id !== id);
      return {
        treatmentPlans: nextPlans,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: s.labOrders,
          treatmentPlans: nextPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity('deleted', 'treatment_plan', 'Presupuesto eliminado', id);
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
    const nextStatus: TreatmentPlan['status'] = allDone ? 'finalizado' : anyDone ? 'en_curso' : plan.status === 'finalizado' ? 'aprobado' : plan.status;

    await treatmentPlanRepo.update(plan.id, { items: updatedItems, status: nextStatus });

    let createdEvolution: ClinicalEvolutionEntry | null = null;
    let createdChargeTx: FinancialTransaction | null = null;

    if (nextCompleted) {
      const todayStr = toLocalIsoDate();
      const amount = calculateTreatmentItemSubtotal(targetItem);

      // 1. Auto-sync to Historia Clínica (Evolución)
      createdEvolution = {
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
        sourceTreatmentPlanId: plan.id,
        createdAt: now,
        updatedAt: now,
      };
      await evolutionRepo.create(createdEvolution);

      // 2. Auto-sync to Cuenta Corriente if not already charged for this item
      const alreadyCharged = get().financialTransactions.some(
        (tx) =>
          !tx.deletedAt &&
          tx.sourceTreatmentPlanId === plan.id &&
          tx.sourceTreatmentItemId === itemId
      );
      if (!alreadyCharged && amount > 0) {
        createdChargeTx = {
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
        await financialTxRepo.create(createdChargeTx);
      }
    }

    set((s) => {
      const nextPlans = s.treatmentPlans.map((p) =>
        p.id === plan.id ? { ...p, items: updatedItems, status: nextStatus, updatedAt: now } : p
      );
      const nextEvolutions = createdEvolution
        ? [createdEvolution, ...s.clinicalEvolutions]
        : s.clinicalEvolutions;
      const nextTransactions = createdChargeTx
        ? [createdChargeTx, ...s.financialTransactions]
        : s.financialTransactions;
      return {
        treatmentPlans: nextPlans,
        clinicalEvolutions: nextEvolutions,
        financialTransactions: nextTransactions,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: nextTransactions,
          labOrders: s.labOrders,
          treatmentPlans: nextPlans,
          appointments: s.appointments,
        }),
      };
    });

    if (nextCompleted) {
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
      get().showToast('Prestación marcada como pendiente', 'info');
    }
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
    set((s) => {
      const nextTransactions = [tx, ...s.financialTransactions];
      return {
        financialTransactions: nextTransactions,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: nextTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'finance',
      `${tx.type === 'payment' ? 'Cobro registrado' : tx.type === 'expense' ? 'Egreso registrado' : 'Cargo agregado'}: ${tx.concept}`,
      tx.id,
      `${tx.currency} ${tx.amount}`
    );
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
    set((s) => {
      const nextTransactions = s.financialTransactions.filter((t) => t.id !== id);
      return {
        financialTransactions: nextTransactions,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: nextTransactions,
          labOrders: s.labOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity('deleted', 'finance', 'Movimiento financiero anulado', id);
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
    set((s) => {
      const nextOrders = [order, ...s.labOrders];
      return {
        labOrders: nextOrders,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: nextOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'created',
      'lab_order',
      `Orden de laboratorio: ${order.workType} · ${order.patientName}`,
      order.id,
      order.providerName
    );
    get().showToast('Orden de laboratorio creada', 'success');
    return order;
  },

  updateLabOrder: async (id, patch) => {
    const now = Date.now();
    await labOrderRepo.update(id, patch);
    set((s) => {
      const nextOrders = s.labOrders.map((o) =>
        o.id === id ? { ...o, ...patch, updatedAt: now } : o
      );
      return {
        labOrders: nextOrders,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: nextOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity('updated', 'lab_order', 'Orden de laboratorio actualizada', id);
    get().showToast('Orden actualizada', 'success');
  },

  updateLabOrderStatus: async (id, status) => {
    const now = Date.now();
    const target = get().labOrders.find((o) => o.id === id);
    const todayStr = toLocalIsoDate();
    const patch: Partial<LabOrder> = { status };
    if (status === 'en_laboratorio' && !target?.sentDate) patch.sentDate = todayStr;
    if (status === 'en_clinica' && !target?.receivedDate) patch.receivedDate = todayStr;
    await labOrderRepo.update(id, patch);
    set((s) => {
      const nextOrders = s.labOrders.map((o) =>
        o.id === id ? { ...o, ...patch, updatedAt: now } : o
      );
      return {
        labOrders: nextOrders,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: nextOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity(
      'status_changed',
      'lab_order',
      `Laboratorio (${target?.workType || id}): estado cambiado a ${status}`,
      id
    );
  },

  deleteLabOrder: async (id) => {
    await labOrderRepo.delete(id);
    set((s) => {
      const nextOrders = s.labOrders.filter((o) => o.id !== id);
      return {
        labOrders: nextOrders,
        patientIndexes: buildClinicPatientIndexes({
          patients: s.patients,
          transactions: s.financialTransactions,
          labOrders: nextOrders,
          treatmentPlans: s.treatmentPlans,
          appointments: s.appointments,
        }),
      };
    });
    await get().logActivity('deleted', 'lab_order', 'Orden de laboratorio eliminada', id);
    get().showToast('Orden de laboratorio eliminada', 'info');
  },

  createPatientShareInvite: async (patientId, referralNote) => {
    const ws = get().workspace;
    if (!ws) return null;
    const patient = get().patients.find((p) => p.id === patientId);
    if (!patient) return null;
    if (patient.workspaceId !== ws.id) {
      get().showToast(
        'Solo el consultorio titular puede generar un enlace de derivación para este paciente.',
        'warning'
      );
      return null;
    }

    const practitioner = resolvePractitionerDisplay(
      get().professionals,
      get().activeProfessionalId,
      get().profile
    );
    const activeProf =
      get().professionals.find((p) => p.id === get().activeProfessionalId) ||
      get().professionals.find((p) => p.role === 'owner') ||
      get().professionals[0];
    const now = Date.now();
    const share: PatientShareLink = {
      id: `pshare_${now}_${Math.random().toString(36).slice(2, 6)}`,
      ownerWorkspaceId: ws.id,
      ownerUserId: get().authUserId || undefined,
      ownerName: practitioner.name,
      ownerSpecialty: activeProf?.specialty,
      ownerLicense: activeProf?.licenseNumber,
      patientId: patient.id,
      patientNameSnapshot: patient.fullName,
      inviteToken: generateShareInviteToken(),
      referralNote: referralNote?.trim() || undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await patientShareRepo.create(share);
      set((s) => ({
        patientShares: [share, ...s.patientShares],
      }));
      await get().logActivity(
        'created',
        'share',
        `Enlace único creado para compartir ficha de ${patient.fullName}`,
        share.id
      );
      get().showToast('Enlace único generado para compartir por WhatsApp', 'success');
      return share;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo generar el enlace de derivación.';
      get().showToast(msg, 'warning');
      return null;
    }
  },

  unlinkPatientShare: async (shareId) => {
    const ws = get().workspace;
    const target = get().patientShares.find((s) => s.id === shareId);
    try {
      await patientShareRepo.unlinkShare(shareId);
      const isRecipientUnlinking = Boolean(
        target && ws && target.recipientWorkspaceId === ws.id && target.ownerWorkspaceId !== ws.id
      );
      await get().loadEmrData();
      if (isRecipientUnlinking && target && get().selectedPatientId === target.patientId) {
        get().selectPatient(null);
      }
      await get().logActivity(
        'status_changed',
        'share',
        `Vínculo clínico revocado${target ? `: ${target.patientNameSnapshot}` : ''}`,
        shareId
      );
      get().showToast('Vínculo compartido desvinculado correctamente', 'info');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo desvincular la ficha compartida.';
      get().showToast(msg, 'warning');
    }
  },

  loadShareInvitePreview: async (token) => {
    if (!token) return;
    set({ shareInviteLoading: true, shareInviteError: null, shareInvitePreview: null });
    try {
      const preview = await patientShareRepo.getPreviewByToken(token, get().workspace?.id);
      if (!preview) {
        set({
          shareInviteLoading: false,
          shareInviteError: 'Este enlace de derivación no existe o no es válido.',
          shareInvitePreview: null,
        });
        return;
      }
      set({
        shareInviteLoading: false,
        shareInvitePreview: preview,
        shareInviteError: null,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo verificar el enlace compartido.';
      set({
        shareInviteLoading: false,
        shareInviteError: msg,
        shareInvitePreview: null,
      });
    }
  },

  acceptShareInvite: async (token) => {
    const ws = get().workspace;
    if (!ws) return;
    set({ shareInviteLoading: true, shareInviteError: null });
    try {
      const practitioner = resolvePractitionerDisplay(
        get().professionals,
        get().activeProfessionalId,
        get().profile
      );
      const activeProf =
        get().professionals.find((p) => p.id === get().activeProfessionalId) ||
        get().professionals.find((p) => p.role === 'owner') ||
        get().professionals[0];
      const accepted = await patientShareRepo.acceptShare({
        token,
        recipientWorkspaceId: ws.id,
        recipientUserId: get().authUserId || undefined,
        recipientName: practitioner.name,
        recipientSpecialty: activeProf?.specialty,
        recipientLicense: activeProf?.licenseNumber,
      });
      await get().loadEmrData();
      set({
        shareInviteToken: null,
        shareInvitePreview: null,
        shareInviteError: null,
        shareInviteLoading: false,
        currentView: 'patients-search',
        selectedPatientId: accepted.patientId,
        selectedPatientSubView: 'overview',
      });
      void get().loadPatientFiles(accepted.patientId);
      await get().logActivity(
        'status_changed',
        'share',
        'Ficha clínica compartida aceptada y vinculada',
        accepted.id
      );
      get().showToast('Paciente vinculado en tiempo real a tu consultorio', 'success');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo aceptar la invitación.';
      set({ shareInviteLoading: false, shareInviteError: msg });
      get().showToast(msg, 'warning');
    }
  },

  dismissShareInvite: () => {
    set({
      shareInviteToken: null,
      shareInvitePreview: null,
      shareInviteError: null,
      shareInviteLoading: false,
    });
  },

  openTransferModal: (tier = 'base', cycle = 'annual') => {
    set({
      isTransferModalOpen: true,
      transferModalTier: tier,
      transferModalCycle: cycle,
    });
  },

  closeTransferModal: () => {
    set({ isTransferModalOpen: false });
  },

  submitBankTransferRequest: async (input) => {
    const ws = get().workspace;
    if (!ws) return null;
    const pricing = calculatePlanPricing(input.requestedTier, input.billingCycle);
    const now = Date.now();
    const request: SubscriptionTransferRequest = {
      id: `trf_${now}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: ws.id,
      userId: get().authUserId || undefined,
      requestedTier: input.requestedTier,
      billingCycle: input.billingCycle,
      amountUsd: pricing.totalUsd,
      payerName: input.payerName.trim(),
      bankName: input.bankName.trim(),
      transferReference: input.transferReference.trim(),
      notes: input.notes?.trim() || undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await sharedSubscriptionRepo.submitTransferRequest(request);
      const [updatedReqs, updatedSub] = await Promise.all([
        sharedSubscriptionRepo.listTransferRequests(ws.id).catch(() => [request, ...get().transferRequests]),
        sharedSubscriptionRepo.getForWorkspace(ws.id).catch(() => get().workspaceSubscription),
      ]);
      set({
        transferRequests: updatedReqs,
        workspaceSubscription: updatedSub,
      });
      await get().logActivity(
        'created',
        'system',
        `Aviso de transferencia bancaria (${pricing.totalUsd} USD · ${input.requestedTier})`,
        request.transferReference
      );
      get().showToast(
        'Aviso de transferencia registrado. Lo validamos a la brevedad.',
        'success'
      );
      return request;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el comprobante.';
      get().showToast(msg, 'warning');
      return null;
    }
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
