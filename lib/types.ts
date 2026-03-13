export type RunStatus = "queued" | "processing" | "completed" | "failed";
export type DriftStatus = "green" | "yellow" | "red";
export type TicketType = "investigate" | "retrain";

export type MonitorRun = {
  id: string;
  domain_key: string;
  baseline_version: string;
  batch_id: string;
  feature_batch_id: string | null;
  scenario: string | null;
  status: RunStatus;
  drift_status: DriftStatus | null;
  prediction_drift_score: number | null;
  report_json: Record<string, unknown> | null;
  html_report_uri: string | null;
  error_text: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  triggered_by: string | null;
};

export type PerformanceMetric = {
  metric_name: string;
  metric_value: number;
  computed_at: string;
};

export type DataQualityMetric = {
  feature_name: string;
  missing_rate: number | null;
  outlier_rate: number | null;
  schema_change: boolean;
  computed_at: string;
};

export type RetrainingEvent = {
  id: string;
  triggered_at: string;
  policy_name: string;
  consecutive_red_count: number | null;
  prediction_drift_score: number | null;
  status: string;
  baseline_version: string | null;
  notes: string | null;
};

export type SystemHealthStats = {
  avgDurationSeconds: number;
  avgBatchSize: number;
  totalRowsProcessed: number;
  p95DurationSeconds: number;
  sampleCount: number;
};

export type DomainHeartbeat = {
  key: string;
  last_worker_heartbeat: string | null;
};

export type FeatureDriftMetric = {
  feature_name: string;
  test_name: string;
  score: number | null;
  p_value: number | null;
  drifted: boolean;
  severity: string | null;
};

export type ActionTicket = {
  id: string;
  run_id: string;
  ticket_type: TicketType;
  status: string;
  payload: Record<string, unknown> | null;
  title: string | null;
  description: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type DriftTopFeature = {
  feature: string;
  test: string;
  score: number;
  drifted: boolean;
};

export type UiSourceMode = "Live" | "Synthetic";

export type UiRun = {
  id: string;
  domain: string;
  status: RunStatus;
  driftStatus: DriftStatus | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  baselineVersion: string;
  batchId: string;
  featureBatchId: string | null;
  scenario: string | null;
  errorText: string | null;
  reportJson: Record<string, unknown> | null;
  htmlReportUri: string | null;
  predictionDriftScore: number | null;
  sourceMode: UiSourceMode;
  driftRatio: number;
  topFeatures: DriftTopFeature[];
  triggeredBy: string | null;
};
