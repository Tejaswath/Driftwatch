# DriftWatch

Nordea-first model/data drift monitoring MVP with a zero-cost deployment architecture.

## What this project is (simple)

DriftWatch checks whether incoming banking-derived feature data still looks like the data your model was built on.

In simple words, finished DriftWatch will let you:
1. Seed/sync Nordea-like data.
2. Build a stable feature batch.
3. Compare current vs baseline using drift metrics.
4. Show Green/Yellow/Red status with top drifting features.
5. Create investigation actions when drift is critical.

## Current status

### Overall completion estimate

- **Project completion today: ~45%**
- **Architecture and skeleton: mostly done**
- **Production validation + Nordea hardening: still pending**

This is realistic to finish.

## Is this realistic to finish?

Yes.

Why:
1. Compute is lightweight (batch drift checks), not large-model heavy.
2. Core architecture is already implemented.
3. Remaining work is integration/ops and UI polish.
4. You already chose a zero-cost path (Vercel + Supabase + GitHub Actions).

Expected effort from current state: **5-8 focused days**.

## Scope we are targeting

### In scope (MVP)

1. Public dashboard for run history and run details.
2. Admin login + server-side dispatch routes.
3. GitHub Actions workflows for all compute and DB writes.
4. Supabase schema with RLS (read-only anon, no anon writes).
5. Evidently data drift run with persisted compact report and per-feature metrics.
6. Red drift -> investigation ticket creation.
7. Nordea seed/sync workflows with sandbox guardrails and mock fallback.

### Out of scope (for now)

1. Always-on backend workers.
2. Complex end-user auth/roles beyond admin cookie gate.
3. Full retraining orchestration in production.
4. Rich BI-level charting and advanced observability dashboards.

## What has been implemented

### Frontend + routes

- Next.js app pages:
  - `/`
  - `/runs`
  - `/runs/[id]`
  - `/admin/login`
  - `/admin`
- API routes:
  - `GET /api/health`
  - `GET /api/runs`
  - `GET /api/runs/[id]`
  - `POST /api/admin/login`
  - `POST /api/admin/run`
  - `POST /api/admin/seed`
  - `POST /api/admin/sync`
  - `POST /api/admin/baseline-refresh`

### Security and privilege separation

- Vercel routes are dispatch-only (no drift compute).
- Admin session cookie: signed, HttpOnly, SameSite=Lax, secure in production.
- Origin checks for admin routes with preview support option.
- CI env guard blocks accidental `NEXT_PUBLIC_*` secret exposure patterns.

### Data layer

- Supabase SQL schema created for:
  - `domains`
  - `baselines`
  - `monitor_runs`
  - `feature_drift_metrics`
  - `action_tickets`
  - `nordea_seed_runs`
- RLS enabled with anon SELECT policies.
- No anon write policies defined.

### Workflows

- `monitor_run.yml` (daily schedule + workflow_dispatch)
- `nordea_seed.yml`
- `nordea_sync.yml`
- `baseline_refresh.yml`
- `sweeper.yml`
- `keepalive.yml` (optional)
- `ci.yml` (includes env leak guard)

### Python pipeline scripts

- Drift run orchestration + Evidently integration.
- Baseline refresh and sync scripts.
- Nordea seed mock script and sandbox bypass guard logic.
- Sweeper and keepalive scripts.

## Architecture (finalized direction)

1. **Vercel (Next.js)**
   - Public dashboard + admin pages
   - Server-side workflow dispatch only
2. **GitHub Actions**
   - All compute: seed/sync/features/drift/report/tickets
   - All privileged writes to Supabase
3. **Supabase**
   - Postgres for run history and metrics
   - Storage for optional HTML artifacts

## What a finished product looks like (simple words)

A hiring manager opens your URL and sees:
1. A run history table with statuses over time.
2. A run details page showing drift summary and top changed features.
3. Admin actions that can trigger seed/sync/monitor runs safely.
4. Evidence that critical drift creates investigation tickets.
5. A Nordea-first narrative: “this monitors banking-style feature drift, not just a toy notebook.”

## What you should do next

1. Apply `supabase/schema.sql` in Supabase.
2. Configure Vercel env vars and GitHub secrets.
3. Trigger `monitor_run.yml` and verify runs appear in `/runs`.
4. Validate red drift scenario creates an action ticket.
5. Harden Nordea seed/sync path and verify at least one authenticated sandbox call.

## Local setup

```bash
npm install
npm run dev
```

## Environment setup

Use `.env.example` as the template.

Important safety rules:
1. `SUPABASE_SERVICE_ROLE_KEY` stays in GitHub Actions secrets only.
2. Nordea credentials stay in GitHub Actions secrets only.
3. Browser gets only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Free-tier assumptions

1. Keep repository public to preserve current GitHub Actions free model.
2. If repo becomes private, Actions minutes may incur billing.
3. Vercel Hobby limits mean admin routes should remain trigger-only.
