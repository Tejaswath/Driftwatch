const truthy = new Set(["1", "true", "yes", "on"]);

function getRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
};

export const serverConfig = {
  githubRepo: process.env.GITHUB_REPO ?? "",
  githubRef: process.env.GITHUB_REF ?? "main",
  githubDispatchToken: process.env.GITHUB_DISPATCH_TOKEN ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminCookieSecret: process.env.ADMIN_COOKIE_SECRET ?? "",
  appOrigin: process.env.APP_ORIGIN ?? "",
  allowPreviewOrigins: truthy.has((process.env.ALLOW_PREVIEW_ORIGINS ?? "").toLowerCase())
};

export function assertPublicConfig(): void {
  getRequired("NEXT_PUBLIC_SUPABASE_URL");
  getRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function assertServerConfig(): void {
  getRequired("GITHUB_REPO");
  getRequired("GITHUB_DISPATCH_TOKEN");
  getRequired("ADMIN_PASSWORD");
  getRequired("ADMIN_COOKIE_SECRET");
  getRequired("APP_ORIGIN");
}
