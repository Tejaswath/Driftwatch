import { NextRequest, NextResponse } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";
import { validateRunInputs } from "@/lib/admin-validation";

type RunBody = {
  domain?: string;
  baseline_version?: string;
  batch_id?: string;
  scenario?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as RunBody;

  const errors = validateRunInputs(body as Record<string, unknown>);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const domain = body.domain ?? "nordea";
  const baselineVersion = body.baseline_version ?? "v1";
  const batchId = body.batch_id ?? `manual-${Date.now()}`;
  const scenario = body.scenario ?? "latest";

  return dispatchAdminWorkflow(request, "monitor_run.yml", {
    domain,
    baseline_version: baselineVersion,
    batch_id: batchId,
    scenario,
    triggered_by: "admin",
  });
}
