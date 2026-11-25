import type { ReportTypeId } from '../clinic/reportEngine';
import type { PaidSubscriptionPlanTier, SubscriptionBillingCycle } from '../types';

export type PublicMarketingRoute =
  | 'landing'
  | 'funciones'
  | 'dictado-por-voz'
  | 'planes'
  | 'preguntas-frecuentes';

export type RoutableAppView =
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
  | 'birthdays'
  | 'next-controls'
  | 'reports'
  | 'manage-patients'
  | 'manage-providers'
  | 'activity-log'
  | 'settings';

export type PatientSubViewSlug =
  | 'overview'
  | 'cuentas'
  | 'historia'
  | 'archivos'
  | 'cuestionario'
  | 'odontograma'
  | 'citas_pendientes'
  | 'historial_citas'
  | 'trabajos_lab';

export interface ModuleUrlQueryState {
  page?: number;
  pageSize?: number;
  sort?: string | null;
  tab?: string | null;
  status?: string | null;
  entity?: string | null;
  period?: string | null;
  method?: string | null;
  month?: string | null;
  prof?: string | null;
  category?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface RouteStateInput {
  authRequired: boolean;
  currentView: RoutableAppView;
  activeReportType?: ReportTypeId;
  currentSessionId?: string | null;
  selectedPatientId?: string | null;
  selectedPatientSubView?: PatientSubViewSlug;
  editingPatientId?: string | null;
  editingProviderId?: string | null;
  selectedAgendaDate?: string | null;
  shareInviteToken?: string | null;
  postLoginRedirect?: string | null;
  moduleQuery?: ModuleUrlQueryState;
}

export interface ParsedRouteState {
  isNotFound: boolean;
  isLoginRoute: boolean;
  isSignupRoute: boolean;
  publicRoute: PublicMarketingRoute | null;
  requestedPlan: PaidSubscriptionPlanTier | null;
  requestedCycle: SubscriptionBillingCycle | null;
  currentView: RoutableAppView;
  activeReportType: ReportTypeId;
  currentSessionId: string | null;
  selectedPatientId: string | null;
  selectedPatientSubView: PatientSubViewSlug;
  editingPatientId: string | null;
  editingProviderId: string | null;
  selectedAgendaDate: string | null;
  shareInviteToken: string | null;
  nextPath: string | null;
  hadForbiddenPii: boolean;
  moduleQuery: ModuleUrlQueryState;
}

export const LOGIN_ROUTE = '/login';
export const SIGNUP_ROUTE = '/registro';
export const DEFAULT_AUTHENTICATED_ROUTE = '/dictar';

export const PUBLIC_MARKETING_ROUTES: PublicMarketingRoute[] = [
  'landing',
  'funciones',
  'dictado-por-voz',
  'planes',
  'preguntas-frecuentes',
];

const REPORT_IDS = new Set<string>([
  'caja',
  'generado',
  'pacientes_nuevos',
  'pacientes_atendidos',
  'pacientes_sin_anotacion',
  'citas_agendadas',
  'prestaciones_realizadas',
  'presupuestos_no_aceptados',
  'cuentas_por_cobrar',
  'pacientes_deudores',
  'cuentas_por_pagar',
  'facturas_por_pagar',
  'pago_de_pacientes',
  'pago_a_proveedores',
  'pacientes_que_asistieron',
  'pacientes_sin_cita',
]);

const PATIENT_SUBVIEW_TO_URL: Record<PatientSubViewSlug, string> = {
  overview: '',
  cuentas: 'cuentas',
  historia: 'historia',
  archivos: 'archivos',
  cuestionario: 'cuestionario',
  odontograma: 'odontograma',
  citas_pendientes: 'citas-pendientes',
  historial_citas: 'historial-citas',
  trabajos_lab: 'trabajos-lab',
};

const URL_TO_PATIENT_SUBVIEW: Record<string, PatientSubViewSlug> = Object.fromEntries(
  Object.entries(PATIENT_SUBVIEW_TO_URL)
    .filter(([, slug]) => Boolean(slug))
    .map(([key, slug]) => [slug, key as PatientSubViewSlug])
);

/**
 * Blocklist of sensitive query parameter names that must NEVER appear in clinical URLs.
 */
export const FORBIDDEN_PII_QUERY_KEYS = new Set([
  'nombre',
  'name',
  'fullname',
  'full_name',
  'apellido',
  'lastname',
  'dni',
  'ci',
  'cuit',
  'rut',
  'documento',
  'telefono',
  'tel',
  'phone',
  'secondaryphone',
  'celular',
  'email',
  'correo',
  'mail',
  'direccion',
  'address',
  'alergias',
  'allergies',
  'diagnostico',
  'diagnosis',
  'motivo',
  'chiefcomplaint',
  'nota',
  'notas',
  'notes',
  'paciente',
  'patientname',
  'patient_name',
  'fechanacimiento',
  'birthdate',
  'birth_date',
  'q',
  'query',
  'search',
  'busqueda',
]);

const OPAQUE_ID_REGEX = /^[a-zA-Z0-9_-]{2,80}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_TOKEN_REGEX = /^[a-zA-Z0-9_-]{1,36}$/;
const SORT_TOKEN_REGEX = /^[a-zA-Z0-9_.-]{1,40}:(asc|desc)$/;
const MONTH_TOKEN_REGEX = /^(?:all|upcoming|1[0-1]|[0-9])$/;

/**
 * Ensures any entity identifier placed in a URL is strictly an opaque internal ID
 * (no whitespace, no percent-encoded names, no emails, no separators).
 */
export function isOpaqueEntityId(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!OPAQUE_ID_REGEX.test(trimmed)) return false;
  if (trimmed.includes('@') || trimmed.includes(' ')) return false;
  return true;
}

