import {
  PaidSubscriptionPlanTier,
  SubscriptionAlertLevel,
  SubscriptionBillingCycle,
  SubscriptionPlanTier,
  WorkspaceSubscription,
} from '../types';

export const FREE_TRIAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRATION_WARNING_DAYS = 5;
export const EXPIRATION_CRITICAL_DAYS = 1;

export interface BillingCycleOption {
  id: SubscriptionBillingCycle;
  label: string;
  shortLabel: string;
  months: number;
  discountPct: number;
  badgeText?: string;
}

export const BILLING_CYCLE_OPTIONS: BillingCycleOption[] = [
  {
    id: 'monthly',
    label: 'Mensual',
    shortLabel: 'Mensual',
    months: 1,
    discountPct: 0,
  },
  {
    id: 'quarterly',
    label: 'Trimestral',
    shortLabel: 'Trimestral (-15%)',
    months: 3,
    discountPct: 15,
    badgeText: '15% OFF',
  },
  {
    id: 'annual',
    label: 'Anual',
    shortLabel: 'Anual (-25%)',
    months: 12,
    discountPct: 25,
    badgeText: '25% OFF',
  },
];

export interface SubscriptionPlanDefinition {
  id: PaidSubscriptionPlanTier;
  name: string;
  tagline: string;
  monthlyUsd: number;
  highlighted?: boolean;
  available: boolean;
  availabilityLabel: string;
  cloudAudioStorage: boolean;
  cloudAudioProcessing: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    id: 'base',
    name: 'Plan Profesional',
    tagline: 'Todo lo necesario para ordenar tu consultorio y dictar tus historias clínicas sin escribir de más.',
    monthlyUsd: 40,
    highlighted: true,
    available: true,
    availabilityLabel: 'Disponible ahora · 7 días gratis',
    cloudAudioStorage: false,
    cloudAudioProcessing: false,
    features: [
      'Historias clínicas completas, odontograma y control de encías para todos tus pacientes',
      'Hablás al micrófono al terminar la consulta y el sistema escribe la evolución por vos',
      'Tus grabaciones quedan privadas dentro de la computadora o celular donde las grabaste',
      'Agenda ordenada con avisos por WhatsApp, presupuestos y caja en pesos o dólares',
      'Compartí una ficha clínica por WhatsApp con otro colega sin mostrar tus presupuestos ni tu caja',
      'Subí radiografías, fotos y generá reportes listos para imprimir o guardar',
    ],
  },
  {
    id: 'extra',
    name: 'Plan Extra',
    tagline: 'Pensado para quienes atienden desde varios equipos y quieren guardar sus grabaciones en la nube.',
    monthlyUsd: 59,
    available: true,
    availabilityLabel: 'Con respaldo de grabaciones en la nube',
    cloudAudioStorage: true,
    cloudAudioProcessing: false,
    features: [
      'Todo lo incluido en el Plan Profesional',
      'Grabá y transcribí consultas completas (incluso de 1 hora o más) y guardá el audio en la nube',
      'Volvé a escuchar o descargá cualquier grabación desde otra computadora, tablet o celular',
      'Uso razonable amplio por consultorio: hasta 1.800 horas (~20 GB comprimidos) de audio guardado en la nube',
    ],
  },
  {
    id: 'mega',
    name: 'Mega Plan',
    tagline: 'Transcripción de grabaciones desde servidores rápidos para cualquier celular, en preparación.',
    monthlyUsd: 89,
    available: false,
    availabilityLabel: 'No disponible por el momento',
    cloudAudioStorage: true,
    cloudAudioProcessing: true,
    features: [
      'Todo lo incluido en el Plan Extra',
      'Pasaje de voz a texto en servidores externos sin exigir potencia en tu celular',
      'Pensado para clínicas con gran volumen diario de consultas',
    ],
  },
];

export interface CalculatedPlanPricing {
  tier: PaidSubscriptionPlanTier;
  cycle: SubscriptionBillingCycle;
  months: number;
  discountPct: number;
  baseMonthlyUsd: number;
  effectiveMonthlyUsd: number;
  totalUsd: number;
  savingsUsd: number;
}

export function getPlanDefinition(tier: SubscriptionPlanTier): SubscriptionPlanDefinition {
  if (tier === 'trial') {
    return SUBSCRIPTION_PLANS[0];
  }
  return SUBSCRIPTION_PLANS.find((p) => p.id === tier) || SUBSCRIPTION_PLANS[0];
}

