import { publicConfig } from "@/lib/config";
import type { ActionTicket, DomainHeartbeat, FeatureDriftMetric, MonitorRun } from "@/lib/types";

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

async function supabaseGet<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      ...DEFAULT_HEADERS
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase GET failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

export async function getRuns(limit = 30): Promise<MonitorRun[]> {
  return supabaseGet<MonitorRun[]>(
    `monitor_runs?select=id,domain_key,baseline_version,batch_id,feature_batch_id,scenario,status,drift_status,prediction_drift_score,report_json,html_report_uri,error_text,started_at,finished_at,created_at&order=created_at.desc&limit=${limit}`
  );
}

export async function getRunById(id: string): Promise<MonitorRun | null> {
  const escapedId = encodeURIComponent(id);
  const rows = await supabaseGet<MonitorRun[]>(
    `monitor_runs?select=id,domain_key,baseline_version,batch_id,feature_batch_id,scenario,status,drift_status,prediction_drift_score,report_json,html_report_uri,error_text,started_at,finished_at,created_at&id=eq.${escapedId}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getFeatureMetricsByRunId(runId: string): Promise<FeatureDriftMetric[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<FeatureDriftMetric[]>(
    `feature_drift_metrics?select=feature_name,test_name,score,p_value,drifted,severity&run_id=eq.${escapedId}&order=score.desc.nullslast`
  );
}

export async function getDomainHeartbeats(): Promise<DomainHeartbeat[]> {
  return supabaseGet<DomainHeartbeat[]>(
    "domains?select=key,last_worker_heartbeat,enabled&enabled=eq.true&order=key.asc"
  );
}

export async function getActionTicketsByRunId(runId: string): Promise<ActionTicket[]> {
  const escapedId = encodeURIComponent(runId);
  return supabaseGet<ActionTicket[]>(
    `action_tickets?select=id,run_id,ticket_type,status,payload,title,description,resolved_at,resolved_by,created_at&run_id=eq.${escapedId}&order=created_at.desc`
  );
}

export async function getTicketById(ticketId: string): Promise<ActionTicket | null> {
  const escapedId = encodeURIComponent(ticketId);
  const rows = await supabaseGet<ActionTicket[]>(
    `action_tickets?select=id,run_id,ticket_type,status,payload,title,description,resolved_at,resolved_by,created_at&id=eq.${escapedId}&limit=1`
  );
  return rows[0] ?? null;
}