export function sanitizeIsoDateParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return ISO_DATE_REGEX.test(trimmed) ? trimmed : null;
}

export function reportIdToSlug(reportId: ReportTypeId): string {
  return reportId.replace(/_/g, '-');
}

export function slugToReportId(slug: string | null | undefined): ReportTypeId {
  if (!slug) return 'caja';
  const normalized = slug.trim().toLowerCase().replace(/-/g, '_');
  if (REPORT_IDS.has(normalized)) {
    return normalized as ReportTypeId;
  }
  return 'caja';
}

export function stripSensitiveQueryParams(search: string): {
  safeParams: URLSearchParams;
  hadForbiddenPii: boolean;
} {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const safeParams = new URLSearchParams();
  let hadForbiddenPii = false;

  for (const [key, val] of raw.entries()) {
    const normalizedKey = key.trim().toLowerCase();
    if (FORBIDDEN_PII_QUERY_KEYS.has(normalizedKey)) {
      hadForbiddenPii = true;
      continue;
    }
    safeParams.append(key, val);
  }

  return { safeParams, hadForbiddenPii };
}

function sanitizePositiveInt(raw: string | null | undefined, min: number, max: number): number | undefined {
  if (!raw) return undefined;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < min || num > max) return undefined;
  return num;
}

function sanitizeSlugToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return SLUG_TOKEN_REGEX.test(trimmed) ? trimmed : null;
}

export function sanitizeSortParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return SORT_TOKEN_REGEX.test(trimmed) ? trimmed : null;
}

