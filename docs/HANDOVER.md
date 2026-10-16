# UniSphere — Production Handover Guide

For an **authorized** institutional handover of the UniSphere portal to Salim
Habib University. Nothing in this document claims the university has approved,
adopted, or integrated the application — that happens only after a formal
agreement and the steps below are completed with university IT.

---

## 1. Deployment architecture

| Piece | Where | Notes |
| --- | --- | --- |
| Web app (Next.js 16, React 19) | Vercel project `unisphere` | Builds from the **repo root** (bun + turbo monorepo: `apps/web` + `packages/db`). Deploy with `vercel deploy --prod --yes` from the root, or connect the Git repo for auto-deploys. |
| Database | Neon Postgres (`aws-ap-southeast-1`) | Prisma 7 (driver adapter `@prisma/adapter-pg`). Migrations live in `packages/db/prisma/migrations`. |
| Auth | Clerk | Custom `/sign-in` maps Institutional ID → Clerk email; `AUTO_PROVISION="false"` (no public self-signup). |
| AI | CommandCode (OpenAI-compatible) | Model `deepseek/deepseek-v4.1-flash`; falls back to a grounded knowledge-base answer when the key is absent or `AI_FALLBACK_MODE=1`. |
| Uploads (attachments, avatars) | Postgres `Bytes` columns | Served only through auth-checked API routes; no public bucket. |

Health probe: `GET /api/health` → `{ ok, db, ai, version }`. Production alias:
`https://unisphere-hazel.vercel.app` (backup: `https://unisphere-shu.vercel.app`).

**CLI gotcha:** deploy only from the repo root; a stray Vercel project named
`web` exists and must not be used. `.vercelignore` keeps `node_modules/.next/.turbo`
out of CLI uploads.

## 2. Environment variables (names only)

Set these in Vercel → Project → Settings → Environment Variables, and locally in
`apps/web/.env.local` (gitignored — never commit values):

```
DATABASE_URL                          # pooled Neon connection (app runtime)
DIRECT_URL                            # direct Neon connection (migrations/CLI)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET                  # Clerk → /api/webhooks/clerk
AUTO_PROVISION                        # "false" for institutional operation
NEXT_PUBLIC_APP_URL
COMMANDCODE_API_KEY                   # AI provider (server-side only)
AI_FALLBACK_MODE                      # "1" disables the remote model (offline demo)
```

Rotate any key that has ever been pasted into a chat, ticket, or log.
`.env.offline.example` shows the offline demo configuration.

## 3. Database backup & restore

- **Backups:** Neon point-in-time restore (configurable window) + manual
  `pg_dump` before any bulk import. Take a dump before `prisma migrate deploy`
  on production.
- **Restore:** Neon branch/restore to a new endpoint, point `DATABASE_URL` at it,
  verify `/api/health` and a smoke login, then re-alias.
- **Migrations:** author SQL under `packages/db/prisma/migrations/<timestamp>_name/`,
  apply with `prisma db execute --file …` then `prisma migrate resolve --applied`
  (or plain `prisma migrate deploy` in CI). Never edit a schema without a backup.

## 4. Authentication & account provisioning

- Admins create accounts in **Admin → Users & Roles / Data Management** (single
  or CSV import). Accounts use institutional IDs (`S22CSC0xx`, `FAC0xx`, `COORD001`,
  `FYP001`, `ADMIN001`); the ID resolves to the Clerk email at sign-in.
- Invitation path = admin-issued, single-use **recovery link** (no email provider
  is configured; nothing claims email delivery). The user sets their own password.
- Device Trust: on Clerk **development** instances password sign-in can demand an
  email code. The demo accounts use a per-account setting that bypasses this.
  **For the university's own Clerk instance, provision verified emails instead**
  and remove the bypass — do not carry development shortcuts into production.
- Deactivate (not delete) accounts that leave the university; history is retained.

## 5. Permissions & security model

- Single source of truth: `apps/web/src/lib/rbac.ts` — 31 capabilities × 6 roles,
  rendered to `docs/PERMISSIONS.md` (`bun scripts/gen-permissions.ts`).
- Every page, server action, API route and file download calls
  `requireUser`/`requireCapability`; record-level checks (ownership, recipient
  scope, approval chain) live in the services. `tests/security.test.ts` statically
  scans the route tree so a new ungated route fails CI.
- Uploads are content-sniffed (magic bytes), size-capped (≤2 MB), stored in DB
  bytes, and served only through guarded routes.
- Audit trail: `AuditLog` + per-domain event tables (form events, complaint
  events, correction requests, timetable revisions).

## 6. Data migration (after written authorization only)

1. Agree the field mapping (institutional ID, official email, program, semester,
   section) with the Registrar/IT — see `docs/FINAL-REPORT.md` §migration.
2. Export an authorized CSV and run **Admin → Data Management → Import** against
   a **Neon branch**, not production, first. The import validates every row,
   reports failed rows with reasons, and detects duplicates before writing.
3. Reconcile counts (received / imported / skipped / failed), review the audit
   log, then repeat on production during a maintenance window.
4. Enrollment/timetable data can be imported the same way; there is **no**
   scraping, no credential sharing, and no integration claim without an
   authorized API or export from the university.

## 7. Admin training & user guides

- Demo walkthrough + credentials: `DEMO-LOGIN.md`, `docs/demo-script.md`.
- Feature-by-feature status: `docs/REQUIREMENTS-CHECKLIST.md`.
- Module guides (complaint routing, forms & chains, admit-card rules, timetable
  revisions, knowledge base): `docs/FINAL-REPORT.md`.
- Screenshots of every role: `docs/demo/screenshots/app/` (+ `app-mobile/`).

## 8. Monitoring & operations

- `/api/health` is the uptime probe (db + ai + git version).
- Runtime logs: Vercel → Deployments → Functions (and `vercel logs`).
- AI failures degrade to the offline knowledge-base answer and are recorded as
  unanswered questions for the admin knowledge queue — check
  **Admin → Knowledge Base** weekly.
- Rate limits are in-process (single instance); replace with a shared store if
  the app ever runs multi-region.

## 9. Known limitations (unchanged from the final report)

- No email notifications, no real-time push (in-app notifications only — by
  design; not claimed as delivered).
- Admit cards and finalized form PDFs are **in-portal representations**, clearly
  labelled; no official signature assets are used and no legal validity is
  claimed.
- Manual import is the supported enrollment mechanism until the university
  provides an approved integration.
- One production environment; provision a staging project + Neon branch before
  the university's first real data import.

## 10. Handover checklist (practical)

- [ ] Written authorization + data-processing agreement on file.
- [ ] University Clerk instance (or migration plan) with verified @shu.edu.pk emails.
- [ ] Production Neon project owned by university IT; backups enabled; restore rehearsed.
- [ ] Vercel team owned by the university; env vars set from §2; Git connected.
- [ ] First import rehearsed on a branch; counts reconciled; rollback path tested.
- [ ] Admin account holders trained (§7); demo accounts disabled or re-labelled.
- [ ] `/api/health` monitored; support contact + escalation path agreed.
- [ ] Known-limitations list (§9) acknowledged in writing.
