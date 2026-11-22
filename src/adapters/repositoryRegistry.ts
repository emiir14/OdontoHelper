import {
  IAuthProvider,
  IGlossaryRepository,
  IPatientFileStore,
  ISessionRepository,
  ISettingsRepository,
  ITranscriptRepository,
} from '../core/interfaces';
import { LocalAudioStore } from './local/LocalAudioStore';
import { LocalAuthProvider } from './local/LocalAuthProvider';
import {
  LocalActivityRepository,
  LocalAppointmentRepository,
  LocalPatientRepository,
  LocalProviderRepository,
} from './local/LocalEmrRepositories';
import { LocalGlossaryRepository } from './local/LocalGlossaryRepository';
import {
  LocalEvolutionRepository,
  LocalFinancialTransactionRepository,
  LocalLabOrderRepository,
  LocalOdontogramRepository,
  LocalPatientShareRepository,
  LocalPeriodontogramRepository,
  LocalProfessionalRepository,
  LocalTreatmentPlanRepository,
} from './local/LocalClinicRepositories';
import { LocalSessionRepository } from './local/LocalSessionRepository';
import { LocalSettingsRepository } from './local/LocalSettingsRepository';
import { LocalTranscriptRepository } from './local/LocalTranscriptRepository';
import { isTestAuthActive } from '../core/auth/testAuth';
import { isSupabaseConfigured } from './supabase/supabaseClient';
import {
  SupabaseActivityRepository,
  SupabaseAppointmentRepository,
  SupabaseAuthProvider,
  SupabaseEvolutionRepository,
  SupabaseFinancialTransactionRepository,
  SupabaseGlossaryRepository,
  SupabaseLabOrderRepository,
  SupabaseOdontogramRepository,
  SupabasePatientFileStore,
  SupabasePatientRepository,
  SupabasePatientShareRepository,
  SupabasePeriodontogramRepository,
  SupabaseProfessionalRepository,
  SupabaseProviderRepository,
  SupabaseSessionRepository,
  SupabaseSettingsRepository,
  SupabaseSubscriptionRepository,
  SupabaseTranscriptRepository,
  SupabaseTreatmentPlanRepository,
} from './supabase/SupabaseRepositories';
import {
  getOrCreateLocalSubscription,
  listLocalTransferRequests,
  saveLocalTransferRequest,
} from '../core/clinic/localSubscriptionStore';

// Audio PCM chunks ALWAYS stay strictly local in browser IndexedDB (never uploaded on free tier).
export const sharedAudioStore = new LocalAudioStore();

// Clinical data uses Supabase when configured (unless testing locally with drtest), otherwise local IndexedDB.
function pickDataRepo<T>(supa: T, local: T): T {
  return isSupabaseConfigured() && !isTestAuthActive() ? supa : local;
}

export class CloudRequiredPatientFileError extends Error {
  constructor(
    message = 'Los archivos clínicos y radiografías deben almacenarse exclusivamente en la nube (Supabase). Configurá e iniciá sesión en Supabase para acceder o subir archivos.'
  ) {
    super(message);
    this.name = 'CloudRequiredPatientFileError';
  }
}

class CloudRequiredPatientFileStore implements IPatientFileStore {
  public async getAll(): Promise<never> {
    throw new CloudRequiredPatientFileError();
  }
  public async getByPatientId(): Promise<never> {
    throw new CloudRequiredPatientFileError();
  }
  public async add(): Promise<never> {
    throw new CloudRequiredPatientFileError();
  }
  public async delete(): Promise<never> {
    throw new CloudRequiredPatientFileError();
  }
}

const cloudRequiredPatientFile = new CloudRequiredPatientFileStore();
const supaPatientFile = new SupabasePatientFileStore();
const patientFileTarget = () =>
  pickDataRepo<IPatientFileStore>(supaPatientFile, cloudRequiredPatientFile);

