import fs from "node:fs";

const publicSensitivePattern = /^NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|SERVICE)/i;
const explicitAllowlist = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
const envFiles = [".env.example"];

const violations = [];

for (const file of envFiles) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [name] = line.split("=");
    const cleanName = name.trim();
    if (explicitAllowlist.has(cleanName)) {
      continue;
    }
    if (publicSensitivePattern.test(cleanName)) {
      violations.push(`${file}: ${cleanName}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Found forbidden public env vars:");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("Public env guard passed.");
