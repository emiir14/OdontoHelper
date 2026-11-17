-- ============================================================================
-- OdontoHelper · Esquema SQL para Neon PostgreSQL (Vercel Serverless)
-- ============================================================================
-- IMPORTANTE:
--   - Solo los datos estructurados (usuarios, consultorios, historias clínicas,
--     pacientes, proveedores, agenda, presupuestos, caja y laboratorio) se
--     almacenan en Neon PostgreSQL.
--   - El audio PCM crudo, imágenes adjuntas de pacientes y los pesos/inferencia
--     de Whisper permanecen 100% en el navegador local (IndexedDB + Cache Storage).
--
-- Instrucciones:
--   1. Abrí tu proyecto en Neon -> SQL Editor.
--   2. Pegá y ejecutá este archivo completo.
--   3. Configurá en Vercel las variables de entorno:
--        DATABASE_URL="postgres://..."
--        AUTH_SECRET="una_clave_secreta_larga_aleatoria"
--      (Y opcionalmente VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY si usás
--       login de Supabase Auth sincronizado con Neon).
-- ============================================================================

-- 1. Cuentas de acceso nativas para Neon + Vercel
create table if not exists neon_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- 2. Espacios de trabajo / Consultorios
create table if not exists workspaces (
  id text primary key,
  owner_id text not null,
  name text not null,
  slug text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 3. Perfiles de usuario vinculados al consultorio
create table if not exists profiles (
  id text primary key,
  user_id text not null unique,
  workspace_id text not null references workspaces(id) on delete cascade,
  full_name text not null,
  role text not null default 'owner' check (role in ('owner', 'dentist', 'assistant')),
  created_at bigint not null,
  updated_at bigint not null
);

-- 4. Pacientes (incluye cuestionario anamnesis JSONB)
create table if not exists patients (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 5. Proveedores, laboratorios y especialistas
create table if not exists providers (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 6. Sesiones / Consultas clínicas (SIN audio; solo metadatos + ficha clínica)
create table if not exists sessions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 7. Segmentos de transcripción en texto
create table if not exists transcript_segments (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  start_sec double precision not null,
  end_sec double precision not null,
  text text not null,
  original_text text not null,
  speaker text,
  edited boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

-- 8. Agenda y turnos odontológicos (filtrados por profesional logueado o clínica completa)
create table if not exists appointments (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 9. Profesionales del consultorio, roles y PIN de firma clínica
create table if not exists clinic_professionals (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 10. Evoluciones clínicas cronológicas
create table if not exists clinical_evolutions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 11. Odontogramas (múltiples mediciones históricas)
create table if not exists odontograms (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 12. Periodontogramas
create table if not exists periodontograms (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  patient_id text not null,
  label text not null,
  teeth jsonb not null default '{}'::jsonb,
  notes text,
  created_by text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 13. Presupuestos y planes de tratamiento
create table if not exists treatment_plans (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 14. Cuenta corriente y Caja diaria (moneda única configurable)
create table if not exists financial_transactions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 15. Órdenes y seguimiento de Laboratorio Dental
create table if not exists lab_orders (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

-- 16. Historial de actividad clínica
create table if not exists activity_logs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  details text,
  created_at bigint not null
);

-- 17. Ajustes de usuario / consultorio (tema claro y UYU por defecto)
create table if not exists settings (
  id text primary key,
  workspace_id text not null unique references workspaces(id) on delete cascade,
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

alter table settings add column if not exists currency text not null default 'UYU';
alter table treatment_plans drop constraint if exists treatment_plans_currency_check;
alter table treatment_plans alter column currency set default 'UYU';
alter table financial_transactions drop constraint if exists financial_transactions_currency_check;
alter table financial_transactions alter column currency set default 'UYU';
alter table lab_orders drop constraint if exists lab_orders_currency_check;
alter table lab_orders alter column currency set default 'UYU';

-- 18. Glosario odontológico personalizado
create table if not exists glossary (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  incorrect text not null,
  correct text not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- ============================================================================
-- Índices para consultas rápidas
-- ============================================================================
create index if not exists idx_neon_users_email on neon_users(email);
create index if not exists idx_patients_workspace on patients(workspace_id) where deleted_at is null;
create index if not exists idx_providers_workspace on providers(workspace_id) where deleted_at is null;
create index if not exists idx_sessions_workspace on sessions(workspace_id, created_at desc) where deleted_at is null;
create index if not exists idx_segments_session on transcript_segments(session_id, start_sec asc);
create index if not exists idx_appointments_workspace_date on appointments(workspace_id, date, start_time) where deleted_at is null;
create index if not exists idx_appointments_prof on appointments(workspace_id, professional_id, date) where deleted_at is null;
create index if not exists idx_clinic_professionals_workspace on clinic_professionals(workspace_id) where deleted_at is null;
create index if not exists idx_clinical_evolutions_patient on clinical_evolutions(workspace_id, patient_id, date desc) where deleted_at is null;
create index if not exists idx_odontograms_patient on odontograms(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_periodontograms_patient on periodontograms(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_treatment_plans_patient on treatment_plans(workspace_id, patient_id, created_at desc) where deleted_at is null;
create index if not exists idx_financial_tx_workspace_date on financial_transactions(workspace_id, date desc) where deleted_at is null;
create index if not exists idx_financial_tx_patient on financial_transactions(workspace_id, patient_id) where deleted_at is null;
create index if not exists idx_lab_orders_workspace on lab_orders(workspace_id, status, created_at desc) where deleted_at is null;
create index if not exists idx_activity_workspace on activity_logs(workspace_id, created_at desc);
create index if not exists idx_glossary_workspace on glossary(workspace_id, incorrect);
