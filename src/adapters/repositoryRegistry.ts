import {
  IAuthProvider,
  IGlossaryRepository,
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
  LocalPatientFileStore,
  LocalPeriodontogramRepository,
  LocalProfessionalRepository,
  LocalTreatmentPlanRepository,
} from './local/LocalClinicRepositories';
import { LocalSessionRepository } from './local/LocalSessionRepository';
import { LocalSettingsRepository } from './local/LocalSettingsRepository';
import { LocalTranscriptRepository } from './local/LocalTranscriptRepository';
import { getNeonToken, getPreferredDbProvider } from './neon/neonClient';
import {
  NeonActivityRepository,
  NeonAppointmentRepository,
  NeonAuthProvider,
  NeonEvolutionRepository,
  NeonFinancialTransactionRepository,
  NeonGlossaryRepository,
  NeonLabOrderRepository,
  NeonOdontogramRepository,
  NeonPatientRepository,
  NeonPeriodontogramRepository,
  NeonProfessionalRepository,
  NeonProviderRepository,
  NeonSessionRepository,
  NeonSettingsRepository,
  NeonTranscriptRepository,
  NeonTreatmentPlanRepository,
} from './neon/NeonRepositories';
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
  SupabasePatientRepository,
  SupabasePeriodontogramRepository,
  SupabaseProfessionalRepository,
  SupabaseProviderRepository,
  SupabaseSessionRepository,
  SupabaseSettingsRepository,
  SupabaseTranscriptRepository,
  SupabaseTreatmentPlanRepository,
} from './supabase/SupabaseRepositories';

// Audio PCM chunks and high-res imaging attachments ALWAYS stay strictly local in browser IndexedDB
export const sharedAudioStore = new LocalAudioStore();
export const sharedPatientFileStore = new LocalPatientFileStore();

function pickRepo<T>(supa: T, neon: T, local: T): T {
  const preferred = getPreferredDbProvider();
  const hasNeonToken = Boolean(getNeonToken());
  const supaReady = isSupabaseConfigured();

  if (preferred === 'neon' && hasNeonToken) return neon;
  if (!supaReady && hasNeonToken) return neon;
  if (supaReady) return supa;
  return local;
}

const localSession = new LocalSessionRepository();
const supaSession = new SupabaseSessionRepository();
const neonSession = new NeonSessionRepository();
const sessionTarget = () => pickRepo<ISessionRepository>(supaSession, neonSession, localSession);

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
const neonTranscript = new NeonTranscriptRepository();
const transcriptTarget = () =>
  pickRepo<ITranscriptRepository>(supaTranscript, neonTranscript, localTranscript);

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
const neonSettings = new NeonSettingsRepository();
const settingsTarget = () =>
  pickRepo<ISettingsRepository>(supaSettings, neonSettings, localSettings);

export const sharedSettingsRepo: ISettingsRepository = {
  get: (wsId) => settingsTarget().get(wsId),
  update: (wsId, patch) => settingsTarget().update(wsId, patch),
};

const localGlossary = new LocalGlossaryRepository();
const supaGlossary = new SupabaseGlossaryRepository();
const neonGlossary = new NeonGlossaryRepository();
const glossaryTarget = () =>
  pickRepo<IGlossaryRepository>(supaGlossary, neonGlossary, localGlossary);

export const sharedGlossaryRepo: IGlossaryRepository = {
  getAll: (wsId) => glossaryTarget().getAll(wsId),
  add: (entry) => glossaryTarget().add(entry),
  remove: (id) => glossaryTarget().remove(id),
  update: (id, inc, cor) => glossaryTarget().update(id, inc, cor),
  seedDefaultsIfEmpty: (wsId) => glossaryTarget().seedDefaultsIfEmpty(wsId),
};

const localAuth = new LocalAuthProvider();
const supaAuth = new SupabaseAuthProvider();
const neonAuth = new NeonAuthProvider();
const authTarget = () => pickRepo<IAuthProvider>(supaAuth, neonAuth, localAuth);

export const sharedAuthProvider: IAuthProvider = {
  getCurrentWorkspace: () => authTarget().getCurrentWorkspace(),
  getCurrentProfile: () => authTarget().getCurrentProfile(),
};

const localPatient = new LocalPatientRepository();
const supaPatient = new SupabasePatientRepository();
const neonPatient = new NeonPatientRepository();
const patientTarget = () => pickRepo(supaPatient, neonPatient, localPatient);

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
const neonProvider = new NeonProviderRepository();
const providerTarget = () => pickRepo(supaProvider, neonProvider, localProvider);

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
const neonAppointment = new NeonAppointmentRepository();
const appointmentTarget = () => pickRepo(supaAppointment, neonAppointment, localAppointment);

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
const neonActivity = new NeonActivityRepository();
const activityTarget = () => pickRepo(supaActivity, neonActivity, localActivity);

export const sharedActivityRepo = {
  getAll: (wsId: string, limit?: number) => activityTarget().getAll(wsId, limit),
  add: (entry: Parameters<LocalActivityRepository['add']>[0]) => activityTarget().add(entry),
  clearAll: (wsId: string) => activityTarget().clearAll(wsId),
};

const localProfessional = new LocalProfessionalRepository();
const supaProfessional = new SupabaseProfessionalRepository();
const neonProfessional = new NeonProfessionalRepository();
const professionalTarget = () => pickRepo(supaProfessional, neonProfessional, localProfessional);

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
const neonEvolution = new NeonEvolutionRepository();
const evolutionTarget = () => pickRepo(supaEvolution, neonEvolution, localEvolution);

export const sharedEvolutionRepo = {
  getAll: (wsId: string) => evolutionTarget().getAll(wsId),
  create: (e: Parameters<LocalEvolutionRepository['create']>[0]) => evolutionTarget().create(e),
  update: (id: string, patch: Parameters<LocalEvolutionRepository['update']>[1]) =>
    evolutionTarget().update(id, patch),
  delete: (id: string) => evolutionTarget().delete(id),
};

const localOdontogram = new LocalOdontogramRepository();
const supaOdontogram = new SupabaseOdontogramRepository();
const neonOdontogram = new NeonOdontogramRepository();
const odontogramTarget = () => pickRepo(supaOdontogram, neonOdontogram, localOdontogram);

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
const neonPeriodontogram = new NeonPeriodontogramRepository();
const periodontogramTarget = () =>
  pickRepo(supaPeriodontogram, neonPeriodontogram, localPeriodontogram);

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
const neonTreatmentPlan = new NeonTreatmentPlanRepository();
const treatmentPlanTarget = () =>
  pickRepo(supaTreatmentPlan, neonTreatmentPlan, localTreatmentPlan);

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
const neonFinancialTx = new NeonFinancialTransactionRepository();
const financialTxTarget = () => pickRepo(supaFinancialTx, neonFinancialTx, localFinancialTx);

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
const neonLabOrder = new NeonLabOrderRepository();
const labOrderTarget = () => pickRepo(supaLabOrder, neonLabOrder, localLabOrder);

export const sharedLabOrderRepo = {
  getAll: (wsId: string) => labOrderTarget().getAll(wsId),
  create: (o: Parameters<LocalLabOrderRepository['create']>[0]) => labOrderTarget().create(o),
  update: (id: string, patch: Parameters<LocalLabOrderRepository['update']>[1]) =>
    labOrderTarget().update(id, patch),
  delete: (id: string) => labOrderTarget().delete(id),
};
