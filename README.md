# UniSphere

**A unified student portal for Salim Habib University** — FYP-II implementation of the FYP-I prototype.
Timetables with live clash detection (plus student clash reporting), attendance, marks/GPA, forms centre,
complaint box, notifications, campus messaging, FYP workflow, GPU/lab resource allocation, internships,
alumni mentorship, audit logs, and a grounded AI assistant.

> Team: Ishan Rajwani · Carol Swan · M. Hassan Siddiqui — BSCS, SHU · Supervisors: Ateeque Rahman, Saadia Karim

---

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Runtime    | Bun 1.4 (package manager + runner), Turborepo 2.11           |
| App        | Next.js 16.3 (App Router, TypeScript strict), React 19       |
| UI         | Tailwind CSS 4.3 + shadcn/ui (radix), custom UniSphere theme |
| Data       | PostgreSQL (Neon) via Prisma 7.10 (`prisma7.config.ts`)      |
| Auth       | Clerk 7.9 — one sign-in for 6 roles (University ID or email), provisioned by the coordination office |
| AI         | Provider-agnostic adapter (Groq default) + Postgres-FTS retrieval |
| Deploy     | Vercel (Hobby) — root directory `apps/web`                   |
| Lint/format| oxlint + oxfmt (oxc toolchain)                               |
| Tests      | Vitest — 376 tests (unit + security suite) + 85-check E2E script |

## Repository layout

```
apps/web                  Next.js app (all routes under src/app)
  src/app/(portal)        Authenticated portal — every page guarded server-side
  src/app/api             health · Clerk webhook · reports export
  src/server/services     Domain services (forms, complaints, fyp, resources,
                          internships, mentorship, schedule, notifications, reports)
  src/server/ai           provider adapter · retrieval · assistant orchestrator
  src/lib                 rbac · auth · validation · nav · db
  tests                   vitest unit + RBAC/security suites
  scripts                 gen-stubs · eval-ai · test-concurrency
packages/db               Prisma schema (26 models), migrations, 685-line seed
docs                      plan, research, spikes, demo scripts
```

## Quickstart

```bash
# 1. Environment — copy the template and fill in (never commit real values)
cp .env.example apps/web/.env.local       # DATABASE_URL, DIRECT_URL, Clerk keys, optional GROQ_API_KEY

# 2. Install + generate
bun install
cd packages/db && bunx prisma generate

# 3. Migrate + seed (idempotent)
bunx prisma migrate deploy
bun run seed

# 4. Dev
cd ../.. && bun run dev          # turbo — http://localhost:3000
```

## Quality gates (all green before every commit)

```bash
bun run lint        # oxlint
bun run typecheck   # tsc --noEmit across the workspace
bun run test        # vitest — 350+ tests incl. RBAC matrix + guard scan
bun run build       # Next production build (typechecked)
```

Domain extras:

```bash
cd apps/web
bun run scripts/test-workflows.ts    # 126-check end-to-end acceptance across every workflow
bun run scripts/eval-ai.ts           # 30-question AI retrieval eval (needs DATABASE_URL)
bun run scripts/test-concurrency.ts  # last-GPU race acceptance test (needs DATABASE_URL)
```

## Modules (FYP-II scope — the deck's list, exactly)

| Module            | Routes                                                    | State |
| ----------------- | --------------------------------------------------------- | ----- |
| Dashboard         | `/dashboard` (role-aware live stats)                      | ✅ |
| Attendance        | `/attendance`, `/faculty/attendance`, `/faculty/attendance/[classId]` | ✅ |
| Marks & GPA       | `/marks`, `/faculty/marks(+[classId])`                    | ✅ |
| Student search    | `/faculty/students(+[id])`, `/coordinator/students(+[id])` | ✅ |
| Messaging         | `/messages` (inbox · sent · compose, every role)          | ✅ |
| Accounts & sign-in| `/admin/users(+[id])` lifecycle, `/sign-in`, `/forgot-password` | ✅ |
| Audit log         | `/admin/audit`                                            | ✅ |
| Timetable + clash | `/timetable`, `/exams`, `/coordinator/clashes`, student clash reports `/clashes` | ✅ |
| Timetable manager | `/coordinator/timetable` — sessions, courses & sections, faculty assignment | ✅ |
| Exam manager      | `/coordinator/exams` — schedule/move/cancel with clash blocking | ✅ |
| Forms manager     | `/admin/forms` — add/retire form templates (spec §11)     | ✅ |
| FYP supervision   | `/fyphead` request desk, `/faculty/fyp` progress notes    | ✅ |
| Academic planning | `/planning`, `/faculty/courses`                           | ✅ |
| Forms centre      | `/forms`, `/forms/new/[key]`, `/submissions(+detail)`, `/reviews`, `/faculty/reviews` — corrections round-trip, review chains, supporting documents | ✅ |
| Complaint box     | `/complaints(+new/detail)`, `/faculty/complaints`, `/coordinator/complaints` — routing rules, internal notes, forward/escalate, attachments, SLA badges | ✅ |
| Assignments       | `/assignments(+detail)`, `/faculty/assignments(+[id])` — deadline, marks, typed uploads, late flags, grading | ✅ |
| Admin toolkit     | `/admin/data(+import)` CSV import, `/admin/complaints` routing rules, `/admin/knowledge` AI corpus + unanswered triage | ✅ |
| Photos & avatars  | `/profile` photo upload (PNG/JPG/WebP, magic-byte checked) surfaced in the top bar everywhere | ✅ |
| Notifications     | `/notifications`, `/admin/broadcast`                      | ✅ |
| FYP workflow      | `/fyp`, `/admin/fyp`                                      | ✅ |
| GPU / resources   | `/resources/request`, `/resources/my`, `/admin/requests`, `/admin/allocations` | ✅ |
| Labs & inventory  | `/admin/labs`, `/admin/inventory`                         | ✅ |
| Reports           | `/admin/reports`, `/api/reports/summary?format=csv`       | ✅ |
| Internships       | `/internships(+detail)`, `/admin/internships`             | ✅ |
| AI assistant      | `/chat` (grounded, citation chips)                        | ✅ |

