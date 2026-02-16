create extension if not exists pgcrypto;

create table if not exists workout_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists workout_raw_logs (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null check (length(trim(raw_text)) > 0),
  submitted_at timestamptz not null,
  ingestion_mode text not null check (ingestion_mode = 'auto_save'),
  idempotency_key text not null unique,
  parse_status text not null check (parse_status in ('parsed', 'parsed_with_warnings', 'failed')),
  overall_confidence numeric(4, 3) check (overall_confidence between 0 and 1),
  latest_response jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  raw_log_id uuid not null references workout_raw_logs(id) on delete cascade,
  workout_type_id uuid not null references workout_types(id),
  occurred_at timestamptz not null,
  timezone text,
  parse_version integer not null check (parse_version > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exercise_performances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_key text not null,
  exercise_name text not null,
  exercise_order integer not null check (exercise_order >= 0),
  total_sets integer not null check (total_sets > 0),
  total_reps integer not null check (total_reps > 0),
  total_volume_lbs numeric(12, 2) not null check (total_volume_lbs >= 0),
  previous_session_volume_delta_lbs numeric(12, 2),
  unique (session_id, exercise_order)
);

create table if not exists set_entries (
  id uuid primary key default gen_random_uuid(),
  exercise_performance_id uuid not null references exercise_performances(id) on delete cascade,
  set_index integer not null check (set_index > 0),
  reps integer not null check (reps > 0),
  weight_lbs numeric(10, 2) not null check (weight_lbs >= 0),
  is_warmup boolean not null default false,
  rpe numeric(4, 2) check (rpe is null or (rpe >= 0 and rpe <= 10)),
  notes text,
  unique (exercise_performance_id, set_index)
);

create table if not exists session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references workout_sessions(id) on delete cascade,
  total_lbs_lifted numeric(12, 2) not null check (total_lbs_lifted >= 0),
  total_sets integer not null check (total_sets > 0),
  total_reps integer not null check (total_reps > 0),
  previous_session_total_lbs_delta numeric(12, 2),
  per_exercise_progression jsonb not null default '[]'::jsonb,
  computation_version integer not null default 1 check (computation_version > 0),
  computed_at timestamptz not null default now()
);

create table if not exists parse_payload_versions (
  id uuid primary key default gen_random_uuid(),
  raw_log_id uuid not null references workout_raw_logs(id) on delete cascade,
  session_id uuid references workout_sessions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  parsed_payload jsonb not null,
  field_confidence jsonb not null default '[]'::jsonb,
  parse_errors jsonb not null default '[]'::jsonb,
  parse_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (raw_log_id, version_number)
);

create table if not exists ingestion_corrections (
  id uuid primary key default gen_random_uuid(),
  raw_log_id uuid not null references workout_raw_logs(id) on delete cascade,
  session_id uuid not null references workout_sessions(id) on delete cascade,
  reason text not null,
  patch jsonb not null,
  status text not null check (status in ('pending', 'applied', 'rejected')),
  requested_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists openrouter_model_logs (
  id uuid primary key default gen_random_uuid(),
  raw_log_id uuid not null references workout_raw_logs(id) on delete cascade,
  parse_version integer not null check (parse_version > 0),
  model text not null,
  attempt integer not null check (attempt > 0),
  request_started_at timestamptz not null,
  request_completed_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  response_status integer,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  logged_at timestamptz not null default now()
);

create index if not exists idx_workout_sessions_type_occurred_at
  on workout_sessions(workout_type_id, occurred_at desc);

create index if not exists idx_exercise_performance_session
  on exercise_performances(session_id);

create index if not exists idx_set_entries_exercise
  on set_entries(exercise_performance_id, set_index);

create index if not exists idx_openrouter_model_logs_raw_log
  on openrouter_model_logs(raw_log_id, logged_at desc);

insert into workout_types (slug, name, is_builtin)
values
  ('chest', 'Chest', true),
  ('back', 'Back', true),
  ('legs', 'Legs', true)
on conflict (slug) do nothing;

-- Add custom types by inserting rows (no schema change required):
-- insert into workout_types (slug, name, is_builtin) values ('shoulders', 'Shoulders', false);
