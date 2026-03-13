import { NextRequest, NextResponse } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";
import { validateBaselineRefreshInputs } from "@/lib/admin-validation";

type BaselineBody = {
  domain?: string;
  schema_version?: string;
  baseline_version?: string;
  rows?: string;
  seed?: string;
  scenario?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as BaselineBody;

  const errors = validateBaselineRefreshInputs(body as Record<string, unknown>);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  return dispatchAdminWorkflow(request, "baseline_refresh.yml", {
    domain: body.domain ?? "nordea",
    schema_version: body.schema_version ?? "v1",
    baseline_version: body.baseline_version ?? "v1",
    rows: body.rows ?? "200",
    seed: body.seed ?? "42",
    scenario: body.scenario ?? "stable_salary"
  });
}
