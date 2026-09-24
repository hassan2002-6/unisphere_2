# UniSphere

**A unified student portal for Salim Habib University** — FYP-II implementation of the FYP-I prototype.
Timetables with live clash detection, forms centre, complaint box, notifications, FYP workflow,
GPU/lab resource allocation, internships, alumni mentorship, and a grounded AI assistant.

> Team: Ishan Rajwani · Carol Swan · M. Hassan Siddiqui — BSCS, SHU · Supervisors: Ateeque Rahman, Saadia Karim

---

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Runtime    | Bun 1.4 (package manager + runner), Turborepo 2.11           |
| App        | Next.js 16.3 (App Router, TypeScript strict), React 19       |
| UI         | Tailwind CSS 4.3 + shadcn/ui (radix), custom UniSphere theme |
| Data       | PostgreSQL (Neon) via Prisma 7.10 (`prisma7.config.ts`)      |
| Auth       | Clerk 7.9 — 5 roles: STUDENT, FACULTY, COORDINATOR, FYP_HEAD, MENTOR |
| AI         | Provider-agnostic adapter (Groq default) + Postgres-FTS retrieval |
| Deploy     | Vercel (Hobby) — root directory `apps/web`                   |
| Lint/format| oxlint + oxfmt (oxc toolchain)                               |
| Tests      | Vitest — 235 tests (unit + security suite)                   |

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
bun run test        # vitest — 235 tests incl. RBAC matrix + guard scan
bun run build       # Next production build (typechecked)
```

Domain extras:

```bash
cd apps/web
bun run scripts/eval-ai.ts           # 33-question AI retrieval eval (needs DATABASE_URL)
bun run scripts/test-concurrency.ts  # last-GPU race acceptance test (needs DATABASE_URL)
```

## Modules (FYP-II scope — the deck's list, exactly)

| Module            | Routes                                                    | State |
| ----------------- | --------------------------------------------------------- | ----- |
| Dashboard         | `/dashboard` (role-aware live stats)                      | ✅ |
| Timetable + clash | `/timetable`, `/exams`, `/coordinator/clashes`            | ✅ |
| Academic planning | `/planning`, `/faculty/courses`                           | ✅ |
| Forms centre      | `/forms`, `/forms/new/[key]`, `/submissions(+detail)`, `/reviews`, `/faculty/reviews` | ✅ |
| Complaint box     | `/complaints(+new/detail)`, `/faculty/complaints`, `/coordinator/complaints` | ✅ |
| Notifications     | `/notifications`, `/admin/broadcast`                      | ✅ |
| FYP workflow      | `/fyp`, `/admin/fyp`                                      | ✅ |
| GPU / resources   | `/resources/request`, `/resources/my`, `/admin/requests`, `/admin/allocations` | ✅ |
| Labs & inventory  | `/admin/labs`, `/admin/inventory`                         | ✅ |
| Reports           | `/admin/reports`, `/api/reports/summary?format=csv`       | ✅ |
| Internships       | `/internships(+detail)`, `/admin/internships`             | ✅ |
| Mentorship        | `/mentorship`, `/mentor`, `/admin/mentors`                | ✅ |
| AI assistant      | `/chat` (grounded, citation chips)                        | ✅ |

Out of scope (per the deck): attendance, results, fees, events.

## Security model

- Clerk authenticates; `src/proxy.ts` (Next 16 middleware) protects everything but `/`, sign-in/up, health and the webhook.
- **Authorization is server-side only** — every page and server action calls `requireUser`/`requireCapability`; the RBAC matrix lives in `src/lib/rbac.ts` and is asserted exhaustively in `tests/security.test.ts`, which also statically fails the build if a portal page/action/API route skips its guard.
- Webhook payloads are svix-verified; every write re-checks role from the DB, never from the client.

## Deployment

**Live:** https://unisphere-hazel.vercel.app (production alias; preview deploys are
protected). Vercel project `unisphere` builds from the **repo root** (`vercel.json`
runs `bun install` then `cd apps/web && bun run build`). Env lives in Vercel project
settings — never in the repo. Migrations run with `bunx prisma migrate deploy`
against `DIRECT_URL`; runtime uses pooled `DATABASE_URL`.
Demo accounts: `bun run scripts/link-clerk-users.ts` links Clerk users to the seeded
personas. See `docs/demo-script.md` for the defence walkthrough,
`docs/offline-demo.md` for the offline kit, `docs/demo/screenshots/` for captures.
