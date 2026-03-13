import { NextRequest, NextResponse } from "next/server";
import { adminCookie, checkAdminPassword, createAdminSessionToken } from "@/lib/admin-auth";
import { assertOrigin } from "@/lib/admin-guards";

type LoginBody = {
  password?: string;
};

// In-memory rate limiter: max 5 failed attempts per 15 minutes per IP
// Resets on successful login. Note: resets on Vercel cold start (acceptable for free tier).
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  const windowExpired = Date.now() - entry.firstAttempt > RATE_LIMIT_WINDOW_MS;
  if (windowExpired) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= RATE_LIMIT_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid origin" },
      { status: 403 }
    );
  }

  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: LoginBody;
  try {
    payload = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.password || !checkAdminPassword(payload.password)) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Success: clear failed attempts for this IP
  failedAttempts.delete(ip);

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
