import {
  Appointment,
  ClinicProfessional,
  CurrencyCode,
  FinancialTransaction,
  LabOrder,
  Patient,
  PatientAnamnesis,
  PatientProfileMeta,
  PaymentMethod,
  Profile,
  TreatmentItem,
  TreatmentPlan,
} from '../types';

export const DEFAULT_CURRENCY: CurrencyCode = 'UYU';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  country: string;
  symbol: string;
  locale: string;
  decimals: number;
}

export const CURRENCY_OPTIONS: CurrencyMeta[] = [
  { code: 'UYU', name: 'Peso Uruguayo', country: 'Uruguay', symbol: '$', locale: 'es-UY', decimals: 0 },
  { code: 'USD', name: 'Dólar Estadounidense', country: 'Estados Unidos', symbol: '$', locale: 'es-UY', decimals: 2 },
  { code: 'ARS', name: 'Peso Argentino', country: 'Argentina', symbol: '$', locale: 'es-AR', decimals: 0 },
  { code: 'BRL', name: 'Real Brasileño', country: 'Brasil', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
  { code: 'CLP', name: 'Peso Chileno', country: 'Chile', symbol: '$', locale: 'es-CL', decimals: 0 },
  { code: 'COP', name: 'Peso Colombiano', country: 'Colombia', symbol: '$', locale: 'es-CO', decimals: 0 },
  { code: 'MXN', name: 'Peso Mexicano', country: 'México', symbol: '$', locale: 'es-MX', decimals: 2 },
  { code: 'PEN', name: 'Sol Peruano', country: 'Perú', symbol: 'S/', locale: 'es-PE', decimals: 2 },
  { code: 'PYG', name: 'Guaraní Paraguayo', country: 'Paraguay', symbol: '₲', locale: 'es-PY', decimals: 0 },
  { code: 'BOB', name: 'Boliviano', country: 'Bolivia', symbol: 'Bs', locale: 'es-BO', decimals: 2 },
  { code: 'CRC', name: 'Colón Costarricense', country: 'Costa Rica', symbol: '₡', locale: 'es-CR', decimals: 0 },
  { code: 'DOP', name: 'Peso Dominicano', country: 'Rep. Dominicana', symbol: '$', locale: 'es-DO', decimals: 2 },
  { code: 'GTQ', name: 'Quetzal Guatemalteco', country: 'Guatemala', symbol: 'Q', locale: 'es-GT', decimals: 2 },
  { code: 'PAB', name: 'Balboa Panameño', country: 'Panamá', symbol: 'B/.', locale: 'es-PA', decimals: 2 },
  { code: 'VES', name: 'Bolívar Venezolano', country: 'Venezuela', symbol: 'Bs.D', locale: 'es-VE', decimals: 2 },
];

export function getCurrencyMeta(code?: CurrencyCode): CurrencyMeta {
  return CURRENCY_OPTIONS.find((c) => c.code === code) || CURRENCY_OPTIONS[0];
}

export interface ProcedureCatalogItem {
  code: string;
  name: string;
  category: string;
  defaultPrice: number;
  defaultDurationMin: number;
}

export const COMMON_DENTAL_PROCEDURES: ProcedureCatalogItem[] = [
  { code: '01.01', name: 'Consulta y diagnóstico integral', category: 'Diagnóstico', defaultPrice: 1800, defaultDurationMin: 30 },
  { code: '09.01', name: 'Radiografía periapical', category: 'Diagnóstico', defaultPrice: 950, defaultDurationMin: 15 },
  { code: '02.01', name: 'Restauración con composite simple', category: 'Operatoria', defaultPrice: 3200, defaultDurationMin: 45 },
  { code: '02.02', name: 'Restauración con composite compleja', category: 'Operatoria', defaultPrice: 4400, defaultDurationMin: 60 },
  { code: '03.01', name: 'Endodoncia unirradicular', category: 'Endodoncia', defaultPrice: 7500, defaultDurationMin: 60 },
  { code: '03.02', name: 'Endodoncia multirradicular', category: 'Endodoncia', defaultPrice: 10800, defaultDurationMin: 90 },
  { code: '04.01', name: 'Corona de porcelana / zirconio', category: 'Prótesis', defaultPrice: 22000, defaultDurationMin: 60 },
  { code: '04.04', name: 'Perno muñón colado / fibra de vidrio', category: 'Prótesis', defaultPrice: 6200, defaultDurationMin: 45 },
  { code: '04.06', name: 'Placa miorelajante / bruxismo', category: 'Prótesis', defaultPrice: 8900, defaultDurationMin: 30 },
  { code: '07.01', name: 'Limpieza ultrasónica y profilaxis', category: 'Prevención', defaultPrice: 2400, defaultDurationMin: 30 },
  { code: '08.01', name: 'Raspaje y alisado radicular por cuadrante', category: 'Periodoncia', defaultPrice: 5200, defaultDurationMin: 45 },
  { code: '10.01', name: 'Exodoncia simple', category: 'Cirugía', defaultPrice: 3600, defaultDurationMin: 30 },
  { code: '10.09', name: 'Exodoncia tercer molar retenido', category: 'Cirugía', defaultPrice: 9500, defaultDurationMin: 60 },
  { code: '11.01', name: 'Implante dental oseointegrado', category: 'Implantología', defaultPrice: 38000, defaultDurationMin: 90 },
  { code: '05.01', name: 'Blanqueamiento dental en consultorio', category: 'Estética', defaultPrice: 9800, defaultDurationMin: 60 },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  obra_social: 'Mutualista / Obra social',
  mercadopago: 'Mercado Pago / QR',
  cargo_clinico: 'Cargo por prestación',
};

export function formatMoney(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  showCurrencyCode = false
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const meta = getCurrencyMeta(currency);
  const absVal = Math.abs(safe);
  const hasCents = Math.abs(absVal % 1) > 0.001;
  const formatted = absVal.toLocaleString(meta.locale, {
    minimumFractionDigits: hasCents ? Math.min(2, meta.decimals || 2) : 0,
    maximumFractionDigits: meta.decimals,
  });
  const sign = safe < -0.0001 ? '-' : '';
  const prefix = showCurrencyCode ? `${meta.code} ${meta.symbol}` : meta.symbol;
  return `${sign}${prefix} ${formatted}`;
}

export function formatCurrencyHeading(
  label: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  showCurrencyCode = false
): string {
  return showCurrencyCode ? `${label} (${currency})` : label;
}

/**
 * Smart table comparator supporting numbers, formatted currency, ISO dates, DD/MM/YYYY dates, and Spanish strings.
 */
export function compareTableValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '' || a === '—') return 1;
  if (b === null || b === undefined || b === '' || b === '—') return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  const strA = String(a).trim();
  const strB = String(b).trim();

  // DD/MM/YYYY -> YYYYMMDD numeric comparison
  const dmyRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const dmyA = strA.match(dmyRegex);
  const dmyB = strB.match(dmyRegex);
  if (dmyA && dmyB) {
    return `${dmyA[3]}${dmyA[2]}${dmyA[1]}`.localeCompare(`${dmyB[3]}${dmyB[2]}${dmyB[1]}`);
  }

  // Formatted currency / numbers (e.g., "-$ 3.200", "UYU $ 1.800,50", "45 min", "80%")
  const numericPattern =
    /^[+-]?\s*(?:[A-Z]{3}\s*)?(?:\$U?|US\$|R\$|S\/|₡|₲|Bs\.D|Bs|Q|B\/\.|RD\$)?\s*[\d.,]+(?:\s*(?:%|min))?$/;
  if (numericPattern.test(strA) && numericPattern.test(strB)) {
    const parseNumeric = (s: string): number => {
      const neg = s.trim().startsWith('-') ? -1 : 1;
      const cleaned = s
        .replace(/[^\d.,]/g, '')
        .replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
        .replace(',', '.');
      const num = Number(cleaned);
      return Number.isFinite(num) ? neg * num : NaN;
    };
    const numA = parseNumeric(strA);
    const numB = parseNumeric(strB);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
  }

  return strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' });
}

