import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelReq extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface VercelRes extends ServerResponse {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
}

export interface AuthContext {
  userId: string;
  email: string;
  workspaceId: string;
  fullName: string;
}

export function getSql(): NeonQueryFunction<false, false> {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    throw new Error('DATABASE_URL no está configurada en Vercel.');
  }
  return neon(dbUrl);
}

export function sendJson(res: VercelRes, statusCode: number, data: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json?.(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJsonBody<T = Record<string, unknown>>(req: VercelReq): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.DATABASE_URL ||
    'odontohelper-neon-local-secret'
  ).trim();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signAuthToken(ctx: AuthContext, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const payload = {
    ...ctx,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyNeonToken(token: string): AuthContext | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthContext & {
      exp?: number;
    };
    if (!parsed.userId || !parsed.workspaceId) return null;
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return {
      userId: parsed.userId,
      email: parsed.email || '',
      workspaceId: parsed.workspaceId,
      fullName: parsed.fullName || 'Odontólogo',
    };
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(
  token: string
): Promise<{ userId: string; email: string; fullName: string } | null> {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!supabaseUrl || !anonKey) return null;

  try {
    const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!resp.ok) return null;
    const user = (await resp.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { full_name?: string };
    };
    if (!user.id) return null;
    return {
      userId: user.id,
      email: user.email || '',
      fullName:
        user.user_metadata?.full_name?.trim() ||
        user.email?.split('@')[0] ||
        'Odontólogo',
    };
  } catch {
    return null;
  }
}

export async function ensureWorkspaceProvisioned(
  sql: NeonQueryFunction<false, false>,
  opts: { userId: string; email: string; fullName: string }
): Promise<{
  workspace: Record<string, unknown>;
  profile: Record<string, unknown>;
}> {
  const compactId = opts.userId.replace(/[^a-zA-Z0-9]/g, '');
  const wsId = `ws_${compactId}`;
  const profId = `prof_${compactId}`;
  const cprofId = `cprof_${compactId}`;
  const now = Date.now();
  const displayName = opts.fullName.trim() || opts.email.split('@')[0] || 'Odontólogo';

  const existingProfiles = await sql.query(
    'SELECT * FROM profiles WHERE user_id = $1 LIMIT 1',
    [opts.userId]
  );

  let workspaceId = wsId;
  if (existingProfiles.length > 0) {
    workspaceId = String(existingProfiles[0].workspace_id);
  } else {
    await sql.query(
      `INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        wsId,
        opts.userId,
        `Consultorio ${displayName}`,
        `consultorio-${compactId.slice(0, 8)}`,
        now,
        now,
      ]
    );

    await sql.query(
      `INSERT INTO profiles (id, user_id, workspace_id, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'owner', $5, $6)
       ON CONFLICT (user_id) DO NOTHING`,
      [profId, opts.userId, wsId, displayName, now, now]
    );
  }

  await sql.query(
    `INSERT INTO clinic_professionals (
      id, workspace_id, full_name, specialty, email, role, agenda_color, pin_code, can_view_finance, active, created_at, updated_at
    ) VALUES ($1, $2, $3, 'Odontología General', $4, 'owner', '#0d9488', '1234', true, true, $5, $6)
    ON CONFLICT (id) DO NOTHING`,
    [cprofId, workspaceId, displayName, opts.email || null, now, now]
  );

  await sql.query(
    `INSERT INTO settings (
      id, workspace_id, model_tier, noise_suppression, require_consent,
      auto_transcribe_on_stop, progressive_transcription, transcription_mode, theme, currency, updated_at
    ) VALUES ($1, $2, 'balanced', false, true, false, true, 'dental', 'light', 'UYU', $3)
    ON CONFLICT (workspace_id) DO NOTHING`,
    [`settings_${workspaceId}`, workspaceId, now]
  );

  const wsRows = await sql.query('SELECT * FROM workspaces WHERE id = $1 LIMIT 1', [workspaceId]);
  const profRows = await sql.query('SELECT * FROM profiles WHERE user_id = $1 LIMIT 1', [
    opts.userId,
  ]);

  return {
    workspace: wsRows[0],
    profile: profRows[0],
  };
}

export async function authenticateRequest(req: VercelReq): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  const neonCtx = verifyNeonToken(token);
  if (neonCtx) return neonCtx;

  const supaUser = await verifySupabaseAccessToken(token);
  if (!supaUser) return null;

  const sql = getSql();
  const { workspace, profile } = await ensureWorkspaceProvisioned(sql, supaUser);
  return {
    userId: supaUser.userId,
    email: supaUser.email,
    workspaceId: String(workspace.id),
    fullName: String(profile.full_name || supaUser.fullName),
  };
}
