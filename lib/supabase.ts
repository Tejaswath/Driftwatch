import { publicConfig } from "@/lib/config";
import type {
  ActionTicket,
  DataQualityMetric,
  DomainHeartbeat,
  FeatureDriftMetric,
  MonitorRun,
  PerformanceMetric,
  RetrainingEvent,
  SystemHealthStats,
} from "@/lib/types";

const DEFAULT_HEADERS = {
  apikey: publicConfig.supabaseAnonKey,
  Authorization: `Bearer ${publicConfig.supabaseAnonKey}`
};

function buildUrl(path: string): string {
  if (!publicConfig.supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }
  return `${publicConfig.supabaseUrl}/rest/v1/${path}`;
}

function getAdminHeaders(): Record<string, string> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function supabaseGet<T>(path: string, revalidate?: number): Promise<T> {
  const fetchOptions: RequestInit = {
    headers: { ...DEFAULT_HEADERS },
  };
  if (revalidate !== undefined) {
    fetchOptions.next = { revalidate };
  } else {
    fetchOptions.cache = "no-store";
  }

  const response = await fetch(buildUrl(path), fetchOptions);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase GET failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

// Runs list: omit report_json (50-200KB each) to reduce payload by ~80%
const RUNS_LIST_COLUMNS =
  "id,domain_key,baseline_version,batch_id,feature_batch_id,scenario,status,drift_status,prediction_drift_score,html_report_uri,error_text,started_at,finished_at,created_at,triggered_by";

// Run detail: include report_json for full analysis
const RUN_DETAIL_COLUMNS =
  "id,domain_key,baseline_version,batch_id,feature_batch_id,scenario,status,drift_status,prediction_drift_score,report_json,html_report_uri,error_text,started_at,finished_at,created_at,triggered_by";

export async function getRuns(limit = 30): Promise<MonitorRun[]> {
  return supabaseGet<MonitorRun[]>(
    `monitor_runs?select=${RUNS_LIST_COLUMNS}&order=created_at.desc&limit=${limit}`,
    60
  );
}

export async function getRunById(id: string): Promise<MonitorRun | null> {
  const escapedId = encodeURIComponent(id);
  const rows = await supabaseGet<MonitorRun[]>(
    `monitor_runs?select=${RUN_DETAIL_COLUMNS}&id=eq.${escapedId}&limit=1`,
    30
  );
  return rows[0] ?? null;
}

export async function getFeatureMetricsByRunId(runId: string): Promise<FeatureDriftMetric[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<FeatureDriftMetric[]>(
    `feature_drift_metrics?select=feature_name,score,p_value,drifted,severity&run_id=eq.${escapedId}&order=score.desc.nullslast`,
    30
  );
}

export async function getDomainHeartbeats(): Promise<DomainHeartbeat[]> {
  return supabaseGet<DomainHeartbeat[]>(
    "domains?select=key,last_worker_heartbeat,enabled&enabled=eq.true&order=key.asc",
    60
  );
}

export async function getActionTicketsByRunId(runId: string): Promise<ActionTicket[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<ActionTicket[]>(
    `action_tickets?select=id,run_id,ticket_type,status,payload,title,description,resolved_at,resolved_by,created_at&run_id=eq.${escapedId}&order=created_at.desc`,
    30
  );
}

export async function getTicketById(ticketId: string): Promise<ActionTicket | null> {
  const escapedId = encodeURIComponent(ticketId);
  const rows = await supabaseGet<ActionTicket[]>(
    `action_tickets?select=id,run_id,ticket_type,status,payload,title,description,resolved_at,resolved_by,created_at&id=eq.${escapedId}&limit=1`,
    30
  );
  return rows[0] ?? null;
}

export async function getPerformanceMetricsByRunId(runId: string): Promise<PerformanceMetric[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<PerformanceMetric[]>(
    `model_performance_metrics?select=metric_name,metric_value,computed_at&run_id=eq.${escapedId}&order=metric_name.asc`,
    30
  );
}

export async function getDataQualityMetricsByRunId(runId: string): Promise<DataQualityMetric[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<DataQualityMetric[]>(
    `data_quality_metrics?select=feature_name,missing_rate,outlier_rate,schema_change,computed_at&run_id=eq.${escapedId}&order=missing_rate.desc.nullslast`,
    30
  );
}

export async function getPendingRetrainingEvents(): Promise<RetrainingEvent[]> {
  return supabaseGet<RetrainingEvent[]>(
    "retraining_events?select=id,triggered_at,policy_name,consecutive_red_count,prediction_drift_score,status,baseline_version,notes&status=eq.pending&order=triggered_at.desc&limit=10",
    30
  );
}

export async function getSystemHealthStats(): Promise<SystemHealthStats | null> {
  const rows = await supabaseGet<Array<Record<string, unknown>>>(
    "monitoring_metrics?select=run_duration_seconds,batch_size,rows_processed,recorded_at&order=recorded_at.desc&limit=50",
    60
  );
  if (!rows.length) return null;

  const durations = rows
    .map((r) => r.run_duration_seconds as number)
    .filter((v) => v != null);
  const batches = rows
    .map((r) => r.batch_size as number)
    .filter((v) => v != null);
  const rowCounts = rows
    .map((r) => r.rows_processed as number)
    .filter((v) => v != null);

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const sorted = [...durations].sort((a, b) => a - b);
  const p95 =
    sorted.length
      ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]
      : 0;

  return {
    avgDurationSeconds: avg(durations),
    avgBatchSize: avg(batches),
    totalRowsProcessed: rowCounts.reduce((a, b) => a + b, 0),
    p95DurationSeconds: p95,
    sampleCount: rows.length,
  };
}

// Admin write functions — server-only (require SUPABASE_SERVICE_ROLE_KEY)

export async function adminUpdateTicket(
  ticketId: string,
  data: Partial<{ status: string; resolved_at: string; resolved_by: string }>
): Promise<ActionTicket> {
  const serviceUrl = `${publicConfig.supabaseUrl}/rest/v1/action_tickets?id=eq.${encodeURIComponent(ticketId)}`;
  const response = await fetch(serviceUrl, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`adminUpdateTicket failed (${response.status}): ${detail}`);
  }
  const rows = (await response.json()) as ActionTicket[];
  if (!rows[0]) throw new Error("adminUpdateTicket: no row returned");
  return rows[0];
}

export async function adminUpdateRetrainingEvent(
  eventId: string,
  data: Partial<{ status: string; notes: string }>
): Promise<RetrainingEvent> {
  const serviceUrl = `${publicConfig.supabaseUrl}/rest/v1/retraining_events?id=eq.${encodeURIComponent(eventId)}`;
  const response = await fetch(serviceUrl, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`adminUpdateRetrainingEvent failed (${response.status}): ${detail}`);
  }
  const rows = (await response.json()) as RetrainingEvent[];
  if (!rows[0]) throw new Error("adminUpdateRetrainingEvent: no row returned");
  return rows[0];
}
