export type RunStatus = "queued" | "processing" | "completed" | "failed";
export type DriftStatus = "green" | "yellow" | "red";
export type TicketType = "investigate" | "retrain";

export type MonitorRun = {
  id: string;
  domain_key: string;
  baseline_version: string;
  batch_id: string;
  status: RunStatus;
  drift_status: DriftStatus | null;
  report_json: Record<string, unknown> | null;
  html_report_uri: string | null;
  error_text: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
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
  ticket_type: TicketType;
  status: string;
  created_at: string;
};

export type DriftTopFeature = {
  feature: string;
  test: string;
  score: number;
  drifted: boolean;
};

export type UiSourceMode = "Live" | "Mock";

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
  errorText: string | null;
  reportJson: Record<string, unknown> | null;
  htmlReportUri: string | null;
  sourceMode: UiSourceMode;
  driftRatio: number;
  topFeatures: DriftTopFeature[];
};
