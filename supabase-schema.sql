create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  completed_videos jsonb not null default '[]'::jsonb,
  completed_checks jsonb not null default '[]'::jsonb,
  knowledge_check_answers jsonb not null default '{}'::jsonb,
  capstone_answers jsonb,
  latest_capstone_score integer check (latest_capstone_score between 0 and 15),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Required for existing projects created before learner progress could be restored.
alter table public.training_records add column if not exists knowledge_check_answers jsonb not null default '{}'::jsonb;

create table if not exists public.training_attempts (
  id bigint generated always as identity primary key,
  training_record_id uuid not null references public.training_records(id) on delete cascade,
  score integer not null check (score between 0 and 15),
  passed boolean not null,
  answers jsonb not null,
  attempted_at timestamptz not null default now()
);

alter table public.training_records enable row level security;
alter table public.training_attempts enable row level security;