// Radiographs, clinical photos, and patient documents MUST live in Supabase (Storage + table), never IndexedDB
export const sharedPatientFileStore: IPatientFileStore = {
  getAll: (wsId) => patientFileTarget().getAll(wsId),
  getByPatientId: (wsId, patientId) => patientFileTarget().getByPatientId(wsId, patientId),
  add: (file) => patientFileTarget().add(file),
  delete: (id) => patientFileTarget().delete(id),
};

const localSession = new LocalSessionRepository();
const supaSession = new SupabaseSessionRepository();
const sessionTarget = () => pickDataRepo<ISessionRepository>(supaSession, localSession);

export const sharedSessionRepo: ISessionRepository = {
  getAll: (wsId) => sessionTarget().getAll(wsId),
  getById: (id) => sessionTarget().getById(id),
  create: (s) => sessionTarget().create(s),
  update: (id, p) => sessionTarget().update(id, p),
  delete: (id) => sessionTarget().delete(id),
  findUnclosedRecording: (wsId) => sessionTarget().findUnclosedRecording(wsId),
};

const localTranscript = new LocalTranscriptRepository();
const supaTranscript = new SupabaseTranscriptRepository();
const transcriptTarget = () =>
  pickDataRepo<ITranscriptRepository>(supaTranscript, localTranscript);

export const sharedTranscriptRepo: ITranscriptRepository = {
  getBySessionId: (id) => transcriptTarget().getBySessionId(id),
  addSegment: (seg) => transcriptTarget().addSegment(seg),
  saveSegments: (segs) => transcriptTarget().saveSegments(segs),
  updateSegment: (id, text) => transcriptTarget().updateSegment(id, text),
  updateSegmentSpeaker: (id, speaker) => transcriptTarget().updateSegmentSpeaker(id, speaker),
  deleteSegment: (id) => transcriptTarget().deleteSegment(id),
  deleteBySessionId: (id) => transcriptTarget().deleteBySessionId(id),
};

const localSettings = new LocalSettingsRepository();
const supaSettings = new SupabaseSettingsRepository();
const settingsTarget = () => pickDataRepo<ISettingsRepository>(supaSettings, localSettings);

export const sharedSettingsRepo: ISettingsRepository = {
  get: (wsId) => settingsTarget().get(wsId),
  update: (wsId, patch) => settingsTarget().update(wsId, patch),
};

const localGlossary = new LocalGlossaryRepository();
const supaGlossary = new SupabaseGlossaryRepository();
const glossaryTarget = () => pickDataRepo<IGlossaryRepository>(supaGlossary, localGlossary);

export const sharedGlossaryRepo: IGlossaryRepository = {
  getAll: (wsId) => glossaryTarget().getAll(wsId),
  add: (entry) => glossaryTarget().add(entry),
  remove: (id) => glossaryTarget().remove(id),
  update: (id, inc, cor) => glossaryTarget().update(id, inc, cor),
  seedDefaultsIfEmpty: (wsId) => glossaryTarget().seedDefaultsIfEmpty(wsId),
};

const localAuth = new LocalAuthProvider();
const supaAuth = new SupabaseAuthProvider();
const authTarget = (): IAuthProvider => {
  if (isTestAuthActive()) return localAuth;
  if (isSupabaseConfigured()) return supaAuth;
  return localAuth;
};

export const sharedAuthProvider: IAuthProvider = {
  getCurrentWorkspace: () => authTarget().getCurrentWorkspace(),
  getCurrentProfile: () => authTarget().getCurrentProfile(),
};

const localPatient = new LocalPatientRepository();
const supaPatient = new SupabasePatientRepository();
const patientTarget = () => pickDataRepo(supaPatient, localPatient);

export const sharedPatientRepo = {
  getAll: (wsId: string) => patientTarget().getAll(wsId),
  getById: (id: string) => patientTarget().getById(id),
  create: (p: Parameters<LocalPatientRepository['create']>[0]) => patientTarget().create(p),
  update: (id: string, patch: Parameters<LocalPatientRepository['update']>[1]) =>
    patientTarget().update(id, patch),
  delete: (id: string) => patientTarget().delete(id),
};

const localProvider = new LocalProviderRepository();
const supaProvider = new SupabaseProviderRepository();
const providerTarget = () => pickDataRepo(supaProvider, localProvider);

