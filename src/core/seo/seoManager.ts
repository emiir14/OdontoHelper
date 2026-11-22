import type { PublicMarketingRoute } from '../routing/appRoutes';

export interface SeoMetadataSpec {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  ogType?: 'website' | 'product';
}

export const URUGUAY_LANDING_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: '¿Cómo funciona la prueba gratis de 7 días en OdontoHelper?',
    answer:
      'Te registrás con tu nombre y correo electrónico en menos de un minuto, sin ingresar tarjeta. Tenés acceso completo durante 7 días corridos a historias clínicas, odontograma FDI, agenda, caja y dictado por voz para probarlo con tu consultorio real.',
  },
  {
    question: '¿Cuánto cuesta el sistema después de los 7 días y cómo se paga en Uruguay?',
    answer:
      'El Plan Profesional cuesta $40 USD por mes, con descuento trimestral del 15% ($34 USD/mes) o anual del 25% ($30 USD/mes). Para evitar comisiones de pasarelas, se abona mediante transferencia bancaria en Uruguay (BROU, Santander, Itaú, BBVA, Prex o OCA Blue) informando el comprobante dentro del sistema o por WhatsApp.',
  },
  {
    question: '¿Los audios de mis pacientes se envían a internet o quedan en mi equipo?',
    answer:
      'En el Plan Profesional el dictado por voz funciona de manera 100% local en tu computadora o navegador con Whisper: el audio nunca sale de tu dispositivo. Si más adelante necesitás respaldo de grabaciones o procesado en servidores externos, podés pasar al Plan Extra o Mega Plan.',
  },
  {
    question: '¿Puedo trabajar en Pesos Uruguayos ($ UYU) y en Dólares (USD)?',
    answer:
      'Sí. OdontoHelper está preconfigurado por defecto en Pesos Uruguayos ($ UYU) y permite cambiar la moneda unificada a USD u otras monedas de la región desde Configuración para presupuestos, cuenta corriente, laboratorio y caja diaria.',
  },
  {
    question: '¿Qué pasa si vence mi prueba o suscripción? ¿Pierdo las fichas de mis pacientes?',
    answer:
      'Nunca perdés tus datos. El sistema muestra avisos previos al vencimiento en todos los planes y, si se cumple la fecha, conserva tus historias clínicas, odontogramas y radiografías intactos para que retomes apenas informes la renovación por transferencia.',
  },
  {
    question: '¿Se puede compartir una historia clínica con otro odontólogo o especialista?',
    answer:
      'Sí. Podés generar un enlace privado de un solo uso para enviar por WhatsApp a un colega (endodoncista, cirujano o ortodoncista). Ambos ven y evolucionan el mismo odontograma y ficha clínica, manteniendo tus presupuestos y caja 100% privados.',
  },
];

const PUBLIC_SEO_MAP: Record<PublicMarketingRoute, SeoMetadataSpec> = {
  landing: {
    title: 'OdontoHelper Uruguay · Software Odontológico con Historia Clínica y Dictado por Voz',
    description:
      'Software odontológico para clínicas y consultorios en Uruguay. Historia clínica digital, odontograma FDI, agenda, caja en UYU/USD y dictado por voz local. Probá 7 días gratis.',
    canonicalPath: '/',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
  },
  funciones: {
    title: 'Funciones Clínicas y Gestión · OdontoHelper Uruguay',
    description:
      'Odontograma FDI interactivo, periodontograma, evoluciones cronológicas, presupuestos, caja diaria en pesos uruguayos, trabajos de laboratorio y fichas compartidas.',
    canonicalPath: '/funciones',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
  },
  'dictado-por-voz': {
    title: 'Dictado por Voz Odontológico Offline · OdontoHelper Uruguay',
    description:
      'Dictá evoluciones e historias clínicas por voz entre paciente y paciente. Reconocimiento de piezas FDI y terminología dental sin enviar el audio a la nube.',
    canonicalPath: '/dictado-por-voz',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
  },
  planes: {
    title: 'Planes y Precios en Uruguay · OdontoHelper desde $40 USD/mes',
    description:
      'Plan Profesional a $40 USD/mes con 15% de descuento trimestral y 25% anual. Pago por transferencia bancaria en Uruguay (BROU, Itaú, Santander, Prex). 7 días gratis.',
    canonicalPath: '/planes',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'product',
  },
  'preguntas-frecuentes': {
    title: 'Preguntas Frecuentes · OdontoHelper Software Odontológico Uruguay',
    description:
      'Respondemos dudas sobre prueba gratis de 7 días, pago por transferencia en Uruguay, privacidad del dictado por voz, odontograma digital y respaldo de historias clínicas.',
    canonicalPath: '/preguntas-frecuentes',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
  },
};

export function getPublicSeoSpec(route: PublicMarketingRoute): SeoMetadataSpec {
  return PUBLIC_SEO_MAP[route] || PUBLIC_SEO_MAP.landing;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function applyPublicSeoMetadata(route: PublicMarketingRoute): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const spec = getPublicSeoSpec(route);
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${spec.canonicalPath}`;

  document.title = spec.title;
  upsertMeta('name', 'description', spec.description);
  upsertMeta('name', 'robots', spec.robots);
  upsertMeta('property', 'og:title', spec.title);
  upsertMeta('property', 'og:description', spec.description);
  upsertMeta('property', 'og:type', spec.ogType || 'website');
  upsertMeta('property', 'og:locale', 'es_UY');
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('name', 'twitter:title', spec.title);
  upsertMeta('name', 'twitter:description', spec.description);
  upsertCanonical(canonicalUrl);
}

export function applyPrivateNoIndexMetadata(title: string): void {
  if (typeof document === 'undefined') return;
  document.title = title;
  upsertMeta('name', 'robots', 'noindex, nofollow');
}