export function getBillingCycleOption(cycle: SubscriptionBillingCycle): BillingCycleOption {
  return BILLING_CYCLE_OPTIONS.find((c) => c.id === cycle) || BILLING_CYCLE_OPTIONS[0];
}

export function calculatePlanPricing(
  tier: PaidSubscriptionPlanTier,
  cycle: SubscriptionBillingCycle
): CalculatedPlanPricing {
  const plan = getPlanDefinition(tier);
  const opt = getBillingCycleOption(cycle);
  const fullTotal = plan.monthlyUsd * opt.months;
  const discountedTotal = Math.round(fullTotal * (1 - opt.discountPct / 100));
  const effectiveMonthlyUsd = Math.round((discountedTotal / opt.months) * 100) / 100;
  return {
    tier,
    cycle,
    months: opt.months,
    discountPct: opt.discountPct,
    baseMonthlyUsd: plan.monthlyUsd,
    effectiveMonthlyUsd,
    totalUsd: discountedTotal,
    savingsUsd: Math.max(0, fullTotal - discountedTotal),
  };
}

export function getTierDisplayLabel(tier: SubscriptionPlanTier): string {
  switch (tier) {
    case 'trial':
      return 'Prueba gratuita (7 días)';
    case 'base':
      return 'Plan Profesional';
    case 'extra':
      return 'Plan Extra · Nube Audio';
    case 'mega':
      return 'Mega Plan · Procesado Nube';
  }
}

export function getCycleDisplayLabel(cycle: SubscriptionBillingCycle): string {
  switch (cycle) {
    case 'monthly':
      return 'Mensual';
    case 'quarterly':
      return 'Trimestral';
    case 'annual':
      return 'Anual';
  }
}

export interface SubscriptionEvaluation {
  tier: SubscriptionPlanTier;
  tierLabel: string;
  billingCycle: SubscriptionBillingCycle;
  isTrial: boolean;
  isIndefinite: boolean;
  isExpired: boolean;
  expiresAt: number;
  msRemaining: number;
  daysRemaining: number;
  hoursRemaining: number;
  alertLevel: SubscriptionAlertLevel;
  headline: string;
  description: string;
}

