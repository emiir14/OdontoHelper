import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Appointment } from '../types';

/**
 * Google Calendar API client using Firebase Auth popup for OAuth tokens.
 * Follows least privilege: requests ONLY `calendar.events` (Sensitive, not Restricted).
 * Access token is strictly cached in memory (never localStorage or sessionStorage).
 */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
] as const;

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

let cachedAccessToken: string | null = null;
let isSigningIn = false;
let authInstance: Auth | null = null;

function getFirebaseAppInstance(): FirebaseApp | null {
  try {
    if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
      return null;
    }
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch {
    return null;
  }
}

function getFirebaseAuthInstance(): Auth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseAppInstance();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}

export function isGoogleCalendarIntegrationAvailable(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      firebaseConfig?.apiKey &&
      firebaseConfig?.projectId &&
      firebaseConfig?.authDomain
  );
}

export function subscribeGoogleCalendarAuthState(
  onConnected: (user: User, token: string) => void,
  onDisconnected: () => void
): () => void {
  const auth = getFirebaseAuthInstance();
  if (!auth) {
    onDisconnected();
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onConnected(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onDisconnected();
    }
  });
}

export async function signInWithGoogleCalendar(): Promise<{
  user: User;
  accessToken: string;
}> {
  const auth = getFirebaseAuthInstance();
  if (!auth) {
    throw new Error('La configuración de Google Calendar no está disponible en este entorno.');
  }
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_CALENDAR_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se recibió token de acceso de Google Calendar.');
    }
    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleCalendar(): Promise<void> {
  cachedAccessToken = null;
  const auth = getFirebaseAuthInstance();
  if (auth) {
    await auth.signOut();
  }
}

export function getGoogleCalendarAccessToken(): string | null {
  return cachedAccessToken;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMin: number;
  htmlLink?: string;
  isAllDay: boolean;
  odontohelperAppointmentId?: string;
}

function getLocalTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Montevideo';
  } catch {
    return 'America/Montevideo';
  }
}