export function calculateTreatmentItemSubtotal(item: TreatmentItem): number {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const price = Math.max(0, Number(item.unitPrice) || 0);
  const discount = Math.min(100, Math.max(0, Number(item.discountPct) || 0));
  const raw = qty * price;
  return Math.round((raw * (1 - discount / 100)) * 100) / 100;
}

export function calculateTreatmentPlanTotals(plan: TreatmentPlan): {
  total: number;
  completedTotal: number;
  pendingTotal: number;
  completedCount: number;
  totalCount: number;
  progressPct: number;
} {
  let total = 0;
  let completedTotal = 0;
  let completedCount = 0;

  for (const item of plan.items) {
    const sub = calculateTreatmentItemSubtotal(item);
    total += sub;
    if (item.completed) {
      completedTotal += sub;
      completedCount += 1;
    }
  }

  const totalCount = plan.items.length;
  const pendingTotal = Math.max(0, Math.round((total - completedTotal) * 100) / 100);
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    total: Math.round(total * 100) / 100,
    completedTotal: Math.round(completedTotal * 100) / 100,
    pendingTotal,
    completedCount,
    totalCount,
    progressPct,
  };
}

export interface CurrencyBalance {
  charged: number;
  paid: number;
  balance: number; // positive means patient owes money
}