export function evaluateSubscriptionStatus(
  sub: WorkspaceSubscription | null | undefined,
  now: number = Date.now()
): SubscriptionEvaluation {
  const fallbackEnd = now + FREE_TRIAL_DAYS * DAY_MS;
  if (!sub) {
    return {
      tier: 'trial',
      tierLabel: getTierDisplayLabel('trial'),
      billingCycle: 'monthly',
      isTrial: true,
      isIndefinite: false,
      isExpired: false,
      expiresAt: fallbackEnd,
      msRemaining: FREE_TRIAL_DAYS * DAY_MS,
      daysRemaining: FREE_TRIAL_DAYS,
      hoursRemaining: FREE_TRIAL_DAYS * 24,
      alertLevel: 'ok',
      headline: `Prueba gratuita activa · quedan ${FREE_TRIAL_DAYS} días`,
      description: 'Tenés acceso completo al consultorio. Podés activar tu plan anual o trimestral con descuento por transferencia bancaria.',
    };
  }

  const tier = sub.planTier;
  const tierLabel = getTierDisplayLabel(tier);
  const isTrial = tier === 'trial';
  const isIndefinite = Boolean(
    sub.isIndefinite || (!isTrial && sub.status === 'active' && sub.currentPeriodEnd == null)
  );

  if (isIndefinite) {
    return {
      tier,
      tierLabel,
      billingCycle: sub.billingCycle,
      isTrial: false,
      isIndefinite: true,
      isExpired: false,
      expiresAt: Number.MAX_SAFE_INTEGER,
      msRemaining: Number.MAX_SAFE_INTEGER,
      daysRemaining: Number.MAX_SAFE_INTEGER,
      hoursRemaining: Number.MAX_SAFE_INTEGER,
      alertLevel: 'ok',
      headline: `${tierLabel} activo · Sin vencimiento`,
      description: 'Acceso completo habilitado de forma indefinida para este consultorio.',
    };
  }

  const expiresAt = isTrial
    ? sub.trialEndsAt
    : sub.currentPeriodEnd ?? sub.trialEndsAt;

  const msRemaining = Math.max(0, expiresAt - now);
  const daysRemaining = msRemaining <= 0 ? 0 : Math.ceil(msRemaining / DAY_MS);
  const hoursRemaining = msRemaining <= 0 ? 0 : Math.ceil(msRemaining / (60 * 60 * 1000));
  const isExpired = sub.status === 'expired' || msRemaining <= 0;

  let alertLevel: SubscriptionAlertLevel = 'ok';
  if (isExpired) {
    alertLevel = 'expired';
  } else if (daysRemaining <= EXPIRATION_CRITICAL_DAYS) {
    alertLevel = 'critical';
  } else if (daysRemaining <= EXPIRATION_WARNING_DAYS) {
    alertLevel = 'warning';
  }

  const targetPlanForCopy = isTrial ? 'tu prueba gratuita de 7 días' : `tu ${tierLabel}`;
  const formattedDate = new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(expiresAt));

  let headline = '';
  let description = '';

  if (alertLevel === 'expired') {
    headline = isTrial
      ? 'Finalizó tu prueba gratuita de 7 días'
      : `Venció la vigencia de ${tierLabel}`;
    description =
      'Tus historias clínicas, odontogramas y pacientes siguen guardados de forma segura. Informá tu transferencia en USD para renovar o activar el plan.';
  } else if (alertLevel === 'critical') {
    headline =
      hoursRemaining <= 24
        ? `Atención: ${targetPlanForCopy} vence en ${hoursRemaining} h (${formattedDate})`
        : `Atención: ${targetPlanForCopy} vence mañana (${formattedDate})`;
    description =
      'Realizá e informá tu transferencia bancaria en USD para evitar interrupciones en la agenda y el registro clínico.';
  } else if (alertLevel === 'warning') {
    headline = `Aviso de vencimiento: quedan ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} en ${targetPlanForCopy}`;
    description = `Vigencia hasta el ${formattedDate}. Podés renovar por transferencia en USD con descuento trimestral (-15%) o anual (-25%).`;
  } else {
    headline = `${tierLabel} activo · ${daysRemaining} ${daysRemaining === 1 ? 'día restante' : 'días restantes'}`;
    description = `Vigencia actual hasta el ${formattedDate} (${getCycleDisplayLabel(sub.billingCycle)}).`;
  }

  return {
    tier,
    tierLabel,
    billingCycle: sub.billingCycle,
    isTrial,
    isIndefinite: false,
    isExpired,
    expiresAt,
    msRemaining,
    daysRemaining,
    hoursRemaining,
    alertLevel,
    headline,
    description,
  };
}

export const URUGUAY_BANK_TRANSFER_INFO = {
  beneficiary: 'OdontoHelper Uruguay',
  banks: [
    { name: 'BROU (Banco República)', detail: 'Caja de Ahorros en USD · Solicitar número al confirmar' },
    { name: 'Santander / Itaú / BBVA Uruguay', detail: 'Transferencia bancaria exclusivamente en dólares (USD)' },
    { name: 'Prex / OCA Blue', detail: 'Transferencia directa en USD sin comisiones de tarjeta' },
  ],
  whatsappNumber: '59899000000',
};

export function buildWorkspaceTransferCode(workspaceId: string): string {
  const clean = workspaceId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(-6).padStart(6, '0');
  return `OH-${suffix}`;
}

export function buildTransferWhatsappUrl(params: {
  workspaceId: string;
  planTier: PaidSubscriptionPlanTier;
  billingCycle: SubscriptionBillingCycle;
  amountUsd: number;
  payerName: string;
  bankName: string;
  transferReference: string;
  email?: string | null;
}): string {
  const planName = getTierDisplayLabel(params.planTier);
  const cycleName = getCycleDisplayLabel(params.billingCycle);
  const code = buildWorkspaceTransferCode(params.workspaceId);
  const msg = [
    'Hola OdontoHelper, informo una transferencia para activar/renovar suscripción:',
    `- Código consultorio: ${code}`,
    params.email ? `- Cuenta: ${params.email}` : null,
    `- Plan: ${planName} (${cycleName})`,
    `- Monto: USD ${params.amountUsd}`,
    `- Titular origen: ${params.payerName}`,
    `- Banco / Billetera: ${params.bankName}`,
    `- Comprobante / Referencia: ${params.transferReference}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${URUGUAY_BANK_TRANSFER_INFO.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
