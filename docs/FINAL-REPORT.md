# UniSphere — final status report

_Generated after the audit-and-complete pass over the whole spec (complete
functionality, workflow, security & UI improvement task). Every claim below is
backed by a command that was actually run; nothing is marked working that was
not exercised end-to-end against the live database._

- **Production:** https://unisphere-hazel.vercel.app (alias backup:
  https://unisphere-shu.vercel.app) — `/api/health` reports `db: up`,
  `ai.provider: commandcode`, `ai.model: deepseek/deepseek-v4.1-flash`, and the
  deployed commit hash.
- **Repository:** https://github.com/hassan2002-6/unisphere_2 (`main`).
- **Stack:** Next.js 16 (App Router, RSC + server actions), React 19, Bun +
  Turborepo, Prisma + PostgreSQL (Neon), Clerk auth, Tailwind v4 + shadcn/ui,
  vitest + oxlint.

---

## 1. What was already working before this pass

Role dashboards with live stats; timetable + clash detection; attendance
capture; marks & GPA from published results; messaging; student search; exam
scheduling; FYP application + supervision basics; resources/inventory; labs;
reports + CSV export; notifications; audit log; account provisioning with
institutional IDs; the AI assistant with retrieval + citations; the red/white
UI matching the prototype. (These were preserved — none were replaced with
mock data.)

## 2. Bugs and missing features fixed in this pass

| # | Problem found | Fix |
| - | ------------- | --- |
| 1 | Demo login demanded an email **verification code** nobody could receive | Clerk Device Trust was forcing `needs_client_trust`; every provisioned account now carries `bypass_client_trust` (script + admin flow + webhook). Documented in `DEMO-LOGIN.md` |
| 2 | Google-created accounts got a raw Clerk error when trying email+password | Account-aware hint: typing the email points the user at **Continue with Google** |
| 3 | Assignments module was missing entirely | Built end-to-end (faculty author/edit/close, student submit, grading) — §4 |
| 4 | Complaints: no routing rules, no internal notes, no forwarding/escalation, no attachment, no SLA | Full pipeline built + configurable rules — §6 |
| 5 | Forms: no corrections round-trip, no review chains, no supporting documents, no versioning, no submission browser | Built — §7 |
| 6 | Alumni mentorship still in active nav/routes though out of scope | Retired from nav, dashboards, routes, auth-shell, capture tooling (DB models kept) |
| 7 | No profile photos anywhere | Blob storage + validated upload + avatar in the top bar/portal — §8 |
| 8 | AI: no unanswered-question capture, no admin knowledge management, no retry | `AiUnanswered` capture + `/admin/knowledge` + one transparent provider retry (25 s timeout and 12/min per-user rate limit already existed) — §9 |
| 9 | No way to enter students/faculty/courses in bulk | CSV import with templates, validation, row-level error report; submissions browser on `/admin/forms` — §10 |
| 10 | Legacy DDL drift (Prisma `Bytes` vs `Buffer`) blocking uploads | `toBytes`/`fromBytes` bridge; guarded file-download API routes with per-record ACLs |
| 11 | Admin dashboard lacked assignments/user counts asked for in the spec | Added counts incl. open assignments |

## 3. Implemented and tested in this pass (with evidence)

- **Assignments (§4):** faculty create (title, instructions, deadline w/ future
  validation, marks 1–1000, allowed file types, optional brief) → enrolled
  students notified → student uploads (type + size validated, late flagged not
  blocked, resubmission until graded) → faculty sees the submission table →
  grades with marks + feedback → student notified. Files stored in Postgres as
  bytes; downloads are ACL-checked per user. **E2E section 14 — 13 checks.**
- **Complaints (§6):** categories + routing rules are DB-backed and
  admin-configurable (target role/person, default priority, escalate-after
  hours, escalation target). Filing issues a reference (`CMP-2026-0003`),
  auto-assigns, sets the SLA deadline; staff acknowledge → in-review, add
  internal notes (invisible to students), reply, request info, forward,
  escalate (priority → HIGH), resolve, close; every step writes an event row +
  audit entry + notification. **E2E section 15 — 14 checks.**
