import {
  authenticateRequest,
  getSql,
  readJsonBody,
  sendJson,
  VercelReq,
  VercelRes,
} from '../_lib/neonAuth';

type TableKey =
  | 'sessions'
  | 'transcript_segments'
  | 'settings'
  | 'glossary'
  | 'patients'
  | 'providers'
  | 'appointments'
  | 'activity_logs'
  | 'clinic_professionals'
  | 'clinical_evolutions'
  | 'odontograms'
  | 'periodontograms'
  | 'treatment_plans'
  | 'financial_transactions'
  | 'lab_orders';

interface TableSpec {
  columns: readonly string[];
  jsonColumns?: readonly string[];
  softDelete: boolean;
  workspaceScoped: boolean;
  orderBy: string;
}

const TABLE_SPECS: Record<TableKey, TableSpec> = {
  sessions: {
    columns: [
      'id',
      'workspace_id',
      'title',
      'reference',
      'patient_id',
      'intake_target',
      'status',
      'duration_sec',
      'consent_given',
      'model_tier_used',
      'audio_deleted',
      'clinical_note',
      'error',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    jsonColumns: ['clinical_note'],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  transcript_segments: {
    columns: [
      'id',
      'session_id',
      'start_sec',
      'end_sec',
      'text',
      'original_text',
      'speaker',
      'edited',
      'created_at',
      'updated_at',
    ],
    softDelete: false,
    workspaceScoped: false,
    orderBy: 'start_sec ASC',
  },
  settings: {
    columns: [
      'id',
      'workspace_id',
      'model_tier',
      'noise_suppression',
      'selected_audio_device_id',
      'require_consent',
      'auto_transcribe_on_stop',
      'progressive_transcription',
      'transcription_mode',
      'theme',
      'currency',
      'updated_at',
    ],
    softDelete: false,
    workspaceScoped: true,
    orderBy: 'updated_at DESC',
  },
  glossary: {
    columns: ['id', 'workspace_id', 'incorrect', 'correct', 'created_at', 'updated_at'],
    softDelete: false,
    workspaceScoped: true,
    orderBy: 'incorrect ASC',
  },
  patients: {
    columns: [
      'id',
      'workspace_id',
      'full_name',
      'dni',
      'birth_date',
      'age',
      'phone',
      'email',
      'address',
      'insurance_provider',
      'insurance_number',
      'allergies',
      'medical_history',
      'chief_complaint',
      'notes',
      'anamnesis',
      'source_session_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    jsonColumns: ['anamnesis'],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'updated_at DESC',
  },
  providers: {
    columns: [
      'id',
      'workspace_id',
      'name',
      'category',
      'contact_name',
      'tax_id',
      'phone',
      'email',
      'address',
      'specialty_or_products',
      'payment_terms',
      'notes',
      'source_session_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'updated_at DESC',
  },
  appointments: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'patient_name',
      'provider_id',
      'provider_name',
      'professional_id',
      'professional_name',
      'date',
      'start_time',
      'duration_min',
      'procedure',
      'status',
      'notes',
      'source_session_id',
      'auto_captured',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'date ASC, start_time ASC',
  },
  activity_logs: {
    columns: [
      'id',
      'workspace_id',
      'action_type',
      'entity_type',
      'entity_id',
      'summary',
      'details',
      'created_at',
    ],
    softDelete: false,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  clinic_professionals: {
    columns: [
      'id',
      'workspace_id',
      'full_name',
      'specialty',
      'license_number',
      'email',
      'phone',
      'role',
      'agenda_color',
      'pin_code',
      'can_view_finance',
      'active',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at ASC',
  },
  clinical_evolutions: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'date',
      'tooth_fdi',
      'procedure',
      'description',
      'highlight_color',
      'professional_id',
      'professional_name',
      'signed_with_pin',
      'signed_at',
      'source_session_id',
      'source_treatment_plan_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  odontograms: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'label',
      'dentition',
      'teeth',
      'notes',
      'created_by',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    jsonColumns: ['teeth'],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  periodontograms: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'label',
      'teeth',
      'notes',
      'created_by',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    jsonColumns: ['teeth'],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  treatment_plans: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'patient_name',
      'title',
      'currency',
      'status',
      'professional_id',
      'professional_name',
      'items',
      'notes',
      'valid_until',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    jsonColumns: ['items'],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  financial_transactions: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'patient_name',
      'type',
      'currency',
      'amount',
      'payment_method',
      'concept',
      'date',
      'professional_id',
      'professional_name',
      'receipt_number',
      'source_treatment_plan_id',
      'source_treatment_item_id',
      'notes',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
  lab_orders: {
    columns: [
      'id',
      'workspace_id',
      'patient_id',
      'patient_name',
      'provider_id',
      'provider_name',
      'work_type',
      'tooth_fdi',
      'shade',
      'sent_date',
      'due_date',
      'received_date',
      'cost',
      'currency',
      'status',
      'notes',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    softDelete: true,
    workspaceScoped: true,
    orderBy: 'created_at DESC',
  },
};

function isValidTable(name: string): name is TableKey {
  return Object.prototype.hasOwnProperty.call(TABLE_SPECS, name);
}

function getQueryParam(req: VercelReq, key: string): string {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery) && fromQuery[0]) return fromQuery[0];
  try {
    const parsed = new URL(req.url || '', 'http://localhost');
    return parsed.searchParams.get(key) || '';
  } catch {
    return '';
  }
}

function serializeValue(spec: TableSpec, col: string, val: unknown): unknown {
  if (val === undefined) return null;
  if (val === null) return null;
  if (spec.jsonColumns?.includes(col)) {
    return JSON.stringify(val);
  }
  return val;
}

let currencySchemaEnsured = false;

async function ensureCurrencySchema(sql: ReturnType<typeof getSql>): Promise<void> {
  if (currencySchemaEnsured) return;
  try {
    await sql.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UYU'`);
    await sql.query(`ALTER TABLE treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_currency_check`);
    await sql.query(`ALTER TABLE treatment_plans ALTER COLUMN currency SET DEFAULT 'UYU'`);
    await sql.query(`ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_currency_check`);
    await sql.query(`ALTER TABLE financial_transactions ALTER COLUMN currency SET DEFAULT 'UYU'`);
    await sql.query(`ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_currency_check`);
    await sql.query(`ALTER TABLE lab_orders ALTER COLUMN currency SET DEFAULT 'UYU'`);
    currencySchemaEnsured = true;
  } catch {
    // Non-fatal if privileges or older schema differ
  }
}

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx) {
      return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
    }

    const sql = getSql();
    await ensureCurrencySchema(sql);

    if (req.method === 'GET') {
      const entity = getQueryParam(req, 'entity');
      if (!isValidTable(entity)) {
        return sendJson(res, 400, { error: 'Entidad inválida.' });
      }
      const spec = TABLE_SPECS[entity];

      if (entity === 'transcript_segments') {
        const sessionId = getQueryParam(req, 'sessionId');
        if (!sessionId) return sendJson(res, 400, { error: 'sessionId requerido.' });
        const rows = await sql.query(
          `SELECT ts.* FROM transcript_segments ts
           INNER JOIN sessions s ON s.id = ts.session_id
           WHERE ts.session_id = $1 AND s.workspace_id = $2
           ORDER BY ts.start_sec ASC`,
          [sessionId, ctx.workspaceId]
        );
        return sendJson(res, 200, { rows });
      }

      const id = getQueryParam(req, 'id');
      if (id) {
        const softClause = spec.softDelete ? 'AND deleted_at IS NULL' : '';
        const rows = await sql.query(
          `SELECT * FROM ${entity} WHERE id = $1 AND workspace_id = $2 ${softClause} LIMIT 1`,
          [id, ctx.workspaceId]
        );
        return sendJson(res, 200, { row: rows[0] || null });
      }

      if (entity === 'sessions' && getQueryParam(req, 'unclosed') === '1') {
        const rows = await sql.query(
          `SELECT * FROM sessions
           WHERE workspace_id = $1 AND status = 'recording' AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [ctx.workspaceId]
        );
        return sendJson(res, 200, { row: rows[0] || null });
      }

      const limitParam = Number(getQueryParam(req, 'limit') || 0);
      const limitClause = limitParam > 0 && limitParam <= 1000 ? `LIMIT ${Math.floor(limitParam)}` : '';
      const softClause = spec.softDelete ? 'AND deleted_at IS NULL' : '';
      const rows = await sql.query(
        `SELECT * FROM ${entity} WHERE workspace_id = $1 ${softClause} ORDER BY ${spec.orderBy} ${limitClause}`,
        [ctx.workspaceId]
      );
      return sendJson(res, 200, { rows });
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const body = await readJsonBody<{
      entity?: string;
      op?: 'upsert' | 'update' | 'delete' | 'deleteBySessionId' | 'clear';
      id?: string;
      sessionId?: string;
      row?: Record<string, unknown>;
      rows?: Record<string, unknown>[];
      patch?: Record<string, unknown>;
    }>(req);

    const entity = body.entity || '';
    if (!isValidTable(entity)) {
      return sendJson(res, 400, { error: 'Entidad inválida.' });
    }
    const spec = TABLE_SPECS[entity];

    if (body.op === 'clear' && entity === 'activity_logs') {
      await sql.query('DELETE FROM activity_logs WHERE workspace_id = $1', [ctx.workspaceId]);
      return sendJson(res, 200, { ok: true });
    }

    if (body.op === 'deleteBySessionId' && entity === 'transcript_segments') {
      if (!body.sessionId) return sendJson(res, 400, { error: 'sessionId requerido.' });
      await sql.query(
        `DELETE FROM transcript_segments ts
         USING sessions s
         WHERE ts.session_id = s.id AND ts.session_id = $1 AND s.workspace_id = $2`,
        [body.sessionId, ctx.workspaceId]
      );
      return sendJson(res, 200, { ok: true });
    }

    if (body.op === 'delete') {
      if (!body.id) return sendJson(res, 400, { error: 'id requerido.' });
      if (entity === 'transcript_segments') {
        await sql.query(
          `DELETE FROM transcript_segments ts
           USING sessions s
           WHERE ts.session_id = s.id AND ts.id = $1 AND s.workspace_id = $2`,
          [body.id, ctx.workspaceId]
        );
      } else if (spec.softDelete) {
        const now = Date.now();
        await sql.query(
          `UPDATE ${entity} SET deleted_at = $1, updated_at = $2 WHERE id = $3 AND workspace_id = $4`,
          [now, now, body.id, ctx.workspaceId]
        );
      } else {
        await sql.query(`DELETE FROM ${entity} WHERE id = $1 AND workspace_id = $2`, [
          body.id,
          ctx.workspaceId,
        ]);
      }
      return sendJson(res, 200, { ok: true });
    }

    if (body.op === 'update') {
      if (!body.id || !body.patch) {
        return sendJson(res, 400, { error: 'id y patch requeridos.' });
      }
      const allowedCols = spec.columns.filter(
        (c) => c !== 'id' && c !== 'workspace_id' && c !== 'session_id'
      );
      const entries = Object.entries(body.patch).filter(([col]) => allowedCols.includes(col));
      if (entries.length === 0) {
        return sendJson(res, 200, { ok: true });
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;

      for (const [col, val] of entries) {
        const castSuffix = spec.jsonColumns?.includes(col) ? '::jsonb' : '';
        setClauses.push(`${col} = $${paramIdx}${castSuffix}`);
        values.push(serializeValue(spec, col, val));
        paramIdx++;
      }

      if (entity === 'transcript_segments') {
        values.push(body.id, ctx.workspaceId);
        await sql.query(
          `UPDATE transcript_segments ts
           SET ${setClauses.join(', ')}
           FROM sessions s
           WHERE ts.session_id = s.id AND ts.id = $${paramIdx} AND s.workspace_id = $${paramIdx + 1}`,
          values
        );
      } else {
        values.push(body.id, ctx.workspaceId);
        await sql.query(
          `UPDATE ${entity}
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIdx} AND workspace_id = $${paramIdx + 1}`,
          values
        );
      }

      return sendJson(res, 200, { ok: true });
    }

    if (body.op === 'upsert') {
      const items = body.rows || (body.row ? [body.row] : []);
      if (items.length === 0) return sendJson(res, 200, { ok: true });

      if (entity === 'transcript_segments') {
        const sessionIds = Array.from(
          new Set(items.map((item) => String(item.session_id || '')).filter(Boolean))
        );
        for (const sid of sessionIds) {
          const check = await sql.query(
            'SELECT id FROM sessions WHERE id = $1 AND workspace_id = $2 LIMIT 1',
            [sid, ctx.workspaceId]
          );
          if (check.length === 0) {
            return sendJson(res, 403, { error: 'Sesión fuera de tu consultorio.' });
          }
        }
      }

      const cols = spec.columns;
      const updateCols = cols.filter((c) => c !== 'id' && c !== 'workspace_id');
      const updateSql = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

      for (const rawItem of items) {
        const item = { ...rawItem };
        if (spec.workspaceScoped) {
          item.workspace_id = ctx.workspaceId;
        }
        const placeholders = cols.map((col, idx) =>
          spec.jsonColumns?.includes(col) ? `$${idx + 1}::jsonb` : `$${idx + 1}`
        );
        const values = cols.map((col) => serializeValue(spec, col, item[col]));
        await sql.query(
          `INSERT INTO ${entity} (${cols.join(', ')})
           VALUES (${placeholders.join(', ')})
           ON CONFLICT (id) DO UPDATE SET ${updateSql}`,
          values
        );
      }

      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: 'Operación inválida.' });
  } catch (err: unknown) {
    console.error('[api/neon/records] error:', err);
    const message = err instanceof Error ? err.message : 'Error en base de datos Neon';
    return sendJson(res, 500, { error: message });
  }
}
