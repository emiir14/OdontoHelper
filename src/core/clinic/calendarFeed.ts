import type { Appointment } from '../types';

export const CALENDAR_FEED_TOKEN_PREFIX = 'ohcal_';

export function generateCalendarFeedToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${CALENDAR_FEED_TOKEN_PREFIX}${hex}`;
}

export function isValidCalendarFeedToken(token: string | undefined | null): token is string {
  if (!token) return false;
  return /^[a-zA-Z0-9_-]{24,128}$/.test(token.trim());
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function toUtcIcsTimestamp(ms: number): string {
  const dt = new Date(Number.isFinite(ms) ? ms : Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(
    dt.getUTCHours()
  )}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

function appointmentToUtcRange(dateStr: string, timeStr: string, durationMin: number): {
  dtStart: string;
  dtEnd: string;
} {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  if (Number.isNaN(dt.getTime())) {
    return { dtStart: '20260101T090000Z', dtEnd: '20260101T093000Z' };
  }
  const startMs = dt.getTime();
  const endMs = startMs + Math.max(5, durationMin || 30) * 60 * 1000;
  return {
    dtStart: toUtcIcsTimestamp(startMs),
    dtEnd: toUtcIcsTimestamp(endMs),
  };
}

export interface CalendarFeedRowLike {
  id: string;
  patientName: string;
  procedure: string;
  date: string;
  startTime: string;
  durationMin: number;
  status: string;
  professionalName?: string;
  notes?: string;
  updatedAt?: number;
  deletedAt?: number | null;
}

export function buildWorkspaceCalendarFeedIcs(
  appointments: CalendarFeedRowLike[],
  clinicName = 'OdontoHelper'
): string {
  const active = appointments
    .filter((a) => !a.deletedAt && Boolean(a.date))
    .slice()
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OdontoHelper//Agenda Odontologica//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${clinicName} · Agenda`)}`,
    'X-WR-TIMEZONE:America/Montevideo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  const nowStamp = toUtcIcsTimestamp(Date.now());

  for (const appt of active) {
    const { dtStart, dtEnd } = appointmentToUtcRange(appt.date, appt.startTime, appt.durationMin);
    const updatedStamp = appt.updatedAt ? toUtcIcsTimestamp(appt.updatedAt) : nowStamp;
    const summary = `${appt.patientName} — ${appt.procedure}`;
    const descParts = [
      `Paciente: ${appt.patientName}`,
      `Tratamiento: ${appt.procedure}`,
      `Estado: ${appt.status}`,
      appt.professionalName ? `Profesional: ${appt.professionalName}` : '',
      appt.notes ? `Notas: ${appt.notes}` : '',
    ].filter(Boolean);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${appt.id}@odontohelper.local`);
    lines.push(`DTSTAMP:${updatedStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
    lines.push(`STATUS:${appt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildCalendarFeedUrls(
  origin: string,
  feedToken: string
): {
  httpsUrl: string;
  webcalUrl: string;
  googleSubscribeUrl: string;
} {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const httpsUrl = `${cleanOrigin}/api/agenda-feed.ics?token=${encodeURIComponent(feedToken)}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//i, 'webcal://');
  const googleSubscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
  return { httpsUrl, webcalUrl, googleSubscribeUrl };
}

export function downloadWorkspaceCalendarIcs(
  appointments: Appointment[],
  clinicName = 'OdontoHelper'
): void {
  const ics = buildWorkspaceCalendarFeedIcs(appointments, clinicName);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `odontohelper-agenda-completa.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
