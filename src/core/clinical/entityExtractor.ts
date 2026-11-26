import { PatientDraftInput, ProviderCategory, ProviderDraftInput } from '../types';
import { extractFdiTeeth } from './clinicalTemplates';

function cleanExtractedValue(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/^[\s:,\-–—.]+/, '')
    .replace(/[\s,.;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpokenEmail(text: string): string {
  // Normalize spoken forms like "maria.gomez arroba gmail punto com"
  const spokenNormalized = text
    .replace(/\s+arroba\s+/gi, '@')
    .replace(/\s+punto\s+/gi, '.')
    .replace(/\s+guion\s+bajo\s+/gi, '_')
    .replace(/\s+guión\s+bajo\s+/gi, '_')
    .replace(/\s+guion\s+/gi, '-')
    .replace(/\s+guión\s+/gi, '-');

  const emailMatch = spokenNormalized.match(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/
  );
  return emailMatch ? emailMatch[0].toLowerCase() : '';
}

function extractPhone(text: string): string {
  const labeled = text.match(
    /(?:tel[eé]fono|cel(?:ular)?|whatsapp|wsp|contacto\s+telef[oó]nico|m[oó]vil)\s*(?:es|:|n[uú]mero)?\s*([+\d][\d\s\-().]{6,20}\d)/i
  );
  if (labeled?.[1]) {
    return cleanExtractedValue(labeled[1]);
  }
  const generic = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:0?\d{2,4}[\s-]?)?\d{3,4}[\s-]?\d{4}\b/);
  return generic ? cleanExtractedValue(generic[0]) : '';
}

function extractDni(text: string): string {
  const labeled = text.match(
    /(?:dni|d\.n\.i\.|c[eé]dula|documento|pasaporte)\s*(?:n[uú]mero|nro\.?|n[°º])?\s*(?:es|:)?\s*([\d.\-\s]{6,14})/i
  );
  if (labeled?.[1]) {
    const compact = labeled[1].replace(/\s+/g, '').replace(/[.-]+$/, '');
    if (compact.replace(/\D/g, '').length >= 6) {
      return compact;
    }
  }
  const dottedDni = text.match(/\b(\d{1,2}\.\d{3}\.\d{3})\b/);
  if (dottedDni?.[1]) return dottedDni[1];
  return '';
}

function extractTaxId(text: string): string {
  const labeled = text.match(
    /(?:cuit|cuil|rut|ruc|nif|cif|identificaci[oó]n\s+fiscal)\s*(?:n[uú]mero|nro\.?|n[°º])?\s*(?:es|:)?\s*([\d.\-\s]{8,16})/i
  );
  if (labeled?.[1]) {
    const compact = labeled[1].replace(/\s+/g, '').replace(/[.-]+$/, '');
    if (compact.replace(/\D/g, '').length >= 8) {
      return compact;
    }
  }
  const cuitPattern = text.match(/\b(\d{2}-\d{7,8}-\d)\b/);
  return cuitPattern?.[1] || '';
}

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