function formatLocalIsoOffset(dateStr: string, timeStr: string, addMinutes = 0): string {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString();
  }
  dt.setMinutes(dt.getMinutes() + addMinutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tzMin = -dt.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const absMin = Math.abs(tzMin);
  const offH = pad(Math.floor(absMin / 60));
  const offM = pad(absMin % 60);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}:00${sign}${offH}:${offM}`;
}

export function buildGoogleCalendarEventBody(
  appt: Appointment,
  timeZone: string = getLocalTimezoneName()
) {
  const duration = Math.max(5, Number(appt.durationMin) || 30);
  const startDateTime = formatLocalIsoOffset(appt.date, appt.startTime, 0);
  const endDateTime = formatLocalIsoOffset(appt.date, appt.startTime, duration);
  const description = [
    `Paciente: ${appt.patientName}`,
    `Tratamiento: ${appt.procedure}`,
    appt.professionalName ? `Profesional: ${appt.professionalName}` : '',
    appt.notes ? `Notas: ${appt.notes}` : '',
    '',
    'Sincronizado desde OdontoHelper',
  ]
    .filter((line, idx, arr) => line !== '' || (idx > 0 && idx < arr.length - 1))
    .join('\n');

  return {
    summary: `OdontoHelper · ${appt.patientName} — ${appt.procedure}`,
    description,
    status: appt.status === 'cancelled' ? 'cancelled' : 'confirmed',
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
    extendedProperties: {
      private: {
        odontohelperAppointmentId: appt.id,
        odontohelperWorkspaceId: appt.workspaceId,
      },
    },
  };
}

interface GoogleEventApiShape {
  id?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export function mapGoogleApiEvent(raw: GoogleEventApiShape): GoogleCalendarEventItem | null {
  if (!raw.id || raw.status === 'cancelled') return null;
  const startDateTime = raw.start?.dateTime;
  const startDateOnly = raw.start?.date;
  const endDateTime = raw.end?.dateTime;
  const endDateOnly = raw.end?.date;
  const startRaw = startDateTime || startDateOnly;
  const endRaw = endDateTime || endDateOnly || startRaw;
  if (!startRaw || !endRaw) return null;

  const isAllDay = Boolean(!startDateTime && startDateOnly);
  let date = startDateOnly || '';
  let startTime = '09:00';
  let durationMin = 60;

  if (startDateTime) {
    const startDt = new Date(startDateTime);
    const endDt = new Date(endDateTime || startDateTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (!Number.isNaN(startDt.getTime())) {
      date = `${startDt.getFullYear()}-${pad(startDt.getMonth() + 1)}-${pad(startDt.getDate())}`;
      startTime = `${pad(startDt.getHours())}:${pad(startDt.getMinutes())}`;
    }
    if (!Number.isNaN(startDt.getTime()) && !Number.isNaN(endDt.getTime())) {
      durationMin = Math.max(15, Math.round((endDt.getTime() - startDt.getTime()) / 60000));
    }
  }

  return {
    id: raw.id,
    summary: raw.summary || '(Sin título en Google Calendar)',
    description: raw.description,
    startIso: startRaw,
    endIso: endRaw,
    date,
    startTime,
    durationMin,
    htmlLink: raw.htmlLink,
    isAllDay,
    odontohelperAppointmentId: raw.extendedProperties?.private?.odontohelperAppointmentId,
  };
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<GoogleCalendarEventItem[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
  });

  const res = await fetch(`${GOOGLE_CALENDAR_API_BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Tu sesión de Google Calendar expiró. Volvé a conectarte.');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`No se pudieron leer eventos de Google Calendar (${res.status}). ${errText}`);
  }

  const data = (await res.json()) as { items?: GoogleEventApiShape[] };
  return (data.items || [])
    .map(mapGoogleApiEvent)
    .filter((item): item is GoogleCalendarEventItem => Boolean(item));
}

export async function upsertAppointmentToGoogleCalendar(
  accessToken: string,
  appt: Appointment
): Promise<{ googleEventId: string; htmlLink?: string; syncedAt: number }> {
  const body = buildGoogleCalendarEventBody(appt);

  if (appt.googleEventId) {
    const patchRes = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(appt.googleEventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (patchRes.status === 401) {
      cachedAccessToken = null;
      throw new Error('Tu sesión de Google Calendar expiró. Volvé a conectarte.');
    }

    if (patchRes.ok) {
      const updated = (await patchRes.json()) as GoogleEventApiShape;
      return {
        googleEventId: updated.id || appt.googleEventId,
        htmlLink: updated.htmlLink,
        syncedAt: Date.now(),
      };
    }

    // If not 404/410, surface error rather than silently duplicating
    if (patchRes.status !== 404 && patchRes.status !== 410) {
      const errText = await patchRes.text().catch(() => '');
      throw new Error(`Error actualizando evento en Google Calendar (${patchRes.status}). ${errText}`);
    }
  }

  const createRes = await fetch(GOOGLE_CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (createRes.status === 401) {
    cachedAccessToken = null;
    throw new Error('Tu sesión de Google Calendar expiró. Volvé a conectarte.');
  }
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`No se pudo crear el evento en Google Calendar (${createRes.status}). ${errText}`);
  }

  const created = (await createRes.json()) as GoogleEventApiShape;
  if (!created.id) {
    throw new Error('Google Calendar no devolvió ID de evento.');
  }

  return {
    googleEventId: created.id,
    htmlLink: created.htmlLink,
    syncedAt: Date.now(),
  };
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Tu sesión de Google Calendar expiró. Volvé a conectarte.');
  }
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errText = await res.text().catch(() => '');
    throw new Error(`No se pudo eliminar el evento de Google Calendar (${res.status}). ${errText}`);
  }
}
