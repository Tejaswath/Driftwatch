import { NextRequest } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";

type SyncBody = {
  domain?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as SyncBody;

  return dispatchAdminWorkflow(request, "nordea_sync.yml", {
    domain: body.domain ?? "nordea"
  });
}
