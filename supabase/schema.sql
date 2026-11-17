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
  clinical_note jsonb,
  error text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

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

-- 8. Profesionales del consultorio, roles y PIN de firma clínica
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
  pin_code text,
  can_view_finance boolean not null default true,
  active boolean not null default true,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 9. Evoluciones clínicas cronológicas (con firma PIN y etiquetas de color)
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
  signed_with_pin boolean not null default false,
  signed_at bigint,
  source_session_id text,
  source_treatment_plan_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

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
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 11. Periodontogramas (mediciones periodontales por pieza)
create table if not exists public.periodontograms (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id text not null,
  label text not null,
  teeth jsonb not null default '{}'::jsonb,
  notes text,
  created_by text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

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
  updated_at bigint not null
);

-- Migraciones idempotentes para bases existentes (moneda única configurable, por defecto UYU)
alter table public.settings add column if not exists currency text not null default 'UYU';
alter table public.treatment_plans drop constraint if exists treatment_plans_currency_check;
alter table public.treatment_plans alter column currency set default 'UYU';
alter table public.financial_transactions drop constraint if exists financial_transactions_currency_check;
alter table public.financial_transactions alter column currency set default 'UYU';
alter table public.lab_orders drop constraint if exists lab_orders_currency_check;
alter table public.lab_orders alter column currency set default 'UYU';

-- 17. Glosario odontológico personalizado
create table if not exists public.glossary (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  incorrect text not null,
  correct text not null,
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
  ws_id text := 'ws_' || replace(new.id::text, '-', '');
  prof_id text := 'prof_' || replace(new.id::text, '-', '');
  display_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Odontólogo');
begin
  insert into public.workspaces (id, owner_id, name, slug, created_at, updated_at)
  values (ws_id, new.id, 'Consultorio ' || display_name, 'consultorio-' || substr(replace(new.id::text, '-', ''), 1, 8), now_ms, now_ms)
  on conflict (id) do nothing;

  insert into public.profiles (id, user_id, workspace_id, full_name, role, created_at, updated_at)
  values (prof_id, new.id, ws_id, display_name, 'owner', now_ms, now_ms)
  on conflict (user_id) do nothing;

  insert into public.clinic_professionals (
    id, workspace_id, full_name, specialty, role, agenda_color, pin_code, can_view_finance, active, created_at, updated_at
  )
  values (
    'cprof_' || replace(new.id::text, '-', ''), ws_id, display_name, 'Odontología General', 'owner', '#0d9488', '1234', true, true, now_ms, now_ms
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ============================================================================
-- Row-Level Security (RLS) estricta por consultorio/usuario
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
alter table public.glossary enable row level security;

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
create policy "patients_workspace_all" on public.patients
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

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

drop policy if exists "clinical_evolutions_workspace_all" on public.clinical_evolutions;
create policy "clinical_evolutions_workspace_all" on public.clinical_evolutions
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "odontograms_workspace_all" on public.odontograms;
create policy "odontograms_workspace_all" on public.odontograms
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "periodontograms_workspace_all" on public.periodontograms;
create policy "periodontograms_workspace_all" on public.periodontograms
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

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

drop policy if exists "glossary_workspace_all" on public.glossary;
create policy "glossary_workspace_all" on public.glossary
  for all to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));