All modules above are in scope and implemented (the FYP-I deck had parked attendance/results —
the FYP-II spec brings them in, with GPA computed from published results). The alumni-mentorship
console (`/mentorship`, `/mentor`, `/admin/mentors`) is retired from the active portal — its DB
models and mentor account remain, but the module is no longer in the spec's active scope.

**University-ID sign-in.** Accounts are provisioned by the coordination office (no public
self-signup — `AUTO_PROVISION=false`): the admin creates an account, the holder receives an
invitation and sets their own password. Sign-in accepts the University ID (`S22CSC003`, `FAC001`,
`COORD001`…) or an email; deactivated accounts are blocked at every layer.

## Demo accounts

18 seeded personas share **one password: `UniSphere#Demo2026`**

> **Device Trust:** Clerk auto-enables Device Trust on new apps — the first password
> sign-in from a new device then demands an email verification code, which the demo
> `@shu.edu.pk` mailboxes can't receive. Provisioned accounts therefore carry
> `bypass_client_trust` (set by `link-clerk-users.ts`, the admin create-account flow
> and the `user.created` webhook), so password sign-in completes without the code.
> No dashboard change needed.

| Role | Accounts | Notes |
| ---- | -------- | ----- |
| Students | `student@shu.edu.pk` … `student10@shu.edu.pk` (registration nos `S22CSC001`…) | attendance, marks, clash reports |
| Faculty | `faculty@`, `faculty2@`, `faculty3@`, `saadia.karim@` | attendance marking, marks entry, student search |
| Coordinator | `coordinator@shu.edu.pk` | clash queue, forms, broadcasts |
| FYP Head | `fyphead@shu.edu.pk` | FYP approvals, resources |
| Mentor | `mentor@shu.edu.pk` | standard dashboard (console retired) |
| Admin | `admin@shu.edu.pk` | users & roles, audit log, reports |

Every account signs in through the single `/sign-in` page and lands on its role dashboard.
`bun run scripts/link-clerk-users.ts` (from `apps/web`) creates/links the Clerk users.
Full sign-in guide (verification-code answer, Google flow, password resets): **`DEMO-LOGIN.md`**.

## Security model

- Clerk authenticates; `src/proxy.ts` (Next 16 middleware) protects everything but `/`, sign-in/up, health and the webhook.
- **Authorization is server-side only** — every page and server action calls `requireUser`/`requireCapability`; the RBAC matrix lives in `src/lib/rbac.ts` and is asserted exhaustively in `tests/security.test.ts`, which also statically fails the build if a portal page/action/API route skips its guard.
- Webhook payloads are svix-verified; every write re-checks role from the DB, never from the client.

## Deployment

**Live:** https://unisphere-hazel.vercel.app (production alias; preview deploys are
protected). Vercel project `unisphere` builds from the **repo root** (`vercel.json` runs
`bun install --frozen-lockfile && cd packages/db && bunx prisma generate` then
`cd apps/web && bun run build` — the generated Prisma client is not committed, so the
install step must generate it). Env lives in Vercel project
settings — never in the repo. Migrations run with `bunx prisma migrate deploy`
against `DIRECT_URL`; runtime uses pooled `DATABASE_URL`.

Deploy from the repo root:

```bash
vercel deploy --prod --yes        # .vercel/project.json links the project
```

**Live environment (2026-09-25):** Neon Postgres `unisphere` (aws-ap-southeast-1) is
provisioned and seeded — `GET /api/health` returns
`{"ok":true,"db":"up","ai":{"provider":"commandcode","model":"deepseek/deepseek-v4.1-flash"}}`.
The AI assistant uses CommandCode (`COMMANDCODE_API_KEY`); Groq/OpenAI/OpenRouter or any
OpenAI-compatible `AI_BASE_URL` also work — first configured wins. `AI_FALLBACK_MODE=1`
keeps demos offline (knowledge-base answers, no provider calls).
Demo accounts: `bun run scripts/link-clerk-users.ts` links Clerk users to the seeded
personas. See `docs/demo-script.md` for the defence walkthrough,
`docs/offline-demo.md` for the offline kit, `docs/demo/screenshots/` for captures.
