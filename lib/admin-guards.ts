import { NextRequest } from "next/server";
import { serverConfig } from "@/lib/config";

function parseHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function isAllowedOrigin(origin: string): boolean {
  const appHost = parseHost(serverConfig.appOrigin);
  const originHost = parseHost(origin);

  if (!originHost) {
    return false;
  }

  if (originHost === appHost) {
    return true;
  }

  if (process.env.VERCEL_ENV === "preview" && serverConfig.allowPreviewOrigins) {
    return originHost.endsWith(".vercel.app");
  }

  return false;
}

export function assertOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new Error("Missing Origin header.");
  }

  if (!isAllowedOrigin(origin)) {
    throw new Error("Origin is not allowed.");
  }
}
