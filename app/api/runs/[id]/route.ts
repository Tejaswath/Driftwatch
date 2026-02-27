import { NextResponse } from "next/server";
import { getRunById } from "@/lib/supabase";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const run = await getRunById(context.params.id);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch run" },
      { status: 500 }
    );
  }
}
