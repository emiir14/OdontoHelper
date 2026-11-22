-- ============================================================================
-- OdontoHelper · Esquema SQL para Supabase (PostgreSQL + RLS + Auth)
-- ============================================================================
-- IMPORTANTE:
--   - Solo los datos estructurados (historias clínicas, pacientes, proveedores,
--     turnos/agenda, glosario, ajustes, metadatos y transcripciones en texto)
--     se almacenan en Supabase.
--   - El audio PCM crudo y la inferencia/pesos del modelo Whisper permanecen
--     100% en el navegador local del usuario (IndexedDB + Cache Storage).
--
-- Instrucciones:
--   1. Abrí tu proyecto en Supabase -> SQL Editor -> New query.
--   2. Pegá y ejecutá este archivo completo.
--   3. Configurá en Vercel las variables:
--        VITE_SUPABASE_URL
--        VITE_SUPABASE_ANON_KEY
-- ============================================================================

-- 1. Espacios de trabajo / Consultorios
create table if not exists public.workspaces (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 2. Perfiles de usuario vinculados a Supabase Auth
create table if not exists public.profiles (
  id text primary key,
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  role text not null default 'owner' check (role in ('owner', 'dentist', 'assistant')),
  created_at bigint not null,
  updated_at bigint not null
);

-- 3. Pacientes (incluye cuestionario anamnesis JSONB)
create table if not exists public.patients (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  dni text,
  birth_date text,
  age text,
  phone text,
  email text,
  address text,
  insurance_provider text,
  insurance_number text,
  allergies text,
  medical_history text,
  chief_complaint text,
  notes text,
  anamnesis jsonb,
  source_session_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.patients add column if not exists anamnesis jsonb;

-- 4. Proveedores, laboratorios y especialistas
create table if not exists public.providers (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null default 'otro' check (category in ('laboratorio', 'insumos', 'especialista', 'mantenimiento', 'otro')),
  contact_name text,
  tax_id text,
  phone text,
  email text,
  address text,
  specialty_or_products text,
  payment_terms text,
  notes text,
  source_session_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 5. Sesiones / Consultas clínicas (SIN audio; solo metadatos + ficha clínica)
create table if not exists public.sessions (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  title text not null,
  reference text,
  patient_id text,
  intake_target text check (intake_target in ('consultation', 'patient', 'provider')),
  status text not null default 'recorded' check (status in ('recording', 'recorded', 'transcribing', 'completed', 'error')),
  duration_sec double precision not null default 0,
  consent_given boolean not null default true,
  model_tier_used text,
  audio_deleted boolean not null default false,
  audio_file_name text,
  recorded_device_id text,
  recorded_device_label text,
  audio_cloud_status text not null default 'local_only',
  clinical_note jsonb,
  error text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.sessions add column if not exists audio_file_name text;
alter table public.sessions add column if not exists recorded_device_id text;
alter table public.sessions add column if not exists recorded_device_label text;
alter table public.sessions add column if not exists audio_cloud_status text not null default 'local_only';

-- 6. Segmentos de transcripción en texto
create table if not exists public.transcript_segments (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  start_sec double precision not null,
  end_sec double precision not null,
  text text not null,
  original_text text not null,
  speaker text,
  edited boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

-- 7. Agenda y turnos odontológicos (con sala de espera y profesional asignado)
create table if not exists public.appointments (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text,
  patient_name text not null,
  provider_id text,
  provider_name text,
  professional_id text,
  professional_name text,
  date text not null,
  start_time text not null,
  duration_min integer not null default 30,
  procedure text not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled')),
  notes text,
  source_session_id text,
  auto_captured boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.appointments add column if not exists professional_id text;
alter table public.appointments add column if not exists professional_name text;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('pending', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled'));

-- 8. Perfil del profesional del consultorio
create table if not exists public.clinic_professionals (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  specialty text,
  license_number text,
  email text,
  phone text,
  role text not null default 'odontologo' check (role in ('owner', 'odontologo', 'secretaria', 'asistente')),
  agenda_color text not null default '#0d9488',
  can_view_finance boolean not null default true,
  active boolean not null default true,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.clinic_professionals drop column if exists pin_code;

-- 9. Evoluciones clínicas cronológicas (con etiquetas de color)
create table if not exists public.clinical_evolutions (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  date text not null,
  tooth_fdi text,
  procedure text not null,
  description text not null,
  highlight_color text not null default 'default' check (highlight_color in ('default', 'teal', 'amber', 'rose', 'blue')),
  professional_id text,
  professional_name text,
  source_session_id text,
  source_treatment_plan_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.clinical_evolutions drop column if exists signed_with_pin;
alter table public.clinical_evolutions drop column if exists signed_at;
alter table public.clinical_evolutions add column if not exists author_user_id uuid default auth.uid();
alter table public.clinical_evolutions add column if not exists author_workspace_id text;

-- 10. Odontogramas (múltiples mediciones históricas por paciente)
create table if not exists public.odontograms (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  label text not null,
  dentition text not null default 'adulto' check (dentition in ('adulto', 'mixto')),
  teeth jsonb not null default '{}'::jsonb,
  notes text,
  created_by text,
  author_user_id uuid default auth.uid(),
  author_workspace_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.odontograms add column if not exists author_user_id uuid default auth.uid();
alter table public.odontograms add column if not exists author_workspace_id text;

-- 11. Periodontogramas (mediciones periodontales por pieza)
create table if not exists public.periodontograms (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  label text not null,
  teeth jsonb not null default '{}'::jsonb,
  notes text,
  created_by text,
  author_user_id uuid default auth.uid(),
  author_workspace_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

alter table public.periodontograms add column if not exists author_user_id uuid default auth.uid();
alter table public.periodontograms add column if not exists author_workspace_id text;

-- 12. Presupuestos y planes de tratamiento
create table if not exists public.treatment_plans (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  patient_name text not null,
  title text not null,
  currency text not null default 'UYU',
  status text not null default 'presentado' check (status in ('borrador', 'presentado', 'aprobado', 'en_curso', 'finalizado')),
  professional_id text,
  professional_name text,
  items jsonb not null default '[]'::jsonb,
  notes text,
  valid_until text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 13. Cuenta corriente de pacientes y Caja diaria (movimientos financieros en moneda configurada)
create table if not exists public.financial_transactions (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text,
  patient_name text,
  type text not null check (type in ('charge', 'payment', 'expense')),
  currency text not null default 'UYU',
  amount double precision not null default 0,
  payment_method text not null default 'efectivo',
  concept text not null,
  date text not null,
  professional_id text,
  professional_name text,
  receipt_number text,
  source_treatment_plan_id text,
  source_treatment_item_id text,
  notes text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 14. Órdenes y seguimiento de Laboratorio Dental
create table if not exists public.lab_orders (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text,
  patient_name text not null,
  provider_id text,
  provider_name text,
  work_type text not null,
  tooth_fdi text,
  shade text,
  sent_date text,
  due_date text,
  received_date text,
  cost double precision,
  currency text not null default 'UYU',
  status text not null default 'sin_enviar' check (status in ('sin_enviar', 'en_laboratorio', 'en_clinica', 'instalado')),
  notes text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 15. Historial de actividad clínica (Auditoría)
create table if not exists public.activity_logs (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  details text,
  created_at bigint not null
);

-- 16. Ajustes de usuario / consultorio
create table if not exists public.settings (
  id text primary key,
  workspace_id text not null unique references public.workspaces(id) on delete cascade,
  model_tier text not null default 'balanced',
  noise_suppression boolean not null default false,
  selected_audio_device_id text,
  require_consent boolean not null default true,
  auto_transcribe_on_stop boolean not null default false,
  progressive_transcription boolean not null default true,
  transcription_mode text not null default 'dental',
  theme text not null default 'light',
  currency text not null default 'UYU',
  show_currency_code boolean not null default false,
  audio_cloud_tier text not null default 'free',
  audio_cloud_auto_sync boolean not null default false,
  updated_at bigint not null
);

-- Migraciones idempotentes para bases existentes (moneda única configurable, por defecto UYU)
alter table public.settings add column if not exists currency text not null default 'UYU';
alter table public.settings add column if not exists show_currency_code boolean not null default false;
alter table public.settings add column if not exists audio_cloud_tier text not null default 'free';
alter table public.settings add column if not exists audio_cloud_auto_sync boolean not null default false;
alter table public.treatment_plans drop constraint if exists treatment_plans_currency_check;
alter table public.treatment_plans alter column currency set default 'UYU';
alter table public.financial_transactions drop constraint if exists financial_transactions_currency_check;
alter table public.financial_transactions alter column currency set default 'UYU';
alter table public.lab_orders drop constraint if exists lab_orders_currency_check;
alter table public.lab_orders alter column currency set default 'UYU';

-- 16b. Radiografías, fotos clínicas y documentos adjuntos del paciente (sin audios)
create table if not exists public.patient_files (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  name text not null,
  category text not null default 'radiografia' check (category in ('radiografia', 'foto_clinica', 'documento', 'consentimiento')),
  mime_type text not null,
  size_bytes integer not null default 0,
  data_url text not null default '',
  storage_path text,
  notes text,
  captured_at text not null,
  created_at bigint not null
);

alter table public.patient_files add column if not exists storage_path text;
alter table public.patient_files add column if not exists uploaded_by text;
alter table public.patient_files add column if not exists author_user_id uuid default auth.uid();
alter table public.patient_files add column if not exists author_workspace_id text;

-- 17. Glosario odontológico personalizado
create table if not exists public.glossary (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  incorrect text not null,
  correct text not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- 18. Vinculación clínica compartida entre colegas (enlaces de un solo uso por WhatsApp)
create table if not exists public.patient_shares (
  id text primary key,
  owner_workspace_id text not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_name text not null,
  owner_specialty text,
  owner_license text,
  patient_id text not null,
  patient_name_snapshot text not null,
  invite_token text not null unique,
  referral_note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  recipient_workspace_id text,
  recipient_user_id uuid,
  recipient_name text,
  recipient_specialty text,
  recipient_license text,
  accepted_at bigint,
  revoked_at bigint,
  created_at bigint not null,
  updated_at bigint not null
);

-- 19. Suscripciones, prueba gratis 7 días y planes (Profesional / Extra / Mega)
create table if not exists public.workspace_subscriptions (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  plan_tier text not null default 'trial' check (plan_tier in ('trial', 'base', 'extra', 'mega')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'quarterly', 'annual')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'expired')),
  trial_starts_at bigint not null,
  trial_ends_at bigint not null,
  current_period_start bigint,
  current_period_end bigint,
  last_payment_method text not null default 'bank_transfer' check (last_payment_method in ('bank_transfer')),
  pending_transfer_id text,
  notes text,
  created_at bigint not null,
  updated_at bigint not null
);

-- 20. Avisos y comprobantes de transferencia bancaria (activación manual sin pasarela)
create table if not exists public.subscription_transfer_requests (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requested_tier text not null check (requested_tier in ('base', 'extra', 'mega')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'quarterly', 'annual')),
  amount_usd integer not null check (amount_usd > 0),
  payer_name text not null,
  bank_name text not null,
  transfer_reference text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at bigint not null,
  updated_at bigint not null
);

-- ============================================================================
-- Índices para consultas rápidas
-- ============================================================================
create index if not exists idx_patients_workspace on public.patients(workspace_id) where deleted_at is null;
create index if not exists idx_providers_workspace on public.providers(workspace_id) where deleted_at is null;
create index if not exists idx_sessions_workspace on public.sessions(workspace_id, created_at desc) where deleted_at is null;
create index if not exists idx_segments_session on public.transcript_segments(session_id, start_sec asc);
create index if not exists idx_appointments_workspace_date on public.appointments(workspace_id, date, start_time) where deleted_at is null;
create index if not exists idx_clinic_professionals_workspace on public.clinic_professionals(workspace_id) where deleted_at is null;
create index if not exists idx_clinical_evolutions_patient on public.clinical_evolutions(workspace_id, patient_id, date desc) where deleted_at is null;
create index if not exists idx_odontograms_patient on public.odontograms(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_periodontograms_patient on public.periodontograms(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_treatment_plans_patient on public.treatment_plans(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_financial_tx_workspace_date on public.financial_transactions(workspace_id, date desc) where deleted_at is null;
create index if not exists idx_financial_tx_patient on public.financial_transactions(workspace_id, patient_id) where deleted_at is null;
create index if not exists idx_lab_orders_workspace on public.lab_orders(workspace_id, status, created_at desc) where deleted_at is null;
create index if not exists idx_activity_workspace on public.activity_logs(workspace_id, created_at desc);
create index if not exists idx_glossary_workspace on public.glossary(workspace_id, incorrect);
create index if not exists idx_patient_files_patient on public.patient_files(workspace_id, patient_id, created_at desc);
create index if not exists idx_patient_shares_owner on public.patient_shares(owner_workspace_id, patient_id, created_at desc);
create index if not exists idx_patient_shares_recipient on public.patient_shares(recipient_workspace_id, patient_id) where status = 'accepted';
create index if not exists idx_patient_shares_token on public.patient_shares(invite_token);
create index if not exists idx_workspace_subscriptions_status on public.workspace_subscriptions(status, trial_ends_at, current_period_end);
create index if not exists idx_transfer_requests_workspace on public.subscription_transfer_requests(workspace_id, created_at desc);

-- ============================================================================
-- Funciones de ayuda y provisión automática al registrarse en Supabase Auth
-- ============================================================================
create or replace function public.user_workspace_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where user_id = auth.uid()
  union
  select id from public.workspaces where owner_id = auth.uid();
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  trial_ms bigint := 7::bigint * 24 * 60 * 60 * 1000;
  ws_id text := 'ws_' || replace(new.id::text, '-', '');
  prof_id text := 'prof_' || replace(new.id::text, '-', '');
  display_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Odontólogo');
  intended_cycle text := case
    when new.raw_user_meta_data->>'intended_cycle' in ('monthly', 'quarterly', 'annual')
      then new.raw_user_meta_data->>'intended_cycle'
    else 'monthly'
  end;
  intended_plan text := nullif(new.raw_user_meta_data->>'intended_plan', '');
begin
  insert into public.workspaces (id, owner_id, name, slug, created_at, updated_at)
  values (ws_id, new.id, 'Consultorio ' || display_name, 'consultorio-' || substr(replace(new.id::text, '-', ''), 1, 8), now_ms, now_ms)
  on conflict (id) do nothing;

  insert into public.profiles (id, user_id, workspace_id, full_name, role, created_at, updated_at)
  values (prof_id, new.id, ws_id, display_name, 'owner', now_ms, now_ms)
  on conflict (user_id) do nothing;

  insert into public.clinic_professionals (
    id, workspace_id, full_name, specialty, role, agenda_color, can_view_finance, active, created_at, updated_at
  )
  values (
    'cprof_' || replace(new.id::text, '-', ''), ws_id, display_name, 'Odontología General', 'owner', '#0d9488', true, true, now_ms, now_ms
  )
  on conflict (id) do nothing;

  insert into public.settings (
    id, workspace_id, model_tier, noise_suppression, require_consent,
    auto_transcribe_on_stop, progressive_transcription, transcription_mode, theme, currency, updated_at
  )
  values (
    'settings_' || ws_id, ws_id, 'balanced', false, true,
    false, true, 'dental', 'light', 'UYU', now_ms
  )
  on conflict (workspace_id) do nothing;

  insert into public.workspace_subscriptions (
    workspace_id, plan_tier, billing_cycle, status, trial_starts_at, trial_ends_at,
    last_payment_method, notes, created_at, updated_at
  )
  values (
    ws_id, 'trial', intended_cycle, 'trialing', now_ms, now_ms + trial_ms,
    'bank_transfer',
    case when intended_plan is not null then 'Interés inicial: ' || intended_plan else null end,
    now_ms, now_ms
  )
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_my_workspace_trial(p_workspace_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  trial_ms bigint := 7::bigint * 24 * 60 * 60 * 1000;
  sub_row public.workspace_subscriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not (p_workspace_id in (select public.user_workspace_ids())) then
    raise exception 'ACCESS_DENIED';
  end if;

  insert into public.workspace_subscriptions (
    workspace_id, plan_tier, billing_cycle, status, trial_starts_at, trial_ends_at,
    last_payment_method, created_at, updated_at
  )
  values (
    p_workspace_id, 'trial', 'monthly', 'trialing', now_ms, now_ms + trial_ms,
    'bank_transfer', now_ms, now_ms
  )
  on conflict (workspace_id) do nothing;

  select * into sub_row
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id;

  return to_jsonb(sub_row);
end;
$$;

create or replace function public.can_access_shared_patient(p_owner_ws text, p_patient_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    p_owner_ws in (select public.user_workspace_ids())
    or exists (
      select 1
      from public.patient_shares ps
      where ps.owner_workspace_id = p_owner_ws
        and ps.patient_id = p_patient_id
        and ps.status = 'accepted'
        and ps.recipient_workspace_id in (select public.user_workspace_ids())
    )
  );
$$;

create or replace function public.get_patient_share_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.patient_shares%rowtype;
  caller_ws boolean;
begin
  if auth.uid() is null then
    raise exception 'Debés iniciar sesión para ver esta invitación.';
  end if;

  select * into s
  from public.patient_shares
  where invite_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  select exists(
    select 1 from public.user_workspace_ids() w where w = s.owner_workspace_id
  ) into caller_ws;

  return jsonb_build_object(
    'id', s.id,
    'ownerName', s.owner_name,
    'ownerSpecialty', s.owner_specialty,
    'ownerLicense', s.owner_license,
    'patientId', s.patient_id,
    'patientNameSnapshot', s.patient_name_snapshot,
    'referralNote', s.referral_note,
    'status', s.status,
    'createdAt', s.created_at,
    'isOwnShare', caller_ws
  );
end;
$$;

create or replace function public.accept_patient_share(
  p_token text,
  p_recipient_ws text,
  p_recipient_name text,
  p_recipient_specialty text default null,
  p_recipient_license text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.patient_shares%rowtype;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null then
    raise exception 'Debés iniciar sesión para aceptar la ficha compartida.';
  end if;

  if not exists (select 1 from public.user_workspace_ids() w where w = p_recipient_ws) then
    raise exception 'No tenés permisos sobre el consultorio receptor.';
  end if;

  select * into s
  from public.patient_shares
  where invite_token = p_token
  for update;

  if not found then
    raise exception 'El enlace de derivación no existe.';
  end if;

  if s.status <> 'pending' then
    raise exception 'Este enlace de un solo uso ya fue utilizado o revocado.';
  end if;

  if s.owner_workspace_id = p_recipient_ws then
    raise exception 'No podés vincular una ficha con tu propio consultorio.';
  end if;

  update public.patient_shares
  set
    status = 'accepted',
    recipient_workspace_id = p_recipient_ws,
    recipient_user_id = auth.uid(),
    recipient_name = coalesce(nullif(trim(p_recipient_name), ''), 'Colega'),
    recipient_specialty = nullif(trim(coalesce(p_recipient_specialty, '')), ''),
    recipient_license = nullif(trim(coalesce(p_recipient_license, '')), ''),
    accepted_at = now_ms,
    updated_at = now_ms
  where id = s.id;

  return jsonb_build_object(
    'id', s.id,
    'patientId', s.patient_id,
    'ownerWorkspaceId', s.owner_workspace_id
  );
end;
$$;

create or replace function public.unlink_patient_share(p_share_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.patient_shares%rowtype;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.';
  end if;

  select * into s
  from public.patient_shares
  where id = p_share_id
  for update;

  if not found then
    return;
  end if;

  if not (
    s.owner_workspace_id in (select public.user_workspace_ids())
    or s.recipient_workspace_id in (select public.user_workspace_ids())
  ) then
    raise exception 'No tenés permisos para desvincular este enlace.';
  end if;

  update public.patient_shares
  set
    status = 'revoked',
    revoked_at = now_ms,
    updated_at = now_ms
  where id = s.id;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ============================================================================
-- Row-Level Security (RLS) estricta por consultorio/usuario + fichas compartidas
-- ============================================================================
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.providers enable row level security;
alter table public.sessions enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.appointments enable row level security;
alter table public.clinic_professionals enable row level security;
alter table public.clinical_evolutions enable row level security;
alter table public.odontograms enable row level security;
alter table public.periodontograms enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.lab_orders enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;
alter table public.patient_files enable row level security;
alter table public.glossary enable row level security;
alter table public.patient_shares enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.subscription_transfer_requests enable row level security;

drop policy if exists "workspaces_owner_all" on public.workspaces;
create policy "workspaces_owner_all" on public.workspaces
  for all to authenticated
  using (owner_id = auth.uid() or id in (select public.user_workspace_ids()))
  with check (owner_id = auth.uid());

drop policy if exists "profiles_self_all" on public.profiles;
create policy "profiles_self_all" on public.profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "patients_workspace_all" on public.patients;
drop policy if exists "patients_shared_select" on public.patients;
drop policy if exists "patients_owner_insert" on public.patients;
drop policy if exists "patients_owner_update" on public.patients;
drop policy if exists "patients_owner_delete" on public.patients;

create policy "patients_shared_select" on public.patients
  for select to authenticated
  using (public.can_access_shared_patient(workspace_id, id));

create policy "patients_owner_insert" on public.patients
  for insert to authenticated
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "patients_owner_update" on public.patients
  for update to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "patients_owner_delete" on public.patients
  for delete to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "providers_workspace_all" on public.providers;
create policy "providers_workspace_all" on public.providers
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "sessions_workspace_all" on public.sessions;
create policy "sessions_workspace_all" on public.sessions
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "segments_workspace_all" on public.transcript_segments;
create policy "segments_workspace_all" on public.transcript_segments
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = transcript_segments.session_id
        and s.workspace_id in (select public.user_workspace_ids())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = transcript_segments.session_id
        and s.workspace_id in (select public.user_workspace_ids())
    )
  );

drop policy if exists "appointments_workspace_all" on public.appointments;
create policy "appointments_workspace_all" on public.appointments
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "clinic_professionals_workspace_all" on public.clinic_professionals;
create policy "clinic_professionals_workspace_all" on public.clinic_professionals
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

-- Evoluciones clínicas: lectura compartida, inserción por ambos colegas, edición/borrado solo del autor
drop policy if exists "clinical_evolutions_workspace_all" on public.clinical_evolutions;
drop policy if exists "clinical_evolutions_shared_select" on public.clinical_evolutions;
drop policy if exists "clinical_evolutions_shared_insert" on public.clinical_evolutions;
drop policy if exists "clinical_evolutions_author_update" on public.clinical_evolutions;
drop policy if exists "clinical_evolutions_author_delete" on public.clinical_evolutions;

create policy "clinical_evolutions_shared_select" on public.clinical_evolutions
  for select to authenticated
  using (public.can_access_shared_patient(workspace_id, patient_id));

create policy "clinical_evolutions_shared_insert" on public.clinical_evolutions
  for insert to authenticated
  with check (
    public.can_access_shared_patient(workspace_id, patient_id)
    and (author_user_id is null or author_user_id = auth.uid())
  );

create policy "clinical_evolutions_author_update" on public.clinical_evolutions
  for update to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  )
  with check (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

create policy "clinical_evolutions_author_delete" on public.clinical_evolutions
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

-- Odontogramas: cada actualización guarda una nueva medición; nadie borra mediciones del colega previo
drop policy if exists "odontograms_workspace_all" on public.odontograms;
drop policy if exists "odontograms_shared_select" on public.odontograms;
drop policy if exists "odontograms_shared_insert" on public.odontograms;
drop policy if exists "odontograms_author_update" on public.odontograms;
drop policy if exists "odontograms_author_delete" on public.odontograms;

create policy "odontograms_shared_select" on public.odontograms
  for select to authenticated
  using (public.can_access_shared_patient(workspace_id, patient_id));

create policy "odontograms_shared_insert" on public.odontograms
  for insert to authenticated
  with check (
    public.can_access_shared_patient(workspace_id, patient_id)
    and (author_user_id is null or author_user_id = auth.uid())
  );

create policy "odontograms_author_update" on public.odontograms
  for update to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  )
  with check (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

create policy "odontograms_author_delete" on public.odontograms
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

-- Periodontogramas: lectura compartida + autoría inmutable
drop policy if exists "periodontograms_workspace_all" on public.periodontograms;
drop policy if exists "periodontograms_shared_select" on public.periodontograms;
drop policy if exists "periodontograms_shared_insert" on public.periodontograms;
drop policy if exists "periodontograms_author_update" on public.periodontograms;
drop policy if exists "periodontograms_author_delete" on public.periodontograms;

create policy "periodontograms_shared_select" on public.periodontograms
  for select to authenticated
  using (public.can_access_shared_patient(workspace_id, patient_id));

create policy "periodontograms_shared_insert" on public.periodontograms
  for insert to authenticated
  with check (
    public.can_access_shared_patient(workspace_id, patient_id)
    and (author_user_id is null or author_user_id = auth.uid())
  );

create policy "periodontograms_author_update" on public.periodontograms
  for update to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  )
  with check (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

create policy "periodontograms_author_delete" on public.periodontograms
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

-- Presupuestos y Caja: ESTRICTAMENTE privados de cada consultorio (nunca compartidos)
drop policy if exists "treatment_plans_workspace_all" on public.treatment_plans;
create policy "treatment_plans_workspace_all" on public.treatment_plans
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "financial_transactions_workspace_all" on public.financial_transactions;
create policy "financial_transactions_workspace_all" on public.financial_transactions
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "lab_orders_workspace_all" on public.lab_orders;
create policy "lab_orders_workspace_all" on public.lab_orders
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "activity_logs_workspace_all" on public.activity_logs;
create policy "activity_logs_workspace_all" on public.activity_logs
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "settings_workspace_all" on public.settings;
create policy "settings_workspace_all" on public.settings
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

-- Archivos clínicos y radiografías: lectura y carga compartida, borrado solo por el autor
drop policy if exists "patient_files_workspace_all" on public.patient_files;
drop policy if exists "patient_files_shared_select" on public.patient_files;
drop policy if exists "patient_files_shared_insert" on public.patient_files;
drop policy if exists "patient_files_author_delete" on public.patient_files;

create policy "patient_files_shared_select" on public.patient_files
  for select to authenticated
  using (public.can_access_shared_patient(workspace_id, patient_id));

create policy "patient_files_shared_insert" on public.patient_files
  for insert to authenticated
  with check (
    public.can_access_shared_patient(workspace_id, patient_id)
    and (author_user_id is null or author_user_id = auth.uid())
  );

create policy "patient_files_author_delete" on public.patient_files
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or (author_user_id is null and workspace_id in (select public.user_workspace_ids()))
  );

drop policy if exists "glossary_workspace_all" on public.glossary;
create policy "glossary_workspace_all" on public.glossary
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "patient_shares_access" on public.patient_shares;
drop policy if exists "patient_shares_select" on public.patient_shares;
drop policy if exists "patient_shares_insert" on public.patient_shares;
drop policy if exists "patient_shares_update" on public.patient_shares;
drop policy if exists "patient_shares_delete" on public.patient_shares;

create policy "patient_shares_select" on public.patient_shares
  for select to authenticated
  using (
    owner_workspace_id in (select public.user_workspace_ids())
    or (status = 'accepted' and recipient_workspace_id in (select public.user_workspace_ids()))
  );

create policy "patient_shares_insert" on public.patient_shares
  for insert to authenticated
  with check (
    owner_workspace_id in (select public.user_workspace_ids())
    and owner_user_id = auth.uid()
  );

create policy "patient_shares_update" on public.patient_shares
  for update to authenticated
  using (
    owner_workspace_id in (select public.user_workspace_ids())
    or (status = 'accepted' and recipient_workspace_id in (select public.user_workspace_ids()))
  )
  with check (
    owner_workspace_id in (select public.user_workspace_ids())
    or recipient_workspace_id in (select public.user_workspace_ids())
  );

create policy "patient_shares_delete" on public.patient_shares
  for delete to authenticated
  using (owner_workspace_id in (select public.user_workspace_ids()));

-- Suscripciones: solo lectura desde cliente (provisión por trigger/RPC; activación por admin/service_role)
drop policy if exists "workspace_subscriptions_select" on public.workspace_subscriptions;
create policy "workspace_subscriptions_select" on public.workspace_subscriptions
  for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

-- Comprobantes de transferencia: lectura y alta en estado 'pending' para el propio consultorio
drop policy if exists "transfer_requests_select" on public.subscription_transfer_requests;
drop policy if exists "transfer_requests_insert" on public.subscription_transfer_requests;

create policy "transfer_requests_select" on public.subscription_transfer_requests
  for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "transfer_requests_insert" on public.subscription_transfer_requests
  for insert to authenticated
  with check (
    workspace_id in (select public.user_workspace_ids())
    and user_id = auth.uid()
    and status = 'pending'
  );

-- ============================================================================
-- Supabase Storage: Bucket privado para radiografías, fotos clínicas y PDFs
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

drop policy if exists "patient_files_storage_select" on storage.objects;
create policy "patient_files_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      (storage.foldername(name))[1] in (select public.user_workspace_ids())
      or public.can_access_shared_patient((storage.foldername(name))[1], (storage.foldername(name))[2])
    )
  );

drop policy if exists "patient_files_storage_insert" on storage.objects;
create policy "patient_files_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (
      (storage.foldername(name))[1] in (select public.user_workspace_ids())
      or public.can_access_shared_patient((storage.foldername(name))[1], (storage.foldername(name))[2])
    )
  );

drop policy if exists "patient_files_storage_delete" on storage.objects;
create policy "patient_files_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.patient_files pf
        where pf.storage_path = name
          and (
            pf.author_user_id = auth.uid()
            or (pf.author_user_id is null and pf.workspace_id in (select public.user_workspace_ids()))
          )
      )
    )
  );

-- ============================================================================
-- Realtime para sincronización en vivo de fichas clínicas compartidas
-- ============================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'patients',
    'clinical_evolutions',
    'odontograms',
    'periodontograms',
    'patient_files',
    'patient_shares'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end;
$$;
