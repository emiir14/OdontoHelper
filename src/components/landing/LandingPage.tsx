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
  Share2,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import heroClinicImg from '../../assets/images/hero_dental_workspace_1795287115633.jpg';
import testimonial1Img from '../../assets/images/dentist_testimonial_1_1795287115089.jpg';
import testimonial2Img from '../../assets/images/dentist_testimonial_2_1795287115889.jpg';
import {
  BILLING_CYCLE_OPTIONS,
  SUBSCRIPTION_PLANS,
  URUGUAY_BANK_TRANSFER_INFO,
  calculatePlanPricing,
} from '../../core/clinic/subscriptionPlans';
import type { PublicMarketingRoute } from '../../core/routing/appRoutes';
import { URUGUAY_LANDING_FAQS } from '../../core/seo/seoManager';
import type { PaidSubscriptionPlanTier, SubscriptionBillingCycle } from '../../core/types';
import { InteractiveClinicSimulator } from './InteractiveClinicSimulator';

interface LandingPageProps {
  activeRoute: PublicMarketingRoute;
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
    heading: 'Historia clínica y dictado por voz para tu consultorio en Uruguay.',
    subtitle:
      'Ordená fichas clínicas, odontograma FDI, agenda, presupuestos y caja diaria en $ UYU o USD. Grabá la evolución entre paciente y paciente sin enviar audios a la nube.',
    primaryCta: 'Comenzar prueba gratis 7 días',
  },
  funciones: {
    heading: 'Todas las funciones clínicas y administrativas en un solo lugar.',
    subtitle:
      'Odontograma interactivo, periodontograma, evoluciones cronológicas, radiografías, agenda multiconsultorio, presupuestos, caja y laboratorio diseñados para la práctica odontológica.',
    primaryCta: 'Probar 7 días sin costo',
  },
  'dictado-por-voz': {
    heading: 'Dictado por voz odontológico que funciona en tu propio equipo.',
    subtitle:
      'Dictá hallazgos, piezas FDI y tratamientos en español rioplatense. Whisper transcribe en segundos directo en tu navegador sin subir audios de pacientes.',
    primaryCta: 'Probar dictado gratis 7 días',
  },
  planes: {
    heading: 'Planes simples en USD con descuento trimestral y anual en Uruguay.',
    subtitle:
      'Empezá con 7 días de prueba gratis sin tarjeta. Luego elegí el plan adecuado y aboná por transferencia bancaria en BROU, Santander, Itaú, BBVA o Prex.',
    primaryCta: 'Iniciar prueba gratuita de 7 días',
  },
  'preguntas-frecuentes': {
    heading: 'Respuestas claras sobre prueba, privacidad y pagos en Uruguay.',
    subtitle:
      'Todo lo que necesitás saber sobre el período de prueba, el dictado local, la privacidad de tus fichas clínicas y la renovación por transferencia.',
    primaryCta: 'Crear cuenta gratis 7 días',
  },
};

