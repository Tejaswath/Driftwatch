"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TicketActionsProps = {
  ticketId: string;
  currentStatus: string;
};

export default function TicketActions({ ticketId, currentStatus }: TicketActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"acknowledge" | "resolve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (currentStatus === "resolved") {
    return null;
  }

  async function handleAction(action: "acknowledge" | "resolve") {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolved_by: "admin" }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {currentStatus !== "acknowledged" && (
        <button
          type="button"
          onClick={() => handleAction("acknowledge")}
          disabled={loading !== null}
          className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "acknowledge" ? "Acknowledging…" : "Acknowledge"}
        </button>
      )}
      <button
        type="button"
        onClick={() => handleAction("resolve")}
        disabled={loading !== null}
        className="rounded-lg bg-nordea-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "resolve" ? "Resolving…" : "Resolve"}
      </button>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
