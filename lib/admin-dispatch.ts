import { NextRequest, NextResponse } from "next/server";
import { assertOrigin } from "@/lib/admin-guards";
import { requireAdminSession } from "@/lib/admin-auth";
import { dispatchWorkflow } from "@/lib/github";

type DispatchPayload = Record<string, string>;

export async function dispatchAdminWorkflow(
  request: NextRequest,
  workflowFile: string,
  payload: DispatchPayload
): Promise<NextResponse> {
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

  try {
    const dispatched = await dispatchWorkflow(workflowFile, payload);
    return NextResponse.json({ status: "dispatched", ...dispatched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dispatch failed" },
      { status: 500 }
    );
  }
}
