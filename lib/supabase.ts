import { publicConfig } from "@/lib/config";
import type { DomainHeartbeat, MonitorRun } from "@/lib/types";

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
    `monitor_runs?select=id,domain_key,baseline_version,batch_id,status,drift_status,report_json,html_report_uri,error_text,started_at,finished_at,created_at&order=created_at.desc&limit=${limit}`
  );
}

export async function getRunById(id: string): Promise<MonitorRun | null> {
  const escapedId = encodeURIComponent(id);
  const rows = await supabaseGet<MonitorRun[]>(
    `monitor_runs?select=id,domain_key,baseline_version,batch_id,status,drift_status,report_json,html_report_uri,error_text,started_at,finished_at,created_at&id=eq.${escapedId}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getDomainHeartbeats(): Promise<DomainHeartbeat[]> {
  return supabaseGet<DomainHeartbeat[]>(
    "domains?select=key,last_worker_heartbeat,enabled&enabled=eq.true&order=key.asc"
  );
}
