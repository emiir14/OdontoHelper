import crypto from 'node:crypto';
import {
  authenticateRequest,
  ensureWorkspaceProvisioned,
  getSql,
  hashPassword,
  readJsonBody,
  sendJson,
  signAuthToken,
  VercelReq,
  VercelRes,
  verifyPassword,
  verifySupabaseAccessToken,
} from '../_lib/neonAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const ctx = await authenticateRequest(req);
      if (!ctx) {
        return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
      }
      const wsRows = await sql.query('SELECT * FROM workspaces WHERE id = $1 LIMIT 1', [
        ctx.workspaceId,
      ]);
      const profRows = await sql.query('SELECT * FROM profiles WHERE user_id = $1 LIMIT 1', [
        ctx.userId,
      ]);
      if (wsRows.length === 0 || profRows.length === 0) {
        const provisioned = await ensureWorkspaceProvisioned(sql, {
          userId: ctx.userId,
          email: ctx.email,
          fullName: ctx.fullName,
        });
        return sendJson(res, 200, {
          user: { id: ctx.userId, email: ctx.email, fullName: ctx.fullName },
          workspace: provisioned.workspace,
          profile: provisioned.profile,
        });
      }
      return sendJson(res, 200, {
        user: { id: ctx.userId, email: ctx.email, fullName: ctx.fullName },
        workspace: wsRows[0],
        profile: profRows[0],
      });
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const body = await readJsonBody<{
      action?: 'login' | 'signup' | 'supabase-sync';
      email?: string;
      password?: string;
      fullName?: string;
      supabaseAccessToken?: string;
    }>(req);

    if (body.action === 'supabase-sync') {
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const accessToken = (body.supabaseAccessToken || bearer || '').trim();
      if (!accessToken) {
        return sendJson(res, 400, { error: 'Token de Supabase requerido.' });
      }
      const supaUser = await verifySupabaseAccessToken(accessToken);
      if (!supaUser) {
        return sendJson(res, 401, { error: 'Token de Supabase inválido o expirado.' });
      }
      const { workspace, profile } = await ensureWorkspaceProvisioned(sql, supaUser);
      const token = signAuthToken({
        userId: supaUser.userId,
        email: supaUser.email,
        workspaceId: String(workspace.id),
        fullName: String(profile.full_name || supaUser.fullName),
      });
      return sendJson(res, 200, {
        token,
        user: supaUser,
        workspace,
        profile,
      });
    }

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Ingresá un correo electrónico válido.' });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    if (body.action === 'signup') {
      const existing = await sql.query('SELECT id FROM neon_users WHERE email = $1 LIMIT 1', [
        email,
      ]);
      if (existing.length > 0) {
        return sendJson(res, 409, {
          error: 'Ya existe una cuenta registrada con ese correo electrónico.',
        });
      }

      const now = Date.now();
      const userId = `nu_${crypto.randomUUID().replace(/-/g, '')}`;
      const fullName = (body.fullName || '').trim() || email.split('@')[0] || 'Odontólogo';
      const passwordHash = hashPassword(password);

      await sql.query(
        `INSERT INTO neon_users (id, email, password_hash, full_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, email, passwordHash, fullName, now, now]
      );

      const { workspace, profile } = await ensureWorkspaceProvisioned(sql, {
        userId,
        email,
        fullName,
      });

      const token = signAuthToken({
        userId,
        email,
        workspaceId: String(workspace.id),
        fullName,
      });

      return sendJson(res, 201, {
        token,
        user: { id: userId, email, fullName },
        workspace,
        profile,
      });
    }

    if (body.action === 'login') {
      const rows = await sql.query('SELECT * FROM neon_users WHERE email = $1 LIMIT 1', [email]);
      if (rows.length === 0) {
        return sendJson(res, 401, { error: 'Credenciales inválidas.' });
      }
      const userRow = rows[0];
      if (!verifyPassword(password, String(userRow.password_hash))) {
        return sendJson(res, 401, { error: 'Credenciales inválidas.' });
      }

      const userId = String(userRow.id);
      const fullName = String(userRow.full_name || email.split('@')[0]);
      const { workspace, profile } = await ensureWorkspaceProvisioned(sql, {
        userId,
        email,
        fullName,
      });

      const token = signAuthToken({
        userId,
        email,
        workspaceId: String(workspace.id),
        fullName,
      });

      return sendJson(res, 200, {
        token,
        user: { id: userId, email, fullName },
        workspace,
        profile,
      });
    }

    return sendJson(res, 400, { error: 'Acción inválida.' });
  } catch (err: unknown) {
    console.error('[api/auth/neon] error:', err);
    const message = err instanceof Error ? err.message : 'Error interno de autenticación';
    return sendJson(res, 500, { error: message });
  }
}