export function parseModuleQueryParams(safeParams: URLSearchParams): ModuleUrlQueryState {
  const query: ModuleUrlQueryState = {};
  const page = sanitizePositiveInt(safeParams.get('pagina'), 1, 10000);
  if (page && page > 1) query.page = page;

  const pageSize = sanitizePositiveInt(safeParams.get('porPagina'), 5, 500);
  if (pageSize) query.pageSize = pageSize;

  const sort = sanitizeSortParam(safeParams.get('orden'));
  if (sort) query.sort = sort;

  const tab = sanitizeSlugToken(safeParams.get('tab'));
  if (tab) query.tab = tab;

  const status = sanitizeSlugToken(safeParams.get('estado'));
  if (status) query.status = status;

  const entity = sanitizeSlugToken(safeParams.get('entidad'));
  if (entity) query.entity = entity;

  const period = sanitizeSlugToken(safeParams.get('periodo'));
  if (period) query.period = period;

  const method = sanitizeSlugToken(safeParams.get('medio'));
  if (method) query.method = method;

  const category = sanitizeSlugToken(safeParams.get('categoria'));
  if (category) query.category = category;

  const rawMonth = safeParams.get('mes')?.trim();
  if (rawMonth && MONTH_TOKEN_REGEX.test(rawMonth)) query.month = rawMonth;

  const rawProf = safeParams.get('prof')?.trim();
  if (rawProf && (rawProf === 'all' || isOpaqueEntityId(rawProf))) {
    query.prof = rawProf;
  }

  const from = sanitizeIsoDateParam(safeParams.get('desde'));
  if (from) query.from = from;

  const to = sanitizeIsoDateParam(safeParams.get('hasta'));
  if (to) query.to = to;

  return query;
}

function appendModuleQueryParams(params: URLSearchParams, moduleQuery?: ModuleUrlQueryState): void {
  if (!moduleQuery) return;
  if (moduleQuery.page && Number.isInteger(moduleQuery.page) && moduleQuery.page > 1) {
    params.set('pagina', String(moduleQuery.page));
  }
  if (
    moduleQuery.pageSize &&
    Number.isInteger(moduleQuery.pageSize) &&
    moduleQuery.pageSize >= 5 &&
    moduleQuery.pageSize <= 500
  ) {
    params.set('porPagina', String(moduleQuery.pageSize));
  }
  const sort = sanitizeSortParam(moduleQuery.sort);
  if (sort) params.set('orden', sort);

  const tab = sanitizeSlugToken(moduleQuery.tab);
  if (tab) params.set('tab', tab);

  const status = sanitizeSlugToken(moduleQuery.status);
  if (status && status !== 'all') params.set('estado', status);

  const entity = sanitizeSlugToken(moduleQuery.entity);
  if (entity && entity !== 'all') params.set('entidad', entity);

  const period = sanitizeSlugToken(moduleQuery.period);
  if (period) params.set('periodo', period);

  const method = sanitizeSlugToken(moduleQuery.method);
  if (method && method !== 'all') params.set('medio', method);

  const category = sanitizeSlugToken(moduleQuery.category);
  if (category && category !== 'all') params.set('categoria', category);

  if (moduleQuery.month && MONTH_TOKEN_REGEX.test(moduleQuery.month)) {
    params.set('mes', moduleQuery.month);
  }

  if (moduleQuery.prof && moduleQuery.prof !== 'all' && isOpaqueEntityId(moduleQuery.prof)) {
    params.set('prof', moduleQuery.prof);
  }

  const from = sanitizeIsoDateParam(moduleQuery.from);
  if (from) params.set('desde', from);

  const to = sanitizeIsoDateParam(moduleQuery.to);
  if (to) params.set('hasta', to);
}

/**
 * Validates post-login redirect targets to avoid open redirects, login loops, or PII leakage.
 */
export function sanitizeInternalNextPath(rawNext: string | null | undefined): string | null {
  if (!rawNext) return null;
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('://') || trimmed.includes('\\')) return null;
  if (trimmed === LOGIN_ROUTE || trimmed.startsWith(`${LOGIN_ROUTE}?`)) return null;

  const qIdx = trimmed.indexOf('?');
  const pathPart = qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed;
  const searchPart = qIdx >= 0 ? trimmed.slice(qIdx) : '';
  const { hadForbiddenPii } = stripSensitiveQueryParams(searchPart);
  if (hadForbiddenPii) return null;

  const parsed = parseAppLocation(pathPart, searchPart);
  if (parsed.isLoginRoute) return null;
  return buildAppUrl({
    authRequired: false,
    currentView: parsed.currentView,
    activeReportType: parsed.activeReportType,
    currentSessionId: parsed.currentSessionId,
    selectedPatientId: parsed.selectedPatientId,
    selectedPatientSubView: parsed.selectedPatientSubView,
    editingPatientId: parsed.editingPatientId,
    editingProviderId: parsed.editingProviderId,
    selectedAgendaDate: parsed.selectedAgendaDate,
    shareInviteToken: parsed.shareInviteToken,
    moduleQuery: parsed.moduleQuery,
  });
}

