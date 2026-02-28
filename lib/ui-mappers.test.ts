import { describe, expect, it } from "vitest";
import { toUiRun, toUiRuns } from "./ui-mappers";
import type { MonitorRun } from "./types";

function buildRun(overrides: Partial<MonitorRun> = {}): MonitorRun {
  return {
    id: "run-1",
    domain_key: "nordea",
    baseline_version: "v1",
    batch_id: "batch-1",
    feature_batch_id: "fb-1",
    scenario: "stable_salary",
    status: "completed",
    drift_status: "red",
    prediction_drift_score: 0.2,
    report_json: {
      source: {
        source_mode: "synthetic",
        scenario: "stable_salary"
      },
      drift: {
        drift_ratio: 0.9,
        top_features: [
          {
            feature: "daily_spend_30d",
            test: "K-S p_value",
            score: 0.32,
            drifted: true
          }
        ]
      }
    },
    html_report_uri: "https://example.com/report.html",
    error_text: null,
    started_at: "2026-02-28T10:00:00.000Z",
    finished_at: "2026-02-28T10:01:00.000Z",
    created_at: "2026-02-28T10:00:00.000Z",
    ...overrides
  };
}

describe("toUiRun", () => {
  it("maps drift ratio and top features from report payload", () => {
    const mapped = toUiRun(buildRun());
    expect(mapped.driftRatio).toBe(0.9);
    expect(mapped.topFeatures).toHaveLength(1);
    expect(mapped.topFeatures[0]?.feature).toBe("daily_spend_30d");
    expect(mapped.sourceMode).toBe("Synthetic");
  });

  it("falls back safely when report payload is missing", () => {
    const mapped = toUiRun(buildRun({ report_json: null, drift_status: null }));
    expect(mapped.driftRatio).toBe(0);
    expect(mapped.topFeatures).toEqual([]);
    expect(mapped.driftStatus).toBeNull();
  });
});

describe("toUiRuns", () => {
  it("maps array of runs", () => {
    const mapped = toUiRuns([buildRun({ id: "a" }), buildRun({ id: "b" })]);
    expect(mapped.map((run) => run.id)).toEqual(["a", "b"]);
  });
});