const CLINICAL_CAPABILITIES = [
  {
    icon: Mic,
    title: 'Dictado clínico con Whisper',
    desc: 'Transcribí consultas con terminología dental y glosario editable. Tu audio permanece en tu dispositivo en el Plan Profesional.',
  },
  {
    icon: FileText,
    title: 'Odontograma FDI y Periodontograma',
    desc: 'Registrá caras dentarias, sondajes, sangrado y evoluciones cronológicas con un historial ordenado por paciente.',
  },
  {
    icon: Share2,
    title: 'Derivación entre colegas por enlace',
    desc: 'Compartí una ficha clínica y odontograma por WhatsApp con otro profesional manteniendo presupuestos y caja privados.',
  },
  {
    icon: Calendar,
    title: 'Agenda y recordatorios diarios',
    desc: 'Organizá turnos por profesional y sillón, próximos controles y cumpleaños sin perder citas.',
  },
  {
    icon: Wallet,
    title: 'Presupuestos, cuenta corriente y caja',
    desc: 'Emití presupuestos claros, controlá cobros parciales, saldos pendientes y egresos de laboratorio en $ UYU o USD.',
  },
  {
    icon: ShieldCheck,
    title: 'Avisos de vencimiento y respaldo',
    desc: 'Recibí alertas anticipadas antes de cada vencimiento en todos los planes y renová sin interrupciones por transferencia.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  activeRoute,
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

  return (
    <div className="min-h-dvh bg-[#F8F9F5] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 3-Zone Header Bar */}
      <header className="sticky top-0 z-40 h-16 bg-[#F8F9F5]/92 dark:bg-slate-950/92 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNavClick('landing')}
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
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              OdontoHelper
            </span>
          </button>

          {/* Zone 2: Single-line Nav Links (Desktop) */}
          <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-6">
            {[
              { id: 'funciones' as const, label: 'Funciones' },
              { id: 'dictado-por-voz' as const, label: 'Dictado por voz' },
              { id: 'planes' as const, label: 'Planes' },
              { id: 'preguntas-frecuentes' as const, label: 'Preguntas' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeRoute === item.id
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="hidden sm:inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => onNavigateAuth('signup', 'base', selectedCycle)}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Prueba 7 días</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#F8F9F5] dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-2">
            {[
              { id: 'funciones' as const, label: 'Funciones clínicas' },
              { id: 'dictado-por-voz' as const, label: 'Simulación dictado por voz' },
              { id: 'planes' as const, label: 'Planes y precios' },
              { id: 'preguntas-frecuentes' as const, label: 'Preguntas frecuentes' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateAuth('login');
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 tracking-wide">
                Uruguay · Consultorios y clínicas odontológicas
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight leading-[1.12] text-slate-900 dark:text-white text-balance">
                {heroCopy.heading}
              </h1>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                {heroCopy.subtitle}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateAuth('signup', 'base', selectedCycle)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  <span>{heroCopy.primaryCta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('simulacion');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <span>Probar simulación interactiva</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Plan Profesional USD 40/mes · Descuento trimestral y anual · Sin tarjeta para empezar
              </p>
            </div>

            {/* Hero Photography */}
            <div className="lg:col-span-6">
              <div className="aspect-[16/9] rounded-3xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800">
                <img
                  src={heroClinicImg}
                  alt="Consultorio odontológico luminoso en Uruguay con tablet para historia clínica OdontoHelper"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Simulation Section */}
        <section
          id="simulacion"
          className="scroll-mt-20 py-14 lg:py-20 bg-[#EDEFEA]/85 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Demostración en vivo
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Probá cómo trabaja el sistema antes de crear tu cuenta
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Seleccioná un caso odontológico para simular la transcripción a historia clínica, tocá piezas en el odontograma o consultá la vista de caja diaria.
              </p>
            </div>

            <InteractiveClinicSimulator />
          </div>
        </section>

        {/* Clinical Capabilities Grid */}
        <section id="funciones" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
              Herramienta clínica integral
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Todo lo que usás todos los días en sillón y recepción
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Sin planillas sueltas ni módulos innecesarios: diseñado para trabajar rápido entre paciente y paciente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CLINICAL_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
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
        </section>

        {/* Pricing Section */}
        <section
          id="planes"
          className="scroll-mt-20 py-14 lg:py-20 bg-[#EDEFEA]/85 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Precios transparentes · 7 días gratis en cualquier plan
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Elegí la frecuencia y activá por transferencia bancaria
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sin pasarelas ni cargos automáticos sorpresa. Recibís avisos claros antes del vencimiento y renovás por transferencia en Uruguay.
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
                return (
                  <div
                    key={plan.id}
                    className={`p-6 sm:p-7 rounded-3xl flex flex-col justify-between gap-6 border ${
                      isFeatured
                        ? 'bg-white dark:bg-slate-900 border-teal-600 ring-1 ring-teal-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                            {plan.availabilityLabel}
                          </span>
                        </div>
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
                          {calc.months === 1
                            ? 'Facturación mensual por transferencia'
                            : `Pago único de USD ${calc.totalUsd} cada ${calc.months} meses (ahorrás USD ${calc.savingsUsd})`}
                        </p>
                      </div>

                      <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateAuth('signup', plan.id, selectedCycle)}
                      className={`w-full py-3 px-4 rounded-2xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                        isFeatured
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                      }`}
                    >
                      <span>Probar 7 días gratis</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
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
                    Pago directo por transferencia en Uruguay
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    Aceptamos {URUGUAY_BANK_TRANSFER_INFO.banks.map((b) => b.name).join(' · ')}. Dentro del sistema informás el comprobante y recibís avisos previos al vencimiento.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                <span>Sin débito automático</span>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
              Experiencia en consultorio
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Odontólogos que reemplazaron el papel y la planilla
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-6">
              <blockquote className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                “Antes me llevaba dos horas al final del día pasar notas al sistema. Ahora dicto apenas se levanta el paciente, reviso la pieza en el odontograma y dejo el próximo control agendado en menos de dos minutos.”
              </blockquote>
              <div className="flex items-center gap-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <img
                    src={testimonial1Img}
                    alt="Dra. Lucía Rodríguez, odontóloga en Pocitos, Montevideo"
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

            <article className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-6">
              <blockquote className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                “Lo que más valoramos al trabajar con derivaciones de endodoncia es enviar el enlace por WhatsApp y que el colega vea la historia y el odontograma al instante, sin mezclar nuestros presupuestos ni la caja.”
              </blockquote>
              <div className="flex items-center gap-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <img
                    src={testimonial2Img}
                    alt="Dr. Martín Díaz, endodoncista en Centro, Montevideo"
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
          className="scroll-mt-20 py-14 lg:py-20 bg-[#EDEFEA]/85 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800/80"
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
                  Cargá tus primeros pacientes, probá el dictado por voz y decidí con tranquilidad.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateAuth('signup', 'base', selectedCycle)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shrink-0 cursor-pointer"
              >
                <span>Crear cuenta gratis</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-[#F8F9F5] dark:bg-slate-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              OdontoHelper Uruguay
            </div>
            <div>Software odontológico, historia clínica digital y dictado por voz</div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => handleNavClick('funciones')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Funciones
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('dictado-por-voz')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Dictado por voz
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('planes')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Planes
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('preguntas-frecuentes')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Preguntas
            </button>
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
            >
              Acceso profesionales
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