function sanitizePlanParam(raw: string | null): PaidSubscriptionPlanTier | null {
  if (!raw) return null;
  const val = raw.trim().toLowerCase();
  if (val === 'base' || val === 'extra' || val === 'mega') return val;
  return null;
}

function sanitizeCycleParam(raw: string | null): SubscriptionBillingCycle | null {
  if (!raw) return null;
  const val = raw.trim().toLowerCase();
  if (val === 'monthly' || val === 'quarterly' || val === 'annual') return val;
  if (val === 'mensual') return 'monthly';
  if (val === 'trimestral') return 'quarterly';
  if (val === 'anual') return 'annual';
  return null;
}

export function isPublicMarketingPath(pathname: string): boolean {
  const cleanPath = (pathname.replace(/\/+$/, '') || '/').split('#')[0];
  return (
    cleanPath === '/' ||
    cleanPath === '/funciones' ||
    cleanPath === '/dictado-por-voz' ||
    cleanPath === '/planes' ||
    cleanPath === '/preguntas-frecuentes'
  );
}

/**
 * Parses pathname + search into normalized clinical & public route state.
 * Patient URLs only accept opaque entity IDs — raw names or PII query parameters are discarded.
 */
export function parseAppLocation(pathname: string, search = ''): ParsedRouteState {
  const cleanPath = (pathname.replace(/\/+$/, '') || '/').split('#')[0];
  const segments = cleanPath === '/' ? [] : cleanPath.slice(1).split('/');
  const { safeParams, hadForbiddenPii } = stripSensitiveQueryParams(search);
  const moduleQuery = parseModuleQueryParams(safeParams);

  const base: ParsedRouteState = {
    isNotFound: false,
    isLoginRoute: false,
    isSignupRoute: false,
    publicRoute: null,
    requestedPlan: sanitizePlanParam(safeParams.get('plan')),
    requestedCycle: sanitizeCycleParam(safeParams.get('ciclo')),
    currentView: 'home',
    activeReportType: 'caja',
    currentSessionId: null,
    selectedPatientId: null,
    selectedPatientSubView: 'overview',
    editingPatientId: null,
    editingProviderId: null,
    selectedAgendaDate: null,
    shareInviteToken: null,
    nextPath: null,
    hadForbiddenPii,
    moduleQuery,
  };

  if (segments.length === 0) {
    return {
      ...base,
      publicRoute: 'landing',
    };
  }

  const [first, second, third] = segments;

  if (
    !second &&
    (first === 'funciones' ||
      first === 'dictado-por-voz' ||
      first === 'planes' ||
      first === 'preguntas-frecuentes')
  ) {
    return {
      ...base,
      publicRoute: first,
    };
  }

  if (!second && (first === 'login' || first === 'registro')) {
    return {
      ...base,
      isLoginRoute: true,
      isSignupRoute: first === 'registro' || safeParams.get('modo') === 'prueba',
      nextPath: sanitizeInternalNextPath(safeParams.get('next')),
    };
  }

  if (!second && first === 'inicio') {
    return {
      ...base,
      currentView: 'patients-search',
    };
  }

  if (first === 'dictar') {
    if (!second) return { ...base, currentView: 'home' };
    if (second === 'grabando') return { ...base, currentView: 'recording' };
    if (second === 'privacidad') return { ...base, currentView: 'privacy' };
    if (second === 'descargas') return { ...base, currentView: 'downloads' };
    if (isOpaqueEntityId(second)) {
      return { ...base, currentView: 'detail', currentSessionId: second };
    }
    return { ...base, currentView: 'home' };
  }

  if (first === 'pacientes') {
    if (!second) {
      const legacyId = safeParams.get('id');
      return {
        ...base,
        currentView: 'patients-search',
        selectedPatientId: isOpaqueEntityId(legacyId) ? legacyId : null,
      };
    }
    if (second === 'nuevo') {
      return { ...base, currentView: 'patient-new' };
    }
    if (isOpaqueEntityId(second)) {
      if (third === 'editar') {
        return {
          ...base,
          currentView: 'patient-new',
          editingPatientId: second,
        };
      }
      const subView = third ? URL_TO_PATIENT_SUBVIEW[third] || 'overview' : 'overview';
      return {
        ...base,
        currentView: 'patients-search',
        selectedPatientId: second,
        selectedPatientSubView: subView,
      };
    }
    // Reject non-opaque segment (e.g. accidental name in URL) -> safe patient search root
    return {
      ...base,
      currentView: 'patients-search',
      hadForbiddenPii: true,
    };
  }

  if (first === 'proveedores') {
    if (second === 'nuevo') {
      return { ...base, currentView: 'provider-new' };
    }
    if (second && isOpaqueEntityId(second) && third === 'editar') {
      return {
        ...base,
        currentView: 'provider-new',
        editingProviderId: second,
      };
    }
    return { ...base, currentView: 'manage-providers' };
  }

  if (first === 'agenda') {
    return {
      ...base,
      currentView: 'agenda',
      selectedAgendaDate: sanitizeIsoDateParam(safeParams.get('fecha')),
    };
  }

  if (first === 'presupuestos') {
    return { ...base, currentView: 'budgets' };
  }

  if (first === 'caja') {
    return { ...base, currentView: 'finance' };
  }

  if (first === 'reportes') {
    return {
      ...base,
      currentView: 'reports',
      activeReportType: slugToReportId(second),
    };
  }

  if (first === 'herramientas') {
    if (second === 'pacientes') return { ...base, currentView: 'manage-patients' };
    if (second === 'proveedores') return { ...base, currentView: 'manage-providers' };
    if (second === 'actividad') return { ...base, currentView: 'activity-log' };
    if (second === 'configuracion') return { ...base, currentView: 'settings' };
    return { ...base, currentView: 'manage-patients' };
  }

  if (first === 'ventana') {
    if (second === 'cumpleanos') return { ...base, currentView: 'birthdays' };
    if (second === 'proximo-control') return { ...base, currentView: 'next-controls' };
    if (second === 'laboratorio') return { ...base, currentView: 'lab' };
    return { ...base, currentView: 'birthdays' };
  }

  if (first === 'compartir') {
    if (second && isOpaqueEntityId(second)) {
      return {
        ...base,
        currentView: 'patients-search',
        shareInviteToken: second,
      };
    }
    return {
      ...base,
      currentView: 'patients-search',
    };
  }

  return {
    ...base,
    isNotFound: true,
  };
}

