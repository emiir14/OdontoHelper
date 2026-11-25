import { beforeEach, describe, expect, it } from 'vitest';
import { getPageRange } from '../src/components/ui/Pagination';
import { computeVirtualWindow } from '../src/components/ui/VirtualList';
import {
  buildClinicPatientIndexes,
  calculateSingleCurrencyBalance,
  indexPatientBalances,
  indexPatientsById,
  indexPendingLabsByPatient,
  lookupPendingLabAlerts,
} from '../src/core/clinic/clinicHelpers';
import { REPORT_DEFINITIONS, buildReportData } from '../src/core/clinic/reportEngine';
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  FORBIDDEN_PII_QUERY_KEYS,
  LOGIN_ROUTE,
  buildAppUrl,
  getModuleDocumentTitle,
  isOpaqueEntityId,
  parseAppLocation,
  sanitizeInternalNextPath,
  stripSensitiveQueryParams,
} from '../src/core/routing/appRoutes';
import {
  extractPathname,
  hasFileExtension,
  resolveServerRequestAction,
} from '../src/core/routing/spaFallback';
import {
  Appointment,
  ClinicalEvolutionEntry,
  FinancialTransaction,
  LabOrder,
  Patient,
  TreatmentPlan,
} from '../src/core/types';
import {
  clearTestAuthSession,
  getTestAuthSession,
  signInWithTestCredentials,
  verifyTestCredentials,
} from '../src/core/auth/testAuth';
import { useAppStore } from '../src/store/useAppStore';