export const sharedProviderRepo = {
  getAll: (wsId: string) => providerTarget().getAll(wsId),
  getById: (id: string) => providerTarget().getById(id),
  create: (p: Parameters<LocalProviderRepository['create']>[0]) => providerTarget().create(p),
  update: (id: string, patch: Parameters<LocalProviderRepository['update']>[1]) =>
    providerTarget().update(id, patch),
  delete: (id: string) => providerTarget().delete(id),
};

const localAppointment = new LocalAppointmentRepository();
const supaAppointment = new SupabaseAppointmentRepository();
const appointmentTarget = () => pickDataRepo(supaAppointment, localAppointment);

export const sharedAppointmentRepo = {
  getAll: (wsId: string) => appointmentTarget().getAll(wsId),
  create: (a: Parameters<LocalAppointmentRepository['create']>[0]) =>
    appointmentTarget().create(a),
  update: (id: string, patch: Parameters<LocalAppointmentRepository['update']>[1]) =>
    appointmentTarget().update(id, patch),
  delete: (id: string) => appointmentTarget().delete(id),
};

const localActivity = new LocalActivityRepository();
const supaActivity = new SupabaseActivityRepository();
const activityTarget = () => pickDataRepo(supaActivity, localActivity);

export const sharedActivityRepo = {
  getAll: (wsId: string, limit?: number) => activityTarget().getAll(wsId, limit),
  add: (entry: Parameters<LocalActivityRepository['add']>[0]) => activityTarget().add(entry),
  clearAll: (wsId: string) => activityTarget().clearAll(wsId),
};

const localProfessional = new LocalProfessionalRepository();
const supaProfessional = new SupabaseProfessionalRepository();
const professionalTarget = () => pickDataRepo(supaProfessional, localProfessional);

export const sharedProfessionalRepo = {
  getAll: (wsId: string) => professionalTarget().getAll(wsId),
  create: (p: Parameters<LocalProfessionalRepository['create']>[0]) =>
    professionalTarget().create(p),
  update: (id: string, patch: Parameters<LocalProfessionalRepository['update']>[1]) =>
    professionalTarget().update(id, patch),
  delete: (id: string) => professionalTarget().delete(id),
};

const localEvolution = new LocalEvolutionRepository();
const supaEvolution = new SupabaseEvolutionRepository();
const evolutionTarget = () => pickDataRepo(supaEvolution, localEvolution);

export const sharedEvolutionRepo = {
  getAll: (wsId: string) => evolutionTarget().getAll(wsId),
  create: (e: Parameters<LocalEvolutionRepository['create']>[0]) => evolutionTarget().create(e),
  update: (id: string, patch: Parameters<LocalEvolutionRepository['update']>[1]) =>
    evolutionTarget().update(id, patch),
  delete: (id: string) => evolutionTarget().delete(id),
};

const localOdontogram = new LocalOdontogramRepository();
const supaOdontogram = new SupabaseOdontogramRepository();
const odontogramTarget = () => pickDataRepo(supaOdontogram, localOdontogram);

export const sharedOdontogramRepo = {
  getAll: (wsId: string) => odontogramTarget().getAll(wsId),
  create: (r: Parameters<LocalOdontogramRepository['create']>[0]) =>
    odontogramTarget().create(r),
  update: (id: string, patch: Parameters<LocalOdontogramRepository['update']>[1]) =>
    odontogramTarget().update(id, patch),
  delete: (id: string) => odontogramTarget().delete(id),
};

const localPeriodontogram = new LocalPeriodontogramRepository();
const supaPeriodontogram = new SupabasePeriodontogramRepository();
const periodontogramTarget = () => pickDataRepo(supaPeriodontogram, localPeriodontogram);

export const sharedPeriodontogramRepo = {
  getAll: (wsId: string) => periodontogramTarget().getAll(wsId),
  create: (r: Parameters<LocalPeriodontogramRepository['create']>[0]) =>
    periodontogramTarget().create(r),
  update: (id: string, patch: Parameters<LocalPeriodontogramRepository['update']>[1]) =>
    periodontogramTarget().update(id, patch),
  delete: (id: string) => periodontogramTarget().delete(id),
};

