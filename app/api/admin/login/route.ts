import { NextRequest, NextResponse } from "next/server";
import { adminCookie, checkAdminPassword, createAdminSessionToken } from "@/lib/admin-auth";
import { assertOrigin } from "@/lib/admin-guards";

type LoginBody = {
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid origin" },
      { status: 403 }
    );
  }

  let payload: LoginBody;
  try {
    payload = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.password || !checkAdminPassword(payload.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { token, maxAge } = createAdminSessionToken();
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(adminCookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });

  return response;
}
