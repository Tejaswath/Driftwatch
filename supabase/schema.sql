create extension if not exists "pgcrypto";

create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  enabled boolean not null default true,
  last_worker_heartbeat timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists baselines (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references domains(id) on delete cascade,
  baseline_version text not null,
  schema_version text not null,
  schema_hash text not null,
  row_count integer not null,
  storage_uri text,
  model_uri text,
  baseline_predictions_json jsonb,
  created_at timestamptz not null default now(),
  reason text,
  unique(domain_id, baseline_version)
);

create table if not exists feature_batches (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references domains(id) on delete cascade,
  batch_id text not null,
  scenario text not null default 'stable_salary',
  row_count integer not null,
  storage_uri text,
  schema_hash text not null,
  source_mode text not null default 'synthetic',
  created_at timestamptz not null default now(),
  unique(domain_id, batch_id)
);

create table if not exists monitor_runs (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references domains(id) on delete set null,
  baseline_id uuid references baselines(id) on delete set null,
  feature_batch_id uuid references feature_batches(id) on delete set null,
  domain_key text not null,
  baseline_version text not null,
  batch_id text not null,
  scenario text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  drift_status text check (drift_status in ('green', 'yellow', 'red')),
  prediction_drift_score double precision,
  report_json jsonb,
  html_report_uri text,
  error_text text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique(domain_key, baseline_version, batch_id)
);

create table if not exists feature_drift_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references monitor_runs(id) on delete cascade,
  feature_name text not null,
  test_name text not null,
  score double precision,
  p_value double precision,
  drifted boolean not null,
  severity text,
  unique(run_id, feature_name, test_name)
);

create table if not exists action_tickets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references monitor_runs(id) on delete cascade,
  ticket_type text not null check (ticket_type in ('investigate', 'retrain')),
  title text,
  description text,
  status text not null default 'open',
  payload jsonb,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create table if not exists nordea_seed_runs (
  id uuid primary key default gen_random_uuid(),
  profile text not null,
  status text not null,
  params jsonb,
  created_at timestamptz not null default now()
);

alter table domains enable row level security;
alter table baselines enable row level security;
alter table feature_batches enable row level security;
alter table monitor_runs enable row level security;
alter table feature_drift_metrics enable row level security;
alter table action_tickets enable row level security;
alter table nordea_seed_runs enable row level security;

do $$ begin
  create policy domains_public_read on domains for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy baselines_public_read on baselines for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy feature_batches_public_read on feature_batches for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy monitor_runs_public_read on monitor_runs for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy feature_drift_metrics_public_read on feature_drift_metrics for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy action_tickets_public_read on action_tickets for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy nordea_seed_runs_public_read on nordea_seed_runs for select to anon using (true);
exception when duplicate_object then null;
end $$;

insert into domains (key, name, enabled)
values
  ('nordea', 'Nordea Sandbox', true),
  ('taiwan_credit', 'Taiwan Credit (Optional)', false)
on conflict (key) do update set name = excluded.name;