describe('Routing: Auth, Modules, URLs, and Patient Privacy', () => {
  it('routes unauthenticated requests to /login with safe internal ?next= redirect', () => {
    expect(buildAppUrl({ authRequired: true, currentView: 'agenda' })).toBe(LOGIN_ROUTE);
    expect(
      buildAppUrl({
        authRequired: true,
        currentView: 'agenda',
        postLoginRedirect: '/pacientes/pat_101/cuentas',
      })
    ).toBe('/login?next=%2Fpacientes%2Fpat_101%2Fcuentas');

    // Never add ?next=/dictar when already pointing to default route
    expect(
      buildAppUrl({
        authRequired: true,
        currentView: 'home',
        postLoginRedirect: DEFAULT_AUTHENTICATED_ROUTE,
      })
    ).toBe(LOGIN_ROUTE);
  });

  it('prevents open redirects and login loops in sanitizeInternalNextPath', () => {
    expect(sanitizeInternalNextPath('/agenda?fecha=2026-11-19')).toBe('/agenda?fecha=2026-11-19');
    expect(sanitizeInternalNextPath('/pacientes/pat_99/odontograma')).toBe(
      '/pacientes/pat_99/odontograma'
    );

    // Block external URLs, protocol-relative URLs, backslashes, and /login loops
    expect(sanitizeInternalNextPath('https://evil.example.com/phish')).toBeNull();
    expect(sanitizeInternalNextPath('//evil.example.com/phish')).toBeNull();
    expect(sanitizeInternalNextPath('/\\evil')).toBeNull();
    expect(sanitizeInternalNextPath('/login')).toBeNull();
    expect(sanitizeInternalNextPath('/login?next=/agenda')).toBeNull();

    // Block ?next= containing forbidden patient PII query params
    expect(sanitizeInternalNextPath('/inicio?nombre=Juan%20Perez&dni=12345678')).toBeNull();
  });

  it('round-trips every module route cleanly between buildAppUrl and parseAppLocation', () => {
    const cases: Array<{
      input: Parameters<typeof buildAppUrl>[0];
      expectedUrl: string;
    }> = [
      { input: { authRequired: false, currentView: 'home' }, expectedUrl: '/dictar' },
      { input: { authRequired: false, currentView: 'recording' }, expectedUrl: '/dictar/grabando' },
      { input: { authRequired: false, currentView: 'privacy' }, expectedUrl: '/dictar/privacidad' },
      { input: { authRequired: false, currentView: 'downloads' }, expectedUrl: '/dictar/descargas' },
      {
        input: { authRequired: false, currentView: 'detail', currentSessionId: 'session_1234' },
        expectedUrl: '/dictar/session_1234',
      },
      { input: { authRequired: false, currentView: 'patients-search' }, expectedUrl: '/inicio' },
      { input: { authRequired: false, currentView: 'patient-new' }, expectedUrl: '/pacientes/nuevo' },
      {
        input: {
          authRequired: false,
          currentView: 'patient-new',
          editingPatientId: 'pat_42',
        },
        expectedUrl: '/pacientes/pat_42/editar',
      },
      {
        input: {
          authRequired: false,
          currentView: 'patients-search',
          selectedPatientId: 'pat_42',
          selectedPatientSubView: 'overview',
        },
        expectedUrl: '/pacientes/pat_42',
      },
      {
        input: {
          authRequired: false,
          currentView: 'patients-search',
          selectedPatientId: 'pat_42',
          selectedPatientSubView: 'citas_pendientes',
        },
        expectedUrl: '/pacientes/pat_42/citas-pendientes',
      },
      {
        input: { authRequired: false, currentView: 'provider-new' },
        expectedUrl: '/proveedores/nuevo',
      },
      {
        input: {
          authRequired: false,
          currentView: 'provider-new',
          editingProviderId: 'prov_77',
        },
        expectedUrl: '/proveedores/prov_77/editar',
      },
      {
        input: {
          authRequired: false,
          currentView: 'agenda',
          selectedAgendaDate: '2026-11-19',
        },
        expectedUrl: '/agenda?fecha=2026-11-19',
      },
      { input: { authRequired: false, currentView: 'budgets' }, expectedUrl: '/presupuestos' },
      { input: { authRequired: false, currentView: 'finance' }, expectedUrl: '/caja' },
      {
        input: {
          authRequired: false,
          currentView: 'reports',
          activeReportType: 'prestaciones_realizadas',
        },
        expectedUrl: '/reportes/prestaciones-realizadas',
      },
      {
        input: { authRequired: false, currentView: 'manage-patients' },
        expectedUrl: '/herramientas/pacientes',
      },
      {
        input: { authRequired: false, currentView: 'manage-providers' },
        expectedUrl: '/herramientas/proveedores',
      },
      {
        input: { authRequired: false, currentView: 'activity-log' },
        expectedUrl: '/herramientas/actividad',
      },
      {
        input: { authRequired: false, currentView: 'settings' },
        expectedUrl: '/herramientas/configuracion',
      },
      { input: { authRequired: false, currentView: 'birthdays' }, expectedUrl: '/ventana/cumpleanos' },
      {
        input: { authRequired: false, currentView: 'next-controls' },
        expectedUrl: '/ventana/proximo-control',
      },
      { input: { authRequired: false, currentView: 'lab' }, expectedUrl: '/ventana/laboratorio' },
    ];

    for (const c of cases) {
      const url = buildAppUrl(c.input);
      expect(url).toBe(c.expectedUrl);
      const qIdx = url.indexOf('?');
      const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
      const search = qIdx >= 0 ? url.slice(qIdx) : '';
      const parsed = parseAppLocation(path, search);
      expect(parsed.isLoginRoute).toBe(false);
      expect(parsed.currentView).toBe(c.input.currentView);
    }
  });

  it('enforces patient URL privacy: opaque IDs only, strips PII params, and never leaks names in titles', () => {
    expect(isOpaqueEntityId('pat_17319001_ab12')).toBe(true);
    expect(isOpaqueEntityId('Juan Perez')).toBe(false);
    expect(isOpaqueEntityId('juan@correo.com')).toBe(false);
    expect(isOpaqueEntityId('Juan%20Perez')).toBe(false);

    const parsedNamePath = parseAppLocation('/pacientes/Juan%20Perez/cuentas');
    expect(parsedNamePath.hadForbiddenPii).toBe(true);
    expect(parsedNamePath.selectedPatientId).toBeNull();
    expect(parsedNamePath.currentView).toBe('patients-search');

    const stripped = stripSensitiveQueryParams(
      '?nombre=Maria&dni=40123456&telefono=099111222&diagnostico=caries&fecha=2026-11-19'
    );
    expect(stripped.hadForbiddenPii).toBe(true);
    expect(stripped.safeParams.toString()).toBe('fecha=2026-11-19');
    expect(FORBIDDEN_PII_QUERY_KEYS.has('nombre')).toBe(true);
    expect(FORBIDDEN_PII_QUERY_KEYS.has('dni')).toBe(true);

    const title = getModuleDocumentTitle({
      authRequired: false,
      currentView: 'patients-search',
      selectedPatientId: 'pat_42',
    });
    expect(title).toBe('Ficha clínica · OdontoHelper');
    expect(title).not.toContain('pat_42');
  });

  it('flags unknown URL paths with isNotFound while keeping known public, login, and module routes valid', () => {
    const unknown = parseAppLocation('/pagina-que-no-existe');
    expect(unknown.isNotFound).toBe(true);
    expect(unknown.isLoginRoute).toBe(false);
    expect(unknown.publicRoute).toBeNull();

    const unknownNested = parseAppLocation('/funciones/inexistente/extra');
    expect(unknownNested.isNotFound).toBe(true);

    expect(parseAppLocation('/').isNotFound).toBe(false);
    expect(parseAppLocation('/planes').isNotFound).toBe(false);
    expect(parseAppLocation('/login').isNotFound).toBe(false);
    expect(parseAppLocation('/registro').isNotFound).toBe(false);
    expect(parseAppLocation('/dictar').isNotFound).toBe(false);
    expect(parseAppLocation('/agenda').isNotFound).toBe(false);
  });
});

