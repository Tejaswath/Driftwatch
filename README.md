# DriftWatch

Nordea-first model drift monitoring MVP with:
- Next.js frontend on Vercel
- GitHub Actions compute workflows
- Supabase Postgres + Storage

## Current Status

Implemented:
- Public dashboard (`/`) with KPI cards, drift trend chart, top drifted features
- Runs page (`/runs`) with filters + pagination
- Run detail page (`/runs/[id]`) with lifecycle, metrics, artifacts, errors, tickets
- Admin login (`/admin/login`) using secure server-side cookie auth
- Admin panel (`/admin`) dispatching GitHub workflows through protected server routes
- Tailwind UI integration from Figma export (adapted to Next.js conventions)
- Automated tests for core UI mapping/format logic

## Nordea Integration Reality

Live Nordea ingestion path exists in backend workflows, but sandbox authentication currently requires full OAuth authorization flow.  
Mock fallback is active and intentional for stable demo operation.

## Verify Locally

```bash
npm install
npm run test
npm run lint
npm run build
```
