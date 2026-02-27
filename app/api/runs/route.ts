import { NextResponse } from "next/server";
import { getRuns } from "@/lib/supabase";

export async function GET() {
  try {
    const runs = await getRuns(50);
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch runs" },
      { status: 500 }
    );
  }
}