describe('SPA Server Fallback Classifier', () => {
  it('protects /api/* routes from ever falling back to index.html', () => {
    expect(resolveServerRequestAction('GET', '/api/health')).toEqual({
      action: 'api',
      normalizedPath: '/api/health',
    });
    expect(resolveServerRequestAction('POST', '/api/webhooks/billing')).toEqual({
      action: 'api',
      normalizedPath: '/api/webhooks/billing',
    });
  });

  it('routes static files as assets and deep client URLs to SPA fallback', () => {
    expect(extractPathname('/agenda?fecha=2026-11-19#top')).toBe('/agenda');
    expect(hasFileExtension('/assets/index-abc123.js')).toBe(true);
    expect(hasFileExtension('/pacientes/pat_123/odontograma')).toBe(false);

    expect(resolveServerRequestAction('GET', '/assets/app.js')).toEqual({
      action: 'asset',
      normalizedPath: '/assets/app.js',
    });
    expect(
      resolveServerRequestAction('GET', '/pacientes/pat_123/odontograma', 'text/html')
    ).toEqual({
      action: 'spa',
      normalizedPath: '/pacientes/pat_123/odontograma',
    });
    expect(resolveServerRequestAction('GET', '/login?next=%2Fcaja', 'text/html')).toEqual({
      action: 'spa',
      normalizedPath: '/login',
    });
    expect(resolveServerRequestAction('POST', '/pacientes/pat_123', 'text/html')).toEqual({
      action: 'not_found',
      normalizedPath: '/pacientes/pat_123',
    });
    expect(resolveServerRequestAction('GET', '/agenda', 'application/json')).toEqual({
      action: 'not_found',
      normalizedPath: '/agenda',
    });
  });
});

describe('Pagination & Virtualization Math (1,000+ patients)', () => {
  it('computes compact page ranges with ellipses', () => {
    expect(getPageRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageRange(1, 40)).toEqual([1, 2, 'ellipsis', 40]);
    expect(getPageRange(20, 40)).toEqual([1, 'ellipsis', 19, 20, 21, 'ellipsis', 40]);
    expect(getPageRange(40, 40)).toEqual([1, 'ellipsis', 39, 40]);
  });

  it('windows 1,500 patient items cleanly without rendering offscreen DOM rows', () => {
    const topWindow = computeVirtualWindow({
      totalItems: 1500,
      itemHeight: 70,
      scrollTop: 0,
      viewportHeight: 560,
      overscan: 6,
    });
    expect(topWindow.startIndex).toBe(0);
    expect(topWindow.endIndex).toBe(14);
    expect(topWindow.topPadding).toBe(0);
    expect(topWindow.totalHeight).toBe(105000);

    const midWindow = computeVirtualWindow({
      totalItems: 1500,
      itemHeight: 70,
      scrollTop: 70 * 500,
      viewportHeight: 560,
      overscan: 6,
    });
    expect(midWindow.startIndex).toBe(494);
    expect(midWindow.endIndex).toBe(514);
    expect(midWindow.topPadding).toBe(494 * 70);
    expect(midWindow.bottomPadding).toBe((1500 - 515) * 70);
    // Rendered slice stays ~21 items even with 1,500 patients
    expect(midWindow.endIndex - midWindow.startIndex + 1).toBeLessThanOrEqual(22);
  });
});