export function calculateSingleCurrencyBalance(
  patientId: string,
  transactions: FinancialTransaction[]
): CurrencyBalance {
  let charged = 0;
  let paid = 0;

  for (const tx of transactions) {
    if (tx.deletedAt || tx.patientId !== patientId) continue;
    const amt = Math.max(0, Number(tx.amount) || 0);
    if (tx.type === 'charge') charged += amt;
    else if (tx.type === 'payment') paid += amt;
  }

  return {
    charged: Math.round(charged * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    balance: Math.round((charged - paid) * 100) / 100,
  };
}

export function indexPatientsById(patients: Patient[]): {
  byId: Map<string, Patient>;
  byName: Map<string, Patient>;
} {
  const byId = new Map<string, Patient>();
  const byName = new Map<string, Patient>();
  for (const pat of patients) {
    if (pat.deletedAt) continue;
    byId.set(pat.id, pat);
    const key = pat.fullName.trim().toLowerCase();
    if (key && !byName.has(key)) {
      byName.set(key, pat);
    }
  }
  return { byId, byName };
}

export function indexTransactionsByPatient(
  transactions: FinancialTransaction[]
): Map<string, FinancialTransaction[]> {
  const map = new Map<string, FinancialTransaction[]>();
  for (const tx of transactions) {
    if (tx.deletedAt || !tx.patientId) continue;
    let bucket = map.get(tx.patientId);
    if (!bucket) {
      bucket = [];
      map.set(tx.patientId, bucket);
    }
    bucket.push(tx);
  }
  return map;
}

export function indexPatientBalances(
  transactions: FinancialTransaction[]
): Map<string, CurrencyBalance> {
  const raw = new Map<string, { charged: number; paid: number }>();

  for (const tx of transactions) {
    if (tx.deletedAt || !tx.patientId) continue;
    const amt = Math.max(0, Number(tx.amount) || 0);
    let entry = raw.get(tx.patientId);
    if (!entry) {
      entry = { charged: 0, paid: 0 };
      raw.set(tx.patientId, entry);
    }
    if (tx.type === 'charge') entry.charged += amt;
    else if (tx.type === 'payment') entry.paid += amt;
  }

  const result = new Map<string, CurrencyBalance>();
  for (const [patientId, entry] of raw.entries()) {
    const charged = Math.round(entry.charged * 100) / 100;
    const paid = Math.round(entry.paid * 100) / 100;
    result.set(patientId, {
      charged,
      paid,
      balance: Math.round((charged - paid) * 100) / 100,
    });
  }
  return result;
}

export interface PendingLabIndex {
  byId: Map<string, LabOrder[]>;
  byName: Map<string, LabOrder[]>;
}

export function indexPendingLabsByPatient(labOrders: LabOrder[]): PendingLabIndex {
  const byId = new Map<string, LabOrder[]>();
  const byName = new Map<string, LabOrder[]>();

  for (const order of labOrders) {
    if (order.deletedAt) continue;
    if (order.status !== 'sin_enviar' && order.status !== 'en_laboratorio') continue;

    if (order.patientId) {
      let idList = byId.get(order.patientId);
      if (!idList) {
        idList = [];
        byId.set(order.patientId, idList);
      }
      idList.push(order);
    }

    const nameKey = order.patientName.trim().toLowerCase();
    if (nameKey) {
      let nameList = byName.get(nameKey);
      if (!nameList) {
        nameList = [];
        byName.set(nameKey, nameList);
      }
      nameList.push(order);
    }
  }

  return { byId, byName };
}

export function lookupPendingLabAlerts(
  patientId: string | undefined,
  patientName: string,
  index: PendingLabIndex
): LabOrder[] {
  const byIdMatches = patientId ? index.byId.get(patientId) || [] : [];
  const nameKey = patientName.trim().toLowerCase();
  const byNameMatches = nameKey ? index.byName.get(nameKey) || [] : [];

  if (byIdMatches.length === 0) return byNameMatches;
  if (byNameMatches.length === 0) return byIdMatches;

  const seen = new Set(byIdMatches.map((o) => o.id));
  const merged = [...byIdMatches];
  for (const order of byNameMatches) {
    if (!seen.has(order.id)) {
      seen.add(order.id);
      merged.push(order);
    }
  }
  return merged;
}

export function indexTreatmentPlansByPatient(
  plans: TreatmentPlan[]
): Map<string, TreatmentPlan[]> {
  const map = new Map<string, TreatmentPlan[]>();
  for (const plan of plans) {
    if (plan.deletedAt || !plan.patientId) continue;
    let bucket = map.get(plan.patientId);
    if (!bucket) {
      bucket = [];
      map.set(plan.patientId, bucket);
    }
    bucket.push(plan);
  }
  return map;
}

export function indexAppointmentsByPatient(appointments: Appointment[]): {
  byId: Map<string, Appointment[]>;
  byName: Map<string, Appointment[]>;
} {
  const byId = new Map<string, Appointment[]>();
  const byName = new Map<string, Appointment[]>();

  for (const appt of appointments) {
    if (appt.deletedAt) continue;
    if (appt.patientId) {
      let idList = byId.get(appt.patientId);
      if (!idList) {
        idList = [];
        byId.set(appt.patientId, idList);
      }
      idList.push(appt);
    }
    const nameKey = appt.patientName.trim().toLowerCase();
    if (nameKey) {
      let nameList = byName.get(nameKey);
      if (!nameList) {
        nameList = [];
        byName.set(nameKey, nameList);
      }
      nameList.push(appt);
    }
  }

  return { byId, byName };
}

export interface ClinicPatientIndexes {
  patientsById: Map<string, Patient>;
  patientsByName: Map<string, Patient>;
  transactionsByPatientId: Map<string, FinancialTransaction[]>;
  balancesByPatientId: Map<string, CurrencyBalance>;
  pendingLabsIndex: PendingLabIndex;
  plansByPatientId: Map<string, TreatmentPlan[]>;
  appointmentsByPatientId: Map<string, Appointment[]>;
  appointmentsByPatientName: Map<string, Appointment[]>;
}

export function buildClinicPatientIndexes(input: {
  patients: Patient[];
  transactions: FinancialTransaction[];
  labOrders: LabOrder[];
  treatmentPlans: TreatmentPlan[];
  appointments: Appointment[];
}): ClinicPatientIndexes {
  const patientMap = indexPatientsById(input.patients);
  const transactionsByPatientId = indexTransactionsByPatient(input.transactions);
  const balancesByPatientId = indexPatientBalances(input.transactions);
  const pendingLabsIndex = indexPendingLabsByPatient(input.labOrders);
  const plansByPatientId = indexTreatmentPlansByPatient(input.treatmentPlans);
  const apptMap = indexAppointmentsByPatient(input.appointments);

  return {
    patientsById: patientMap.byId,
    patientsByName: patientMap.byName,
    transactionsByPatientId,
    balancesByPatientId,
    pendingLabsIndex,
    plansByPatientId,
    appointmentsByPatientId: apptMap.byId,
    appointmentsByPatientName: apptMap.byName,
  };
}

export function calculatePatientBalances(
  patientId: string,
  transactions: FinancialTransaction[]
): {
  total: CurrencyBalance;
  ARS: CurrencyBalance;
  USD: CurrencyBalance;
} {
  const total = calculateSingleCurrencyBalance(patientId, transactions);
  const ars: CurrencyBalance = { charged: 0, paid: 0, balance: 0 };
  const usd: CurrencyBalance = { charged: 0, paid: 0, balance: 0 };

  for (const tx of transactions) {
    if (tx.deletedAt || tx.patientId !== patientId) continue;
    const bucket = tx.currency === 'USD' ? usd : ars;
    const amt = Math.max(0, Number(tx.amount) || 0);
    if (tx.type === 'charge') bucket.charged += amt;
    else if (tx.type === 'payment') bucket.paid += amt;
  }

  ars.balance = Math.round((ars.charged - ars.paid) * 100) / 100;
  usd.balance = Math.round((usd.charged - usd.paid) * 100) / 100;

  return { total, ARS: ars, USD: usd };
}

export function getPatientPendingLabAlerts(
  patientId: string | undefined,
  patientName: string,
  labOrders: LabOrder[]
): LabOrder[] {
  const lower = patientName.trim().toLowerCase();
  return labOrders.filter((order) => {
    if (order.deletedAt) return false;
    const isPending = order.status === 'sin_enviar' || order.status === 'en_laboratorio';
    if (!isPending) return false;
    if (patientId && order.patientId === patientId) return true;
    return Boolean(lower && order.patientName.trim().toLowerCase() === lower);
  });
}

export function toLocalIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sanitizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Uruguay mobile format: 09X XXX XXX -> 598 9X XXX XXX
  if (digits.length === 9 && digits.startsWith('09')) {
    return `598${digits.slice(1)}`;
  }
  // Argentina 10-digit fallback
  if (digits.length === 10 && !digits.startsWith('54') && !digits.startsWith('598')) {
    return `549${digits}`;
  }
  return digits;
}

