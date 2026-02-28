"use client";

import { FormEvent, useState } from "react";
import {
  Database,
  ExternalLink,
  FlaskConical,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import type { UiRun } from "@/lib/types";

type ActionResult = {
  status: string;
  workflow_run_url?: string;
  error?: string;
};

type ActionConfig = {
  label: string;
  endpoint: string;
  description: string;
  icon: "seed" | "sync" | "run" | "baseline" | "generate";
};

type HistoryItem = {
  action: string;
  domain: string;
  status: "completed" | "failed" | "processing" | "queued" | "dispatched";
  timestamp: string;
};

type AdminActionsProps = {
  initialRuns: UiRun[];
};

const ACTIONS: ActionConfig[] = [
  {
    label: "Run Drift",
    endpoint: "/api/admin/run",
    description: "Execute drift detection analysis",
    icon: "run"
  },
  {
    label: "Generate Batch",
    endpoint: "/api/admin/generate-batch",
    description: "Generate scenario batch for controlled drift testing",
    icon: "generate"
  },
  {
    label: "Seed Nordea",
    endpoint: "/api/admin/seed",
    description: "Generate synthetic transaction payloads for auditable demos",
    icon: "seed"
  },
  {
    label: "Sync Nordea",
    endpoint: "/api/admin/sync",
    description: "Build feature batch from configured source path",
    icon: "sync"
  },
  {
    label: "Refresh Baseline",
    endpoint: "/api/admin/baseline-refresh",
    description: "Retrain baseline model and update baseline distribution",
    icon: "baseline"
  }
];

function mapRunsToHistory(runs: UiRun[]): HistoryItem[] {
  return runs.map((run) => ({
    action: "Run Drift",
    domain: run.domain,
    status: run.status,
    timestamp: run.createdAt
  }));
}

function ActionIcon({ type }: { type: ActionConfig["icon"] }) {
  if (type === "seed") {
    return <Database size={24} className="text-nordea-navy" />;
  }
  if (type === "sync") {
    return <RefreshCw size={24} className="text-nordea-navy" />;
  }
  if (type === "baseline") {
    return <RotateCcw size={24} className="text-nordea-navy" />;
  }
  if (type === "generate") {
    return <FlaskConical size={24} className="text-nordea-navy" />;
  }
  return <PlayCircle size={24} className="text-nordea-navy" />;
}

export default function AdminActions({ initialRuns }: AdminActionsProps) {
  const [domain, setDomain] = useState("nordea");
  const [baselineVersion, setBaselineVersion] = useState("v1");
  const [batchId, setBatchId] = useState("");
  const [seedProfile, setSeedProfile] = useState("stable_salary_profile");
  const [scenario, setScenario] = useState("stable_salary");
  const [rows, setRows] = useState("100");
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isLoading, setLoading] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(mapRunsToHistory(initialRuns));

  async function onAction(event: FormEvent<HTMLFormElement>, action: ActionConfig) {
    event.preventDefault();
    setLoading(action.label);
    setResult(null);

    const body: Record<string, string> = {
      domain,
      baseline_version: baselineVersion,
      scenario,
      rows
    };
    if (batchId.trim()) {
      body.batch_id = batchId.trim();
    }
    if (seed.trim()) {
      body.seed = seed.trim();
    }

    if (action.label === "Run Drift") {
      body.scenario = "latest";
    }
    if (action.label === "Seed Nordea") {
      body.profile = seedProfile;
    }
    if (action.label === "Refresh Baseline") {
      body.schema_version = baselineVersion;
    }

    const response = await fetch(action.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as ActionResult;

    if (!response.ok) {
      setResult({ status: "failed", error: payload.error ?? "Request failed" });
      toast.error(`${action.label} failed`);
      setLoading(null);
      return;
    }

    setResult(payload);
    toast.success(`${action.label} dispatched successfully`);

    setHistory((prev) => [
      {
        action: action.label,
        domain,
        status: "dispatched",
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);

    setLoading(null);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-nordea-navy">Configuration</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Domain</label>
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Baseline Version</label>
            <input
              value={baselineVersion}
              onChange={(event) => setBaselineVersion(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Batch ID (Optional)</label>
            <input
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              placeholder="Leave empty for auto"
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Scenario</label>
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            >
              <option value="stable_salary">Stable salary</option>
              <option value="inflation_shift">Inflation shift</option>
              <option value="subscription_spike">Subscription spike</option>
              <option value="income_drop">Income drop</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Rows</label>
            <input
              value={rows}
              onChange={(event) => setRows(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Seed (Optional)</label>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="e.g. 42"
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Seed Profile (nordea_seed)</label>
            <select
              value={seedProfile}
              onChange={(event) => setSeedProfile(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            >
              <option value="stable_salary_profile">Stable salary</option>
              <option value="inflation_shift_profile">Inflation shift</option>
              <option value="income_drop_profile">Income drop</option>
              <option value="subscription_spike_profile">Subscription spike</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {ACTIONS.map((action) => (
          <div key={action.label} className="rounded-lg border border-[#E5E5E5] border-t-4 border-t-nordea-navy bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-nordea-navy/10">
                <ActionIcon type={action.icon} />
              </div>
              <div className="w-full">
                <h3 className="mb-2 text-lg font-bold text-nordea-navy">{action.label}</h3>
                <p className="mb-4 text-sm text-[#6B7280]">{action.description}</p>
                <form onSubmit={(event) => onAction(event, action)}>
                  <button
                    type="submit"
                    disabled={Boolean(isLoading)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-nordea-teal text-sm font-medium text-white transition-colors hover:bg-[#008A83] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading === action.label ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Dispatching...
                      </>
                    ) : (
                      action.label
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      {result ? (
        <div className="rounded-lg border border-[#10B981] bg-[#10B981]/10 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#10B981] text-white">✓</div>
            <div className="w-full">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-bold text-nordea-navy">Latest dispatch</span>
                <span className="rounded-full bg-[#10B981] px-2 py-0.5 text-xs font-medium text-white">Dispatched</span>
              </div>
              {result.workflow_run_url ? (
                <a
                  href={result.workflow_run_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-nordea-teal hover:underline"
                >
                  View on GitHub
                  <ExternalLink size={14} />
                </a>
              ) : null}
              {result.error ? <p className="mt-2 text-sm text-[#EF4444]">{result.error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-nordea-navy">Recent History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F4F4F4]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.slice(0, 10).map((item, index) => (
                  <tr key={`${item.action}-${item.timestamp}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"}>
                    <td className="px-4 py-3 text-sm text-nordea-navy">{item.action}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{item.domain}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium text-white ${
                          item.status === "completed"
                            ? "bg-[#10B981]"
                            : item.status === "failed"
                              ? "bg-[#EF4444]"
                              : item.status === "processing" || item.status === "queued"
                                ? "bg-[#F59E0B]"
                                : "bg-nordea-teal"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{formatRelativeTime(item.timestamp)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                    No admin actions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