/**
 * Serializes current clinical application state into a canonical, privacy-safe URL.
 */
export function buildAppUrl(state: RouteStateInput): string {
  if (state.authRequired) {
    const safeNext = sanitizeInternalNextPath(state.postLoginRedirect);
    if (safeNext && safeNext !== DEFAULT_AUTHENTICATED_ROUTE) {
      return `${LOGIN_ROUTE}?next=${encodeURIComponent(safeNext)}`;
    }
    return LOGIN_ROUTE;
  }

  if (isOpaqueEntityId(state.shareInviteToken)) {
    return `/compartir/${state.shareInviteToken}`;
  }

  let basePath: string;
  const extraParams = new URLSearchParams();

  switch (state.currentView) {
    case 'home':
      basePath = DEFAULT_AUTHENTICATED_ROUTE;
      break;
    case 'recording':
      basePath = '/dictar/grabando';
      break;
    case 'privacy':
      basePath = '/dictar/privacidad';
      break;
    case 'downloads':
      basePath = '/dictar/descargas';
      break;
    case 'detail':
      basePath = isOpaqueEntityId(state.currentSessionId)
        ? `/dictar/${state.currentSessionId}`
        : DEFAULT_AUTHENTICATED_ROUTE;
      break;
    case 'patients-search': {
      if (isOpaqueEntityId(state.selectedPatientId)) {
        const subSlug = state.selectedPatientSubView
          ? PATIENT_SUBVIEW_TO_URL[state.selectedPatientSubView]
          : '';
        basePath = subSlug
          ? `/pacientes/${state.selectedPatientId}/${subSlug}`
          : `/pacientes/${state.selectedPatientId}`;
      } else {
        basePath = '/inicio';
      }
      break;
    }
    case 'patient-new':
      basePath = isOpaqueEntityId(state.editingPatientId)
        ? `/pacientes/${state.editingPatientId}/editar`
        : '/pacientes/nuevo';
      break;
    case 'provider-new':
      basePath = isOpaqueEntityId(state.editingProviderId)
        ? `/proveedores/${state.editingProviderId}/editar`
        : '/proveedores/nuevo';
      break;
    case 'agenda': {
      basePath = '/agenda';
      const safeDate = sanitizeIsoDateParam(state.selectedAgendaDate);
      if (safeDate) extraParams.set('fecha', safeDate);
      break;
    }
    case 'budgets':
      basePath = '/presupuestos';
      break;
    case 'finance':
      basePath = '/caja';
      break;
    case 'reports':
      basePath = `/reportes/${reportIdToSlug(state.activeReportType || 'caja')}`;
      break;
    case 'manage-patients':
      basePath = '/herramientas/pacientes';
      break;
    case 'manage-providers':
      basePath = '/herramientas/proveedores';
      break;
    case 'activity-log':
      basePath = '/herramientas/actividad';
      break;
    case 'settings':
      basePath = '/herramientas/configuracion';
      break;
    case 'birthdays':
      basePath = '/ventana/cumpleanos';
      break;
    case 'next-controls':
      basePath = '/ventana/proximo-control';
      break;
    case 'lab':
      basePath = '/ventana/laboratorio';
      break;
  }

  if (
    state.currentView !== 'recording' &&
    state.currentView !== 'patient-new' &&
    state.currentView !== 'provider-new'
  ) {
    appendModuleQueryParams(extraParams, state.moduleQuery);
  }

  const queryStr = extraParams.toString();
  return queryStr ? `${basePath}?${queryStr}` : basePath;
}

