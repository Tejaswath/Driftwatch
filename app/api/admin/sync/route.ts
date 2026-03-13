import { NextRequest, NextResponse } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";
import { validateBatchInputs } from "@/lib/admin-validation";

type SyncBody = {
  domain?: string;
  scenario?: string;
  rows?: string;
  batch_id?: string;
  seed?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as SyncBody;

  const errors = validateBatchInputs(body as Record<string, unknown>);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const payload: Record<string, string> = {
    domain: body.domain ?? "nordea",
    scenario: body.scenario ?? "stable_salary",
    rows: body.rows ?? "100"
  };
  if (body.batch_id) {
    payload.batch_id = body.batch_id;
  }
  if (body.seed) {
    payload.seed = body.seed;
  }

  return dispatchAdminWorkflow(request, "nordea_sync.yml", {
    ...payload
  });
}
