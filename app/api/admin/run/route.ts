import { NextRequest } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";

type RunBody = {
  domain?: string;
  baseline_version?: string;
  batch_id?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as RunBody;
  const domain = body.domain ?? "nordea";
  const baselineVersion = body.baseline_version ?? "v1";
  const batchId = body.batch_id ?? `manual-${Date.now()}`;

  return dispatchAdminWorkflow(request, "monitor_run.yml", {
    domain,
    baseline_version: baselineVersion,
    batch_id: batchId
  });
}
