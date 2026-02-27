import { NextRequest } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";

type BaselineBody = {
  domain?: string;
  schema_version?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as BaselineBody;

  return dispatchAdminWorkflow(request, "baseline_refresh.yml", {
    domain: body.domain ?? "nordea",
    schema_version: body.schema_version ?? "v1"
  });
}
