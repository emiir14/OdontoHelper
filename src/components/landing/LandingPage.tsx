import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Landmark,
  Lock,
  Menu,
  Mic,
  Play,
  Share2,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import clinicOperatoryImg from '../../assets/images/clinic_operatory_hero_1795530859590.jpg';
import clinicDeskImg from '../../assets/images/clinic_consultation_desk_1795530850935.jpg';
import testimonial1Img from '../../assets/images/odontologa_portrait_uy_1795530851062.jpg';
import testimonial2Img from '../../assets/images/odontologo_portrait_uy_1795530851326.jpg';
import {
  BILLING_CYCLE_OPTIONS,
  SUBSCRIPTION_PLANS,
  URUGUAY_BANK_TRANSFER_INFO,
  calculatePlanPricing,
} from '../../core/clinic/subscriptionPlans';
import type { PublicMarketingRoute } from '../../core/routing/appRoutes';
import { URUGUAY_LANDING_FAQS } from '../../core/seo/seoManager';
import type { PaidSubscriptionPlanTier, SubscriptionBillingCycle } from '../../core/types';
import {
  AlternatingModuleShowcases,
  HeroMultiDeviceShowcase,
  VoiceToCalendarWalkthrough,
} from './SystemWalkthroughs';

interface LandingPageProps {
  activeRoute: PublicMarketingRoute;
  isAuthenticated?: boolean;
  onGoToWorkspace?: () => void;
  onNavigateMarketing: (route: PublicMarketingRoute) => void;
  onNavigateAuth: (
    mode: 'login' | 'signup',
    plan?: PaidSubscriptionPlanTier,
    cycle?: SubscriptionBillingCycle
  ) => void;
}

const ROUTE_SECTION_ID: Partial<Record<PublicMarketingRoute, string>> = {
  funciones: 'funciones',
  'dictado-por-voz': 'simulacion',
  planes: 'planes',
  'preguntas-frecuentes': 'preguntas',
};

const ROUTE_HERO_COPY: Record<
  PublicMarketingRoute,
  { heading: string; subtitle: string; primaryCta: string }
> = {
  landing: {
    heading: 'Historia clínica, agenda y dictado por voz pensados para tu consultorio.',
    subtitle:
      'Organizá tus turnos con avisos por WhatsApp, Google y Apple Calendar, odontograma FDI y caja en pesos uruguayos o dólares, sin complicarte.',
    primaryCta: 'Probar 7 días gratis',
  },
  funciones: {
    heading: 'Todo tu consultorio conectado en una sola plataforma web y móvil.',
    subtitle:
      'Desde la agenda diaria y el odontograma interactivo hasta trabajos de laboratorio, caja en pesos o dólares y derivación privada entre colegas.',
    primaryCta: 'Probar 7 días sin costo',
  },
  'dictado-por-voz': {
    heading: 'Dictá la consulta al terminar y dejá el próximo control agendado en segundos.',
    subtitle:
      'El sistema convierte tu voz en texto directo en tu computadora o celular, reconoce piezas dentarias e indicaciones y prepara el próximo turno.',
    primaryCta: 'Probar dictado gratis 7 días',
  },
  planes: {
    heading: 'Planes claros desde USD 40/mes con descuento trimestral y anual.',
    subtitle:
      'Probá 7 días gratis sin ingresar tarjeta. Luego elegí tu plan y aboná exclusivamente en dólares (USD) por transferencia bancaria en Uruguay.',
    primaryCta: 'Iniciar prueba de 7 días',
  },
  'preguntas-frecuentes': {
    heading: 'Todo claro antes de sumar OdontoHelper a tu consultorio.',
    subtitle:
      'Conocé cómo funciona la prueba de 7 días, la privacidad del dictado por voz, el resguardo de tus fichas y el pago por transferencia en USD.',
    primaryCta: 'Crear cuenta gratis 7 días',
  },
};

