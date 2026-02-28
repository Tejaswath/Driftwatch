-- DriftWatch v2 migration
-- Adds feature batch lineage and prediction-drift support while preserving existing data.

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

alter table feature_batches enable row level security;
do $$ begin
  create policy feature_batches_public_read on feature_batches for select to anon using (true);
exception when duplicate_object then null;
end $$;

alter table baselines add column if not exists model_uri text;
alter table baselines add column if not exists baseline_predictions_json jsonb;

alter table monitor_runs add column if not exists scenario text;
alter table monitor_runs add column if not exists feature_batch_id uuid references feature_batches(id) on delete set null;
alter table monitor_runs add column if not exists prediction_drift_score double precision;

alter table action_tickets add column if not exists title text;
alter table action_tickets add column if not exists description text;
alter table action_tickets add column if not exists resolved_at timestamptz;
alter table action_tickets add column if not exists resolved_by text;
