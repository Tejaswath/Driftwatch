import { redirect } from "next/navigation";
import AdminActions from "@/components/admin-actions";
import { requireAdminSession } from "@/lib/admin-auth";
import { getPendingRetrainingEvents, getRuns, getSystemHealthStats } from "@/lib/supabase";
import { toUiRuns } from "@/lib/ui-mappers";
import { formatScore } from "@/lib/format";

export default async function AdminPage() {
  const isAdmin = requireAdminSession();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  const [recentRuns, pendingEvents, healthStats] = await Promise.all([
    getRuns(10).catch(() => []).then(toUiRuns),
    getPendingRetrainingEvents().catch(() => []),
    getSystemHealthStats().catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-nordea-navy">Admin Panel</h1>
        <p className="text-sm text-[#6B7280]">
          These actions dispatch GitHub workflows only. Drift compute and privileged writes happen in GitHub
          Actions.
        </p>

        {pendingEvents.length > 0 ? (
          <section className="rounded-lg border-2 border-[#F59E0B] bg-white p-6">
            <h2 className="mb-3 text-lg font-bold text-nordea-navy">
              Pending Retraining Events ({pendingEvents.length})
            </h2>
            <div className="space-y-3">
              {pendingEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between rounded-lg bg-[#FEF3C7] p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-nordea-navy">
                      Policy: <span className="font-mono">{event.policy_name}</span>
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {event.consecutive_red_count} consecutive red runs — PSI:{" "}
                      {formatScore(event.prediction_drift_score, 4)}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      Baseline: {event.baseline_version ?? "—"} · Triggered: {new Date(event.triggered_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F59E0B] px-2 py-1 text-xs font-medium text-white">
                    PENDING
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#6B7280]">
              Approve: use Baseline Refresh below to retrain the champion model.
            </p>
          </section>
        ) : null}

        {healthStats ? (
          <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-nordea-navy">System Health</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">Avg Duration</p>
                <p className="text-xl font-bold text-nordea-navy">
                  {healthStats.avgDurationSeconds.toFixed(0)}s
                </p>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">p95 Duration</p>
                <p className="text-xl font-bold text-nordea-navy">
                  {healthStats.p95DurationSeconds.toFixed(0)}s
                </p>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">Avg Batch Size</p>
                <p className="text-xl font-bold text-nordea-navy">
                  {healthStats.avgBatchSize.toFixed(0)}
                </p>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] p-4">
                <p className="text-xs uppercase text-[#6B7280]">Total Rows</p>
                <p className="text-xl font-bold text-nordea-navy">
                  {healthStats.totalRowsProcessed.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Based on last {healthStats.sampleCount} monitor runs.
            </p>
          </section>
        ) : null}

        <AdminActions initialRuns={recentRuns} />
      </div>
    </div>
  );
}
