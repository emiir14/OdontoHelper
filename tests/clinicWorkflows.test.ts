import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  buildAppointmentIcs,
  calculateAgeFromBirthDate,
  calculatePatientBalances,
  calculateSingleCurrencyBalance,
  calculateTreatmentItemSubtotal,
  calculateTreatmentPlanTotals,
  compareTableValues,
  formatBirthDateDisplay,
  formatCurrencyHeading,
  formatMoney,
  generateGoogleCalendarUrl,
  generateWhatsAppUrl,
  getPatientPendingLabAlerts,
  getUpcomingBirthdays,
  packPatientAnamnesis,
  sanitizePhoneForWhatsApp,
  toLocalIsoDate,
  unpackPatientProfileMeta,
} from '../src/core/clinic/clinicHelpers';
import {
  activityRepo,
  appointmentRepo,
  evolutionRepo,
  financialTxRepo,
  patientRepo,
  professionalRepo,
  providerRepo,
  sessionRepo,
  treatmentPlanRepo,
  useAppStore,
} from '../src/store/useAppStore';
import { createDefaultSettings } from '../src/adapters/local/LocalSettingsRepository';
import {
  sharedActivityRepo,
  sharedAppointmentRepo,
  sharedEvolutionRepo,
  sharedFinancialTxRepo,
  sharedLabOrderRepo,
  sharedOdontogramRepo,
  sharedPatientRepo,
  sharedPeriodontogramRepo,
  sharedProfessionalRepo,
  sharedProviderRepo,
  sharedSessionRepo,
  sharedTranscriptRepo,
  sharedTreatmentPlanRepo,
} from '../src/adapters/repositoryRegistry';
import { seedDemoClinicData } from '../src/core/clinic/mockDataSeeder';
import { REPORT_DEFINITIONS, buildReportData } from '../src/core/clinic/reportEngine';
import {
  Appointment,
  ClinicalEvolutionEntry,
  ClinicalNote,
  FinancialTransaction,
  LabOrder,
  Patient,
  Provider,
  Session,
  TreatmentPlan,
} from '../src/core/types';

