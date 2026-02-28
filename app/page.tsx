import Link from "next/link";
import { PlayCircle } from "lucide-react";
import CopyRunIdButton from "@/components/copy-run-id-button";
import DriftTrendChart from "@/components/drift-trend-chart";
import LandingHero from "@/components/landing-hero";
import { DriftBadge, StatusBadge, YesNoBadge } from "@/components/status-badge";
import { formatRelativeTime, formatScore } from "@/lib/format";
import { getRuns } from "@/lib/supabase";
import { toUiRuns } from "@/lib/ui-mappers";

export default async function DashboardPage() {
  const runs = toUiRuns(await getRuns(50).catch(() => []));
  const latestRun = runs[0] ?? null;

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recentRuns = runs.filter((run) => new Date(run.createdAt).getTime() > oneDayAgo);
  const recentFailedRuns = recentRuns.filter((run) => run.status === "failed");
  const redDriftRuns = runs.filter(
    (run) => new Date(run.createdAt).getTime() > sevenDaysAgo && run.driftStatus === "red"
  );

  const chartData = runs
    .slice(0, 20)
    .reverse()
    .map((run) => ({
      time: new Date(run.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      ratio: run.driftRatio,
      runId: run.id
    }));

  const topDriftingFeatures = latestRun?.topFeatures.slice(0, 10) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-6">
        <LandingHero hasRuns={runs.length > 0} />

        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <div className="grid gap-6 md:grid-cols-5">
            <div className="space-y-2 md:col-span-3">
              <h1 className="text-[28px] font-bold text-nordea-navy">Drift Monitoring Overview</h1>
              <p className="text-sm text-[#6B7280]">
                Real-time monitoring of feature drift across production models. Automated detection and alerting
                for data distribution changes that may impact model performance.
              </p>
            </div>

            <div className="rounded-lg bg-[#F4F4F4] p-4 md:col-span-2">
              <div className="mb-3 text-xs uppercase text-[#6B7280]">Latest Run</div>
              {latestRun ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <code className="text-sm font-medium text-nordea-navy">{latestRun.id}</code>
                    <CopyRunIdButton runId={latestRun.id} />
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <StatusBadge status={latestRun.status} />
                    <DriftBadge severity={latestRun.driftStatus} />
                  </div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-[#6B7280]">Domain:</span>
                    <span className="font-medium text-nordea-navy">{latestRun.domain}</span>
                  </div>
                  <div className="text-sm text-[#6B7280]">{formatRelativeTime(latestRun.createdAt)}</div>
                </>
              ) : (
                <p className="text-sm text-[#6B7280]">No runs available yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
            <div className="mb-2 text-xs uppercase text-[#6B7280]">Runs 24h</div>
            <div className="text-[32px] font-bold text-nordea-navy">{recentRuns.length}</div>
          </div>
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
            <div className="mb-2 text-xs uppercase text-[#6B7280]">Failed 24h</div>
            <div className={`text-[32px] font-bold ${recentFailedRuns.length ? "text-[#EF4444]" : "text-nordea-navy"}`}>
              {recentFailedRuns.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
            <div className="mb-2 text-xs uppercase text-[#6B7280]">Red Drift 7d</div>
            <div className="text-[32px] font-bold text-nordea-navy">{redDriftRuns.length}</div>
          </div>
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
            <div className="mb-2 text-xs uppercase text-[#6B7280]">Source Mode</div>
            <div className="mt-2 inline-flex items-center rounded-full bg-[#4A67FF] px-3 py-1.5 text-xs font-medium text-white">
              {latestRun?.sourceMode ?? "Synthetic"}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <h2 className="mb-4 text-xl font-bold text-nordea-navy">Drift Trend</h2>
          <DriftTrendChart data={chartData} />
        </div>

        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <h2 className="mb-4 text-xl font-bold text-nordea-navy">Top Drifting Features</h2>
          {!topDriftingFeatures.length ? (
            <p className="text-sm text-[#6B7280]">No drift features found in latest run report.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E5E5]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Feature</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Test</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Drifted</th>
                  </tr>
                </thead>
                <tbody>
                  {topDriftingFeatures.map((metric, index) => (
                    <tr key={`${metric.feature}-${metric.test}`} className={index % 2 === 0 ? "bg-[#F9F9F9]" : "bg-white"}>
                      <td className="px-4 py-3 text-sm text-nordea-navy">{metric.feature}</td>
                      <td className="px-4 py-3 text-sm text-[#6B7280]">{metric.test}</td>
                      <td className="px-4 py-3 text-sm font-medium text-nordea-navy">{formatScore(metric.score)}</td>
                      <td className="px-4 py-3">
                        <YesNoBadge value={metric.drifted} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Link href="/runs" className="text-sm text-nordea-teal hover:underline">
              View all runs →
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-nordea-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#008A83]"
            >
              <PlayCircle size={16} />
              Run Monitoring Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
