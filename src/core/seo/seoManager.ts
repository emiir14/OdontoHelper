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
      'El Plan Profesional cuesta $40 USD por mes, con descuento trimestral del 15% ($34 USD/mes) o anual del 25% ($30 USD/mes). Todos los abonos se pagan exclusivamente en dólares (USD) mediante transferencia bancaria en Uruguay (BROU, Santander, Itaú, BBVA, Prex o OCA Blue) informando el comprobante dentro del sistema o por WhatsApp.',
  },
  {
    question: '¿Las grabaciones de mis pacientes se suben a internet o quedan en mi equipo?',
    answer:
      'En el Plan Profesional el dictado por voz funciona directo en tu computadora o celular: el audio nunca sale de tu equipo. Si preferís guardar copias de tus audios en la nube para escucharlas desde otro dispositivo, podés elegir el Plan Extra (USD 59/mes). El Mega Plan no está disponible por el momento.',
  },
  {
    question: '¿Puedo grabar y transcribir una consulta entera de una hora en el Plan Extra?',
    answer:
      'Sí. Podés grabar consultas completas de 1 hora o más y el sistema transcribe la totalidad de la consulta. En el Plan Extra el respaldo en la nube comprime el audio de forma liviana y cuenta con una cláusula de uso razonable por consultorio de hasta 20 GB activos (más de 1.800 horas de grabación). Tus historias clínicas escritas y evoluciones quedan guardadas siempre sin límite.',
  },
  {
    question: '¿Puedo trabajar en Pesos Uruguayos ($ UYU) y en Dólares (USD) con mis pacientes?',
    answer:
      'Sí. Para tus pacientes y tu caja diaria el sistema viene configurado en Pesos Uruguayos ($ UYU) y podés cambiarlo a USD desde Configuración en presupuestos, cuentas y laboratorio. (La suscripción al sistema sí se abona únicamente en dólares USD).',
  },
  {
    question: '¿Qué pasa si vence mi prueba o suscripción? ¿Pierdo las fichas de mis pacientes?',
    answer:
      'Nunca perdés tus datos. El sistema muestra avisos previos al vencimiento en todos los planes y, si se cumple la fecha, conserva tus historias clínicas, odontogramas y radiografías intactos para que retomes apenas informes tu transferencia en USD.',
  },
  {
    question: '¿Se puede compartir una historia clínica con otro odontólogo o especialista?',
    answer:
      'Sí. Podés generar un enlace privado para enviar por WhatsApp a un colega (endodoncista, cirujano o ortodoncista). Ambos ven y evolucionan el mismo odontograma y ficha clínica, manteniendo tus presupuestos y caja 100% privados.',
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
