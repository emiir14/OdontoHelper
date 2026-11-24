import { describe, expect, it } from 'vitest';
import {
  buildCalendarFeedUrls,
  buildWorkspaceCalendarFeedIcs,
  generateCalendarFeedToken,
  isValidCalendarFeedToken,
} from '../src/core/clinic/calendarFeed';
import {
  GOOGLE_CALENDAR_SCOPES,
  buildGoogleCalendarEventBody,
  mapGoogleApiEvent,
} from '../src/core/calendar/googleCalendarClient';
import { Appointment } from '../src/core/types';

describe('Apple Calendar webcal:// Feed & iCal Generator', () => {
  it('generates valid high-entropy calendar feed tokens and builds webcal/https URLs', () => {
    const token = generateCalendarFeedToken();
    expect(token.startsWith('ohcal_')).toBe(true);
    expect(isValidCalendarFeedToken(token)).toBe(true);
    expect(isValidCalendarFeedToken('short')).toBe(false);
    expect(isValidCalendarFeedToken('bad token with spaces!')).toBe(false);

    const urls = buildCalendarFeedUrls('https://odontohelper.com.uy/', token);
    expect(urls.httpsUrl).toBe(`https://odontohelper.com.uy/api/agenda-feed.ics?token=${token}`);
    expect(urls.webcalUrl).toBe(`webcal://odontohelper.com.uy/api/agenda-feed.ics?token=${token}`);
    expect(urls.googleSubscribeUrl).toContain('https://calendar.google.com/calendar/r?cid=');
  });

  it('serializes active and cancelled appointments into RFC 5545 VCALENDAR with proper escaping', () => {
    const ics = buildWorkspaceCalendarFeedIcs(
      [
        {
          id: 'appt_2',
          patientName: 'Pérez, Juan',
          procedure: 'Endodoncia; pieza 36',
          date: '2026-12-01',
          startTime: '15:30',
          durationMin: 45,
          status: 'confirmed',
          professionalName: 'Dra. Gómez',
          notes: 'Traer radiografía\nConfirmado',
          updatedAt: 1764000000000,
        },
        {
          id: 'appt_1',
          patientName: 'López, Ana',
          procedure: 'Limpieza',
          date: '2026-11-30',
          startTime: '09:00',
          durationMin: 30,
          status: 'cancelled',
        },
        {
          id: 'appt_deleted',
          patientName: 'Borrado',
          procedure: 'Nada',
          date: '2026-11-29',
          startTime: '10:00',
          durationMin: 30,
          status: 'confirmed',
          deletedAt: 1764000000000,
        },
      ],
      'Clínica Montevideo'
    );

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('X-WR-CALNAME:Clínica Montevideo · Agenda');
    expect(ics).toContain('UID:appt_1@odontohelper.local');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('UID:appt_2@odontohelper.local');
    expect(ics).toContain('SUMMARY:Pérez\\, Juan — Endodoncia\\; pieza 36');
    expect(ics).toContain('Traer radiografía\\nConfirmado');
    expect(ics).not.toContain('appt_deleted');
    // Chronological order: appt_1 before appt_2
    expect(ics.indexOf('appt_1')).toBeLessThan(ics.indexOf('appt_2'));
  });
});

describe('Google Calendar API Adapter & Least-Privilege Scope', () => {
  it('requests strictly the sensitive calendar.events scope (no restricted Gmail/Drive scopes)', () => {
    expect(GOOGLE_CALENDAR_SCOPES).toEqual(['https://www.googleapis.com/auth/calendar.events']);
  });

  it('builds Google Calendar event payloads and parses API events cleanly', () => {
    const appt: Appointment = {
      id: 'appt_g1',
      workspaceId: 'ws_demo',
      patientName: 'Sofía Martínez',
      procedure: 'Control de brackets',
      professionalName: 'Dr. Martín Silva',
      date: '2026-12-05',
      startTime: '10:15',
      durationMin: 30,
      status: 'confirmed',
      notes: 'Arco superior',
      createdAt: 1764000000000,
      updatedAt: 1764000000000,
    };

    const payload = buildGoogleCalendarEventBody(appt, 'America/Montevideo');
    expect(payload.summary).toBe('OdontoHelper · Sofía Martínez — Control de brackets');
    expect(payload.start.timeZone).toBe('America/Montevideo');
    expect(payload.extendedProperties.private.odontohelperAppointmentId).toBe('appt_g1');

    const mapped = mapGoogleApiEvent({
      id: 'gcal_evt_99',
      summary: 'Bloqueo personal',
      start: { dateTime: '2026-12-05T14:00:00-03:00' },
      end: { dateTime: '2026-12-05T15:00:00-03:00' },
      htmlLink: 'https://calendar.google.com/event?eid=99',
    });
    expect(mapped).not.toBeNull();
    expect(mapped?.durationMin).toBe(60);
    expect(mapped?.isAllDay).toBe(false);
    expect(mapped?.id).toBe('gcal_evt_99');

    const cancelled = mapGoogleApiEvent({ id: 'gcal_c', status: 'cancelled' });
    expect(cancelled).toBeNull();
  });
});