describe('OdontoHelper Clinical Helpers', () => {
  it('calculates treatment item subtotals with quantity and discount', () => {
    expect(
      calculateTreatmentItemSubtotal({
        id: 'i1',
        procedure: 'Corona',
        quantity: 2,
        unitPrice: 100000,
        discountPct: 10,
        completed: false,
      })
    ).toBe(180000);
  });

  it('calculates treatment plan totals and completion progress', () => {
    const plan: TreatmentPlan = {
      id: 'p1',
      workspaceId: 'ws1',
      patientId: 'pat1',
      patientName: 'Juan Pérez',
      title: 'Plan integral',
      currency: 'ARS',
      status: 'en_curso',
      items: [
        {
          id: 'a',
          procedure: 'Limpieza',
          quantity: 1,
          unitPrice: 40000,
          completed: true,
        },
        {
          id: 'b',
          procedure: 'Composite',
          quantity: 1,
          unitPrice: 60000,
          discountPct: 0,
          completed: false,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const totals = calculateTreatmentPlanTotals(plan);
    expect(totals.total).toBe(100000);
    expect(totals.completedTotal).toBe(40000);
    expect(totals.pendingTotal).toBe(60000);
    expect(totals.completedCount).toBe(1);
    expect(totals.totalCount).toBe(2);
    expect(totals.progressPct).toBe(50);
  });

  it('calculates patient ARS and USD balances excluding expenses and soft-deleted items', () => {
    const txs: FinancialTransaction[] = [
      {
        id: '1',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Ana',
        type: 'charge',
        currency: 'ARS',
        amount: 120000,
        paymentMethod: 'cargo_clinico',
        concept: 'Endodoncia',
        date: '2026-11-10',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: '2',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Ana',
        type: 'payment',
        currency: 'ARS',
        amount: 50000,
        paymentMethod: 'efectivo',
        concept: 'Seña',
        date: '2026-11-11',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: '3',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Ana',
        type: 'charge',
        currency: 'USD',
        amount: 800,
        paymentMethod: 'cargo_clinico',
        concept: 'Implante',
        date: '2026-11-12',
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: '4',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Ana',
        type: 'payment',
        currency: 'ARS',
        amount: 99999,
        paymentMethod: 'efectivo',
        concept: 'Anulado',
        date: '2026-11-12',
        createdAt: 4,
        updatedAt: 4,
        deletedAt: 5,
      },
      {
        id: '5',
        workspaceId: 'ws1',
        patientId: 'pat1',
        type: 'expense',
        currency: 'ARS',
        amount: 30000,
        paymentMethod: 'efectivo',
        concept: 'Insumos',
        date: '2026-11-12',
        createdAt: 5,
        updatedAt: 5,
      },
    ];

    const bal = calculatePatientBalances('pat1', txs);
    expect(bal.ARS).toEqual({ charged: 120000, paid: 50000, balance: 70000 });
    expect(bal.USD).toEqual({ charged: 800, paid: 0, balance: 800 });
  });

  it('detects pending lab orders by patientId or patientName while ignoring clinic/installed items', () => {
    const orders: LabOrder[] = [
      {
        id: 'l1',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Lucía',
        providerName: 'Lab Sur',
        workType: 'Corona zirconio',
        currency: 'ARS',
        status: 'en_laboratorio',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'l2',
        workspaceId: 'ws1',
        patientName: 'lucía',
        providerName: 'Lab Norte',
        workType: 'Placa',
        currency: 'ARS',
        status: 'sin_enviar',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'l3',
        workspaceId: 'ws1',
        patientId: 'pat1',
        patientName: 'Lucía',
        providerName: 'Lab Sur',
        workType: 'Corona lista',
        currency: 'ARS',
        status: 'en_clinica',
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const alerts = getPatientPendingLabAlerts('pat1', 'Lucía', orders);
    expect(alerts.map((a) => a.id)).toEqual(['l1', 'l2']);
  });

  it('builds valid WhatsApp, Google Calendar, and ICS links', () => {
    const wa = generateWhatsAppUrl('11 5544-3322', 'Hola turno');
    expect(wa).toBe('https://wa.me/5491155443322?text=Hola%20turno');

    const appt: Appointment = {
      id: 'a1',
      workspaceId: 'ws1',
      patientName: 'Carlos Ruiz',
      date: '2026-12-10',
      startTime: '14:30',
      durationMin: 45,
      procedure: 'Limpieza',
      status: 'confirmed',
      createdAt: 1,
      updatedAt: 1,
    };

    const gcal = generateGoogleCalendarUrl(appt);
    expect(gcal).toContain('https://calendar.google.com/calendar/render');
    expect(gcal).toContain('Carlos%20Ruiz');

    const ics = buildAppointmentIcs(appt);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Turno Odontológico - Carlos Ruiz (Limpieza)');
  });

  it('finds upcoming birthdays within the configured window', () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const inFiveDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
    const birthDate = `1990-${pad(inFiveDays.getMonth() + 1)}-${pad(inFiveDays.getDate())}`;

    const patients: Patient[] = [
      {
        id: 'p_bday',
        workspaceId: 'ws1',
        fullName: 'Sofía Méndez',
        birthDate,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const list = getUpcomingBirthdays(patients, 10);
    expect(list).toHaveLength(1);
    expect(list[0].patient.fullName).toBe('Sofía Méndez');
    expect(list[0].daysUntil).toBe(5);
  });

  it('defaults to UYU currency without currency U/code by default and reveals code when showCurrencyCode is true', () => {
    expect(DEFAULT_CURRENCY).toBe('UYU');
    expect(CURRENCY_OPTIONS).toHaveLength(15);
    expect(CURRENCY_OPTIONS.map((c) => c.code)).toEqual(
      expect.arrayContaining(['UYU', 'USD', 'ARS', 'BRL', 'CLP', 'COP', 'MXN', 'PEN', 'PYG', 'BOB', 'CRC', 'DOP', 'GTQ', 'PAB', 'VES'])
    );
    expect(formatMoney(1800)).toBe('$ 1.800');
    expect(formatMoney(-3200)).toBe('-$ 3.200');
    expect(formatMoney(1800, 'USD')).toBe('$ 1.800');
    expect(formatMoney(1800, 'UYU', true)).toBe('UYU $ 1.800');
    expect(formatMoney(1800, 'USD', true)).toBe('USD $ 1.800');
    expect(formatMoney(1800, 'MXN', true)).toBe('MXN $ 1,800');
    expect(formatCurrencyHeading('Ingresos', 'UYU', false)).toBe('Ingresos');
    expect(formatCurrencyHeading('Ingresos', 'USD', true)).toBe('Ingresos (USD)');
  });

  it('sorts numbers, currency amounts (including negatives), DD/MM/YYYY dates, and Spanish strings via compareTableValues', () => {
    expect(compareTableValues('-$ 3.200', '$ 1.800')).toBeLessThan(0);
    expect(compareTableValues('$ 2.400', '$ 950')).toBeGreaterThan(0);
    expect(compareTableValues('15/11/2026', '02/12/2026')).toBeLessThan(0);
    expect(compareTableValues('Álvaro', 'Beatriz')).toBeLessThan(0);
    expect(compareTableValues('—', 'Algo')).toBeGreaterThan(0);
  });

  it('calculates unified single-currency balance excluding expenses and soft-deleted transactions', () => {
    const txs: FinancialTransaction[] = [
      {
        id: 'u1',
        workspaceId: 'ws1',
        patientId: 'pat1',
        type: 'charge',
        currency: 'UYU',
        amount: 7500,
        paymentMethod: 'cargo_clinico',
        concept: 'Endodoncia',
        date: '2026-11-10',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'u2',
        workspaceId: 'ws1',
        patientId: 'pat1',
        type: 'payment',
        currency: 'UYU',
        amount: 3200,
        paymentMethod: 'efectivo',
        concept: 'Abono inicial',
        date: '2026-11-11',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'u3',
        workspaceId: 'ws1',
        patientId: 'pat1',
        type: 'payment',
        currency: 'UYU',
        amount: 9999,
        paymentMethod: 'efectivo',
        concept: 'Anulado',
        date: '2026-11-12',
        createdAt: 3,
        updatedAt: 3,
        deletedAt: 4,
      },
      {
        id: 'u4',
        workspaceId: 'ws1',
        patientId: 'pat1',
        type: 'expense',
        currency: 'UYU',
        amount: 1500,
        paymentMethod: 'efectivo',
        concept: 'Insumos',
        date: '2026-11-12',
        createdAt: 5,
        updatedAt: 5,
      },
    ];

    expect(calculateSingleCurrencyBalance('pat1', txs)).toEqual({
      charged: 7500,
      paid: 3200,
      balance: 4300,
    });
  });

  it('normalizes Uruguayan mobile numbers for WhatsApp', () => {
    expect(sanitizePhoneForWhatsApp('099 412 890')).toBe('59899412890');
    expect(generateWhatsAppUrl('099 412 890', 'Hola')).toBe('https://wa.me/59899412890?text=Hola');
  });

  it('formats birth dates, calculates age, and packs/unpacks extended patient metadata safely', () => {
    expect(formatBirthDateDisplay('2020-01-16')).toBe('16/01/2020');
    const age = calculateAgeFromBirthDate('1991-06-14');
    expect(age).toBeGreaterThanOrEqual(34);

    const packed = packPatientAnamnesis(
      {
        gender: 'F',
        secondaryPhone: '2708 4412',
        nextControlDate: '2026-12-15',
        nextControlNote: 'Control Rx',
        physicalExam: { bloodPressure: '115/75 mmHg', oralHygiene: 'Buena' },
      },
      { bruxism: true }
    );
    expect(packed?.bruxism).toBe(true);
    const meta = unpackPatientProfileMeta(packed);
    expect(meta.gender).toBe('F');
    expect(meta.secondaryPhone).toBe('2708 4412');
    expect(meta.nextControlDate).toBe('2026-12-15');
    expect(meta.physicalExam?.bloodPressure).toBe('115/75 mmHg');
  });
});

describe('OdontoHelper Clinic Workflows (Personal Profile, Evolution, Budget -> Evolution + Ledger Sync)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({
      workspace: { id: 'ws_test', name: 'Consultorio Test', slug: 'consultorio-test', createdAt: 1, updatedAt: 1 },
      patients: [
        {
          id: 'pat_1',
          workspaceId: 'ws_test',
          fullName: 'Lucía Fernández',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      professionals: [
        {
          id: 'prof_owner',
          workspaceId: 'ws_test',
          fullName: 'Dr. Marcos',
          role: 'owner',
          agendaColor: '#0d9488',
          canViewFinance: true,
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'prof_asst',
          workspaceId: 'ws_test',
          fullName: 'Asistente Clara',
          role: 'asistente',
          agendaColor: '#2563eb',
          canViewFinance: false,
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeProfessionalId: 'prof_owner',
      treatmentPlans: [
        {
          id: 'plan_1',
          workspaceId: 'ws_test',
          patientId: 'pat_1',
          patientName: 'Lucía Fernández',
          title: 'Rehabilitación',
          currency: 'ARS',
          status: 'aprobado',
          items: [
            {
              id: 'item_1',
              procedure: 'Restauración con composite',
              toothFdi: '1.6',
              quantity: 1,
              unitPrice: 55000,
              completed: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      financialTransactions: [],
      clinicalEvolutions: [],
      toastMessage: null,
    });

    vi.spyOn(useAppStore.getState(), 'loadEmrData').mockResolvedValue(undefined);
    vi.spyOn(activityRepo, 'add').mockResolvedValue(undefined);
    vi.spyOn(activityRepo, 'getAll').mockResolvedValue([]);
  });

  it('creates clinical evolution entry attributed to active personal practitioner', async () => {
    const createSpy = vi.spyOn(evolutionRepo, 'create').mockResolvedValue(undefined);

    const created = await useAppStore.getState().createEvolutionEntry({
      patientId: 'pat_1',
      date: '2026-11-17',
      procedure: 'Control',
      description: 'Todo en orden',
      highlightColor: 'teal',
    });
    expect(created).not.toBeNull();
    expect(created?.professionalName).toBe('Dr. Marcos');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('saves a clinical note, creates and links the patient, and records the evolution', async () => {
    const session: Session = {
      id: 'sess_ficha_1',
      workspaceId: 'ws_test',
      title: 'Consulta nueva',
      reference: 'Paciente sin ficha',
      status: 'completed',
      durationSec: 120,
      consentGiven: true,
      audioDeleted: false,
      createdAt: new Date('2026-11-20T10:30:00').getTime(),
      updatedAt: new Date('2026-11-20T10:30:00').getTime(),
    };

    useAppStore.setState({
      patients: [],
      sessions: [session],
      activeSession: session,
      clinicalEvolutions: [],
      toastMessage: null,
    });

    const createPatientSpy = vi.spyOn(patientRepo, 'create').mockResolvedValue(undefined);
    const updateSessionSpy = vi.spyOn(sessionRepo, 'update').mockResolvedValue(undefined);
    vi.spyOn(sessionRepo, 'getById').mockResolvedValue({ ...session, patientId: 'pat_new' });
    vi.spyOn(useAppStore.getState(), 'loadSessions').mockResolvedValue(undefined);
    const createEvolutionSpy = vi.spyOn(evolutionRepo, 'create').mockResolvedValue(undefined);

    const note: ClinicalNote = {
      templateId: 'operatoria',
      detectedTeeth: ['4.6'],
      chiefComplaint: 'Dolor al morder',
      findings: 'Caries oclusal profunda',
      procedure: 'Restauración con composite',
      indications: 'Ibuprofeno 600 mg c/8h',
      nextVisit: 'Control en 15 días',
      updatedAt: Date.now(),
      consultationDate: '2026-11-20',
      consultationTime: '10:30',
      diagnosis: 'Caries dentinaria pieza 4.6',
      patient: {
        fullName: 'Valentina Rodríguez',
        documentType: 'CI',
        documentNumber: '4.987.654-3',
        phone: '099 111 222',
        insuranceProvider: 'FONASA',
      },
      allergies: 'Penicilina',
      medicalHistory: 'Asma',
    };

    await useAppStore.getState().saveClinicalNote(session.id, note);

    expect(createPatientSpy).toHaveBeenCalledTimes(1);
    const createdPatient = createPatientSpy.mock.calls[0][0] as Patient;
    expect(createdPatient.fullName).toBe('Valentina Rodríguez');
    expect(createdPatient.dni).toBe('4.987.654-3');
    expect(createdPatient.documentType).toBe('CI');
    expect(createdPatient.allergies).toBe('Penicilina');

    expect(
      useAppStore.getState().patients.some((p) => p.id === createdPatient.id)
    ).toBe(true);

    expect(updateSessionSpy).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        patientId: createdPatient.id,
        clinicalNote: expect.objectContaining({
          patient: expect.objectContaining({ patientId: createdPatient.id }),
        }),
      })
    );

    expect(createEvolutionSpy).toHaveBeenCalledTimes(1);
    const evolution = createEvolutionSpy.mock.calls[0][0] as ClinicalEvolutionEntry;
    expect(evolution.patientId).toBe(createdPatient.id);
    expect(evolution.procedure).toContain('Restauración con composite');
    expect(evolution.description).toContain('Diagnóstico: Caries dentinaria');
    expect(evolution.sourceSessionId).toBe(session.id);
  });

  it('always allows finance access for single personal practitioner and updates personal practitioner profile', async () => {
    const profUpdateSpy = vi.spyOn(professionalRepo, 'update').mockResolvedValue(undefined);
    expect(useAppStore.getState().canAccessFinance()).toBe(true);

    useAppStore.setState({ activeProfessionalId: 'prof_asst' });
    expect(useAppStore.getState().canAccessFinance()).toBe(true);

    useAppStore.setState({
      activeProfessionalId: 'prof_owner',
      profile: {
        id: 'prof_1',
        workspaceId: 'ws_test',
        fullName: 'Dr. Marcos',
        role: 'owner',
        createdAt: 1,
        updatedAt: 1,
      },
    });
    await useAppStore.getState().updatePersonalPractitioner({
      fullName: 'Dra. Camila Ruiz',
      specialty: 'Ortodoncia',
      licenseNumber: 'MP 8890',
    });

    expect(profUpdateSpy).toHaveBeenCalledWith(
      'prof_owner',
      expect.objectContaining({
        fullName: 'Dra. Camila Ruiz',
        specialty: 'Ortodoncia',
        licenseNumber: 'MP 8890',
      })
    );
    const updatedOwner = useAppStore.getState().professionals.find((p) => p.id === 'prof_owner');
    expect(updatedOwner?.fullName).toBe('Dra. Camila Ruiz');
    expect(useAppStore.getState().profile?.fullName).toBe('Dra. Camila Ruiz');
  });

  it('creates both a clinical evolution entry and a financial charge when completing a treatment plan item', async () => {
    const planUpdateSpy = vi.spyOn(treatmentPlanRepo, 'update').mockResolvedValue(undefined);
    const evolCreateSpy = vi.spyOn(evolutionRepo, 'create').mockResolvedValue(undefined);
    const txCreateSpy = vi.spyOn(financialTxRepo, 'create').mockResolvedValue(undefined);

    await useAppStore.getState().toggleTreatmentItemCompleted('plan_1', 'item_1');

    expect(planUpdateSpy).toHaveBeenCalledTimes(1);
    expect(evolCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'pat_1',
        toothFdi: '1.6',
        procedure: 'Restauración con composite',
        sourceTreatmentPlanId: 'plan_1',
      })
    );
    expect(txCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'pat_1',
        type: 'charge',
        currency: 'ARS',
        amount: 55000,
        sourceTreatmentPlanId: 'plan_1',
        sourceTreatmentItemId: 'item_1',
      })
    );
  });

  it('assigns active logged-in doctor and matches patient when capturing appointment from transcript', async () => {
    const apptCreateSpy = vi.spyOn(appointmentRepo, 'create').mockResolvedValue(undefined);
    useAppStore.setState({ appointments: [] });

    const created = await useAppStore
      .getState()
      .captureAppointmentFromTranscript(
        'Paciente Lucía Fernández, nos vemos el próximo martes a las 15:30 para control de endodoncia en pieza 3.6.',
        { referenceDate: new Date(2026, 10, 16, 10, 0, 0) }
      );

    expect(created).not.toBeNull();
    expect(created?.patientId).toBe('pat_1');
    expect(created?.patientName).toBe('Lucía Fernández');
    expect(created?.professionalId).toBe('prof_owner');
    expect(created?.professionalName).toBe('Dr. Marcos');
    expect(created?.startTime).toBe('15:30');
    expect(created?.autoCaptured).toBe(true);
    expect(apptCreateSpy).toHaveBeenCalledTimes(1);
  });

  it('uses light theme, UYU currency, and showCurrencyCode=false by default in createDefaultSettings', () => {
    const settings = createDefaultSettings('ws_new');
    expect(settings.theme).toBe('light');
    expect(settings.currency).toBe('UYU');
    expect(settings.showCurrencyCode).toBe(false);
  });

  it('supports bulk deleting patients and providers', async () => {
    const patDelSpy = vi.spyOn(patientRepo, 'delete').mockResolvedValue(undefined);
    const provDelSpy = vi.spyOn(providerRepo, 'delete').mockResolvedValue(undefined);
    useAppStore.setState({
      patients: [
        { id: 'p_a', workspaceId: 'ws_test', fullName: 'Ana', createdAt: 1, updatedAt: 1 },
        { id: 'p_b', workspaceId: 'ws_test', fullName: 'Beto', createdAt: 1, updatedAt: 1 },
      ],
      providers: [
        { id: 'pr_1', workspaceId: 'ws_test', name: 'Lab 1', category: 'laboratorio', createdAt: 1, updatedAt: 1 },
        { id: 'pr_2', workspaceId: 'ws_test', name: 'Lab 2', category: 'insumos', createdAt: 1, updatedAt: 1 },
      ],
    });

    await useAppStore.getState().deletePatientsBulk(['p_a', 'p_b']);
    expect(patDelSpy).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().patients).toHaveLength(0);

    await useAppStore.getState().deleteProvidersBulk(['pr_1']);
    expect(provDelSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().providers.map((p) => p.id)).toEqual(['pr_2']);
  });

  it('switches activeReportType and currentView via setReportType', () => {
    useAppStore.getState().setReportType('cuentas_por_cobrar');
    const state = useAppStore.getState();
    expect(state.currentView).toBe('reports');
    expect(state.activeReportType).toBe('cuentas_por_cobrar');
  });
});

describe('OdontoHelper 16 Reports Engine', () => {
  const createdNovMs = new Date('2026-11-10T12:00:00Z').getTime();

  const patients: Patient[] = [
    {
      id: 'p1',
      workspaceId: 'ws1',
      fullName: 'María Gómez',
      dni: '30111222',
      phone: '1122334455',
      insuranceProvider: 'OSDE',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'p2',
      workspaceId: 'ws1',
      fullName: 'Carlos López',
      dni: '28444555',
      phone: '1199887766',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const providers: Provider[] = [
    {
      id: 'prov1',
      workspaceId: 'ws1',
      name: 'Lab Dental Sur',
      category: 'laboratorio',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'ap1',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      date: '2026-11-15',
      startTime: '10:00',
      durationMin: 30,
      procedure: 'Limpieza',
      status: 'completed',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'ap2',
      workspaceId: 'ws1',
      patientId: 'p2',
      patientName: 'Carlos López',
      date: '2026-11-16',
      startTime: '11:00',
      durationMin: 45,
      procedure: 'Control sin nota',
      status: 'completed',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'ap3',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      date: '2099-05-01',
      startTime: '09:00',
      durationMin: 30,
      procedure: 'Control futuro',
      status: 'confirmed',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const evolutions: ClinicalEvolutionEntry[] = [
    {
      id: 'ev1',
      workspaceId: 'ws1',
      patientId: 'p1',
      date: '2026-11-15',
      procedure: 'Limpieza ultrasónica',
      description: 'Profilaxis completa',
      highlightColor: 'teal',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const sessions: Session[] = [];

  const treatmentPlans: TreatmentPlan[] = [
    {
      id: 'tp1',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      title: 'Rehabilitación integral',
      currency: 'ARS',
      status: 'aprobado',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      items: [
        {
          id: 'it1',
          procedure: 'Corona porcelana',
          toothFdi: '1.1',
          quantity: 1,
          unitPrice: 200000,
          completed: true,
          completedAt: createdNovMs,
        },
        {
          id: 'it2',
          procedure: 'Carilla estética',
          toothFdi: '2.1',
          quantity: 1,
          unitPrice: 150000,
          completed: false,
        },
      ],
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'tp2',
      workspaceId: 'ws1',
      patientId: 'p2',
      patientName: 'Carlos López',
      title: 'Implante unitario',
      currency: 'ARS',
      status: 'presentado',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      items: [
        {
          id: 'it3',
          procedure: 'Implante titanio',
          toothFdi: '3.6',
          quantity: 1,
          unitPrice: 450000,
          completed: false,
        },
      ],
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const transactions: FinancialTransaction[] = [
    {
      id: 'tx1',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      type: 'charge',
      currency: 'ARS',
      amount: 200000,
      paymentMethod: 'cargo_clinico',
      concept: 'Corona porcelana',
      date: '2026-11-15',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      sourceTreatmentPlanId: 'tp1',
      sourceTreatmentItemId: 'it1',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'tx2',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      type: 'payment',
      currency: 'ARS',
      amount: 120000,
      paymentMethod: 'transferencia',
      concept: 'Seña corona',
      receiptNumber: 'REC-001',
      date: '2026-11-15',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
    {
      id: 'tx3',
      workspaceId: 'ws1',
      type: 'expense',
      currency: 'ARS',
      amount: 45000,
      paymentMethod: 'efectivo',
      concept: 'Pago Lab Dental Sur',
      date: '2026-11-16',
      professionalId: 'prof1',
      professionalName: 'Dr. Marcos',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  const labOrders: LabOrder[] = [
    {
      id: 'lab1',
      workspaceId: 'ws1',
      patientId: 'p1',
      patientName: 'María Gómez',
      providerName: 'Lab Dental Sur',
      workType: 'Corona zirconio',
      toothFdi: '1.1',
      sentDate: '2026-11-12',
      dueDate: '2026-11-20',
      cost: 70000,
      currency: 'ARS',
      status: 'en_laboratorio',
      createdAt: createdNovMs,
      updatedAt: createdNovMs,
    },
  ];

  it('defines all 16 requested reports in exact order', () => {
    expect(REPORT_DEFINITIONS.map((r) => r.label)).toEqual([
      'Caja',
      'Generado',
      'Pacientes Nuevos',
      'Pacientes Atendidos',
      'Pacientes atendidos sin anotación',
      'Citas Agendadas',
      'Prestaciones Realizadas',
      'Presupuestos No Aceptados',
      'Cuentas por Cobrar',
      'Pacientes Deudores',
      'Cuentas por Pagar',
      'Facturas por pagar',
      'Pago de Pacientes',
      'Pago a Proveedores',
      'Pacientes que Asistieron',
      'Pacientes sin Cita',
    ]);
  });

  it('builds accurate rows and KPIs for all 16 report types', () => {
    const baseInput = {
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      professionalFilter: 'all',
      patients,
      providers,
      appointments,
      evolutions,
      sessions,
      treatmentPlans,
      transactions,
      labOrders,
    };

    for (const def of REPORT_DEFINITIONS) {
      const result = buildReportData({ ...baseInput, reportId: def.id });
      expect(result.definition.id).toBe(def.id);
      expect(result.columns.length).toBeGreaterThan(2);
      expect(result.kpis.length).toBeGreaterThan(0);
    }

    const caja = buildReportData({ ...baseInput, reportId: 'caja' });
    expect(caja.rows).toHaveLength(2);

    const generado = buildReportData({ ...baseInput, reportId: 'generado' });
    expect(generado.rows).toHaveLength(1); // Avoids double counting tp1:it1 already charged in tx1

    const sinNota = buildReportData({ ...baseInput, reportId: 'pacientes_sin_anotacion' });
    expect(sinNota.rows).toHaveLength(1);
    expect(sinNota.rows[0][2]).toBe('Carlos López');

    const noAceptados = buildReportData({ ...baseInput, reportId: 'presupuestos_no_aceptados' });
    expect(noAceptados.rows).toHaveLength(1);
    expect(noAceptados.rows[0][1]).toBe('Carlos López');

    const deudores = buildReportData({ ...baseInput, reportId: 'pacientes_deudores' });
    expect(deudores.rows).toHaveLength(1);
    expect(deudores.rows[0][0]).toBe('María Gómez');

    const porPagar = buildReportData({ ...baseInput, reportId: 'cuentas_por_pagar' });
    expect(porPagar.rows).toHaveLength(1);

    const facturasPorPagar = buildReportData({ ...baseInput, reportId: 'facturas_por_pagar' });
    expect(facturasPorPagar.rows).toHaveLength(1);

    const sinCita = buildReportData({ ...baseInput, reportId: 'pacientes_sin_cita' });
    expect(sinCita.rows).toHaveLength(1);
    expect(sinCita.rows[0][0]).toBe('Carlos López');
  });

  it('formats financial report KPIs and rows respecting showCurrencyCode setting', () => {
    const baseInput = {
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      professionalFilter: 'all',
      patients,
      providers,
      appointments,
      evolutions,
      sessions,
      treatmentPlans,
      transactions,
      labOrders,
    };

    const cajaDefault = buildReportData({ ...baseInput, reportId: 'caja', currency: 'UYU' });
    expect(cajaDefault.kpis[0].label).toBe('Ingresos');
    expect(cajaDefault.kpis[0].value).toBe('$ 120.000');
    expect(cajaDefault.rows[0][6]).toBe('-$ 45.000');

    const cajaUsdShown = buildReportData({
      ...baseInput,
      reportId: 'caja',
      currency: 'USD',
      showCurrencyCode: true,
    });
    expect(cajaUsdShown.kpis[0].label).toContain('(USD)');
    expect(cajaUsdShown.kpis[0].value).toContain('USD $');
    expect(cajaUsdShown.rows[0][6]).toContain('USD $');

    const cajaMxnShown = buildReportData({
      ...baseInput,
      reportId: 'caja',
      currency: 'MXN',
      showCurrencyCode: true,
    });
    expect(cajaMxnShown.kpis[0].label).toContain('(MXN)');
    expect(cajaMxnShown.kpis[0].value).toContain('MXN $');
    expect(cajaMxnShown.rows[0][6]).toContain('MXN $');
  });
});

describe('toLocalIsoDate & Demo Data Seeder', () => {
  it('formats local calendar dates as YYYY-MM-DD without UTC drift', () => {
    const sample = new Date(2026, 10, 18, 23, 55, 0);
    expect(toLocalIsoDate(sample)).toBe('2026-11-18');
  });

  it('seeds consistent appointments, linked sessions, clean currency logs, and refreshes stale demo dates', async () => {
    vi.restoreAllMocks();
    const apptsStore: Appointment[] = [];
    const profsStore: Array<{ id: string; workspaceId: string; role: string; fullName: string }> = [];
    const sessionsStore: Session[] = [];
    const logsStore: Array<{ id: string; workspaceId: string; summary: string }> = [];
    const patsStore: Patient[] = [];
    const provsStore: Provider[] = [];
    const evolsStore: ClinicalEvolutionEntry[] = [];
    const plansStore: TreatmentPlan[] = [];
    const txsStore: FinancialTransaction[] = [];
    const labsStore: LabOrder[] = [];
    const odontoStore: Array<{ id: string; workspaceId: string }> = [];
    const perioStore: Array<{ id: string; workspaceId: string }> = [];

    const makeMemRepo = <T extends { id: string; workspaceId: string }>(arr: T[]) => ({
      getAll: async (wsId: string) => arr.filter((x) => x.workspaceId === wsId),
      create: async (item: T) => {
        arr.push(item);
      },
      update: async (id: string, patch: Partial<T>) => {
        const idx = arr.findIndex((x) => x.id === id);
        if (idx >= 0) arr[idx] = { ...arr[idx], ...patch };
      },
      delete: async (id: string) => {
        const idx = arr.findIndex((x) => x.id === id);
        if (idx >= 0) arr.splice(idx, 1);
      },
    });

    const pMem = makeMemRepo(patsStore);
    vi.spyOn(sharedPatientRepo, 'getAll').mockImplementation(pMem.getAll);
    vi.spyOn(sharedPatientRepo, 'create').mockImplementation(pMem.create);

    const prMem = makeMemRepo(provsStore);
    vi.spyOn(sharedProviderRepo, 'getAll').mockImplementation(prMem.getAll);
    vi.spyOn(sharedProviderRepo, 'create').mockImplementation(prMem.create);

    const aMem = makeMemRepo(apptsStore);
    vi.spyOn(sharedAppointmentRepo, 'getAll').mockImplementation(aMem.getAll);
    vi.spyOn(sharedAppointmentRepo, 'create').mockImplementation(aMem.create);
    vi.spyOn(sharedAppointmentRepo, 'update').mockImplementation(aMem.update);

    const profMem = makeMemRepo(profsStore as never);
    vi.spyOn(sharedProfessionalRepo, 'getAll').mockImplementation(profMem.getAll as never);
    vi.spyOn(sharedProfessionalRepo, 'create').mockImplementation(profMem.create as never);

    const sMem = makeMemRepo(sessionsStore);
    vi.spyOn(sharedSessionRepo, 'getAll').mockImplementation(sMem.getAll);
    vi.spyOn(sharedSessionRepo, 'getById').mockImplementation(async (id) => sessionsStore.find((s) => s.id === id));
    vi.spyOn(sharedSessionRepo, 'create').mockImplementation(sMem.create);
    vi.spyOn(sharedSessionRepo, 'update').mockImplementation(sMem.update);

    vi.spyOn(sharedTranscriptRepo, 'saveSegments').mockResolvedValue(undefined);

    const eMem = makeMemRepo(evolsStore);
    vi.spyOn(sharedEvolutionRepo, 'getAll').mockImplementation(eMem.getAll);
    vi.spyOn(sharedEvolutionRepo, 'create').mockImplementation(eMem.create);

    const oMem = makeMemRepo(odontoStore);
    vi.spyOn(sharedOdontogramRepo, 'getAll').mockImplementation(oMem.getAll as never);
    vi.spyOn(sharedOdontogramRepo, 'create').mockImplementation(oMem.create as never);

    const peMem = makeMemRepo(perioStore);
    vi.spyOn(sharedPeriodontogramRepo, 'getAll').mockImplementation(peMem.getAll as never);
    vi.spyOn(sharedPeriodontogramRepo, 'create').mockImplementation(peMem.create as never);

    const tpMem = makeMemRepo(plansStore);
    vi.spyOn(sharedTreatmentPlanRepo, 'getAll').mockImplementation(tpMem.getAll);
    vi.spyOn(sharedTreatmentPlanRepo, 'create').mockImplementation(tpMem.create);

    const txMem = makeMemRepo(txsStore);
    vi.spyOn(sharedFinancialTxRepo, 'getAll').mockImplementation(txMem.getAll);
    vi.spyOn(sharedFinancialTxRepo, 'create').mockImplementation(txMem.create);

    const labMem = makeMemRepo(labsStore);
    vi.spyOn(sharedLabOrderRepo, 'getAll').mockImplementation(labMem.getAll);
    vi.spyOn(sharedLabOrderRepo, 'create').mockImplementation(labMem.create);

    vi.spyOn(sharedActivityRepo, 'getAll').mockImplementation(async (wsId) =>
      logsStore.filter((l) => l.workspaceId === wsId) as never
    );
    vi.spyOn(sharedActivityRepo, 'add').mockImplementation(async (entry) => {
      logsStore.push(entry as never);
    });

    const memStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in memStorage ? memStorage[k] : null),
      setItem: (k: string, v: string) => {
        memStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete memStorage[k];
      },
    });

    const wsId = `ws_seed_test_${Date.now()}`;
    const seeded = await seedDemoClinicData(wsId, { force: true });
    expect(seeded).toBe(true);

    const todayStr = toLocalIsoDate();
    const appts = await sharedAppointmentRepo.getAll(wsId);
    const profs = await sharedProfessionalRepo.getAll(wsId);
    const sessions = await sharedSessionRepo.getAll(wsId);
    const logs = await sharedActivityRepo.getAll(wsId);

    expect(appts.filter((a) => !a.deletedAt && a.date === todayStr).length).toBeGreaterThanOrEqual(4);
    expect(profs.some((p) => p.role === 'owner')).toBe(true);
    for (const appt of appts) {
      if (appt.professionalId) {
        expect(profs.some((p) => p.id === appt.professionalId)).toBe(true);
      }
    }

    for (const sess of sessions) {
      const linked = appts.filter((a) => !a.deletedAt && a.sourceSessionId === sess.id);
      expect(linked.length).toBeGreaterThanOrEqual(1);
      expect(appts.some((a) => !a.deletedAt && a.date === linked[0].date)).toBe(true);
    }

    expect(logs.some((l) => l.summary.includes('$U'))).toBe(false);

    // Simulate stale previous-day demo seed date and verify automatic refresh without duplicating data
    const wsPrefix = wsId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'local';
    const anchorId = `demo_${wsPrefix}_appt_today_1`;
    await sharedAppointmentRepo.update(anchorId, { date: '2026-11-10' });
    localStorage.setItem(`odontohelper_demo_seeded_${wsId}`, '1');
    localStorage.setItem(`odontohelper_demo_seed_date_${wsId}`, '2026-11-10');

    const reseeded = await seedDemoClinicData(wsId);
    expect(reseeded).toBe(false);

    const refreshedAppts = await sharedAppointmentRepo.getAll(wsId);
    const refreshed = refreshedAppts.find((a) => a.id === anchorId);
    expect(refreshed?.date).toBe(todayStr);
    expect(localStorage.getItem(`odontohelper_demo_seed_date_${wsId}`)).toBe(todayStr);

    vi.unstubAllGlobals();
  });
});