const CLINICAL_CAPABILITIES = [
  {
    icon: Mic,
    title: 'Dictado clínico por voz',
    desc: 'Hablás al terminar de atender y la evolución queda redactada en la ficha. En el Plan Profesional los audios nunca salen de tu dispositivo.',
  },
  {
    icon: Calendar,
    title: 'Agenda, WhatsApp y calendarios',
    desc: 'Turnos por profesional, control en sala de espera, recordatorios por WhatsApp y sincronización con Google Calendar y Apple Calendar.',
  },
  {
    icon: FileText,
    title: 'Odontograma FDI y periodontograma',
    desc: 'Marcá caras dentarias, sondajes y sangrado, y guardá radiografías o fotos clínicas ordenadas en la línea temporal del paciente.',
  },
  {
    icon: Share2,
    title: 'Derivación segura entre colegas',
    desc: 'Compartí historia clínica y odontograma por enlace de WhatsApp con otro especialista manteniendo tus presupuestos y saldos privados.',
  },
  {
    icon: Wallet,
    title: 'Presupuestos, caja y laboratorio',
    desc: 'Trabajá en $ UYU o USD, registrá señas y cuotas, y controlá trabajos de prótesis antes de confirmar la cita del paciente.',
  },
  {
    icon: ShieldCheck,
    title: 'Avisos claros antes de cada vencimiento',
    desc: 'Notificaciones anticipadas dentro del sistema para que renueves con tiempo y nunca se interrumpa tu agenda diaria.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  activeRoute,
  isAuthenticated = false,
  onGoToWorkspace,
  onNavigateMarketing,
  onNavigateAuth,
}) => {
  const [selectedCycle, setSelectedCycle] = useState<SubscriptionBillingCycle>('annual');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const heroCopy = ROUTE_HERO_COPY[activeRoute] || ROUTE_HERO_COPY.landing;

  useEffect(() => {
    const targetId = ROUTE_SECTION_ID[activeRoute];
    if (!targetId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeRoute]);

  const handleNavClick = (route: PublicMarketingRoute) => {
    setMobileMenuOpen(false);
    onNavigateMarketing(route);
  };

  const handlePrimaryAction = () => {
    if (isAuthenticated && onGoToWorkspace) {
      onGoToWorkspace();
      return;
    }
    onNavigateAuth('signup', 'base', selectedCycle);
  };

  const getRouteHref = (route: PublicMarketingRoute): string =>
    route === 'landing' ? '/' : `/${route}`;

  const getAuthHref = (
    mode: 'login' | 'signup',
    plan?: PaidSubscriptionPlanTier,
    cycle?: SubscriptionBillingCycle
  ): string => {
    if (mode === 'login') return '/login';
    const params = new URLSearchParams();
    if (plan) params.set('plan', plan);
    if (cycle) params.set('ciclo', cycle);
    const q = params.toString();
    return q ? `/registro?${q}` : '/registro';
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('landing');
            }}
            className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0">
              <svg className="w-4.5 h-4.5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M16 4.5C11.2 4.5 8 7.5 8 12.2C8 16.5 9.8 19.8 10.9 24.4C11.5 26.8 12.7 27.8 13.9 27.8C15 27.8 15.5 25.4 16 23.8C16.5 25.4 17 27.8 18.1 27.8C19.3 27.8 20.5 26.8 21.1 24.4C22.2 19.8 24 16.5 24 12.2C24 7.5 20.8 4.5 16 4.5Z"
                  fill="currentColor"
                  fillOpacity="0.24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 9.8V16.2M12.8 13H19.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              OdontoHelper
            </span>
          </a>

          {/* Zone 2: Nav Links */}
          <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-6">
            {[
              { id: 'dictado-por-voz' as const, label: 'Cómo funciona' },
              { id: 'funciones' as const, label: 'Módulos' },
              { id: 'planes' as const, label: 'Planes' },
              { id: 'preguntas-frecuentes' as const, label: 'Preguntas' },
            ].map((item) => (
              <a
                key={item.id}
                href={getRouteHref(item.id)}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.id);
                }}
                className={`text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeRoute === item.id
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && onGoToWorkspace ? (
              <a
                href="/dictar"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToWorkspace();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Ir al consultorio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateAuth('login');
                  }}
                  className="hidden sm:inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Iniciar sesión
                </a>
                <a
                  href={getAuthHref('signup', 'base', selectedCycle)}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateAuth('signup', 'base', selectedCycle);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Prueba 7 días</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-2 shadow-lg">
            {[
              { id: 'dictado-por-voz' as const, label: 'Grabación y Agenda en vivo' },
              { id: 'funciones' as const, label: 'Módulos del consultorio' },
              { id: 'planes' as const, label: 'Planes y precios' },
              { id: 'preguntas-frecuentes' as const, label: 'Preguntas frecuentes' },
            ].map((item) => (
              <a
                key={item.id}
                href={getRouteHref(item.id)}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.id);
                }}
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {item.label}
              </a>
            ))}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              {isAuthenticated && onGoToWorkspace ? (
                <a
                  href="/dictar"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    onGoToWorkspace();
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 text-white text-center cursor-pointer"
                >
                  Ir al consultorio
                </a>
              ) : (
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    onNavigateAuth('login');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-center cursor-pointer"
                >
                  Iniciar sesión
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Split Section (OdontoSys crisp light cyan-white clinical framing) */}
        <section className="bg-gradient-to-b from-[#F2FAFB] via-[#F7FCFC] to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 tracking-wide">
                  Software odontológico para consultorios en Uruguay
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.12] text-slate-900 dark:text-white text-balance">
                  {heroCopy.heading}
                </h1>

                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {heroCopy.subtitle}
                </p>

                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Agenda multiconsultorio con WhatsApp, Google Calendar y Apple Calendar</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Historia clínica, Odontograma FDI, caja en $ UYU / USD y laboratorio</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Dictado por voz privado directo en tu computadora o celular</span>
                  </li>
                </ul>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                  >
                    <span>
                      {isAuthenticated ? 'Entrar a mi consultorio' : heroCopy.primaryCta}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('simulacion');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 text-teal-600 fill-current" />
                    <span>Ver cómo funciona</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Plan Profesional USD 40/mes · Descuento trimestral (-15%) y anual (-25%) · Sin tarjeta
                </p>
              </div>

              {/* Multi-device Preview (Desktop Browser + Mobile Dictation Frame) */}
              <div className="lg:col-span-6">
                <HeroMultiDeviceShowcase />
              </div>
            </div>
          </div>
        </section>

        {/* Animated GIF-Style System Walkthrough: Recording -> Calendar -> Patient Card */}
        <section
          id="simulacion"
          className="scroll-mt-20 py-14 lg:py-20 bg-[#F4F8F8] dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Demostración animada del flujo diario
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Mirá cómo una grabación se convierte en evolución clínica y turno en tu Agenda
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Grabás unos segundos apenas se levanta el paciente, el sistema redacta la nota clínica y con un clic el próximo control queda agendado con aviso por WhatsApp.
              </p>
            </div>

            <VoiceToCalendarWalkthrough />
          </div>
        </section>

        {/* OdontoSys-Style Alternating Feature Showcases */}
        <section id="funciones" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 space-y-20">
          <AlternatingModuleShowcases />

          {/* Concise 6-Module Grid */}
          <div className="pt-8 border-t border-slate-200/80 dark:border-slate-800 space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Sistema completo para consultorios
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Todo lo que necesitás entre consulta y recepción
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CLINICAL_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="p-6 rounded-3xl bg-[#F9FCFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-teal-600/10 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
              <a
                href="/dictado-por-voz"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('dictado-por-voz');
                }}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span>Ver dictado clínico por voz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="/planes"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('planes');
                }}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span>Comparar planes en USD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="/preguntas-frecuentes"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('preguntas-frecuentes');
                }}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span>Resolver dudas frecuentes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="planes"
          className="scroll-mt-20 py-14 lg:py-20 bg-[#F4F8F8] dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Precios transparentes · 7 días gratis en cualquier plan
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Elegí tu plan y aboná exclusivamente en USD por transferencia
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sin pasarelas ni débitos automáticos sorpresa. Todos los planes se abonan únicamente en dólares (USD) por transferencia bancaria y te avisan antes de cada vencimiento.
                </p>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="inline-flex rounded-2xl bg-white dark:bg-slate-900 p-1.5 border border-slate-200 dark:border-slate-800 self-start">
                {BILLING_CYCLE_OPTIONS.map((opt) => {
                  const active = selectedCycle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedCycle(opt.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const calc = calculatePlanPricing(plan.id, selectedCycle);
                const isFeatured = Boolean(plan.highlighted);
                const isUnavailable = !plan.available;
                return (
                  <div
                    key={plan.id}
                    className={`p-6 sm:p-7 rounded-3xl flex flex-col justify-between gap-6 border bg-white dark:bg-slate-900 ${
                      isUnavailable
                        ? 'border-slate-200/80 dark:border-slate-800/80 opacity-75'
                        : isFeatured
                        ? 'border-teal-600 ring-1 ring-teal-600 shadow-md'
                        : 'border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <span
                          className={`text-xs font-semibold ${
                            isUnavailable
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-teal-700 dark:text-teal-300'
                          }`}
                        >
                          {plan.availabilityLabel}
                        </span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {plan.tagline}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1 tabular-nums">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                            USD {calc.effectiveMonthlyUsd}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            / mes
                          </span>
                          {calc.discountPct > 0 && (
                            <span className="text-xs line-through text-slate-400">
                              USD {calc.baseMonthlyUsd}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isUnavailable
                            ? 'Disponible próximamente · Pago en USD'
                            : calc.months === 1
                            ? 'Facturación mensual por transferencia en USD'
                            : `Pago único de USD ${calc.totalUsd} cada ${calc.months} meses (ahorrás USD ${calc.savingsUsd})`}
                        </p>
                      </div>

                      <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isUnavailable ? 'text-slate-400' : 'text-teal-600'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {isUnavailable ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-2xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>No disponible por el momento</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          isAuthenticated && onGoToWorkspace
                            ? onGoToWorkspace()
                            : onNavigateAuth('signup', plan.id, selectedCycle)
                        }
                        className={`w-full py-3 px-4 rounded-2xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                          isFeatured
                            ? 'bg-teal-600 hover:bg-teal-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                        }`}
                      >
                        <span>{isAuthenticated ? 'Ver plan en mi consultorio' : 'Probar 7 días gratis'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bank Transfer Note */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Pago directo por transferencia exclusivamente en USD
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    Aceptamos transferencias en dólares ({URUGUAY_BANK_TRANSFER_INFO.banks.map((b) => b.name).join(' · ')}). Informás tu comprobante dentro de Configuración y activamos tu consultorio en el día.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                <span>Solo en USD · Sin débito automático</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
              Cláusula de uso razonable (Plan Extra): admite grabaciones completas de consultas de 1 hora o más (transcripción íntegra en tu computadora o celular) con hasta 1.800 horas (~20 GB en formato liviano) de audio guardado en la nube por consultorio. Las historias clínicas escritas quedan guardadas siempre sin límite de tiempo.
            </p>
          </div>
        </section>

        {/* Consultorio Real Visual Gallery + Testimonials Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
              Diseñado junto a odontólogos en Uruguay
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              Consultorios reales que dejaron atrás el papel y las planillas sueltas
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Pensado para el ritmo diario entre el sillón y el escritorio, tanto en consultorios individuales como en clínicas multidisciplinarias de Montevideo e interior.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 aspect-[16/9] rounded-3xl overflow-hidden bg-gradient-to-br from-teal-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <img
                src={clinicOperatoryImg}
                alt="Sillón odontológico y box clínico luminoso en consultorio moderno de Uruguay"
                width={1200}
                height={675}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="lg:col-span-5 aspect-[16/9] lg:aspect-auto rounded-3xl overflow-hidden bg-gradient-to-br from-slate-100 to-teal-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <img
                src={clinicDeskImg}
                alt="Escritorio de consulta odontológica con vista al sillón clínico"
                width={960}
                height={540}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="p-6 sm:p-7 rounded-3xl bg-[#F9FCFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-6">
              <blockquote className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                “Antes me llevaba dos horas al final del día pasar notas al sistema. Ahora dicto apenas se levanta el paciente, reviso la pieza en el odontograma y dejo el próximo control agendado en menos de dos minutos.”
              </blockquote>
              <div className="flex items-center gap-3.5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <img
                    src={testimonial1Img}
                    alt="Dra. Lucía Rodríguez, odontóloga en Pocitos, Montevideo"
                    width={320}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Dra. Lucía Rodríguez
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Odontología General · Pocitos, Montevideo
                  </div>
                </div>
              </div>
            </article>

            <article className="p-6 sm:p-7 rounded-3xl bg-[#F9FCFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-6">
              <blockquote className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                “Lo que más valoramos al trabajar con derivaciones de endodoncia es enviar el enlace por WhatsApp y que el colega vea la historia y el odontograma al instante, sin mezclar nuestros presupuestos ni la caja.”
              </blockquote>
              <div className="flex items-center gap-3.5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <img
                    src={testimonial2Img}
                    alt="Dr. Martín Díaz, endodoncista en Centro, Montevideo"
                    width={320}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Dr. Martín Díaz
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Endodoncia · Centro, Montevideo
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="preguntas"
          className="scroll-mt-20 py-14 lg:py-20 bg-[#F4F8F8] dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800/80"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Preguntas frecuentes
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Dudas comunes antes de empezar
              </h2>
            </div>

            <div className="space-y-3">
              {URUGUAY_LANDING_FAQS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.question}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                    >
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Call to Action */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0D2B2D] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold tracking-tight">
                  Empezá hoy con 7 días gratis en tu consultorio
                </h3>
                <p className="text-sm text-teal-100/80">
                  Cargá tus primeros pacientes, probá el dictado por voz con agenda automática y decidí con tranquilidad.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shrink-0 cursor-pointer"
              >
                <span>{isAuthenticated ? 'Ir a mi consultorio' : 'Crear cuenta gratis'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              OdontoHelper Uruguay
            </div>
            <div>Software odontológico, historia clínica digital y dictado por voz</div>
          </div>

          <nav aria-label="Enlaces del pie de página" className="flex flex-wrap items-center gap-4">
            <a
              href="/dictado-por-voz"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('dictado-por-voz');
              }}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cómo funciona
            </a>
            <a
              href="/funciones"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('funciones');
              }}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Módulos
            </a>
            <a
              href="/planes"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('planes');
              }}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Planes
            </a>
            <a
              href="/preguntas-frecuentes"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('preguntas-frecuentes');
              }}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Preguntas
            </a>
            <a
              href={isAuthenticated ? '/dictar' : '/login'}
              onClick={(e) => {
                e.preventDefault();
                if (isAuthenticated && onGoToWorkspace) {
                  onGoToWorkspace();
                } else {
                  onNavigateAuth('login');
                }
              }}
              className="font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
            >
              {isAuthenticated ? 'Ir al consultorio' : 'Acceso profesionales'}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