const localTreatmentPlan = new LocalTreatmentPlanRepository();
const supaTreatmentPlan = new SupabaseTreatmentPlanRepository();
const treatmentPlanTarget = () => pickDataRepo(supaTreatmentPlan, localTreatmentPlan);

export const sharedTreatmentPlanRepo = {
  getAll: (wsId: string) => treatmentPlanTarget().getAll(wsId),
  create: (p: Parameters<LocalTreatmentPlanRepository['create']>[0]) =>
    treatmentPlanTarget().create(p),
  update: (id: string, patch: Parameters<LocalTreatmentPlanRepository['update']>[1]) =>
    treatmentPlanTarget().update(id, patch),
  delete: (id: string) => treatmentPlanTarget().delete(id),
};

const localFinancialTx = new LocalFinancialTransactionRepository();
const supaFinancialTx = new SupabaseFinancialTransactionRepository();
const financialTxTarget = () => pickDataRepo(supaFinancialTx, localFinancialTx);

export const sharedFinancialTxRepo = {
  getAll: (wsId: string) => financialTxTarget().getAll(wsId),
  create: (tx: Parameters<LocalFinancialTransactionRepository['create']>[0]) =>
    financialTxTarget().create(tx),
  update: (id: string, patch: Parameters<LocalFinancialTransactionRepository['update']>[1]) =>
    financialTxTarget().update(id, patch),
  delete: (id: string) => financialTxTarget().delete(id),
};

const localLabOrder = new LocalLabOrderRepository();
const supaLabOrder = new SupabaseLabOrderRepository();
const labOrderTarget = () => pickDataRepo(supaLabOrder, localLabOrder);

export const sharedLabOrderRepo = {
  getAll: (wsId: string) => labOrderTarget().getAll(wsId),
  create: (o: Parameters<LocalLabOrderRepository['create']>[0]) => labOrderTarget().create(o),
  update: (id: string, patch: Parameters<LocalLabOrderRepository['update']>[1]) =>
    labOrderTarget().update(id, patch),
  delete: (id: string) => labOrderTarget().delete(id),
};

const localPatientShare = new LocalPatientShareRepository();
const supaPatientShare = new SupabasePatientShareRepository();
const patientShareTarget = () => pickDataRepo(supaPatientShare, localPatientShare);

export const sharedPatientShareRepo = {
  getAllForWorkspace: (wsId: string) => patientShareTarget().getAllForWorkspace(wsId),
  create: (share: Parameters<LocalPatientShareRepository['create']>[0]) =>
    patientShareTarget().create(share),
  getPreviewByToken: (token: string, callerWorkspaceId?: string) =>
    patientShareTarget().getPreviewByToken(token, callerWorkspaceId),
  acceptShare: (input: Parameters<LocalPatientShareRepository['acceptShare']>[0]) =>
    patientShareTarget().acceptShare(input),
  unlinkShare: (shareId: string) => patientShareTarget().unlinkShare(shareId),
};

const supaSubscription = new SupabaseSubscriptionRepository();
const localSubscriptionRepo = {
  getForWorkspace: async (wsId: string) => getOrCreateLocalSubscription(wsId),
  listTransferRequests: async (wsId: string) => listLocalTransferRequests(wsId),
  submitTransferRequest: async (
    req: Parameters<SupabaseSubscriptionRepository['submitTransferRequest']>[0]
  ) => {
    saveLocalTransferRequest(req);
  },
};
const subscriptionTarget = () => pickDataRepo(supaSubscription, localSubscriptionRepo);

export const sharedSubscriptionRepo = {
  getForWorkspace: (wsId: string) => subscriptionTarget().getForWorkspace(wsId),
  listTransferRequests: (wsId: string) => subscriptionTarget().listTransferRequests(wsId),
  submitTransferRequest: (
    req: Parameters<SupabaseSubscriptionRepository['submitTransferRequest']>[0]
  ) => subscriptionTarget().submitTransferRequest(req),
};

