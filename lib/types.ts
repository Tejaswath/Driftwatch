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
