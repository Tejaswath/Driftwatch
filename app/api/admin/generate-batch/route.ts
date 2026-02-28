import { NextRequest } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";

type GenerateBatchBody = {
  domain?: string;
  scenario?: string;
  rows?: string;
  batch_id?: string;
  seed?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as GenerateBatchBody;

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

  return dispatchAdminWorkflow(request, "generate_batch.yml", payload);
}