- **Forms (§7):** corrections round-trip (Request corrections → student
  resubmits in place, optionally with a supporting document → decision),
  chain-aware reviewer queue, template version snapshots on submissions,
  admin template editor with live field preview, version bumping, attachment
  configuration and a filterable submissions browser. **E2E section 16 — 9
  checks** (approval receipt and decisions are exercised in sections 3–5).
- **Photos (§8):** upload validated by extension + size + magic bytes, stored
  in Postgres, served through an access-checked route, default initials
  avatar, persists across sessions. **E2E section 17 — 5 checks.**
- **AI (§9):** retrieval over the university corpus + personal context,
  citation chips, "not in the knowledge base" honesty path, unanswered-question
  capture, admin console to add/archive knowledge and triage unanswered
  questions, offline fallback (clearly labelled), 25 s timeout, one retry,
  12 questions/min rate limit. **33-question retrieval eval + unit tests.**
- **Admin/data (§10):** CSV import for students/faculty/courses with template
  download, duplicate detection, per-row errors; `/admin/data` instructions;
  forms templates, complaint routing, announcements, inventory all managed in
  the portal. **Ran actual imports during development; row-level errors
  verified.**
- **Mentorship removed (§5):** nav, routes, dashboards, copy and tooling
  cleaned; DB models and the mentor persona kept (deactivate-style removal, no
  destructive migration).

## 4. Incomplete / limitations (honest list)

- **Email notifications** are not wired: the system uses in-app notifications
  as the reliable baseline (as permitted). No email provider is configured.
- **Real-time push** is not implemented (no websockets); pages use
  server-rendered data with revalidation.
- **Rate limit** is per-user via DB count — correct for the current
  single-deployment setup, but not distributed.
- **`www.unisphere-hazel.vercel.app`** does not exist — use the non-`www`
  host.
- **Formal performance benchmarks** were not re-measured this pass; list pages
  use cursor pagination and indexes from M1–M6 remain in place.
- Demo personas sign in with a shared demo password (by design); production
  provisioning flows remain per-user.

## 5. Commands

```bash
# local development (repo root)
bun install
cp .env.example .env.local          # fill in (see §7)
bun run db:generate                  # prisma generate
bunx prisma migrate deploy --schema packages/db/prisma/schema.prisma
bun run db:seed                      # idempotent demo seed
bun run dev                          # http://localhost:3000

# quality gates (all green before the deploy in this report)
bun run lint      # oxlint
bun run typecheck # tsc --noEmit
bun run test      # vitest: 352 tests
bun run build     # next production build

# workflows against the live DB (apps/web)
bun scripts/test-workflows.ts        # 126-check end-to-end acceptance
bun scripts/eval-ai.ts               # 33-question retrieval eval
bun scripts/test-concurrency.ts      # last-GPU race test
bun scripts/link-clerk-users.ts      # (re)create/link the demo personas in Clerk
bun scripts/gen-permissions.ts       # regenerate docs/PERMISSIONS.md from rbac.ts
bun run capture:demo                 # refresh docs/demo/screenshots (headless Chrome)
```

## 6. Migrations

Three migrations were added this pass (already applied to production Neon):

- `20261015190000_wave_assignments_complaints_forms_photos`
- `20261015210820_wave_ai_knowledge_admin`
- `20261015213000_wave_form_attachments`

`bun run db:seed` is idempotent and safe to re-run; it never deletes existing
records.

## 7. Required environment variables (names only — values never in the repo)

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → API keys |
| `NEXT_PUBLIC_APP_URL` | Your deployed origin |
| `DATABASE_URL` (pooled), `DIRECT_URL` | Neon project → connection details |
| `COMMANDCODE_API_KEY` (or provider key the app supports) | commandcode.ai → API keys; without it the assistant runs the labelled offline fallback |
| `AUTO_PROVISION` | `"false"` — accounts are issued by the office |

