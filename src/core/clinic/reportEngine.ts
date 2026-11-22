import {
  Appointment,
  ClinicalEvolutionEntry,
  CurrencyCode,
  FinancialTransaction,
  LabOrder,
  Patient,
  Provider,
  Session,
  TreatmentPlan,
} from '../types';
import {
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  calculateTreatmentItemSubtotal,
  calculateTreatmentPlanTotals,
  formatCurrencyHeading,
  formatMoney,
  indexAppointmentsByPatient,
  indexPatientBalances,
  indexPatientsById,
  indexTreatmentPlansByPatient,
} from './clinicHelpers';

export type ReportTypeId =
  | 'caja'
  | 'generado'
  | 'pacientes_nuevos'
  | 'pacientes_atendidos'
  | 'pacientes_sin_anotacion'
  | 'citas_agendadas'
  | 'prestaciones_realizadas'
  | 'presupuestos_no_aceptados'
  | 'cuentas_por_cobrar'
  | 'pacientes_deudores'
  | 'cuentas_por_pagar'
  | 'facturas_por_pagar'
  | 'pago_de_pacientes'
  | 'pago_a_proveedores'
  | 'pacientes_que_asistieron'
  | 'pacientes_sin_cita';

export interface ReportDefinition {
  id: ReportTypeId;
  label: string;
  description: string;
  category: 'finanzas' | 'pacientes' | 'agenda_clinica' | 'proveedores';
  usesDateRange: boolean;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'caja',
    label: 'Caja',
    description: 'Ingresos, egresos, saldo neto y desglose por medio de pago en el período.',
    category: 'finanzas',
    usesDateRange: true,
  },
  {
    id: 'generado',
    label: 'Generado',
    description: 'Producción clínica facturada (cargos y prestaciones completadas) en el período.',
    category: 'finanzas',
    usesDateRange: true,
  },
  {
    id: 'pacientes_nuevos',
    label: 'Pacientes Nuevos',
    description: 'Pacientes dados de alta dentro del rango de fechas seleccionado.',
    category: 'pacientes',
    usesDateRange: true,
  },
  {
    id: 'pacientes_atendidos',
    label: 'Pacientes Atendidos',
    description: 'Pacientes atendidos con turno completado o evolución clínica registrada.',
    category: 'pacientes',
    usesDateRange: true,
  },
  {
    id: 'pacientes_sin_anotacion',
    label: 'Pacientes atendidos sin anotación',
    description: 'Atenciones y turnos marcados como atendidos sin evolución ni nota clínica del día.',
    category: 'agenda_clinica',
    usesDateRange: true,
  },
  {
    id: 'citas_agendadas',
    label: 'Citas Agendadas',
    description: 'Listado completo de turnos agendados, estados y cancelaciones.',
    category: 'agenda_clinica',
    usesDateRange: true,
  },
  {
    id: 'prestaciones_realizadas',
    label: 'Prestaciones Realizadas',
    description: 'Tratamientos finalizados de presupuestos y evoluciones ejecutadas.',
    category: 'agenda_clinica',
    usesDateRange: true,
  },
  {
    id: 'presupuestos_no_aceptados',
    label: 'Presupuestos No Aceptados',
    description: 'Planes de tratamiento en borrador o presentados pendientes de aprobación.',
    category: 'finanzas',
    usesDateRange: true,
  },
  {
    id: 'cuentas_por_cobrar',
    label: 'Cuentas por Cobrar',
    description: 'Saldos exigibles en cuenta corriente y prestaciones pendientes de presupuestos aprobados.',
    category: 'finanzas',
    usesDateRange: false,
  },
  {
    id: 'pacientes_deudores',
    label: 'Pacientes Deudores',
    description: 'Pacientes con saldo deudor positivo y datos de contacto para seguimiento.',
    category: 'finanzas',
    usesDateRange: false,
  },
  {
    id: 'cuentas_por_pagar',
    label: 'Cuentas por Pagar',
    description: 'Órdenes de laboratorio y compromisos con proveedores con costo pendiente.',
    category: 'proveedores',
    usesDateRange: false,
  },
  {
    id: 'facturas_por_pagar',
    label: 'Facturas por pagar',
    description: 'Comprobantes y trabajos de proveedores pendientes por fecha de vencimiento.',
    category: 'proveedores',
    usesDateRange: true,
  },
  {
    id: 'pago_de_pacientes',
    label: 'Pago de Pacientes',
    description: 'Detalle de cobros y abonos recibidos de pacientes con número de recibo.',
    category: 'finanzas',
    usesDateRange: true,
  },
  {
    id: 'pago_a_proveedores',
    label: 'Pago a Proveedores',
    description: 'Egresos registrados para laboratorios, insumos y gastos del consultorio.',
    category: 'proveedores',
    usesDateRange: true,
  },
  {
    id: 'pacientes_que_asistieron',
    label: 'Pacientes que Asistieron',
    description: 'Turnos con asistencia efectiva (sala de espera, en atención o completados).',
    category: 'pacientes',
    usesDateRange: true,
  },
  {
    id: 'pacientes_sin_cita',
    label: 'Pacientes sin Cita',
    description: 'Pacientes activos que no tienen ningún turno próximo agendado.',
    category: 'pacientes',
    usesDateRange: false,
  },
];

