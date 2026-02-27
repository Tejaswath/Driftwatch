"use client";

import { FormEvent, useState } from "react";

type ActionResult = {
  status: string;
  workflow_run_url?: string;
  error?: string;
};

type ActionConfig = {
  label: string;
  endpoint: string;
  body?: Record<string, string>;
};

const ACTIONS: ActionConfig[] = [
  {
    label: "Run Drift",
    endpoint: "/api/admin/run",
    body: { domain: "nordea", baseline_version: "v1" }
  },
  {
    label: "Seed Nordea",
    endpoint: "/api/admin/seed",
    body: { profile: "stable_salary_profile" }
  },
  {
    label: "Sync Nordea",
    endpoint: "/api/admin/sync",
    body: { domain: "nordea" }
  },
  {
    label: "Refresh Baseline",
    endpoint: "/api/admin/baseline-refresh",
    body: { domain: "nordea", schema_version: "v1" }
  }
];

export default function AdminActions() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isLoading, setLoading] = useState<string | null>(null);

  async function onAction(event: FormEvent<HTMLFormElement>, action: ActionConfig) {
    event.preventDefault();
    setLoading(action.label);
    setResult(null);

    const response = await fetch(action.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(action.body ?? {})
    });

    const payload = (await response.json().catch(() => ({}))) as ActionResult;

    if (!response.ok) {
      setResult({ status: "failed", error: payload.error ?? "Request failed" });
      setLoading(null);
      return;
    }

    setResult(payload);
    setLoading(null);
  }

  return (
    <section className="stack">
      {ACTIONS.map((action) => (
        <form key={action.label} onSubmit={(event) => onAction(event, action)}>
          <button type="submit" disabled={Boolean(isLoading)}>
            {isLoading === action.label ? `${action.label}...` : action.label}
          </button>
        </form>
      ))}

      {result ? (
        <div className="card stack">
          <strong>Status:</strong> {result.status}
          {result.workflow_run_url ? (
            <div className="stack">
              <a href={result.workflow_run_url} target="_blank" rel="noreferrer">
                Open GitHub workflow
              </a>
              <small>
                This link is for workflow debugging. New run rows appear in <code>/runs</code> after workflow
                completion.
              </small>
            </div>
          ) : null}
          {result.error ? <p className="error">{result.error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
