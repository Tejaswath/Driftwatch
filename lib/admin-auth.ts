import crypto from "node:crypto";
import { cookies } from "next/headers";
import { serverConfig } from "@/lib/config";

const COOKIE_NAME = "dw_admin";
const ONE_DAY_SECONDS = 24 * 60 * 60;

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", serverConfig.adminCookieSecret)
    .update(payload)
    .digest("base64url");
}

function encodeSession(expiresAtUnix: number): string {
  const payload = String(expiresAtUnix);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function decodeSession(token: string): number | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  return expiresAt;
}

export function checkAdminPassword(input: string): boolean {
  return input.length > 0 && input === serverConfig.adminPassword;
}

export function createAdminSessionToken(): { token: string; maxAge: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + ONE_DAY_SECONDS;
  return { token: encodeSession(expiresAt), maxAge: ONE_DAY_SECONDS };
}

export function clearAdminSession(): void {
  cookies().delete(COOKIE_NAME);
}

export function requireAdminSession(): boolean {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }

  const expiresAt = decodeSession(token);
  if (!expiresAt) {
    return false;
  }

  return Math.floor(Date.now() / 1000) < expiresAt;
}

export const adminCookie = {
  name: COOKIE_NAME
};
