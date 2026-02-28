import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronRight, Download } from "lucide-react";
import CollapsibleSection from "@/components/collapsible-section";
import { getActionTicketsByRunId, getFeatureMetricsByRunId, getRunById } from "@/lib/supabase";
import { formatAbsoluteTime, formatDuration, formatRelativeTime, formatScore } from "@/lib/format";
import { DriftBadge, StatusBadge, YesNoBadge } from "@/components/status-badge";
import { toUiRun } from "@/lib/ui-mappers";

type RunDetailPageProps = {
  params: {
    id: string;
  };
};

type PredictionDriftPayload = {
  psi?: number;
  status?: "green" | "yellow" | "red";
  baseline_mean?: number;
  current_mean?: number;
};

function parsePredictionPayload(reportJson: Record<string, unknown> | null): PredictionDriftPayload | null {
  if (!reportJson || typeof reportJson !== "object") {
    return null;
  }
  const prediction = (reportJson as Record<string, unknown>).prediction_drift;
  if (!prediction || typeof prediction !== "object") {
    return null;
  }
  const raw = prediction as Record<string, unknown>;
  return {
    psi: typeof raw.psi === "number" ? raw.psi : undefined,
    status:
      raw.status === "green" || raw.status === "yellow" || raw.status === "red"
        ? raw.status
        : undefined,
    baseline_mean: typeof raw.baseline_mean === "number" ? raw.baseline_mean : undefined,
    current_mean: typeof raw.current_mean === "number" ? raw.current_mean : undefined
  };
}

