import type { DriftTopFeature, MonitorRun, UiRun, UiSourceMode } from "@/lib/types";

type DriftPayload = {
  drift?: {
    drift_ratio?: unknown;
    top_features?: unknown;
    deterministic_summary?: unknown;
  };
  source?: {
    source_mode?: unknown;
    scenario?: unknown;
  };
};

function parseTopFeatures(value: unknown): DriftTopFeature[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const feature = typeof row.feature === "string" ? row.feature : "";
      const test = typeof row.test === "string" ? row.test : "";
      const score = typeof row.score === "number" ? row.score : NaN;
      const drifted = typeof row.drifted === "boolean" ? row.drifted : false;
      if (!feature || !test || Number.isNaN(score)) {
        return null;
      }
      return { feature, test, score, drifted };
    })
    .filter((row): row is DriftTopFeature => Boolean(row));
}

function inferSourceMode(payload: DriftPayload, run: MonitorRun): UiSourceMode {
  const sourceMode = payload.source?.source_mode;
  if (typeof sourceMode === "string") {
    const normalized = sourceMode.toLowerCase();
    return normalized === "live" ? "Live" : "Synthetic";
  }

  const reason = run.error_text?.toLowerCase() ?? "";
  if (reason.includes("live")) {
    return "Live";
  }
  return "Synthetic";
}

function parseDriftPayload(run: MonitorRun): DriftPayload {
  if (!run.report_json || typeof run.report_json !== "object") {
    return {};
  }
  return run.report_json as DriftPayload;
}

export function toUiRun(run: MonitorRun): UiRun {
  const payload = parseDriftPayload(run);
  const driftRatioRaw = payload.drift?.drift_ratio;
  const driftRatio = typeof driftRatioRaw === "number" ? driftRatioRaw : 0;
  const topFeatures = parseTopFeatures(payload.drift?.top_features);

  return {
    id: run.id,
    domain: run.domain_key,
    status: run.status,
    driftStatus: run.drift_status,
    createdAt: run.created_at,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    baselineVersion: run.baseline_version,
    batchId: run.batch_id,
    featureBatchId: run.feature_batch_id,
    scenario:
      typeof payload.source?.scenario === "string"
        ? payload.source.scenario
        : run.scenario,
    errorText: run.error_text,
    reportJson: run.report_json,
    htmlReportUri: run.html_report_uri,
    predictionDriftScore: run.prediction_drift_score,
    sourceMode: inferSourceMode(payload, run),
    driftRatio,
    topFeatures
  };
}

export function toUiRuns(runs: MonitorRun[]): UiRun[] {
  return runs.map(toUiRun);
}
