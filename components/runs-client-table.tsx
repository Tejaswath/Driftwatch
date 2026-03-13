"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DriftStatus, RunStatus, UiRun } from "@/lib/types";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import { DriftIndicator, StatusBadge } from "@/components/status-badge";

const ROWS_PER_PAGE = 20;

type RunsClientTableProps = {
  runs: UiRun[];
};

export default function RunsClientTable({ runs }: RunsClientTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterDomain = searchParams.get("domain") ?? "all";
  const filterStatus = (searchParams.get("status") ?? "all") as RunStatus | "all";
  const filterDrift = (searchParams.get("drift") ?? "all") as DriftStatus | "all";
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function setPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const domains = useMemo(() => Array.from(new Set(runs.map((run) => run.domain))).sort(), [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (filterDomain !== "all" && run.domain !== filterDomain) return false;
      if (filterStatus !== "all" && run.status !== filterStatus) return false;
      if (filterDrift !== "all" && run.driftStatus !== filterDrift) return false;
      return true;
    });
  }, [runs, filterDomain, filterStatus, filterDrift]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ROWS_PER_PAGE;
  const currentRuns = filteredRuns.slice(startIndex, startIndex + ROWS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Domain</label>
            <select
              value={filterDomain}
              onChange={(e) => updateFilter("domain", e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            >
              <option value="all">All Domains</option>
              {domains.map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#6B7280]">Drift</label>
            <select
              value={filterDrift}
              onChange={(e) => updateFilter("drift", e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            >
              <option value="all">All Levels</option>
              <option value="green">No Drift</option>
              <option value="yellow">Moderate</option>
              <option value="red">High Drift</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F4F4F4]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Scenario</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Drift</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Baseline</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Triggered</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B7280]">Created</th>
              </tr>
            </thead>
            <tbody>
              {!currentRuns.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                    No runs recorded for the selected filters.
                  </td>
                </tr>
              ) : (
                currentRuns.map((run, index) => (
                  <tr key={run.id} className={index % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"}>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/runs/${run.id}`} className="font-mono text-nordea-teal hover:underline">
                        {run.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-nordea-navy">{run.domain}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      <span className="inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#1D2AB7]">
                        {run.scenario ?? "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DriftIndicator severity={run.driftStatus} showLabel />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{run.baselineVersion}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      {run.triggeredBy === "admin" ? (
                        <span className="inline-flex rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                          admin
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">cron</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]" title={formatAbsoluteTime(run.createdAt)}>
                      {formatRelativeTime(run.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {currentRuns.length ? (
          <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3">
            <div className="text-sm text-[#6B7280]">
              Showing {startIndex + 1}–{Math.min(startIndex + ROWS_PER_PAGE, filteredRuns.length)} of{" "}
              {filteredRuns.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                aria-label="Previous page"
                className="rounded-lg border border-[#E5E5E5] px-3 py-1 text-sm text-[#6B7280] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-nordea-navy">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === totalPages}
                aria-label="Next page"
                className="rounded-lg border border-[#E5E5E5] px-3 py-1 text-sm text-[#6B7280] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
