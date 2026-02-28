import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import { getRunById, getTicketById } from "@/lib/supabase";

type TicketPageProps = {
  params: {
    id: string;
  };
};

export default async function TicketDetailsPage({ params }: TicketPageProps) {
  const ticket = await getTicketById(params.id);
  if (!ticket) {
    notFound();
  }

  const run = await getRunById(ticket.run_id).catch(() => null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-[#6B7280]">
        <Link href="/runs" className="text-nordea-teal hover:underline">
          Runs
        </Link>
        <ChevronRight size={14} />
        <span className="font-mono text-nordea-navy">{ticket.id}</span>
      </div>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h1 className="mb-4 text-xl font-bold text-nordea-navy">{ticket.title ?? "Investigation Ticket"}</h1>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-[#6B7280]">Ticket ID: </span>
            <span className="font-mono text-nordea-navy">{ticket.id}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Type: </span>
            <span className="font-medium uppercase text-nordea-navy">{ticket.ticket_type}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Status: </span>
            <span className="font-medium uppercase text-nordea-navy">{ticket.status}</span>
          </div>
          <div title={formatAbsoluteTime(ticket.created_at)}>
            <span className="text-[#6B7280]">Created: </span>
            <span className="text-nordea-navy">{formatRelativeTime(ticket.created_at)}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Resolved At: </span>
            <span className="text-nordea-navy">{formatRelativeTime(ticket.resolved_at)}</span>
          </div>
          <div>
            <span className="text-[#6B7280]">Resolved By: </span>
            <span className="text-nordea-navy">{ticket.resolved_by ?? "—"}</span>
          </div>
        </div>

        {ticket.description ? (
          <p className="mt-4 rounded-lg bg-[#F4F4F4] p-3 text-sm text-nordea-navy">{ticket.description}</p>
        ) : null}

        <div className="mt-4">
          <span className="text-sm text-[#6B7280]">Related Run: </span>
          {run ? (
            <Link href={`/runs/${run.id}`} className="font-mono text-sm text-nordea-teal hover:underline">
              {run.id}
            </Link>
          ) : (
            <span className="font-mono text-sm text-[#6B7280]">{ticket.run_id}</span>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-nordea-navy">Ticket Payload</h2>
        <pre className="overflow-x-auto rounded bg-[#111827] p-3 font-mono text-xs text-[#F9FAFB]">
          {JSON.stringify(ticket.payload ?? {}, null, 2)}
        </pre>
      </section>
    </div>
  );
}