describe('O(1) Map Pre-Indexing by patientId & 1,000-Patient Scale', () => {
  it('builds consistent Map indexes matching individual balance/lab calculations', () => {
    const patients: Patient[] = [
      {
        id: 'pat_1',
        workspaceId: 'ws_1',
        fullName: 'Lucia Fernandez',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'pat_2',
        workspaceId: 'ws_1',
        fullName: 'Marcos Silva',
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const transactions: FinancialTransaction[] = [
      {
        id: 'tx_1',
        workspaceId: 'ws_1',
        patientId: 'pat_1',
        patientName: 'Lucia Fernandez',
        type: 'charge',
        currency: 'UYU',
        amount: 5000,
        paymentMethod: 'efectivo',
        concept: 'Endodoncia',
        date: '2026-11-10',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'tx_2',
        workspaceId: 'ws_1',
        patientId: 'pat_1',
        patientName: 'Lucia Fernandez',
        type: 'payment',
        currency: 'UYU',
        amount: 2000,
        paymentMethod: 'efectivo',
        concept: 'Entrega',
        date: '2026-11-12',
        createdAt: 2,
        updatedAt: 2,
      },
    ];
    const labOrders: LabOrder[] = [
      {
        id: 'lab_1',
        workspaceId: 'ws_1',
        patientId: 'pat_2',
        patientName: 'Marcos Silva',
        workType: 'Corona porcelana',
        status: 'en_laboratorio',
        currency: 'UYU',
        cost: 4200,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const indexes = buildClinicPatientIndexes({
      patients,
      transactions,
      labOrders,
      treatmentPlans: [],
      appointments: [],
    });

    expect(indexes.patientsById.get('pat_1')?.fullName).toBe('Lucia Fernandez');
    expect(indexes.balancesByPatientId.get('pat_1')).toEqual(
      calculateSingleCurrencyBalance('pat_1', transactions)
    );
    expect(indexes.balancesByPatientId.get('pat_2')).toBeUndefined();

    const pat2Labs = lookupPendingLabAlerts('pat_2', 'Marcos Silva', indexes.pendingLabsIndex);
    expect(pat2Labs).toHaveLength(1);
    expect(pat2Labs[0].id).toBe('lab_1');
  });

  it('executes 1,200-patient indexing and heavy reports quickly using Map lookups', () => {
    const patients: Patient[] = [];
    const transactions: FinancialTransaction[] = [];
    const plans: TreatmentPlan[] = [];
    const appointments: Appointment[] = [];
    const evolutions: ClinicalEvolutionEntry[] = [];
    const labOrders: LabOrder[] = [];

    for (let i = 0; i < 1200; i++) {
      const id = `pat_bench_${i}`;
      patients.push({
        id,
        workspaceId: 'ws_bench',
        fullName: `Paciente ${i}`,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      });
      transactions.push({
        id: `tx_c_${i}`,
        workspaceId: 'ws_bench',
        patientId: id,
        patientName: `Paciente ${i}`,
        type: 'charge',
        currency: 'UYU',
        amount: 3000 + (i % 500),
        paymentMethod: 'efectivo',
        concept: 'Consulta',
        date: '2026-11-10',
        createdAt: 1,
        updatedAt: 1,
      });
      if (i % 2 === 0) {
        transactions.push({
          id: `tx_p_${i}`,
          workspaceId: 'ws_bench',
          patientId: id,
          patientName: `Paciente ${i}`,
          type: 'payment',
          currency: 'UYU',
          amount: 1500,
          paymentMethod: 'transferencia',
          concept: 'Pago',
          date: '2026-11-11',
          createdAt: 2,
          updatedAt: 2,
        });
      }
      appointments.push({
        id: `appt_${i}`,
        workspaceId: 'ws_bench',
        patientId: id,
        patientName: `Paciente ${i}`,
        date: i % 3 === 0 ? '2026-12-20' : '2026-11-05',
        startTime: '10:00',
        durationMin: 30,
        procedure: 'Control',
        status: i % 3 === 0 ? 'confirmed' : 'completed',
        createdAt: 1,
        updatedAt: 1,
      });
      if (i % 4 === 0) {
        evolutions.push({
          id: `ev_${i}`,
          workspaceId: 'ws_bench',
          patientId: id,
          date: '2026-11-05',
          procedure: 'Control',
          description: 'Sin novedades',
          highlightColor: 'default',
          createdAt: 1,
          updatedAt: 1,
        });
      }
    }

    const start = performance.now();
    const patIdx = indexPatientsById(patients);
    const balIdx = indexPatientBalances(transactions);
    const labIdx = indexPendingLabsByPatient(labOrders);

    expect(patIdx.byId.size).toBe(1200);
    expect(balIdx.size).toBe(1200);
    expect(labIdx.byId.size).toBe(0);

    const receivables = buildReportData({
      reportId: 'cuentas_por_cobrar',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      patients,
      providers: [],
      appointments,
      sessions: [],
      evolutions,
      treatmentPlans: plans,
      transactions,
      labOrders,
    });
    const noFutureAppt = buildReportData({
      reportId: 'pacientes_sin_cita',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      patients,
      providers: [],
      appointments,
      sessions: [],
      evolutions,
      treatmentPlans: plans,
      transactions,
      labOrders,
    });
    const elapsedMs = performance.now() - start;

    expect(receivables.rows).toHaveLength(1200);
    expect(noFutureAppt.rows.length).toBeGreaterThan(0);
    expect(REPORT_DEFINITIONS).toHaveLength(16);
    expect(elapsedMs).toBeLessThan(1500);
  });
});

describe('Store Routing Helpers', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentView: 'home',
      selectedPatientId: null,
      selectedPatientSubView: 'overview',
      editingPatientId: null,
      editingProviderId: null,
      postLoginRedirect: null,
    });
  });

  it('hydrates parsed route state and resets edit flags when navigating via setView', () => {
    const parsed = parseAppLocation('/pacientes/pat_99/odontograma');
    useAppStore.getState().applyParsedRoute(parsed);

    expect(useAppStore.getState().currentView).toBe('patients-search');
    expect(useAppStore.getState().selectedPatientId).toBe('pat_99');
    expect(useAppStore.getState().selectedPatientSubView).toBe('odontograma');

    // Selecting a new patient resets subview to overview
    useAppStore.getState().selectPatient('pat_100');
    expect(useAppStore.getState().selectedPatientId).toBe('pat_100');
    expect(useAppStore.getState().selectedPatientSubView).toBe('overview');

    // Editing a patient then clicking Nuevo Paciente clears editingPatientId cleanly
    useAppStore.getState().startEditPatient('pat_100');
    expect(useAppStore.getState().editingPatientId).toBe('pat_100');
    useAppStore.getState().setView('patient-new');
    expect(useAppStore.getState().editingPatientId).toBeNull();
  });

  it('validates hardcoded drtest/test credentials and manages test login/logout state', async () => {
    expect(verifyTestCredentials('drtest', 'test')).toBe(true);
    expect(verifyTestCredentials('DRTEST', 'test')).toBe(true);
    expect(verifyTestCredentials('drtest', 'wrong')).toBe(false);
    expect(verifyTestCredentials('other', 'test')).toBe(false);

    const store: Record<string, string> = {};
    const origWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      location: { pathname: '/login', search: '' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    };

    try {
      clearTestAuthSession();
      expect(getTestAuthSession()).toBeNull();

      expect(signInWithTestCredentials('drtest', 'wrong')).toBe(false);
      expect(getTestAuthSession()).toBeNull();

      expect(signInWithTestCredentials('drtest', 'test')).toBe(true);
      expect(getTestAuthSession()?.username).toBe('drtest');

      await useAppStore.getState().signOutSupabase();
      expect(getTestAuthSession()).toBeNull();
      expect(useAppStore.getState().authRequired).toBe(true);
      expect(useAppStore.getState().authEmail).toBeNull();
    } finally {
      (globalThis as { window?: unknown }).window = origWindow;
    }
  });
});
