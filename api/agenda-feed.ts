import {
  buildWorkspaceCalendarFeedIcs,
  CalendarFeedRowLike,
  isValidCalendarFeedToken,
} from '../src/core/clinic/calendarFeed';

interface VercelReq {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

interface VercelRes {
  status: (code: number) => VercelRes;
  send: (body: string) => void;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

interface FeedRpcPayload {
  clinicName?: string;
  appointments?: Array<{
    id: string;
    patientName: string;
    procedure: string;
    date: string;
    startTime: string;
    durationMin: number;
    status: string;
    professionalName?: string | null;
    notes?: string | null;
    updatedAt?: number | null;
  }>;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawToken = Array.isArray(req.query?.token) ? req.query?.token[0] : req.query?.token;
  const token = (rawToken || '').trim();
  if (!isValidCalendarFeedToken(token)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(401).json({ error: 'Token de calendario inválido o faltante.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseAnonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(503).json({
      error: 'El servidor no tiene configurada la conexión a Supabase para feeds externos.',
    });
  }

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_calendar_feed_appointments`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_feed_token: token }),
    });

    if (!rpcRes.ok) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(502).json({ error: 'No se pudo consultar la agenda en Supabase.' });
    }

    const payload = (await rpcRes.json()) as FeedRpcPayload | null;
    if (!payload) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: 'Enlace de calendario no encontrado o revocado.' });
    }

    const rows: CalendarFeedRowLike[] = (payload.appointments || []).map((a) => ({
      id: a.id,
      patientName: a.patientName,
      procedure: a.procedure,
      date: a.date,
      startTime: a.startTime,
      durationMin: a.durationMin,
      status: a.status,
      professionalName: a.professionalName ?? undefined,
      notes: a.notes ?? undefined,
      updatedAt: a.updatedAt ?? undefined,
    }));

    const ics = buildWorkspaceCalendarFeedIcs(rows, payload.clinicName || 'OdontoHelper');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="odontohelper-agenda.ics"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    if (method === 'HEAD') {
      res.status(200).end();
      return;
    }

    return res.status(200).send(ics);
  } catch {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: 'Error interno al generar el calendario iCal.' });
  }
}
