import { NextRequest } from "next/server";
import { dispatchAdminWorkflow } from "@/lib/admin-dispatch";

type SeedBody = {
  profile?: string;
};

export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as SeedBody;

  return dispatchAdminWorkflow(request, "nordea_seed.yml", {
    profile: body.profile ?? "stable_salary_profile"
  });
}
