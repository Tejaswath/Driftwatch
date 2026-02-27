import { NextResponse } from "next/server";
import { getDomainHeartbeats } from "@/lib/supabase";

export async function GET() {
  try {
    const heartbeats = await getDomainHeartbeats();
    return NextResponse.json({
      status: "ok",
      checked_at: new Date().toISOString(),
      domains: heartbeats
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Health check failed"
      },
      { status: 500 }
    );
  }
}