function predictionMessage(status: "green" | "yellow" | "red" | undefined): string {
  if (status === "red") {
    return "Significant prediction drift. Investigate score distribution changes immediately.";
  }
  if (status === "yellow") {
    return "Moderate prediction drift. Monitor and validate recent population shifts.";
  }
  if (status === "green") {
    return "Prediction distribution remains stable against baseline.";
  }
  return "Prediction drift not available for this run.";
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const runRaw = await getRunById(params.id);

  if (!runRaw) {
    notFound();
  }

  const run = toUiRun(runRaw);
  const [metrics, tickets] = await Promise.all([
    getFeatureMetricsByRunId(run.id).catch(() => []),
    getActionTicketsByRunId(run.id).catch(() => [])
  ]);

  const prediction = parsePredictionPayload(run.reportJson);
  const driftedMetrics = metrics.filter((metric) => metric.drifted);
  const totalFeaturesCount = metrics.length || run.topFeatures.length;
  const driftedFeaturesCount = driftedMetrics.length || run.topFeatures.filter((item) => item.drifted).length;
  const topDrifted = driftedMetrics.length
    ? driftedMetrics.slice(0, 5)
    : run.topFeatures
        .filter((item) => item.drifted)
        .slice(0, 5)
        .map((item) => ({
          feature_name: item.feature,
          test_name: item.test,
          score: item.score,
          p_value: null,
          drifted: item.drifted,
          severity: run.driftStatus
        }));

  const driftColor = run.driftStatus === "red" ? "#EF4444" : run.driftStatus === "yellow" ? "#EAB308" : "#10B981";
  const sourceHint = run.sourceMode === "Live" ? "Live Nordea read path used." : "Synthetic/mock fallback path used.";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-[#6B7280]">
        <Link href="/runs" className="text-nordea-teal hover:underline">
          Runs
        </Link>
        <ChevronRight size={14} />
        <span className="font-mono text-nordea-navy">{run.id}</span>
      </div>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h1 className="mb-4 text-xl font-mono text-nordea-navy">{run.id}</h1>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-[#F4F4F4] px-3 py-1">
            <span className="text-xs text-[#6B7280]">Domain: </span>
            <span className="text-xs font-medium text-nordea-navy">{run.domain}</span>
          </div>
          <StatusBadge status={run.status} />
          <DriftBadge severity={run.driftStatus} />
          <div className="rounded-full bg-[#F4F4F4] px-3 py-1">
            <span className="text-xs text-[#6B7280]">Baseline: </span>
            <span className="text-xs font-medium text-nordea-navy">{run.baselineVersion}</span>
          </div>
          <div className="rounded-full bg-[#F4F4F4] px-3 py-1">
            <span className="text-xs text-[#6B7280]">Scenario: </span>
            <span className="text-xs font-medium text-nordea-navy">{run.scenario ?? "unknown"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
          <div>
            <span className="text-[#6B7280]">Started: </span>
            <span className="text-nordea-navy">{formatRelativeTime(run.startedAt)}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Finished: </span>
            <span className="text-nordea-navy">{formatRelativeTime(run.finishedAt)}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Duration: </span>
            <span className="text-nordea-navy">{formatDuration(run.startedAt, run.finishedAt)}</span>
          </div>
          <div title={formatAbsoluteTime(run.createdAt)}>
            <span className="text-[#6B7280]">Created: </span>
            <span className="text-nordea-navy">{formatRelativeTime(run.createdAt)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E5E5] bg-[#F4F4F4] p-6">
        <h2 className="mb-3 text-lg font-bold text-nordea-navy">Source Context</h2>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full px-3 py-1.5 ${
              run.sourceMode === "Live" ? "bg-nordea-teal" : "bg-[#4A67FF]"
            }`}
          >
            <span className="text-xs font-medium text-white">{run.sourceMode}</span>
          </div>
          <span className="text-sm text-[#6B7280]">{sourceHint}</span>
        </div>
        {run.sourceMode === "Synthetic" ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F59E0B] bg-[#F59E0B]/10 p-3">
            <AlertCircle size={16} className="mt-0.5 text-[#F59E0B]" />
            <p className="text-sm text-nordea-navy">Synthetic mode active - live Nordea OAuth flow is not enabled.</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-nordea-navy">Feature Drift Summary</h2>

        <div className="mb-4 text-center">
          <div className="mb-2 text-5xl font-bold" style={{ color: driftColor }}>
            {formatScore(run.driftRatio)}
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#E5E5E5]">
            <div className="h-full" style={{ width: `${Math.min(100, run.driftRatio * 100)}%`, backgroundColor: driftColor }} />
          </div>
        </div>

        <p className="mb-4 text-center text-sm text-[#6B7280]">
          {driftedFeaturesCount} of {totalFeaturesCount} features drifted
        </p>

        <p className="text-sm text-nordea-navy">
          {run.driftStatus === "red"
            ? "High feature drift detected. Immediate investigation recommended."
            : run.driftStatus === "yellow"
              ? "Moderate feature drift detected. Monitor closely."
              : "Minimal feature drift detected. System performing normally."}
        </p>

        <div className="mt-6">
          <h3 className="mb-3 text-sm uppercase text-[#6B7280]">Top Drifted Features</h3>
          <div className="space-y-2">
            {topDrifted.length ? (
              topDrifted.map((metric) => (
                <div key={metric.feature_name} className="flex items-center justify-between rounded-lg bg-[#F4F4F4] px-3 py-2">
                  <span className="text-sm text-nordea-navy">{metric.feature_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#6B7280]">{metric.test_name}</span>
                    <span className="text-sm font-bold" style={{ color: driftColor }}>
                      {formatScore(metric.score)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#6B7280]">No drift metrics available.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-nordea-navy">Prediction Drift</h2>
        {prediction ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">PSI</p>
                <p className="text-2xl font-bold text-nordea-navy">{formatScore(prediction.psi, 4)}</p>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">Baseline Mean Score</p>
                <p className="text-2xl font-bold text-nordea-navy">{formatScore(prediction.baseline_mean, 4)}</p>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">Current Mean Score</p>
                <p className="text-2xl font-bold text-nordea-navy">{formatScore(prediction.current_mean, 4)}</p>
              </div>
            </div>
            <p className="text-sm text-nordea-navy">{predictionMessage(prediction.status)}</p>
            <DriftBadge severity={prediction.status ?? null} />
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">No prediction drift data (baseline model may not be trained yet).</p>
        )}
      </section>

      <CollapsibleSection title="Feature Metrics" defaultOpen>
        {!metrics.length ? (
          <p className="text-sm text-[#6B7280]">No feature metrics found for this run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F4F4]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Feature</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">P-Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Drifted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Severity</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => (
                  <tr key={`${metric.feature_name}-${metric.test_name}`} className={index % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"}>
                    <td className="px-4 py-3 text-sm text-nordea-navy">{metric.feature_name}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{metric.test_name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-nordea-navy">{formatScore(metric.score)}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{formatScore(metric.p_value, 4)}</td>
                    <td className="px-4 py-3">
                      <YesNoBadge value={metric.drifted} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#6B7280]">{metric.severity?.toUpperCase() ?? "UNKNOWN"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-nordea-navy">Artifacts</h2>
        {run.htmlReportUri ? (
          <a
            href={run.htmlReportUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-nordea-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#008A83]"
          >
            <Download size={16} />
            Download Report
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-[#9CA3AF] px-4 py-2 text-sm font-medium text-white/90"
          >
            <Download size={16} />
            Report Not Available
          </button>
        )}
      </section>

      {run.errorText ? (
        <section className="rounded-lg border-2 border-[#EF4444] bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-[#EF4444]">Error</h2>
          <pre className="overflow-x-auto rounded bg-[#F4F4F4] p-3 font-mono text-sm text-nordea-navy">{run.errorText}</pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-nordea-navy">Investigation Tickets</h2>
        {tickets.length ? (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded-lg bg-[#F4F4F4] px-3 py-2">
                <Link href={`/tickets/${ticket.id}`} className="font-mono text-sm text-nordea-teal hover:underline">
                  {ticket.id}
                </Link>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium text-white ${
                      ticket.status === "open" ? "bg-[#F59E0B]" : "bg-[#10B981]"
                    }`}
                  >
                    {ticket.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#6B7280]" title={formatAbsoluteTime(ticket.created_at)}>
                    {formatRelativeTime(ticket.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">No tickets created for this run.</p>
        )}
      </section>

      <CollapsibleSection title="Compact Report JSON" defaultOpen={false}>
        <pre className="overflow-x-auto rounded bg-[#111827] p-3 font-mono text-xs text-[#F9FAFB]">
          {JSON.stringify(run.reportJson ?? {}, null, 2)}
        </pre>
      </CollapsibleSection>
    </div>
  );
}
