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
  formatBirthDateDisplay,
  formatMoney,
  generateGoogleCalendarUrl,
  generateWhatsAppUrl,
  getPatientPendingLabAlerts,
  getUpcomingBirthdays,
  packPatientAnamnesis,
  sanitizePhoneForWhatsApp,
  unpackPatientProfileMeta,
} from '../src/core/clinic/clinicHelpers';
import {
  activityRepo,
  appointmentRepo,
  evolutionRepo,
  financialTxRepo,
  treatmentPlanRepo,
  useAppStore,
} from '../src/store/useAppStore';
import { createDefaultSettings } from '../src/adapters/local/LocalSettingsRepository';
import { REPORT_DEFINITIONS, buildReportData } from '../src/core/clinic/reportEngine';
import {
  Appointment,
  ClinicalEvolutionEntry,
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

  it('defaults to UYU currency and provides LatAm + USD currency options', () => {
    expect(DEFAULT_CURRENCY).toBe('UYU');
    expect(CURRENCY_OPTIONS).toHaveLength(15);
    expect(CURRENCY_OPTIONS.map((c) => c.code)).toEqual(
      expect.arrayContaining(['UYU', 'USD', 'ARS', 'BRL', 'CLP', 'COP', 'MXN', 'PEN', 'PYG', 'BOB', 'CRC', 'DOP', 'GTQ', 'PAB', 'VES'])
    );
    expect(formatMoney(1800)).toBe('$U 1.800');
    expect(formatMoney(1800, 'USD')).toContain('US$');
    expect(formatMoney(1800, 'MXN')).toContain('MXN $');
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

describe('OdontoHelper Clinic Workflows (PIN signature, RBAC, Budget -> Evolution + Ledger Sync)', () => {
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
          pinCode: '4321',
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
          pinCode: '0000',
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

  it('enforces PIN validation on createEvolutionEntry', async () => {
    const createSpy = vi.spyOn(evolutionRepo, 'create').mockResolvedValue(undefined);

    const rejected = await useAppStore.getState().createEvolutionEntry(
      {
        patientId: 'pat_1',
        date: '2026-11-17',
        procedure: 'Control',
        description: 'Sin novedades',
        highlightColor: 'teal',
        signedWithPin: false,
      },
      '9999'
    );
    expect(rejected).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();

    const accepted = await useAppStore.getState().createEvolutionEntry(
      {
        patientId: 'pat_1',
        date: '2026-11-17',
        procedure: 'Control',
        description: 'Todo en orden',
        highlightColor: 'teal',
        signedWithPin: false,
      },
      '4321'
    );
    expect(accepted).not.toBeNull();
    expect(accepted?.signedWithPin).toBe(true);
    expect(accepted?.professionalName).toBe('Dr. Marcos');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('enforces canAccessFinance RBAC per active professional', () => {
    expect(useAppStore.getState().canAccessFinance()).toBe(true);

    useAppStore.setState({ activeProfessionalId: 'prof_asst' });
    expect(useAppStore.getState().canAccessFinance()).toBe(false);
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

  it('uses light theme and UYU currency by default in createDefaultSettings', () => {
    const settings = createDefaultSettings('ws_new');
    expect(settings.theme).toBe('light');
    expect(settings.currency).toBe('UYU');
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
      signedWithPin: true,
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

  it('formats financial report KPIs and rows using configured currency', () => {
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

    const cajaUsd = buildReportData({ ...baseInput, reportId: 'caja', currency: 'USD' });
    expect(cajaUsd.kpis[0].label).toContain('(USD)');
    expect(cajaUsd.kpis[0].value).toContain('US$');
    expect(cajaUsd.rows[0][6]).toContain('US$');

    const cajaMxn = buildReportData({ ...baseInput, reportId: 'caja', currency: 'MXN' });
    expect(cajaMxn.kpis[0].label).toContain('(MXN)');
    expect(cajaMxn.kpis[0].value).toContain('MXN $');
    expect(cajaMxn.rows[0][6]).toContain('MXN $');
  });
});
