/**
 * Server-side input validation for admin dispatch routes.
 * Validates that inputs are within known-safe enums before forwarding to GitHub Actions.
 */

const VALID_DOMAINS = ["nordea", "taiwan_credit"] as const;
const VALID_SCENARIOS = [
  "stable_salary",
  "inflation_shift",
  "subscription_spike",
  "income_drop",
  "latest",
] as const;
const BASELINE_VERSION_RE = /^v\d+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_INT_RE = /^\d{1,6}$/;
const SEED_RE = /^\d{1,10}$/;

export type ValidationError = { field: string; message: string };

export function validateRunInputs(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.domain !== undefined && !VALID_DOMAINS.includes(body.domain as never)) {
    errors.push({ field: "domain", message: `Must be one of: ${VALID_DOMAINS.join(", ")}` });
  }

  if (
    body.baseline_version !== undefined &&
    !BASELINE_VERSION_RE.test(String(body.baseline_version))
  ) {
    errors.push({ field: "baseline_version", message: 'Must match pattern v<number> (e.g. "v1")' });
  }

  if (body.batch_id !== undefined && !UUID_RE.test(String(body.batch_id))) {
    errors.push({ field: "batch_id", message: "Must be a valid UUID" });
  }

  if (body.scenario !== undefined && !VALID_SCENARIOS.includes(body.scenario as never)) {
    errors.push({ field: "scenario", message: `Must be one of: ${VALID_SCENARIOS.join(", ")}` });
  }

  return errors;
}

export function validateBatchInputs(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.domain !== undefined && !VALID_DOMAINS.includes(body.domain as never)) {
    errors.push({ field: "domain", message: `Must be one of: ${VALID_DOMAINS.join(", ")}` });
  }

  if (body.scenario !== undefined && !VALID_SCENARIOS.includes(body.scenario as never)) {
    errors.push({ field: "scenario", message: `Must be one of: ${VALID_SCENARIOS.join(", ")}` });
  }

  if (body.rows !== undefined && !POSITIVE_INT_RE.test(String(body.rows))) {
    errors.push({ field: "rows", message: "Must be a positive integer up to 6 digits" });
  }

  if (body.seed !== undefined && !SEED_RE.test(String(body.seed))) {
    errors.push({ field: "seed", message: "Must be a numeric seed" });
  }

  if (body.batch_id !== undefined && !UUID_RE.test(String(body.batch_id))) {
    errors.push({ field: "batch_id", message: "Must be a valid UUID" });
  }

  return errors;
}

export function validateBaselineRefreshInputs(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.domain !== undefined && !VALID_DOMAINS.includes(body.domain as never)) {
    errors.push({ field: "domain", message: `Must be one of: ${VALID_DOMAINS.join(", ")}` });
  }

  if (
    body.baseline_version !== undefined &&
    !BASELINE_VERSION_RE.test(String(body.baseline_version))
  ) {
    errors.push({ field: "baseline_version", message: 'Must match pattern v<number> (e.g. "v1")' });
  }

  if (body.scenario !== undefined && !VALID_SCENARIOS.includes(body.scenario as never)) {
    errors.push({ field: "scenario", message: `Must be one of: ${VALID_SCENARIOS.join(", ")}` });
  }

  if (body.rows !== undefined && !POSITIVE_INT_RE.test(String(body.rows))) {
    errors.push({ field: "rows", message: "Must be a positive integer up to 6 digits" });
  }

  if (body.seed !== undefined && !SEED_RE.test(String(body.seed))) {
    errors.push({ field: "seed", message: "Must be a numeric seed" });
  }

  return errors;
}