function extractBirthDate(text: string): string {
  // Numeric dd/mm/yyyy or dd-mm-yyyy
  const numeric = text.match(
    /(?:nacimiento|naci[oó]|fecha\s+de\s+nacimiento)?\s*(?:el|:)?\s*\b(\d{1,2})[/-](\d{1,2})[/-](19\d{2}|20\d{2})\b/i
  );
  if (numeric) {
    const dd = numeric[1].padStart(2, '0');
    const mm = numeric[2].padStart(2, '0');
    const yyyy = numeric[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Spoken "12 de mayo de 1988"
  const spoken = text.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de|del)\s+(19\d{2}|20\d{2})\b/i
  );
  if (spoken) {
    const dd = spoken[1].padStart(2, '0');
    const mm = MONTHS_ES[spoken[2].toLowerCase()] || '01';
    const yyyy = spoken[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}

function extractAge(text: string): string {
  const match = text.match(/\b(?:tiene|edad(?:\s+de)?|con)?\s*(\d{1,3})\s+a[nñ]os\b/i);
  if (match?.[1]) {
    const ageNum = Number.parseInt(match[1], 10);
    if (ageNum > 0 && ageNum <= 115) return `${ageNum}`;
  }
  return '';
}

function extractClause(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return match?.[1] ? cleanExtractedValue(match[1]) : '';
}

const STOP_BOUNDARY =
  '(?=\\.|,|;|\\s+(?:dni|d\\.n\\.i|c[eé]dula|documento|tel[eé]fono|cel(?:ular)?|whatsapp|mail|correo|email|domicilio|direcci[oó]n|obra\\s+social|prepaga|afiliado|alergi|antecedente|motivo|edad|fecha|tiene\\s+\\d|cuit|rut|contacto|categor[ií]a|rubro|producto|condici[oó]n|pago|nota)|$)';

const ADDRESS_STOP_BOUNDARY =
  '(?=,|;|\\n|\\.$|\\s+(?:dni|d\\.n\\.i|c[eé]dula|documento|tel[eé]fono|cel(?:ular)?|whatsapp|mail|correo|email|domicilio|direcci[oó]n|obra\\s+social|prepaga|afiliado|alergi|antecedente|motivo|edad|fecha|tiene\\s+\\d|cuit|rut|contacto|categor[ií]a|rubro|producto|condici[oó]n|pago|nota)|$)';

/**
 * Extracts structured patient fields 100% locally from a transcribed voice recording.
 */
export function extractPatientFromTranscript(transcriptText: string): Partial<PatientDraftInput> {
  const text = (transcriptText || '').replace(/\s+/g, ' ').trim();
  if (!text) return {};

  const fullName =
    extractClause(
      text,
      new RegExp(
        `(?:nuevo\\s+paciente|paciente|nombre(?:\\s+y\\s+apellido|\\s+completo)?|se\\s+llama)\\s*(?:es|:)?\\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,4})${STOP_BOUNDARY}`,
        'i'
      )
    ) || '';

  const dni = extractDni(text);
  const birthDate = extractBirthDate(text);
  const age = extractAge(text);
  const phone = extractPhone(text);
  const email = normalizeSpokenEmail(text);

  const address = extractClause(
    text,
    new RegExp(
      `(?:domicilio|direcci[oó]n|vive\\s+en)\\s*(?:es|:)?\\s+([^,;\\n]{3,90}?)${ADDRESS_STOP_BOUNDARY}`,
      'i'
    )
  );

  const insuranceProvider = extractClause(
    text,
    new RegExp(
      `(?:obra\\s+social|prepaga|mutual|cobertura|seguro\\s+m[eé]dico)\\s*(?:es|:)?\\s+([^.,;\\n]{2,50}?)${STOP_BOUNDARY}`,
      'i'
    )
  );

  const insuranceNumber = extractClause(
    text,
    /(?:n[uú]mero\s+de\s+afiliado|afiliado\s*(?:n[uú]mero|nro\.?|n[°º])?|credencial|socio\s*(?:n[°º])?)\s*(?:es|:)?\s*([\w\d\-/.]{4,25})/i
  );

  let allergies = extractClause(
    text,
    new RegExp(
      `(?:alergias?|al[eé]rgic[oa]\\s+a)\\s*(?:es|:)?\\s+([^.;\\n]{2,90}?)${STOP_BOUNDARY}`,
      'i'
    )
  );
  if (!allergies && /\b(?:sin\s+alergias|no\s+refiere\s+alergias|ninguna\s+alergia)\b/i.test(text)) {
    allergies = 'Sin alergias conocidas';
  }

  const medicalHistory = extractClause(
    text,
    new RegExp(
      `(?:antecedentes(?:\\s+m[eé]dicos|\\s+personales)?|patolog[ií]as?|enfermedades?)\\s*(?:es|son|:)?\\s+([^.;\\n]{3,140}?)${STOP_BOUNDARY}`,
      'i'
    )
  );

  const chiefComplaint = extractClause(
    text,
    /(?:motivo\s+de\s+consulta|consulta\s+por|viene\s+por|refiere)\s*(?:es|:)?\s+((?:[^.\n]|\.(?=\d)){3,180})/i
  );

  const teeth = extractFdiTeeth(text);
  const notesParts: string[] = [];
  if (teeth.length > 0) {
    notesParts.push(`Piezas FDI mencionadas: ${teeth.join(', ')}`);
  }
  notesParts.push(`Transcripción original: ${text}`);

  return {
    ...(fullName ? { fullName: toTitleCase(fullName) } : {}),
    ...(dni ? { dni } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(age ? { age } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(insuranceProvider ? { insuranceProvider } : {}),
    ...(insuranceNumber ? { insuranceNumber } : {}),
    ...(allergies ? { allergies } : {}),
    ...(medicalHistory ? { medicalHistory } : {}),
    ...(chiefComplaint ? { chiefComplaint } : {}),
    notes: notesParts.join('\n'),
  };
}

/**
 * Extracts structured provider fields 100% locally from a transcribed voice recording.
 */
export function extractProviderFromTranscript(
  transcriptText: string
): Partial<ProviderDraftInput> {
  const text = (transcriptText || '').replace(/\s+/g, ' ').trim();
  if (!text) return {};

  const name =
    extractClause(
      text,
      new RegExp(
        `(?:nuevo\\s+proveedor|proveedor|raz[oó]n\\s+social|empresa|laboratorio(?:\\s+dental)?|casa\\s+de\\s+insumos)\\s*(?:se\\s+llama|es|:)?\\s+([^.,;\\n]{2,60}?)${STOP_BOUNDARY}`,
        'i'
      )
    ) || '';

  let category: ProviderCategory = 'otro';
  if (/\b(laboratorio|pr[oó]tesis|corona|puente|alineador|f[eé]rula|cer[aá]mica|zirconio)\b/i.test(text)) {
    category = 'laboratorio';
  } else if (/\b(insumos|materiales|implante|composite|anestesia|descartable|guantes|instrumental)\b/i.test(text)) {
    category = 'insumos';
  } else if (/\b(especialista|derivaci[oó]n|ortodoncista|cirujano|endodoncista|periodoncista|radiolog[ií]a|tomograf[ií]a)\b/i.test(text)) {
    category = 'especialista';
  } else if (/\b(mantenimiento|t[eé]cnico|equipo|sill[oó]n|compresor|autoclave|turbina|reparaci[oó]n)\b/i.test(text)) {
    category = 'mantenimiento';
  }

  const contactName = extractClause(
    text,
    new RegExp(
      `(?:contacto|persona\\s+de\\s+contacto|representante|vendedor|hablar\\s+con|atiende)\\s*(?:es|:)?\\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3})${STOP_BOUNDARY}`,
      'i'
    )
  );

  const taxId = extractTaxId(text);
  const phone = extractPhone(text);
  const email = normalizeSpokenEmail(text);

  const address = extractClause(
    text,
    new RegExp(
      `(?:direcci[oó]n|domicilio|ubicado\\s+en|zona|sucursal)\\s*(?:es|:)?\\s+([^,;\\n]{3,90}?)${ADDRESS_STOP_BOUNDARY}`,
      'i'
    )
  );

  const specialtyOrProducts = extractClause(
    text,
    new RegExp(
      `(?:productos?|servicios?|trabajos?|especialidad|provee|entrega)\\s*(?:es|son|de|:)?\\s+([^.;\\n]{3,120}?)${STOP_BOUNDARY}`,
      'i'
    )
  );

  const paymentTerms = extractClause(
    text,
    /(?:condiciones?\s+de\s+pago|forma\s+de\s+pago|pago|alias|cbu|facturaci[oó]n)\s*(?:es|por|:)?\s+([^.;\n]{3,80})/i
  );

  return {
    ...(name ? { name: toTitleCase(name) } : {}),
    category,
    ...(contactName ? { contactName: toTitleCase(contactName) } : {}),
    ...(taxId ? { taxId } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(specialtyOrProducts ? { specialtyOrProducts } : {}),
    ...(paymentTerms ? { paymentTerms } : {}),
    notes: `Transcripción original: ${text}`,
  };
}

export interface ExtractedAppointmentDraft {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMin: number;
  procedure: string;
  matchedText: string;
  timeExplicit: boolean;
}

const WEEKDAYS_MAP_ES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const SPANISH_NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  treinta: 30,
};

const PAST_OR_BIRTH_EXCLUSION_REGEX =
  /\b(nac[ií]|naci[oó]|fecha\s+de\s+nacimiento|cumplea[nñ]os|pasad[oa]|ayer|anteayer|hace\s+\d+\s+(?:d[ií]as|semanas|meses|a[nñ]os))\b/i;

const SCHEDULING_CUE_REGEX =
  /\b(?:turno|cita|agenda(?:r|mos|do|da)?|control|revisi[oó]n|seguimiento|pr[oó]xim[oa]|volv(?:er|emos|e|é|a|amos)|regres(?:ar|a|á|emos)|ven(?:ir|[ií]s|[ií]|g[ao])|pas(?:ar|ás|a|e)|cit(?:ar|amos|o)|quedamos|nos\s+vemos|te\s+espero|segunda\s+sesi[oó]n|retir(?:o|ar)\s+(?:de\s+)?puntos|impresi[oó]n|cementado|obturaci[oó]n\s+definitiva|para\s+el|el\s+d[ií]a|dentro\s+de|que\s+viene)\b/i;

function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysLocal(base: Date, days: number): Date {
  const copy = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonthsLocal(base: Date, months: number): Date {
  const copy = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function parseSpanishCount(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(asInt)) return asInt;
  return SPANISH_NUMBERS[trimmed] || 0;
}

function extractSpokenTime(clause: string): { startTime: string; explicit: boolean } {
  // 1. Numeric "a las 15:30", "a las 9.30", "15:30 hs", "a las 16 horas"
  const numericWithMinutes = clause.match(
    /(?:a\s+las?|a\s+la|desde\s+las?|horario\s+(?:de\s+)?las?|\b)?\s*\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:hs|hrs|horas|de\s+la\s+(?:ma[nñ]ana|tarde|noche))?/i
  );
  if (numericWithMinutes) {
    let hour = Number.parseInt(numericWithMinutes[1], 10);
    const min = numericWithMinutes[2];
    const fullMatch = numericWithMinutes[0].toLowerCase();
    if ((fullMatch.includes('tarde') || fullMatch.includes('noche')) && hour >= 1 && hour <= 11) {
      hour += 12;
    }
    return {
      startTime: `${String(hour).padStart(2, '0')}:${min}`,
      explicit: true,
    };
  }

  // 2. Spoken hour with optional "y media" / "y cuarto" / "menos cuarto" + period
  const spokenHour = clause.match(
    /(?:a\s+las?|a\s+la)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte)(?:\s+(y\s+media|y\s+cuarto|menos\s+cuarto))?(?:\s+(?:hs|hrs|horas))?(?:\s+de\s+la\s+(ma[nñ]ana|tarde|noche))?/i
  );
  if (spokenHour) {
    let hour = parseSpanishCount(spokenHour[1]);
    let mins = '00';
    const modifier = (spokenHour[2] || '').toLowerCase();
    const period = (spokenHour[3] || '').toLowerCase();

    if (modifier.includes('media')) mins = '30';
    else if (modifier.includes('y cuarto')) mins = '15';
    else if (modifier.includes('menos cuarto')) {
      hour = hour > 0 ? hour - 1 : 23;
      mins = '45';
    }

    if ((period === 'tarde' || period === 'noche') && hour >= 1 && hour <= 11) {
      hour += 12;
    }
    if (hour >= 0 && hour <= 23) {
      return {
        startTime: `${String(hour).padStart(2, '0')}:${mins}`,
        explicit: true,
      };
    }
  }

  // 3. Mediodía / Por la mañana / Por la tarde
  if (/\b(?:al\s+)?mediod[ií]a\b/i.test(clause)) {
    return { startTime: '12:00', explicit: true };
  }
  if (/\b(?:por|a|en)\s+la\s+tarde\b/i.test(clause)) {
    return { startTime: '15:00', explicit: false };
  }
  if (/\b(?:por|a|en)\s+la\s+ma[nñ]ana\b/i.test(clause)) {
    return { startTime: '09:30', explicit: false };
  }

  return { startTime: '09:30', explicit: false };
}

function extractAppointmentProcedure(clause: string, fullText: string): string {
  // Look for "para <motivo>" or "control de <motivo>"
  const purposeMatch = clause.match(
    /(?:para(?:\s+hacer|\s+realizar|\s+ver)?|motivo|control\s+de|seguimiento\s+de)\s+([a-záéíóúñ\s.\d]{4,65}?)(?=\s+(?:el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|pr[oó]ximo|\d)|a\s+las?|en\s+\d|dentro\s+de|ma[nñ]ana|pasado)|[,.;\n]|$)/i
  );

  const candidate = purposeMatch?.[1] ? cleanExtractedValue(purposeMatch[1]) : '';
  const cleanedCandidate = candidate
    .replace(/^(?:un|una|el|la|los|las)\s+/i, '')
    .trim();

  if (
    cleanedCandidate.length >= 4 &&
    !/^(?:ese\s+d[ií]a|vernos|entonces|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(
      cleanedCandidate
    )
  ) {
    return cleanedCandidate.charAt(0).toUpperCase() + cleanedCandidate.slice(1);
  }

  const keywordChecks: Array<[RegExp, string]> = [
    [/\bretir(?:o|ar)\s+(?:de\s+)?puntos\b/i, 'Retiro de puntos'],
    [/\b(?:endodoncia|tratamiento\s+de\s+conducto|conducto)\b/i, 'Control / Continuación de endodoncia'],
    [/\bcementado\b/i, 'Cementado definitivo'],
    [/\btoma\s+de\s+impresi[oó]n|impresi[oó]n\b/i, 'Toma de impresión'],
    [/\bcorona|puente|pr[oó]tesis\b/i, 'Control / Prueba de prótesis'],
    [/\blimpieza|profilaxis|tartrectom[ií]a\b/i, 'Limpieza dental / Profilaxis'],
    [/\bobturaci[oó]n|restauraci[oó]n|arregl(?:o|ar)\b/i, 'Restauración / Obturación'],
    [/\bimplante|cirug[ií]a|extracci[oó]n\b/i, 'Control post-quirúrgico'],
    [/\bortodoncia|alineador|brackets\b/i, 'Control de ortodoncia'],
    [/\bcontrol|revisi[oó]n|chequeo\b/i, 'Control odontológico'],
  ];

  for (const [rx, label] of keywordChecks) {
    if (rx.test(clause) || rx.test(fullText)) {
      const teeth = extractFdiTeeth(clause);
      const allTeeth = teeth.length > 0 ? teeth : extractFdiTeeth(fullText);
      return allTeeth.length > 0 ? `${label} (pieza ${allTeeth.join(', ')})` : label;
    }
  }

  const teeth = extractFdiTeeth(fullText);
  return teeth.length > 0
    ? `Control odontológico (pieza ${teeth.join(', ')})`
    : 'Control odontológico';
}

function resolveDateInClause(
  clause: string,
  referenceDate: Date
): { date: string; matchedText: string } | null {
  const hasCue = SCHEDULING_CUE_REGEX.test(clause);

  // 1. Explicit date with Spanish month name: "25 de noviembre", "el 3 de diciembre de 2026"
  const spokenMonthMatch = clause.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(20\d{2}))?\b/i
  );
  if (spokenMonthMatch && (hasCue || /\bpara\s+el\b/i.test(clause))) {
    const day = Number.parseInt(spokenMonthMatch[1], 10);
    const month = Number.parseInt(MONTHS_ES[spokenMonthMatch[2].toLowerCase()], 10) - 1;
    let year = spokenMonthMatch[3]
      ? Number.parseInt(spokenMonthMatch[3], 10)
      : referenceDate.getFullYear();

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      let candidate = new Date(year, month, day, 12, 0, 0);
      if (!spokenMonthMatch[3]) {
        const refMid = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate(),
          12,
          0,
          0
        );
        // If spoken date already passed this year, roll over to next year
        if (candidate.getTime() < refMid.getTime() - 24 * 60 * 60 * 1000) {
          year += 1;
          candidate = new Date(year, month, day, 12, 0, 0);
        }
      }
      return {
        date: formatLocalIsoDate(candidate),
        matchedText: spokenMonthMatch[0],
      };
    }
  }

  // 2. Numeric dd/mm(/yyyy) or dd-mm(-yyyy) — requires scheduling cue so we never confuse phone/IDs
  const numericDateMatch = clause.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/
  );
  if (numericDateMatch && hasCue) {
    const day = Number.parseInt(numericDateMatch[1], 10);
    const month = Number.parseInt(numericDateMatch[2], 10) - 1;
    let year = referenceDate.getFullYear();
    if (numericDateMatch[3]) {
      year =
        numericDateMatch[3].length === 2
          ? 2000 + Number.parseInt(numericDateMatch[3], 10)
          : Number.parseInt(numericDateMatch[3], 10);
    }
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      let candidate = new Date(year, month, day, 12, 0, 0);
      if (!numericDateMatch[3]) {
        const refMid = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate(),
          12,
          0,
          0
        );
        if (candidate.getTime() < refMid.getTime() - 24 * 60 * 60 * 1000) {
          candidate = new Date(year + 1, month, day, 12, 0, 0);
        }
      }
      return {
        date: formatLocalIsoDate(candidate),
        matchedText: numericDateMatch[0],
      };
    }
  }

  // 3. Relative weekdays: "el próximo martes", "martes que viene", "este viernes", "lunes de la semana que viene"
  const weekdayMatch = clause.match(
    /(?:(?:para\s+el|el)\s+)?(?:(pr[oó]xim[oa]|este|siguiente)\s+)?\b(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\b(?:\s+(que\s+viene|pr[oó]xim[oa]|entrante|de\s+la\s+semana\s+que\s+viene))?/i
  );
  if (weekdayMatch) {
    const preMod = (weekdayMatch[1] || '').toLowerCase();
    const dayName = weekdayMatch[2].toLowerCase();
    const postMod = (weekdayMatch[3] || '').toLowerCase();
    const targetWeekday = WEEKDAYS_MAP_ES[dayName];
    if (targetWeekday !== undefined) {
      const currentWeekday = referenceDate.getDay();
      let diff = (targetWeekday - currentWeekday + 7) % 7;
      if (diff === 0) diff = 7;

      const explicitNextWeek =
        postMod.includes('semana que viene') ||
        /\bsemana\s+que\s+viene\b/i.test(clause) ||
        /\bpr[oó]xima\s+semana\b/i.test(clause);

      if (explicitNextWeek && currentWeekday !== 0 && targetWeekday > currentWeekday) {
        diff += 7;
      } else if (
        !preMod.includes('este') &&
        (postMod.includes('que viene') || preMod.includes('próxim') || preMod.includes('proxim')) &&
        diff <= 1
      ) {
        // If today is Sunday and someone says "lunes que viene" (or Monday -> "martes que viene"), keep near vs next? Usually diff=1 when tomorrow, only push +7 if explicit next week.
      }

      const resolved = addDaysLocal(referenceDate, diff);
      return {
        date: formatLocalIsoDate(resolved),
        matchedText: weekdayMatch[0].trim(),
      };
    }
  }

  // 4. Relative day offsets: "en 7 días", "dentro de quince días", "a los 10 días"
  const relDaysMatch = clause.match(
    /\b(?:en|dentro\s+de|a\s+los)\s+(\d{1,3}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)\s+d[ií]as\b/i
  );
  if (relDaysMatch) {
    const count = parseSpanishCount(relDaysMatch[1]);
    if (count > 0 && count <= 365) {
      return {
        date: formatLocalIsoDate(addDaysLocal(referenceDate, count)),
        matchedText: relDaysMatch[0],
      };
    }
  }

  // 5. Relative weeks: "en dos semanas", "dentro de una semana", "la semana que viene"
  const relWeeksMatch = clause.match(
    /\b(?:en|dentro\s+de|a\s+las?)\s+(\d{1,2}|un|una|dos|tres|cuatro|cinco|seis)\s+semanas?\b/i
  );
  if (relWeeksMatch) {
    const weeks = parseSpanishCount(relWeeksMatch[1]);
    if (weeks > 0 && weeks <= 52) {
      return {
        date: formatLocalIsoDate(addDaysLocal(referenceDate, weeks * 7)),
        matchedText: relWeeksMatch[0],
      };
    }
  }
  if (/\b(?:la\s+semana\s+que\s+viene|la\s+pr[oó]xima\s+semana)\b/i.test(clause)) {
    return {
      date: formatLocalIsoDate(addDaysLocal(referenceDate, 7)),
      matchedText: 'la semana que viene',
    };
  }

  // 6. Relative months: "en un mes", "dentro de dos meses", "el mes que viene"
  const relMonthsMatch = clause.match(
    /\b(?:en|dentro\s+de|al)\s+(\d{1,2}|un|uno|dos|tres|cuatro|seis)\s+mes(?:es)?\b/i
  );
  if (relMonthsMatch) {
    const months = parseSpanishCount(relMonthsMatch[1]);
    if (months > 0 && months <= 24) {
      return {
        date: formatLocalIsoDate(addMonthsLocal(referenceDate, months)),
        matchedText: relMonthsMatch[0],
      };
    }
  }
  if (/\b(?:el\s+mes\s+que\s+viene|el\s+pr[oó]ximo\s+mes)\b/i.test(clause)) {
    return {
      date: formatLocalIsoDate(addMonthsLocal(referenceDate, 1)),
      matchedText: 'el mes que viene',
    };
  }

  // 7. "pasado mañana" & "mañana" (excluding "de la mañana" / "por la mañana" / "en la mañana")
  if (/\bpasado\s+ma[nñ]ana\b/i.test(clause)) {
    return {
      date: formatLocalIsoDate(addDaysLocal(referenceDate, 2)),
      matchedText: 'pasado mañana',
    };
  }

  const strippedMorning = clause.replace(/\b(?:de|por|en|a)\s+la\s+ma[nñ]ana\b/gi, '');
  if (/\bma[nñ]ana\b/i.test(strippedMorning)) {
    return {
      date: formatLocalIsoDate(addDaysLocal(referenceDate, 1)),
      matchedText: 'mañana',
    };
  }

  return null;
}

/**
 * Extracts an appointment date, time, and motive from a Spanish consultation transcript.
 * Returns null if no future/scheduled appointment date is detected.
 */
export function extractAppointmentFromTranscript(
  transcriptText: string,
  referenceDate: Date = new Date()
): ExtractedAppointmentDraft | null {
  const clean = (transcriptText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  const clauses = clean
    .split(/(?<=[.!?\n])\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);

  // Scan from the end first because closing remarks in a dental visit usually set the next appointment
  for (let i = clauses.length - 1; i >= 0; i--) {
    const clause = clauses[i];
    if (PAST_OR_BIRTH_EXCLUSION_REGEX.test(clause)) {
      continue;
    }

    const resolvedDate = resolveDateInClause(clause, referenceDate);
    if (!resolvedDate) continue;

    const { startTime, explicit } = extractSpokenTime(clause);
    const procedure = extractAppointmentProcedure(clause, clean);

    return {
      date: resolvedDate.date,
      startTime,
      durationMin: 30,
      procedure,
      matchedText: resolvedDate.matchedText,
      timeExplicit: explicit,
    };
  }

  return null;
}

function toTitleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
