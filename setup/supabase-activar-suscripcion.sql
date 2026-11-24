-- ============================================================================
-- OdontoHelper · Consultas de Administración de Suscripciones (Supabase SQL Editor)
-- ============================================================================
-- Cómo usar este archivo:
--   1. No se ejecuta una sola vez al inicio; guardalo como referencia operativa.
--   2. Cuando un odontólogo informa una transferencia en USD desde la app o por
--      WhatsApp, abrí Supabase -> SQL Editor -> New query y ejecutá el bloque
--      correspondiente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ver solicitudes de transferencia pendientes de aprobación
-- ----------------------------------------------------------------------------
select
  r.id as transfer_request_id,
  r.workspace_id,
  w.name as consultorio,
  u.email as cuenta_email,
  r.requested_tier as plan_solicitado,
  r.billing_cycle as ciclo,
  r.amount_usd as monto_usd,
  r.payer_name as titular_origen,
  r.bank_name as banco,
  r.transfer_reference as comprobante,
  r.status,
  to_timestamp(r.created_at / 1000.0) as fecha_aviso
from public.subscription_transfer_requests r
join public.workspaces w on w.id = r.workspace_id
left join auth.users u on u.id = r.user_id
where r.status = 'pending'
order by r.created_at desc;

-- ----------------------------------------------------------------------------
-- 2. Aprobar una transferencia y activar/renovar el plan del consultorio
-- ----------------------------------------------------------------------------
-- Reemplazá 'REQ_ID_AQUI' por el transfer_request_id de la consulta anterior.
-- Calcula automáticamente:
--   - monthly   -> +30 días
--   - quarterly -> +90 días
--   - annual    -> +365 días
-- Si el plan actual todavía tiene días vigentes del mismo o mayor período, suma
-- desde current_period_end; si estaba en prueba o vencido, arranca desde now().
-- ----------------------------------------------------------------------------
/*
do $$
declare
  v_req_id text := 'REQ_ID_AQUI';
  v_req public.subscription_transfer_requests%rowtype;
  v_sub public.workspace_subscriptions%rowtype;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_day_ms bigint := 86400000;
  v_period_days integer;
  v_base_start_ms bigint;
  v_new_end_ms bigint;
begin
  select * into v_req
  from public.subscription_transfer_requests
  where id = v_req_id
  for update;

  if not found then
    raise exception 'No existe el transfer_request_id: %', v_req_id;
  end if;

  v_period_days := case v_req.billing_cycle
    when 'annual' then 365
    when 'quarterly' then 90
    else 30
  end;

  select * into v_sub
  from public.workspace_subscriptions
  where workspace_id = v_req.workspace_id
  for update;

  v_base_start_ms := greatest(
    v_now_ms,
    coalesce(v_sub.current_period_end, v_now_ms)
  );
  v_new_end_ms := v_base_start_ms + (v_period_days::bigint * v_day_ms);

  update public.subscription_transfer_requests
  set status = 'approved',
      updated_at = v_now_ms
  where id = v_req.id;

  update public.workspace_subscriptions
  set plan_tier = v_req.requested_tier,
      billing_cycle = v_req.billing_cycle,
      status = 'active',
      current_period_start = coalesce(v_sub.current_period_start, v_now_ms),
      current_period_end = v_new_end_ms,
      pending_transfer_id = null,
      notes = concat('Aprobado comprobante ', v_req.transfer_reference, ' (USD ', v_req.amount_usd, ')'),
      updated_at = v_now_ms
  where workspace_id = v_req.workspace_id;
end;
$$;
*/

-- ----------------------------------------------------------------------------
-- 3. Auditar vencimientos próximos y cuentas en prueba de 7 días
-- ----------------------------------------------------------------------------
select
  s.workspace_id,
  w.name as consultorio,
  u.email as cuenta_email,
  s.plan_tier,
  s.billing_cycle,
  s.status,
  case
    when s.plan_tier <> 'trial' and s.status = 'active' and s.current_period_end is null then null
    else to_timestamp(
      case when s.plan_tier = 'trial' then s.trial_ends_at else coalesce(s.current_period_end, s.trial_ends_at) end / 1000.0
    )
  end as vence_el,
  case
    when s.plan_tier <> 'trial' and s.status = 'active' and s.current_period_end is null then null
    else round(
      (
        (case when s.plan_tier = 'trial' then s.trial_ends_at else coalesce(s.current_period_end, s.trial_ends_at) end)
        - (extract(epoch from now()) * 1000)
      ) / 86400000.0,
      1
    )
  end as dias_restantes
from public.workspace_subscriptions s
join public.workspaces w on w.id = s.workspace_id
left join auth.users u on u.id = w.owner_id
order by dias_restantes asc nulls last;

-- ----------------------------------------------------------------------------
-- 4. (Opcional) Otorgar Plan Profesional (base) indefinido en Supabase
-- ----------------------------------------------------------------------------
-- Si además tenés un usuario de prueba en Supabase (por ejemplo Dr. Test),
-- dejá current_period_end = null con plan_tier = 'base' y status = 'active'.
-- ----------------------------------------------------------------------------
/*
update public.workspace_subscriptions s
set plan_tier = 'base',
    billing_cycle = 'annual',
    status = 'active',
    current_period_start = coalesce(s.current_period_start, (extract(epoch from now()) * 1000)::bigint),
    current_period_end = null,
    pending_transfer_id = null,
    notes = 'Plan Profesional indefinido',
    updated_at = (extract(epoch from now()) * 1000)::bigint
from public.workspaces w
left join auth.users u on u.id = w.owner_id
where w.id = s.workspace_id
  and u.email = 'email-de-prueba@ejemplo.com';
*/
