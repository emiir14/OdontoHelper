import { sendJson, VercelReq, VercelRes } from './_lib/neonAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const neonConfigured = Boolean((process.env.DATABASE_URL || '').trim());
  const supabaseConfigured = Boolean(
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim() &&
      (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
  );

  return sendJson(res, 200, {
    ok: true,
    neonConfigured,
    supabaseConfigured,
    dbProvider:
      (process.env.VITE_DB_PROVIDER || '').trim() ||
      (supabaseConfigured ? 'supabase' : neonConfigured ? 'neon' : 'local'),
  });
}
