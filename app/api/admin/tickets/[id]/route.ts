import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { assertOrigin } from "@/lib/admin-guards";
import { adminUpdateTicket } from "@/lib/supabase";


type ResolveBody = {
  action?: "resolve" | "acknowledge";
  resolved_by?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    assertOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid origin" },
      { status: 403 }
    );
  }

  if (!requireAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action = "resolve", resolved_by = "admin" } = body;

  if (action !== "resolve" && action !== "acknowledge") {
    return NextResponse.json(
      { error: 'action must be "resolve" or "acknowledge"' },
      { status: 400 }
    );
  }

  const ticketId = params.id;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket ID" }, { status: 400 });
  }

  try {
    const updated = await adminUpdateTicket(ticketId, {
      status: action === "resolve" ? "resolved" : "acknowledged",
      resolved_at: new Date().toISOString(),
      resolved_by,
    });
    return NextResponse.json({ ticket: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