export function generateWhatsAppUrl(phone: string | undefined, message: string): string | null {
  if (!phone) return null;
  const clean = sanitizePhoneForWhatsApp(phone);
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function generateAppointmentMailtoUrl(
  email: string | undefined,
  subject: string,
  body: string
): string | null {
  if (!email?.trim()) return null;
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function toCompactUtcStamp(dateStr: string, timeStr: string, addMinutes = 0): string {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  if (Number.isNaN(dt.getTime())) {
    return '20260101T090000Z';
  }
  dt.setMinutes(dt.getMinutes() + addMinutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(
    dt.getUTCHours()
  )}${pad(dt.getUTCMinutes())}00Z`;
}

export function generateGoogleCalendarUrl(appt: Appointment): string {
  const start = toCompactUtcStamp(appt.date, appt.startTime, 0);
  const end = toCompactUtcStamp(appt.date, appt.startTime, appt.durationMin || 30);
  const title = `OdontoHelper · ${appt.patientName} — ${appt.procedure}`;
  const details = [
    `Paciente: ${appt.patientName}`,
    `Tratamiento: ${appt.procedure}`,
    appt.professionalName ? `Profesional: ${appt.professionalName}` : '',
    appt.notes ? `Notas: ${appt.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
}

export function buildAppointmentIcs(appt: Appointment): string {
  const start = toCompactUtcStamp(appt.date, appt.startTime, 0);
  const end = toCompactUtcStamp(appt.date, appt.startTime, appt.durationMin || 30);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OdontoHelper//Agenda Odontologica//ES',
    'BEGIN:VEVENT',
    `UID:${appt.id}@odontohelper.local`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Turno Odontológico - ${appt.patientName} (${appt.procedure})`,
    `DESCRIPTION:${(appt.notes || appt.procedure).replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function getUpcomingBirthdays(patients: Patient[], withinDays = 30): Array<{
  patient: Patient;
  daysUntil: number;
  nextDateLabel: string;
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results: Array<{ patient: Patient; daysUntil: number; nextDateLabel: string }> = [];

  for (const p of patients) {
    if (!p.birthDate || p.deletedAt) continue;
    const match = p.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) continue;
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    let target = new Date(today.getFullYear(), month, day);
    if (target.getTime() < today.getTime()) {
      target = new Date(today.getFullYear() + 1, month, day);
    }
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= withinDays) {
      results.push({
        patient: p,
        daysUntil: diffDays,
        nextDateLabel: target.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }),
      });
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function calculateAgeFromBirthDate(birthDate?: string): number | null {
  if (!birthDate) return null;
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const now = new Date();
  let age = now.getFullYear() - year;
  const mDiff = now.getMonth() - month;
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

export function formatBirthDateDisplay(birthDate?: string): string {
  if (!birthDate) return '';
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return birthDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function packPatientAnamnesis(
  patient: Partial<Patient>,
  existing?: PatientAnamnesis | null
): PatientAnamnesis | undefined {
  const baseAnamnesis: PatientAnamnesis = {
    ...(existing || {}),
    ...(patient.anamnesis || {}),
  };
  const existingMeta: PatientProfileMeta = baseAnamnesis._profileMeta || {};
  const nextMeta: PatientProfileMeta = { ...existingMeta };

  if ('gender' in patient) nextMeta.gender = patient.gender;
  if ('secondaryPhone' in patient) nextMeta.secondaryPhone = patient.secondaryPhone;
  if ('groupTag' in patient) nextMeta.groupTag = patient.groupTag;
  if ('photoDataUrl' in patient) nextMeta.photoDataUrl = patient.photoDataUrl;
  if ('physicalExam' in patient) nextMeta.physicalExam = patient.physicalExam;
  if ('nextControlDate' in patient) nextMeta.nextControlDate = patient.nextControlDate;
  if ('nextControlNote' in patient) nextMeta.nextControlNote = patient.nextControlNote;

  const hasMeta = Object.values(nextMeta).some((v) => v !== undefined && v !== null && v !== '');
  if (hasMeta) {
    baseAnamnesis._profileMeta = nextMeta;
  } else {
    delete baseAnamnesis._profileMeta;
  }

  return Object.keys(baseAnamnesis).length > 0 ? baseAnamnesis : undefined;
}

export function unpackPatientProfileMeta(anamnesis?: PatientAnamnesis | null): PatientProfileMeta {
  return anamnesis?._profileMeta || {};
}

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  downloadBlob(filename, new Blob([content], { type: mimeType }));
}

export function escapeCsvCell(val?: string | number | null): string {
  const str = String(val ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | undefined | null>>,
  includeBom = false
): void {
  const csv = [
    headers.map((h) => escapeCsvCell(h)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n');
  const payload = includeBom ? `\uFEFF${csv}` : csv;
  downloadTextFile(filename, payload, 'text/csv;charset=utf-8');
}

export function downloadAppointmentIcsFile(appt: Appointment): void {
  const ics = buildAppointmentIcs(appt);
  const safeName = appt.patientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadTextFile(`turno-${safeName}-${appt.date}.ics`, ics, 'text/calendar;charset=utf-8');
}

export function getPractitionerInitials(name: string): string {
  const cleaned = name
    .replace(/\b(dr|dra|od|odont)\.?\b/gi, ' ')
    .trim();
  const parts = (cleaned || name.trim()).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function resolvePractitionerDisplay(
  professionals: ClinicProfessional[],
  activeProfessionalId: string | null,
  profile: Profile | null
): {
  name: string;
  specialty?: string;
  licenseNumber?: string;
  meta: string;
  initials: string;
} {
  const active =
    professionals.find((p) => p.id === activeProfessionalId) ||
    professionals.find((p) => p.role === 'owner') ||
    professionals[0];
  const name = (active?.fullName || profile?.fullName || 'Odontólogo Titular').trim();
  const specialty = active?.specialty?.trim() || undefined;
  const licenseNumber = active?.licenseNumber?.trim() || undefined;
  const meta = [specialty, licenseNumber].filter(Boolean).join(' · ') || 'Perfil profesional';
  return {
    name,
    specialty,
    licenseNumber,
    meta,
    initials: getPractitionerInitials(name),
  };
}
