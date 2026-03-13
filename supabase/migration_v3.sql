-- DriftWatch Migration v3
-- Adds: model performance metrics, retraining events, data quality metrics,
--       alert logs, monitoring metrics, baseline lineage columns,
--       champion/challenger support, triggered_by on monitor_runs

-- ─────────────────────────────────────────────
-- 1. model_performance_metrics
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES monitor_runs(id) ON DELETE CASCADE,
  metric_name text NOT NULL,   -- accuracy | precision | recall | f1 | auc
  metric_value float NOT NULL,
  computed_at timestamptz DEFAULT now()
);

ALTER TABLE model_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read model_performance_metrics"
  ON model_performance_metrics FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_model_perf_run_id
  ON model_performance_metrics (run_id);

-- ─────────────────────────────────────────────
-- 2. retraining_events
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retraining_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz DEFAULT now(),
  trigger_run_id uuid REFERENCES monitor_runs(id) ON DELETE SET NULL,
  policy_name text NOT NULL,          -- e.g. "consecutive_red_3"
  consecutive_red_count int,
  prediction_drift_score float,
  status text DEFAULT 'pending',      -- pending | dispatched | skipped | cancelled
  baseline_version text,
  notes text
);

ALTER TABLE retraining_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read retraining_events"
  ON retraining_events FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_retraining_events_status
  ON retraining_events (status);

-- ─────────────────────────────────────────────
-- 3. data_quality_metrics
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES monitor_runs(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  missing_rate float,
  outlier_rate float,
  null_ratio float,
  schema_change boolean DEFAULT false,
  computed_at timestamptz DEFAULT now()
);

ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read data_quality_metrics"
  ON data_quality_metrics FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_data_quality_run_id
  ON data_quality_metrics (run_id);

-- ─────────────────────────────────────────────
-- 4. alert_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES monitor_runs(id) ON DELETE SET NULL,
  channel text NOT NULL,       -- github_issue | slack | webhook
  status text NOT NULL,        -- sent | failed | skipped
  response_code int,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read alert_logs"
  ON alert_logs FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_alert_logs_run_id
  ON alert_logs (run_id);

-- ─────────────────────────────────────────────
-- 5. monitoring_metrics (system observability)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES monitor_runs(id) ON DELETE CASCADE,
  run_duration_seconds float,
  batch_size int,
  features_processed int,
  rows_processed int,
  baseline_rows int,
  evidently_report_size_bytes int,
  psi_compute_ms int,
  total_compute_ms int,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read monitoring_metrics"
  ON monitoring_metrics FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_run_id
  ON monitoring_metrics (run_id);

-- ─────────────────────────────────────────────
-- 6. Extend monitor_runs: triggered_by + comparison_run_id
-- ─────────────────────────────────────────────
ALTER TABLE monitor_runs
  ADD COLUMN IF NOT EXISTS triggered_by text DEFAULT 'cron';

ALTER TABLE monitor_runs
  ADD COLUMN IF NOT EXISTS comparison_run_id uuid REFERENCES monitor_runs(id);

-- ─────────────────────────────────────────────
-- 7. Extend baselines: lineage + champion/challenger
-- ─────────────────────────────────────────────
ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS model_role text DEFAULT 'champion';

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS training_commit_hash text;

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS training_dataset_id text;

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS metrics_json jsonb;

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

ALTER TABLE baselines
  ADD COLUMN IF NOT EXISTS promoted_by text;