export function getModuleDocumentTitle(state: RouteStateInput): string {
  if (state.authRequired) return 'Iniciar sesión · OdontoHelper';
  const map: Record<RoutableAppView, string> = {
    home: 'Dictar historia clínica · OdontoHelper',
    recording: 'Grabación en curso · OdontoHelper',
    detail: 'Detalle de dictado · OdontoHelper',
    downloads: 'Descargas nativas · OdontoHelper',
    privacy: 'Privacidad local · OdontoHelper',
    'patients-search': state.selectedPatientId
      ? 'Ficha clínica · OdontoHelper'
      : 'Buscar Paciente · OdontoHelper',
    'patient-new': state.editingPatientId
      ? 'Editar Paciente · OdontoHelper'
      : 'Nuevo Paciente · OdontoHelper',
    'provider-new': state.editingProviderId
      ? 'Editar Proveedor · OdontoHelper'
      : 'Nuevo Proveedor · OdontoHelper',
    agenda: 'Agenda · OdontoHelper',
    budgets: 'Presupuestos · OdontoHelper',
    finance: 'Caja · OdontoHelper',
    lab: 'Trabajos de Laboratorio · OdontoHelper',
    birthdays: 'Cumpleaños · OdontoHelper',
    'next-controls': 'Próximo Control · OdontoHelper',
    reports: 'Reportes · OdontoHelper',
    'manage-patients': 'Administrar Pacientes · OdontoHelper',
    'manage-providers': 'Administrar Proveedores · OdontoHelper',
    'activity-log': 'Historial de actividad · OdontoHelper',
    settings: 'Configuración · OdontoHelper',
  };
  return map[state.currentView];
}