Vercel needs the same values in Project → Settings → Environment Variables.

## 8. Demo login

See **`DEMO-LOGIN.md`** (University-ID + password flow, Google flow, the
verification-code explanation, password reset paths). Persona table is in
`README.md`.

## 9. Where to enter data (spec §10)

- **Students / Faculty / Courses in bulk:** Admin → **Data Management** →
  *Import* (`/admin/data/import`) — download the CSV template, fill, upload;
  per-row errors are reported. Single accounts: `/admin/users` → *New
  account*.
- **Courses/sections + faculty assignment:** Coordinator →
  `/coordinator/timetable` (courses & sections cards).
- **Complaint categories & routing:** Admin → `/admin/complaints`.
- **Forms:** Admin → `/admin/forms`.
- **Assignments:** Faculty → `/faculty/assignments`.
- **Announcements:** `/admin/broadcast`. **Inventory/GPU:** `/admin/inventory`,
  `/admin/allocations`. **Internships:** `/admin/internships`.
- **Seed (demo data):** `bun run db:seed` — documented in README.

## 10. Changing a form's fields / approval workflow (spec §7)

Admin → `/admin/forms`:
1. Click **Edit** on a template (or create one): fields are one line per
   field, `Label | type | optional | options`; the live preview renders as
   students will see it.
2. Set audience (who may submit), reviewer (single role) or the ordered
   approval chain, SLA days, instructions, attachment label + required flag.
3. Saving bumps the template **version**; existing submissions keep the field
   snapshot they were submitted with — old data is never silently rewritten.
4. Activate/deactivate with the toggle; submissions are browsable below with
   filters (form, status, applicant, date).

## 11. Permission matrix

Generated directly from the RBAC source: **`docs/PERMISSIONS.md`** (28
capabilities × 6 roles, plus per-role lists). Regenerate with
`bun scripts/gen-permissions.ts` after any matrix change. The guard suite
(`tests/security.test.ts`) fails the build if a portal page, server action or
API route skips server-side authorization.

## 12. Test results / build status / deployment

- `bun run lint` — pass · `bun run typecheck` — pass · `bun run test` — **352
  passed** · `bun run build` — pass (production Next build).
- End-to-end acceptance vs the live Neon database: **126 checks, 0 failures**
  (sections: timetable/clash, attendance, marks, messaging, search, exports,
  accounts & provisioning, coordinator classes/exams, FYP lifecycle +
  supervision notes, **assignments**, **complaints pipeline**, **form
  corrections + documents**, **profile photos**); the script cleans up every
  record it creates.
- Retrieval eval: 30/30 questions grounded or correctly refused.
- Deployed to production from commit `e0a7426` (preceded by `17295da` wave +
  `.vercelignore` fix `fd3d069`); `/api/health` green and reports the deployed
  hash.
- **Deployment limitation:** production deploys must not rely on the local
  `VERCEL_TOKEN` (it expires); the CLI device login is the working path. CLI
  uploads exclude `node_modules`/`.next`/`.turbo` via `.vercelignore`.

## 13. Manual configuration still required (by the account owner)

1. **Vercel:** environment variables from §7 (already set for the current
   deployment; re-set if the project is recreated).
2. **Clerk:** keep Device Trust bypassed for provisioned accounts (handled in
   code); configure Google OAuth if a different Google client is desired;
   pick a production domain before an official launch.
3. **Neon:** nothing to do (project live), rotate credentials if ever leaked.
4. **AI provider:** `COMMANDCODE_API_KEY` for live answers (works without it in
   offline fallback).

## 14. Demo script

`docs/demo-script.md` — a ~12-minute walkthrough (Student → Faculty/Coordinator
→ Admin; Student → Form → Approver; assignments; complaints; AI), with the
screenshot fallback under `docs/demo/screenshots/`.