export interface ReportKpi {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'teal';
}

export interface ReportTableResult {
  definition: ReportDefinition;
  kpis: ReportKpi[];
  columns: string[];
  rows: string[][];
  emptyMessage: string;
}

export interface BuildReportInput {
  reportId: ReportTypeId;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  currency?: CurrencyCode;
  showCurrencyCode?: boolean;
  professionalFilter?: string; // 'all' or professionalId
  patients: Patient[];
  providers: Provider[];
  appointments: Appointment[];
  evolutions: ClinicalEvolutionEntry[];
  sessions: Session[];
  treatmentPlans: TreatmentPlan[];
  transactions: FinancialTransaction[];
  labOrders: LabOrder[];
}

function inDateRange(dateStr: string | undefined, fromDate: string, toDate: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

function msToDateStr(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

const APPT_STATUS_ES: Record<Appointment['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  waiting: 'En sala',
  in_progress: 'En atención',
  completed: 'Atendido',
  cancelled: 'Cancelado',
};

const LAB_STATUS_ES: Record<LabOrder['status'], string> = {
  sin_enviar: 'Sin enviar',
  en_laboratorio: 'En laboratorio',
  en_clinica: 'En clínica',
  instalado: 'Instalado',
};

const PLAN_STATUS_ES: Record<TreatmentPlan['status'], string> = {
  borrador: 'Borrador',
  presentado: 'Presentado',
  aprobado: 'Aprobado',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
};

export function buildReportData(input: BuildReportInput): ReportTableResult {
  const {
    reportId,
    fromDate,
    toDate,
    currency = DEFAULT_CURRENCY,
    showCurrencyCode = false,
    professionalFilter = 'all',
    patients,
    appointments,
    evolutions,
    sessions,
    treatmentPlans,
    transactions,
    labOrders,
  } = input;

  const definition =
    REPORT_DEFINITIONS.find((d) => d.id === reportId) || REPORT_DEFINITIONS[0];

  const todayStr = new Date().toISOString().slice(0, 10);

  const matchProf = (profId?: string) =>
    professionalFilter === 'all' || !professionalFilter || profId === professionalFilter;

  const activePatients = patients.filter((p) => !p.deletedAt);
  const activeAppts = appointments.filter((a) => !a.deletedAt && matchProf(a.professionalId));
  const activeEvols = evolutions.filter((e) => !e.deletedAt && matchProf(e.professionalId));
  const activePlans = treatmentPlans.filter((p) => !p.deletedAt && matchProf(p.professionalId));
  const activeTx = transactions.filter((t) => !t.deletedAt && matchProf(t.professionalId));
  const activeLabs = labOrders.filter((l) => !l.deletedAt);
  const patientMaps = indexPatientsById(activePatients);

  switch (reportId) {
    case 'caja': {
      const cashTx = activeTx
        .filter(
          (t) =>
            (t.type === 'payment' || t.type === 'expense') &&
            inDateRange(t.date, fromDate, toDate)
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      let totalIncome = 0;
      let totalExpense = 0;

      cashTx.forEach((t) => {
        if (t.type === 'payment') totalIncome += t.amount;
        else totalExpense += t.amount;
      });

      return {
        definition,
        kpis: [
          {
            label: formatCurrencyHeading('Ingresos', currency, showCurrencyCode),
            value: formatMoney(totalIncome, currency, showCurrencyCode),
            tone: 'emerald',
          },
          {
            label: formatCurrencyHeading('Egresos', currency, showCurrencyCode),
            value: formatMoney(totalExpense, currency, showCurrencyCode),
            tone: 'rose',
          },
          {
            label: formatCurrencyHeading('Saldo neto', currency, showCurrencyCode),
            value: formatMoney(totalIncome - totalExpense, currency, showCurrencyCode),
            tone: 'teal',
          },
          { label: 'Movimientos', value: String(cashTx.length) },
        ],
        columns: ['Fecha', 'Tipo', 'Concepto', 'Paciente', 'Medio', 'Profesional', 'Monto'],
        rows: cashTx.map((t) => [
          t.date,
          t.type === 'payment' ? 'Ingreso' : 'Egreso',
          t.concept,
          t.patientName || '—',
          PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
          t.professionalName || '—',
          formatMoney(t.type === 'expense' ? -t.amount : t.amount, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay ingresos ni egresos registrados en el rango seleccionado.',
      };
    }

    case 'generado': {
      const chargeTx = activeTx.filter(
        (t) => t.type === 'charge' && inDateRange(t.date, fromDate, toDate)
      );
      const chargedItemKeys = new Set(
        activeTx
          .filter((t) => t.sourceTreatmentPlanId && t.sourceTreatmentItemId)
          .map((t) => `${t.sourceTreatmentPlanId}:${t.sourceTreatmentItemId}`)
      );

      interface GenRow {
        date: string;
        patientName: string;
        concept: string;
        tooth: string;
        professional: string;
        origin: string;
        amount: number;
      }

      const combined: GenRow[] = chargeTx.map((t) => ({
        date: t.date,
        patientName: t.patientName || 'Particular',
        concept: t.concept,
        tooth: '—',
        professional: t.professionalName || '—',
        origin: t.sourceTreatmentPlanId ? 'Presupuesto' : 'Cargo directo',
        amount: t.amount,
      }));

      activePlans.forEach((plan) => {
        plan.items.forEach((item) => {
          if (!item.completed) return;
          const key = `${plan.id}:${item.id}`;
          if (chargedItemKeys.has(key)) return;
          const dateStr = msToDateStr(item.completedAt || plan.updatedAt || plan.createdAt);
          if (!inDateRange(dateStr, fromDate, toDate)) return;
          combined.push({
            date: dateStr,
            patientName: plan.patientName,
            concept: item.procedure,
            tooth: item.toothFdi || '—',
            professional: item.professionalName || plan.professionalName || '—',
            origin: plan.title,
            amount: calculateTreatmentItemSubtotal(item),
          });
        });
      });

      combined.sort((a, b) => b.date.localeCompare(a.date));

      const totalGenerated = combined.reduce((s, r) => s + r.amount, 0);

      return {
        definition,
        kpis: [
          {
            label: formatCurrencyHeading('Total generado', currency, showCurrencyCode),
            value: formatMoney(totalGenerated, currency, showCurrencyCode),
            tone: 'teal',
          },
          { label: 'Prestaciones facturadas', value: String(combined.length) },
          {
            label: 'Promedio por prestación',
            value:
              combined.length > 0
                ? formatMoney(totalGenerated / combined.length, currency, showCurrencyCode)
                : formatMoney(0, currency, showCurrencyCode),
          },
        ],
        columns: ['Fecha', 'Paciente', 'Prestación / Concepto', 'Pieza', 'Profesional', 'Origen', 'Monto'],
        rows: combined.map((r) => [
          r.date,
          r.patientName,
          r.concept,
          r.tooth,
          r.professional,
          r.origin,
          formatMoney(r.amount, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay producción clínica generada en el rango seleccionado.',
      };
    }

    case 'pacientes_nuevos': {
      const list = activePatients
        .filter((p) => inDateRange(msToDateStr(p.createdAt), fromDate, toDate))
        .sort((a, b) => b.createdAt - a.createdAt);

      const withInsurance = list.filter((p) => Boolean(p.insuranceProvider?.trim())).length;
      const withPhone = list.filter((p) => Boolean(p.phone?.trim())).length;

      return {
        definition,
        kpis: [
          { label: 'Pacientes nuevos', value: String(list.length), tone: 'teal' },
          { label: 'Con obra social', value: String(withInsurance) },
          { label: 'Con teléfono', value: String(withPhone) },
          { label: 'Total pacientes activos', value: String(activePatients.length) },
        ],
        columns: ['Fecha alta', 'Paciente', 'DNI', 'Teléfono', 'Obra social', 'Motivo consulta'],
        rows: list.map((p) => [
          msToDateStr(p.createdAt),
          p.fullName,
          p.dni || '—',
          p.phone || '—',
          p.insuranceProvider || 'Particular',
          p.chiefComplaint || '—',
        ]),
        emptyMessage: 'No se registraron pacientes nuevos en el rango seleccionado.',
      };
    }

    case 'pacientes_atendidos': {
      const map = new Map<
        string,
        {
          patientName: string;
          dni: string;
          phone: string;
          lastDate: string;
          count: number;
          lastDetail: string;
        }
      >();

      activeAppts
        .filter(
          (a) =>
            (a.status === 'completed' || a.status === 'in_progress') &&
            inDateRange(a.date, fromDate, toDate)
        )
        .forEach((a) => {
          const key = a.patientId || `name:${a.patientName.toLowerCase().trim()}`;
          const pat =
            (a.patientId ? patientMaps.byId.get(a.patientId) : undefined) ||
            patientMaps.byName.get(a.patientName.trim().toLowerCase());
          const cur = map.get(key) || {
            patientName: pat?.fullName || a.patientName,
            dni: pat?.dni || '—',
            phone: pat?.phone || '—',
            lastDate: a.date,
            count: 0,
            lastDetail: a.procedure,
          };
          cur.count += 1;
          if (a.date >= cur.lastDate) {
            cur.lastDate = a.date;
            cur.lastDetail = a.procedure;
          }
          map.set(key, cur);
        });

      activeEvols
        .filter((e) => inDateRange(e.date, fromDate, toDate))
        .forEach((e) => {
          const pat = patientMaps.byId.get(e.patientId);
          const key = e.patientId;
          const cur = map.get(key) || {
            patientName: pat?.fullName || 'Paciente',
            dni: pat?.dni || '—',
            phone: pat?.phone || '—',
            lastDate: e.date,
            count: 0,
            lastDetail: e.procedure,
          };
          cur.count += 1;
          if (e.date >= cur.lastDate) {
            cur.lastDate = e.date;
            cur.lastDetail = e.procedure;
          }
          map.set(key, cur);
        });

      const list = Array.from(map.values()).sort((a, b) =>
        b.lastDate.localeCompare(a.lastDate)
      );
      const totalVisits = list.reduce((s, x) => s + x.count, 0);

      return {
        definition,
        kpis: [
          { label: 'Pacientes atendidos', value: String(list.length), tone: 'teal' },
          { label: 'Registros / atenciones', value: String(totalVisits) },
          {
            label: 'Promedio atenciones',
            value: list.length > 0 ? (totalVisits / list.length).toFixed(1) : '0',
          },
        ],
        columns: ['Paciente', 'DNI', 'Teléfono', 'Última atención', 'Atenciones', 'Último procedimiento'],
        rows: list.map((r) => [
          r.patientName,
          r.dni,
          r.phone,
          r.lastDate,
          String(r.count),
          r.lastDetail,
        ]),
        emptyMessage: 'No hay pacientes atendidos en el rango seleccionado.',
      };
    }

    case 'pacientes_sin_anotacion': {
      const attendedAppts = activeAppts
        .filter(
          (a) =>
            (a.status === 'completed' || a.status === 'in_progress' || a.status === 'waiting') &&
            inDateRange(a.date, fromDate, toDate)
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      const evolDateKeys = new Set<string>();
      for (const e of activeEvols) {
        if (e.patientId && e.date) {
          evolDateKeys.add(`${e.patientId}:${e.date}`);
        }
      }

      const sessionNotesByDate = new Map<string, Session[]>();
      for (const s of sessions) {
        if (s.deletedAt || !s.clinicalNote) continue;
        const dStr = msToDateStr(s.createdAt);
        if (!dStr) continue;
        let bucket = sessionNotesByDate.get(dStr);
        if (!bucket) {
          bucket = [];
          sessionNotesByDate.set(dStr, bucket);
        }
        bucket.push(s);
      }

      const missing = attendedAppts.filter((appt) => {
        const pat =
          (appt.patientId ? patientMaps.byId.get(appt.patientId) : undefined) ||
          patientMaps.byName.get(appt.patientName.trim().toLowerCase());
        const resolvedPatId = appt.patientId || pat?.id;

        const hasEvolutionSameDay = resolvedPatId
          ? evolDateKeys.has(`${resolvedPatId}:${appt.date}`)
          : false;

        const daySessions = sessionNotesByDate.get(appt.date) || [];
        const lowerName = appt.patientName.toLowerCase();
        const hasClinicalNoteSession = daySessions.some(
          (s) =>
            (resolvedPatId && s.patientId === resolvedPatId) ||
            (s.reference || '').toLowerCase().includes(lowerName)
        );

        return !hasEvolutionSameDay && !hasClinicalNoteSession;
      });

      return {
        definition,
        kpis: [
          {
            label: 'Atenciones sin anotación',
            value: String(missing.length),
            tone: missing.length > 0 ? 'amber' : 'emerald',
          },
          { label: 'Turnos asistidos en período', value: String(attendedAppts.length) },
        ],
        columns: ['Fecha', 'Hora', 'Paciente', 'Motivo turno', 'Profesional', 'Estado', 'Observación'],
        rows: missing.map((a) => [
          a.date,
          a.startTime,
          a.patientName,
          a.procedure,
          a.professionalName || '—',
          APPT_STATUS_ES[a.status],
          'Falta cargar evolución o nota clínica',
        ]),
        emptyMessage: 'Todas las atenciones del período cuentan con anotación clínica registrada.',
      };
    }

    case 'citas_agendadas': {
      const list = activeAppts
        .filter((a) => inDateRange(a.date, fromDate, toDate))
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

      const completed = list.filter((a) => a.status === 'completed').length;
      const cancelled = list.filter((a) => a.status === 'cancelled').length;
      const activeCount = list.length - cancelled;

      return {
        definition,
        kpis: [
          { label: 'Citas totales', value: String(list.length), tone: 'teal' },
          { label: 'Activas / Confirmadas', value: String(activeCount) },
          { label: 'Completadas', value: String(completed), tone: 'emerald' },
          { label: 'Canceladas', value: String(cancelled), tone: cancelled > 0 ? 'rose' : 'default' },
        ],
        columns: ['Fecha', 'Hora', 'Duración', 'Paciente', 'Motivo / Tratamiento', 'Profesional', 'Estado'],
        rows: list.map((a) => [
          a.date,
          a.startTime,
          `${a.durationMin} min`,
          a.patientName,
          a.procedure,
          a.professionalName || '—',
          APPT_STATUS_ES[a.status],
        ]),
        emptyMessage: 'No hay citas agendadas en el rango seleccionado.',
      };
    }

    case 'prestaciones_realizadas': {
      interface DoneProcRow {
        date: string;
        patient: string;
        tooth: string;
        procedure: string;
        professional: string;
        origin: string;
        valueStr: string;
        amount: number;
      }
      const list: DoneProcRow[] = [];

      activePlans.forEach((plan) => {
        plan.items.forEach((item) => {
          if (!item.completed) return;
          const dateStr = msToDateStr(item.completedAt || plan.updatedAt || plan.createdAt);
          if (!inDateRange(dateStr, fromDate, toDate)) return;
          const sub = calculateTreatmentItemSubtotal(item);
          list.push({
            date: dateStr,
            patient: plan.patientName,
            tooth: item.toothFdi || '—',
            procedure: item.procedure,
            professional: item.professionalName || plan.professionalName || '—',
            origin: `Presupuesto: ${plan.title}`,
            valueStr: formatMoney(sub, currency, showCurrencyCode),
            amount: sub,
          });
        });
      });

      activeEvols
        .filter((e) => !e.sourceTreatmentPlanId && inDateRange(e.date, fromDate, toDate))
        .forEach((e) => {
          const pat = patientMaps.byId.get(e.patientId);
          list.push({
            date: e.date,
            patient: pat?.fullName || 'Paciente',
            tooth: e.toothFdi || '—',
            procedure: e.procedure,
            professional: e.professionalName || '—',
            origin: 'Evolución clínica',
            valueStr: '—',
            amount: 0,
          });
        });

      list.sort((a, b) => b.date.localeCompare(a.date));
      const totalAmount = list.reduce((s, r) => s + r.amount, 0);

      return {
        definition,
        kpis: [
          { label: 'Prestaciones realizadas', value: String(list.length), tone: 'teal' },
          {
            label: formatCurrencyHeading('Valor presupuestado', currency, showCurrencyCode),
            value: formatMoney(totalAmount, currency, showCurrencyCode),
            tone: 'emerald',
          },
        ],
        columns: ['Fecha', 'Paciente', 'Pieza', 'Prestación', 'Profesional', 'Origen', 'Valor'],
        rows: list.map((r) => [
          r.date,
          r.patient,
          r.tooth,
          r.procedure,
          r.professional,
          r.origin,
          r.valueStr,
        ]),
        emptyMessage: 'No hay prestaciones realizadas en el rango seleccionado.',
      };
    }

    case 'presupuestos_no_aceptados': {
      const list = activePlans
        .filter(
          (p) =>
            (p.status === 'borrador' || p.status === 'presentado') &&
            inDateRange(msToDateStr(p.createdAt), fromDate, toDate)
        )
        .sort((a, b) => b.createdAt - a.createdAt);

      const totalPending = list.reduce(
        (sum, p) => sum + calculateTreatmentPlanTotals(p).total,
        0
      );

      return {
        definition,
        kpis: [
          { label: 'Presupuestos sin aceptar', value: String(list.length), tone: 'amber' },
          {
            label: formatCurrencyHeading('Monto pendiente', currency, showCurrencyCode),
            value: formatMoney(totalPending, currency, showCurrencyCode),
            tone: 'teal',
          },
        ],
        columns: ['Fecha', 'Paciente', 'Plan de tratamiento', 'Estado', 'Vigencia', 'Profesional', 'Total'],
        rows: list.map((p) => [
          msToDateStr(p.createdAt),
          p.patientName,
          p.title,
          PLAN_STATUS_ES[p.status],
          p.validUntil || '—',
          p.professionalName || '—',
          formatMoney(calculateTreatmentPlanTotals(p).total, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay presupuestos pendientes de aceptación en el rango seleccionado.',
      };
    }

    case 'cuentas_por_cobrar': {
      interface ReceivableRow {
        patientName: string;
        charged: number;
        paid: number;
        balance: number;
        approvedPending: number;
        phone: string;
      }

      const balancesByPatient = indexPatientBalances(activeTx);
      const plansByPatient = indexTreatmentPlansByPatient(activePlans);
      const rowsData: ReceivableRow[] = [];

      activePatients.forEach((pat) => {
        const bal = balancesByPatient.get(pat.id) || { charged: 0, paid: 0, balance: 0 };
        const patientPlans = plansByPatient.get(pat.id) || [];
        let pendPlan = 0;
        for (const pl of patientPlans) {
          if (pl.status === 'aprobado' || pl.status === 'en_curso') {
            pendPlan += calculateTreatmentPlanTotals(pl).pendingTotal;
          }
        }

        if (bal.balance <= 0 && pendPlan <= 0) return;

        rowsData.push({
          patientName: pat.fullName,
          charged: bal.charged,
          paid: bal.paid,
          balance: Math.max(0, bal.balance),
          approvedPending: pendPlan,
          phone: pat.phone || '—',
        });
      });

      rowsData.sort(
        (a, b) => b.balance + b.approvedPending - (a.balance + a.approvedPending)
      );

      const totBalance = rowsData.reduce((s, r) => s + r.balance, 0);
      const totPendPlan = rowsData.reduce((s, r) => s + r.approvedPending, 0);

      return {
        definition,
        kpis: [
          {
            label: formatCurrencyHeading('Saldo exigible', currency, showCurrencyCode),
            value: formatMoney(totBalance, currency, showCurrencyCode),
            tone: 'amber',
          },
          {
            label: formatCurrencyHeading('Pendiente planes aprobados', currency, showCurrencyCode),
            value: formatMoney(totPendPlan, currency, showCurrencyCode),
            tone: 'teal',
          },
          { label: 'Pacientes', value: String(rowsData.length) },
        ],
        columns: [
          'Paciente',
          'Cargos',
          'Abonado',
          'Saldo exigible',
          'Pendiente presup. aprobados',
          'Teléfono',
        ],
        rows: rowsData.map((r) => [
          r.patientName,
          formatMoney(r.charged, currency, showCurrencyCode),
          formatMoney(r.paid, currency, showCurrencyCode),
          formatMoney(r.balance, currency, showCurrencyCode),
          formatMoney(r.approvedPending, currency, showCurrencyCode),
          r.phone,
        ]),
        emptyMessage: 'No hay cuentas por cobrar pendientes.',
      };
    }

    case 'pacientes_deudores': {
      const balancesByPatient = indexPatientBalances(activeTx);
      const debtors = activePatients
        .map((pat) => {
          const bal = balancesByPatient.get(pat.id) || { charged: 0, paid: 0, balance: 0 };
          return { pat, bal };
        })
        .filter(({ bal }) => bal.balance > 0)
        .sort((a, b) => b.bal.balance - a.bal.balance);

      const totDebt = debtors.reduce((s, d) => s + Math.max(0, d.bal.balance), 0);

      return {
        definition,
        kpis: [
          {
            label: 'Pacientes deudores',
            value: String(debtors.length),
            tone: debtors.length > 0 ? 'rose' : 'emerald',
          },
          {
            label: formatCurrencyHeading('Deuda total', currency, showCurrencyCode),
            value: formatMoney(totDebt, currency, showCurrencyCode),
            tone: 'rose',
          },
        ],
        columns: ['Paciente', 'Documento', 'Teléfono', 'Cargos', 'Pagos', 'Saldo deudor'],
        rows: debtors.map(({ pat, bal }) => [
          pat.fullName,
          pat.dni || '—',
          pat.phone || '—',
          formatMoney(bal.charged, currency, showCurrencyCode),
          formatMoney(bal.paid, currency, showCurrencyCode),
          formatMoney(Math.max(0, bal.balance), currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay pacientes con deuda pendiente en cuenta corriente.',
      };
    }

    case 'cuentas_por_pagar': {
      const pendingLabs = activeLabs
        .filter((l) => (l.cost || 0) > 0 && l.status !== 'instalado')
        .sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));

      const totalPayable = pendingLabs.reduce((s, l) => s + (l.cost || 0), 0);

      return {
        definition,
        kpis: [
          { label: 'Cuentas por pagar', value: String(pendingLabs.length), tone: 'amber' },
          {
            label: formatCurrencyHeading('Total pendiente', currency, showCurrencyCode),
            value: formatMoney(totalPayable, currency, showCurrencyCode),
            tone: 'rose',
          },
        ],
        columns: ['Fecha envío', 'Proveedor / Lab', 'Trabajo', 'Paciente', 'Estado', 'Vencimiento', 'Monto'],
        rows: pendingLabs.map((l) => [
          l.sentDate || msToDateStr(l.createdAt),
          l.providerName || 'Laboratorio',
          l.workType + (l.toothFdi ? ` (${l.toothFdi})` : ''),
          l.patientName,
          LAB_STATUS_ES[l.status],
          l.dueDate || '—',
          formatMoney(l.cost || 0, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay órdenes o cuentas pendientes de pago a proveedores.',
      };
    }

    case 'facturas_por_pagar': {
      const invoices = activeLabs
        .filter((l) => {
          if ((l.cost || 0) <= 0 || l.status === 'instalado') return false;
          const refDate = l.dueDate || l.sentDate || msToDateStr(l.createdAt);
          return inDateRange(refDate, fromDate, toDate) || Boolean(l.dueDate && l.dueDate < todayStr);
        })
        .sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));

      const overdue = invoices.filter((l) => Boolean(l.dueDate && l.dueDate < todayStr)).length;
      const totalPayable = invoices.reduce((s, l) => s + (l.cost || 0), 0);

      return {
        definition,
        kpis: [
          { label: 'Facturas / órdenes por pagar', value: String(invoices.length), tone: 'amber' },
          { label: 'Vencidas', value: String(overdue), tone: overdue > 0 ? 'rose' : 'emerald' },
          {
            label: formatCurrencyHeading('Total a liquidar', currency, showCurrencyCode),
            value: formatMoney(totalPayable, currency, showCurrencyCode),
          },
        ],
        columns: ['Vencimiento', 'Proveedor', 'Concepto / Trabajo', 'Paciente', 'Situación', 'Estado', 'Importe'],
        rows: invoices.map((l) => {
          const isOverdue = Boolean(l.dueDate && l.dueDate < todayStr);
          return [
            l.dueDate || l.sentDate || msToDateStr(l.createdAt),
            l.providerName || 'Proveedor / Lab',
            l.workType + (l.toothFdi ? ` (${l.toothFdi})` : ''),
            l.patientName,
            isOverdue ? 'Vencida' : 'Por vencer',
            LAB_STATUS_ES[l.status],
            formatMoney(l.cost || 0, currency, showCurrencyCode),
          ];
        }),
        emptyMessage: 'No hay facturas o trabajos vencidos/por pagar en el período.',
      };
    }

    case 'pago_de_pacientes': {
      const payments = activeTx
        .filter((t) => t.type === 'payment' && inDateRange(t.date, fromDate, toDate))
        .sort((a, b) => b.date.localeCompare(a.date));

      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

      return {
        definition,
        kpis: [
          { label: 'Pagos recibidos', value: String(payments.length), tone: 'teal' },
          {
            label: formatCurrencyHeading('Total cobrado', currency, showCurrencyCode),
            value: formatMoney(totalPaid, currency, showCurrencyCode),
            tone: 'emerald',
          },
        ],
        columns: ['Fecha', 'Recibo', 'Paciente', 'Concepto', 'Medio de pago', 'Profesional', 'Monto'],
        rows: payments.map((t) => [
          t.date,
          t.receiptNumber || '—',
          t.patientName || 'Particular',
          t.concept,
          PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
          t.professionalName || '—',
          formatMoney(t.amount, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay pagos de pacientes registrados en el rango seleccionado.',
      };
    }

    case 'pago_a_proveedores': {
      const expenses = activeTx
        .filter((t) => t.type === 'expense' && inDateRange(t.date, fromDate, toDate))
        .sort((a, b) => b.date.localeCompare(a.date));

      const totalPaid = expenses.reduce((s, e) => s + e.amount, 0);

      return {
        definition,
        kpis: [
          { label: 'Pagos / Egresos', value: String(expenses.length) },
          {
            label: formatCurrencyHeading('Total pagado', currency, showCurrencyCode),
            value: formatMoney(totalPaid, currency, showCurrencyCode),
            tone: 'rose',
          },
        ],
        columns: ['Fecha', 'Concepto / Proveedor', 'Medio de pago', 'Profesional', 'Notas', 'Monto'],
        rows: expenses.map((t) => [
          t.date,
          t.concept,
          PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
          t.professionalName || '—',
          t.notes || '—',
          formatMoney(t.amount, currency, showCurrencyCode),
        ]),
        emptyMessage: 'No hay pagos a proveedores ni egresos registrados en el rango seleccionado.',
      };
    }

    case 'pacientes_que_asistieron': {
      const periodAppts = activeAppts.filter((a) => inDateRange(a.date, fromDate, toDate));
      const attended = periodAppts
        .filter((a) => a.status === 'waiting' || a.status === 'in_progress' || a.status === 'completed')
        .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

      const uniquePatients = new Set(
        attended.map((a) => a.patientId || a.patientName.toLowerCase().trim())
      ).size;
      const rate =
        periodAppts.length > 0 ? Math.round((attended.length / periodAppts.length) * 100) : 0;

      return {
        definition,
        kpis: [
          { label: 'Asistencias', value: String(attended.length), tone: 'emerald' },
          { label: 'Pacientes únicos', value: String(uniquePatients), tone: 'teal' },
          { label: 'Tasa de asistencia', value: `${rate}%`, sublabel: `Sobre ${periodAppts.length} citas` },
        ],
        columns: ['Fecha', 'Hora', 'Paciente', 'Tratamiento', 'Profesional', 'Estado'],
        rows: attended.map((a) => [
          a.date,
          a.startTime,
          a.patientName,
          a.procedure,
          a.professionalName || '—',
          APPT_STATUS_ES[a.status],
        ]),
        emptyMessage: 'No hay asistencias registradas en el rango seleccionado.',
      };
    }

    case 'pacientes_sin_cita': {
      const apptsIndex = indexAppointmentsByPatient(activeAppts);
      const withoutFuture: Array<{ pat: Patient; lastVisit: string }> = [];

      for (const pat of activePatients) {
        const byId = apptsIndex.byId.get(pat.id) || [];
        const byName = apptsIndex.byName.get(pat.fullName.trim().toLowerCase()) || [];
        const mergedMap = new Map<string, Appointment>();
        for (const a of byId) mergedMap.set(a.id, a);
        for (const a of byName) mergedMap.set(a.id, a);

        let hasFuture = false;
        let latestPastDate = '';

        for (const a of mergedMap.values()) {
          if (a.date >= todayStr && a.status !== 'cancelled' && a.status !== 'completed') {
            hasFuture = true;
            break;
          }
          if (a.date > latestPastDate) {
            latestPastDate = a.date;
          }
        }

        if (!hasFuture) {
          withoutFuture.push({
            pat,
            lastVisit: latestPastDate || msToDateStr(pat.createdAt),
          });
        }
      }

      withoutFuture.sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));

      return {
        definition,
        kpis: [
          { label: 'Pacientes sin cita próxima', value: String(withoutFuture.length), tone: 'amber' },
          { label: 'Total pacientes activos', value: String(activePatients.length) },
        ],
        columns: ['Paciente', 'DNI', 'Teléfono', 'Email', 'Última visita / alta', 'Obra social'],
        rows: withoutFuture.map(({ pat, lastVisit }) => [
          pat.fullName,
          pat.dni || '—',
          pat.phone || '—',
          pat.email || '—',
          lastVisit,
          pat.insuranceProvider || 'Particular',
        ]),
        emptyMessage: 'Todos tus pacientes activos tienen una cita próxima agendada.',
      };
    }
  }
}
