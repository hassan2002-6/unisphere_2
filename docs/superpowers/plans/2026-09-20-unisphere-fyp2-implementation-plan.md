# UniSphere FYP-II — Implementation-Ready Engineering Plan

> **For agentic workers:** Execute this plan milestone by milestone. For each milestone, expand it into bite-sized tasks (TDD: failing test → run → minimal implementation → run → commit) using the `superpowers:writing-plans` conventions, then implement via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax when expanded into task lists.

**Goal:** Turn the FYP-I clickable prototype of UniSphere into a real, multi-user, demoable system — Next.js full-stack + PostgreSQL + Clerk + AI assistant — covering exactly the modules the FYP-I final deck lists for FYP-II.

**Architecture:** Single Next.js 16 (App Router) application. React Server Components read data through server-side service modules; mutations go through Route Handlers under `/api`. PostgreSQL (Neon) via Prisma 7. Clerk for auth with a 5-role RBAC model enforced server-side. AI assistant = provider-agnostic adapter (OpenAI-compatible) + retrieval over the requesting user's own records and a curated knowledge corpus. Deployed on Vercel, with a local (offline) fallback run mode for demo resilience.

**Tech Stack:** Next.js 16.3.x (App Router, TypeScript strict) · React 19.3 · Tailwind CSS 4.3 + shadcn/ui · Prisma 7.10 (stable; do **not** use the 8.0 release-candidate) · PostgreSQL (Neon free tier; pgvector optional) · Clerk (@clerk/nextjs 7.9.x) · Zod 4.6 · Vitest 5 · Playwright 1.63 · GitHub Actions · Vercel Hobby.
**Toolchain (owner-directed, 2026-09-24):** Bun 1.4 (package manager + script runner) · Turborepo 2.11 (monorepo: `apps/web` + `packages/db`) · Oxc — oxlint 1.85 (lint) + oxfmt 0.70 (format), replacing ESLint/Prettier.

**Spec:** This document (self-contained). Source-of-truth inputs that ride with it: `docs/research/EVIDENCE.md` (evidence map), `docs/reference/prototype/setup.html` (the FYP-I prototype — UI/flow baseline).

## Global Constraints

- **Stack is fixed:** Next.js + Prisma + PostgreSQL (Neon) + Clerk + Vercel. (Decided by the project owner on 2026-09-20; the PHP/MySQL/XAMPP line on the September poster is superseded — do not implement it. Verified: `@clerk/nextjs@7.9.4` peers allow `next@^16.0.10`; Prisma stable major is 7.10.0.)
- **Scope is fixed:** exactly the modules on the FYP-I final deck — Student Dashboard, Academic Planning (incl. the prototyped timetable/exam views & clash flags), Complaint Management, Notification System, Forms Center, Internship Module, Mentorship Module, AI Assistant, GPU/Resource Allocation — plus backend, DB, auth, APIs, testing, deployment. **Nothing more.** Attendance, results/marks, fee management, events, marketplace/notes-rental, canteen, carpool, native mobile app, LMS/ERP integration are **explicitly out of scope**.
- Language: English UI. Single university (Salim Habib University), single department at first (CS). Currency in PKR where shown.
- All authorization decisions happen **server-side**. Never trust client-supplied identity or role. Every route handler and server page guard enforces role access via `src/lib/rbac.ts`.
- Target operating cost: **$0** (free tiers). No hard dependency on any service whose free tier cannot be verified at the time of setup; every external dependency must have a documented fallback (see §7).
- Every milestone must leave the app **demoable** (working golden path), seeded with realistic data, and with green CI.
- Do not commit secrets. All config via environment variables (`.env.example` kept current).
- **Toolchain (owner-directed 2026-09-24):** the repo is a Turborepo monorepo (`apps/web` = Next app, `packages/db` = Prisma schema/client/seed). Package manager and script runner: **Bun** — wherever this plan writes `npm …` / `npx …`, run `bun …` / `bunx …` (`bun run build` instead of `npm run build`; `bunx prisma migrate dev` instead of `npx prisma migrate dev`); lockfile is `bun.lock`. Linting/formatting: **oxlint + oxfmt** (no ESLint/Prettier). Path mapping: plan's `prisma/…` → `packages/db/prisma/…`; `src/…` → `apps/web/src/…`. Scope, architecture, milestones, and acceptance criteria are unchanged.

## Review Focus

(The input classes and failure modes most likely to bite a real user — each gets tests in the owning milestone, as noted.)

1. **Malformed or partial form payloads** against dynamic (JSON-driven) forms → server must reject with a field-level error, never persist garbage. (M2c)
2. **Two allocation requests racing for the last GPU** → availability must decrement atomically; exactly one allocation succeeds. (M3b)
3. **AI provider outage / quota exhaustion** → chat degrades to a labeled limited mode, never a dead screen or a fabricated answer. (M5)
4. **Role-escalation attempts** (student calling admin endpoints, tampered IDs) → 403 with a server-side audit, never data leakage. (M1 + security suite M6)
5. **Empty-data first-run** (fresh DB, a role with zero records) → every screen renders a purposeful empty state, not a crash or blank panel. (every milestone's UI work)

---

## 1. Executive Summary

UniSphere is a unified university portal for **Students, Faculty, Program Coordinators, and the FYP Head (admin)** — plus **Alumni Mentors** for the mentorship module — built as the FYP-II implementation of a project whose research, design, and clickable prototype were completed in FYP-I (see `docs/reference/prototype/setup.html`; the real UI looked like this). FYP-II replaces the prototype's in-memory mock data with a real backend: PostgreSQL persistence, Clerk authentication with role-based portals, complete request/approval workflows (Forms Center, Complaints, FYP applications, GPU/Resource allocation, Internships, Mentorship), an in-app notification system, and an AI assistant that answers student questions grounded in their own records and a curated university-knowledge corpus. It ships deployed on Vercel with a local offline fallback for demo day. The single highest-value showcase feature — emphasized on the team's poster — is the **FYP GPU/Resource Request workflow** (student → FYP Head review → allocation → tracking). Success = all acceptance criteria in §12 pass, the app is deployed and demoable in under 3 minutes per role, and the FYP-II report can cite real architecture, real tests, and real evaluation results.

## 2. Refined Specification

### 2.1 Problem
University services are fragmented: students juggle disconnected platforms for announcements, forms, complaints, internships, and FYP administration; deadlines are missed because notifications don't exist centrally; complaint handling is manual and opaque; GPU/lab resources for FYP projects have no structured request process. (Sources: FYP-I deck, poster, survey — see `docs/research/EVIDENCE.md`.)

### 2.2 Users
| Role | Who | Primary needs |
|---|---|---|
| STUDENT | Enrolled students | Timetable/exams, forms & requests, complaints, notifications, internships, mentorship, FYP application, GPU/CPU resource request, AI assistant |
| FACULTY | Teaching staff | Their schedule, student complaints addressed to them, forms routed to them, (mentor duties if also mentor) |
| COORDINATOR | Program Coordinator | Timetable approval + clash resolution, complaints management, forms review, faculty assignment, broadcasts |
| FYP_HEAD | FYP Head / admin | FYP application review, resource requests review/recommend/allocate, labs & inventory, mentor approvals, internships posting, reports |
| MENTOR | Alumni mentors (vetted accounts) | Mentor profile, incoming mentorship requests, scheduling sessions |

### 2.3 Core workflows (end-to-end)
1. **Sign in → role portal.** Clerk auth; user lands on their role's dashboard (sidebar per role, exactly as prototyped).
2. **Student daily loop:** dashboard (today's classes, announcements, stats) → timetable/exams (clash flags visible) → notifications.
3. **Forms:** student picks a form type (Add/Drop, Withdrawal, Semester Freeze, Transcript, Degree Verification, Scholarship, Leave…) → dynamic form → submit → routed to reviewer role → review (approve/reject + comment) → submitter notified → timeline shows history.
4. **Complaints:** student submits (subject, category, description) → faculty/coordinator picks up → status transitions with comments → student notified and tracks status.
5. **FYP application:** student group submits (title, domain, tech, group, members, supervisor preference) → FYP Head approves/rejects with remarks → notified; status visible.
6. **GPU/Resource request (showcase):** student group requests (project, resource type GPU/CPU/Workstation, config, purpose, dates, time slot) → FYP Head reviews → **recommend** → **allocate** (pick lab + resource; availability decremented atomically) or reject → student notified; allocation tracking dashboard for admin; "My Allocations" for students.
7. **Internships:** admin/coordinator posts listings → students browse, apply, track status; reviewers shortlist/accept/reject.
8. **Mentorship:** student browses approved alumni mentors → sends request with message → mentor accepts/declines → session proposed (time/mode/location) and confirmed → completed.
9. **AI assistant:** student asks in chat; assistant answers using the student's own data (forms, requests, timetable, allocations) and the knowledge corpus; always cites document sources; refuses out-of-scope questions; degrades gracefully offline.
10. **Notifications:** every state change above emits an in-app notification (bell + page + unread badge); coordinator can broadcast; admin can announce.

### 2.4 Inputs
Clerk identity; form submissions (JSON payloads per template); complaints; FYP applications; resource requests; internship applications; mentorship requests/sessions; schedule data (classes, slots, exams); lab/resource inventory; knowledge documents; broadcasts; chat messages.

### 2.5 Outputs
Persisted records with status timelines; notifications; per-role dashboards; clash reports; allocation records + utilization reports; AI answers (with sources or explicit refusals); seeded demo data; the FYP-II documentation set (from §11 M6).

### 2.6 Success definition
A faculty examiner (or any reviewer) can, within one demo session: sign in as each of the 5 roles; complete the student→reviewer→decision loop for Forms, Complaints, FYP, and GPU requests; see notifications appear; ask the AI assistant 3 representative questions and get grounded answers; and view reports that reflect the seeded data — with the whole system running on the deployed URL (and locally, offline, as backup).

## 3. Requirements

### Must-have
- Auth + 5 roles + role portals (Clerk; server-enforced RBAC).
- Student Dashboard (today's classes, stats, announcements, quick actions).
- Academic Planning: degree-plan view (seeded BSCS 8-semester plan), Timetable view, Exam Schedule view, clash flags.
- Complaint Management: submit, track, review workflow, notifications.
- Notification System: in-app, event-driven, unread counts, broadcast.
- Forms Center: dynamic forms from templates (student + faculty sets), routing, decisions, tracking timeline.
- Internship Module: listings (admin-posted/seeded), student applications, tracking.
- Mentorship Module: mentor directory, requests, session scheduling, mentor portal.
- FYP application workflow (submit/review/status).
- GPU/Resource: request → review → recommend → allocate → track; labs + inventory management; reports/analytics.
- AI Assistant: chat UI, provider adapter (OpenAI-compatible), retrieval over own records + knowledge corpus, citations, refuse/redirect behavior, rate limiting, canned fallback mode.
- PostgreSQL persistence via Prisma migrations; seed system; test suite (unit + integration + E2E); CI; deployed on Vercel; local offline run mode.

### Should-have
- CSV export on admin reports; “allocation expiring soon” indicators; email notification channel (e.g. Resend free tier) behind a flag; vector search (pgvector) as a second retrieval backend behind a flag; bulk notification digest; keyboard-accessible chat.

### Nice-to-have
- Course-completion tracking on the degree plan; mentor availability calendar; internship save/bookmark; dark mode; Urdu UI strings.

### Explicitly out of scope
Attendance tracking, marks/results/fee modules, events module, room booking, food ordering, notes marketplace, carpool, native mobile apps, LMS/ERP integration, biometric/voice features, predictive analytics. Do not build them even if the FYP-I report (generic template) mentions some of them.

## 4. Architecture

### 4.1 Options considered
| Option | Verdict | Why |
|---|---|---|
| **A. Next.js full-stack monolith (App Router + Route Handlers) + Prisma + Neon + Clerk, Vercel** | **Selected** | Matches the FYP-I deck commitment; one deployable; end-to-end TypeScript; team skill evidence (Next.js/Clerk practice repos); free tiers sufficient; fastest path to a solid demo. |
| B. Next.js frontend + separate Node/Express API | Rejected | Double deployment + CORS + auth plumbing for zero benefit at this scale (YAGNI). |
| C. PHP + MySQL (XAMPP) | Rejected | Contradicts the deck commitment; weak AI/typed-DX story; chosen against by owner. |
| D. SPA + Supabase (swap Prisma/Clerk) | Rejected | Conflicts with the deck’s Prisma/Clerk commitment; no compensating benefit. |

### 4.2 System architecture (textual)
```
┌─────────────────────────────  Vercel (Next.js 16)  ─────────────────────────────┐
│  Browser ──HTTPS──▶  Next.js App Router                                         │
│   • (portal) route group: server components + client islands (chat, forms)      │
│   • /api Route Handlers (mutations, AI, webhooks) ── Zod validation             │
│   • src/server/* services (business logic; all RBAC + state machines live here) │
│   • Clerk middleware: session → userId → DB user (role)                         │
└──────────┬──────────────────────────────┬───────────────────────────────┬──────┘
           │ Prisma (pooled URL)          │ Clerk Backend API             │ HTTPS (fetch)
           ▼                              ▼                               ▼
   PostgreSQL (Neon)              Clerk (auth, users)            AI provider (OpenAI-compatible:
   • all app data                 • sessions, MFA                Groq default / Gemini / OpenRouter)
   • optional pgvector            • webhook → user sync          • fallback: canned mode
   • FTS index on knowledge docs  • role in publicMetadata        • corpus: DB + /content/knowledge
```
### 4.3 Key decisions
- **Reads** via React Server Components calling `src/server/services/*` directly (no HTTP hop). **Writes** via Route Handlers so every mutation has one enforcement point, one Zod schema, one test surface. No Server Actions in v1 (uniformity over novelty).
- **Identity:** Clerk session → `clerkId` → DB `User` row loaded per request (role + profile). Role is also mirrored in Clerk `publicMetadata.role` for routing/shell, but **authorization always reads the DB** (fresh, auditable). Clerk webhook syncs user create/update; first-login fallback upserts.
- **AI:** server assembles a bounded context per message: (a) the requesting user's own records snapshot (own forms/complaints/FYP/allocation/mentorship statuses — never other users'), (b) top-k knowledge chunks via Postgres full-text search, (c) last 6 chat turns. One OpenAI-compatible client (works with Groq, Gemini’s OpenAI-compat endpoint, OpenRouter, OpenAI) configured entirely by env vars. No function/tool calling in v1 (context injection instead — simpler, safer, testable). Provider failure → retry once → canned fallback responses + "limited mode" banner.
- **Retrieval:** committed = structured queries + Postgres FTS over `KnowledgeDoc`. Optional (flag `RETRIEVAL_VECTOR=on`) = pgvector (Neon supports it on all plans — verified; `CREATE EXTENSION IF NOT EXISTS vector`) with embeddings from the configured provider; FTS remains the fallback path.
- **Notifications:** synchronous DB fan-out inside the same transaction as the triggering state change (small scale → simplest correct option). UI polls (30s + on navigation). Email is optional/should-have.
- **Demo resilience:** all three critical externals (DB, AI, hosting) have fallbacks: local Postgres via Docker, canned AI mode, `npm run dev`/`npm start` locally. See §9 and M6.

## 5. Components

| # | Component | Responsibility | Inputs → Outputs | Key invariants / failure modes |
|---|---|---|---|---|
| C1 | `src/lib/auth` + middleware | Session → user resolution; route protection; role-based redirect | Clerk session → `{user, role}` | Every `(portal)` page requires a DB user; unknown role → sign-in with error; Clerk outage → error page (no data exposure) |
| C2 | `src/lib/rbac.ts` | `requireRole(roles)`, `assertCan(actor, action, resource)` (matrix in §8.1) | actor + action → allow/deny | Deny-by-default; unit-tested matrix; failure mode: none silently pass |
| C3 | `src/server/services/*` | Business logic per domain (forms, complaints, fyp, resources, notifications, internships, mentorship, schedule, reports, chat) | validated DTOs → Prisma writes + notifications | State machines enforce legal transitions; every transition emits exactly one notification to the right audience; failures roll back the transaction |
| C4 | `src/server/clash.ts` | Timetable/exam clash detection (room, faculty, cohort overlaps) | slots → clash list | Pure function; deterministic; unit-test matrix |
| C5 | `src/server/ai/*` | Context builder, retrieval, provider adapter, guardrails, fallback | chat request → grounded reply + sources | Context contains only the requester's data + public docs; provider timeout 10s → fallback; tokens bounded (`AI_MAX_TOKENS`, top-k=4 chunks, 6 turns) |
| C6 | `src/app/(portal)/**` | Role portals & screens (see §6.4); sidebar per role from prototype | server data → UI | Empty states for every list; no client-side authz decisions |
| C7 | `src/components/**` | shadcn/ui-based design system + domain components (StatusBadge, TrackTimeline, statCard, chat bubbles) | props → UI | Visual tokens follow prototype palette (§6.5) |
| C8 | `prisma/` (schema, migrations, seed) | Data model; reproducible seed incl. demo clash + GPU inventory | `prisma migrate dev` / `npm run seed` | Seed idempotent; fresh DB → fully demoable in <2 min |
| C9 | Tests (`tests/**`, `e2e/**`) | Unit/integration/E2E/AI-eval | code → evidence | Flows in §10 are the contract |
| C10 | CI (GitHub Actions) | typecheck, lint, unit, prisma validate, build, integration (ephemeral PG) | PR → status | Red CI blocks merge |

## 6. Data / State / API Design

### 6.1 Prisma schema (draft v1 — finalize in M1)
```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (Neon)
  directUrl = env("DIRECT_URL")     // direct, for migrations
}

enum Role { STUDENT FACULTY COORDINATOR FYP_HEAD MENTOR }
enum FormStatus { SUBMITTED UNDER_REVIEW APPROVED REJECTED WITHDRAWN }
enum ComplaintStatus { OPEN IN_REVIEW RESOLVED CLOSED }
enum FypStatus { PENDING APPROVED REJECTED }
enum ResourceRequestStatus { PENDING RECOMMENDED ALLOCATED REJECTED CANCELLED }
enum AllocationStatus { ACTIVE COMPLETED REVOKED }
enum MentorshipRequestStatus { PENDING ACCEPTED DECLINED CANCELLED COMPLETED }
enum MentorshipSessionStatus { PROPOSED CONFIRMED COMPLETED CANCELLED }
enum InternshipApplicationStatus { APPLIED SHORTLISTED ACCEPTED REJECTED }
enum ResourceType { GPU CPU WORKSTATION LAB }
enum NotificationType { FORM COMPLAINT FYP RESOURCE MENTORSHIP INTERNSHIP ANNOUNCEMENT SYSTEM }
enum DayOfWeek { MON TUE WED THU FRI SAT }

model User {
  id             String   @id @default(cuid())
  clerkId        String   @unique
  email          String   @unique
  name           String
  role           Role     @default(STUDENT)
  department     String?
  registrationNo String?
  employeeId     String?
  createdAt      DateTime @default(now())
  studentProfile   StudentProfile?
  facultyProfile   FacultyProfile?
  mentorProfile    MentorProfile?
  // Back-relations to add in M1: formSubmissions, formEvents(actor), complaints, complaintEvents(actor),
  // fypApplications(applicant+decider), resourceRequests(applicant+decider), allocations(allocator),
  // internshipsPosted, internshipApplications, mentorshipAsStudent, mentorshipAsMentor,
  // sessionsProposed, chatSessions, notifications
}

model StudentProfile { id String @id @default(cuid()) userId String @unique semester Int? batch String? program String @default("BSCS") user User @relation(fields:[userId], references:[id]) }
model FacultyProfile { id String @id @default(cuid()) userId String @unique designation String? office String? user User @relation(fields:[userId], references:[id]) }
model MentorProfile  { id String @id @default(cuid()) userId String @unique headline String company String? expertise String[] bio String? linkedinUrl String? isApproved Boolean @default(false) maxActiveMentees Int @default(5) user User @relation(fields:[userId], references:[id]) }

model CourseClass  { id String @id @default(cuid()) courseCode String title String section String department String semester String facultyId String? credits Int? slots TimetableSlot[] exams ExamSchedule[] }
model TimetableSlot{ id String @id @default(cuid()) classId String day DayOfWeek startMin Int endMin Int room String? labId String? class CourseClass @relation(fields:[classId], references:[id]) @@index([day, startMin, endMin]) }
model ExamSchedule { id String @id @default(cuid()) classId String? courseTitle String date DateTime startMin Int endMin Int hall String? }

model Lab      { id String @id @default(cuid()) name String number String capacity Int type String? }
model Resource { id String @id @default(cuid()) name String model String type ResourceType specs String quantity Int available Int }

model Notification { id String @id @default(cuid()) userId String type NotificationType title String body String link String? readAt DateTime? createdAt DateTime @default(now()) @@index([userId, readAt]) }

model FormTemplate   { id String @id @default(cuid()) key String @unique title String description String audienceRole Role reviewerRole Role recipientLabel String fields Json active Boolean @default(true) slaDays Int? }
model FormSubmission { id String @id @default(cuid()) templateId String submittedById String payload Json status FormStatus @default(SUBMITTED) reviewerId String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt events FormEvent[] @@index([status]) }
model FormEvent      { id String @id @default(cuid()) submissionId String actorId String? fromStatus FormStatus? toStatus FormStatus comment String? createdAt DateTime @default(now()) }

model Complaint      { id String @id @default(cuid()) submittedById String subject String category String description String status ComplaintStatus @default(OPEN) assignedToId String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt events ComplaintEvent[] @@index([status]) }
model ComplaintEvent { id String @id @default(cuid()) complaintId String actorId String? status ComplaintStatus comment String? createdAt DateTime @default(now()) }

model Internship { id String @id @default(cuid()) title String company String description String location String? mode String? stipend String? deadline DateTime? applyUrl String? tags String[] status String @default("OPEN") postedById String createdAt DateTime @default(now()) applications InternshipApplication[] }
model InternshipApplication { id String @id @default(cuid()) internshipId String studentId String note String? status InternshipApplicationStatus @default(APPLIED) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([internshipId, studentId]) }

model FypApplication { id String @id @default(cuid()) applicantId String title String domain String description String technologies String groupName String members String registrationNos String supervisorPref String? department String semester String status FypStatus @default(PENDING) remarks String? decidedById String? decidedAt DateTime? createdAt DateTime @default(now()) @@index([status]) }

model ResourceRequest { id String @id @default(cuid()) applicantId String projectName String groupName String members String supervisor String? resourceType ResourceType config String purpose String startDate DateTime endDate DateTime timeSlot String status ResourceRequestStatus @default(PENDING) remarks String? decidedById String? decidedAt DateTime? createdAt DateTime @default(now()) allocation Allocation? @@index([status]) }
model Allocation { id String @id @default(cuid()) requestId String @unique resourceId String labId String? startDate DateTime endDate DateTime timeSlot String status AllocationStatus @default(ACTIVE) allocatedById String allocatedAt DateTime @default(now()) notes String? }

model MentorshipRequest { id String @id @default(cuid()) studentId String mentorId String message String status MentorshipRequestStatus @default(PENDING) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt sessions MentorshipSession[] @@index([mentorId, status]) }
model MentorshipSession { id String @id @default(cuid()) requestId String proposedById String scheduledAt DateTime mode String location String? notes String? status MentorshipSessionStatus @default(PROPOSED) createdAt DateTime @default(now()) }

model ChatSession { id String @id @default(cuid()) userId String title String? createdAt DateTime @default(now()) messages ChatMessage[] }
model ChatMessage { id String @id @default(cuid()) sessionId String role String content String sources Json? tokenCount Int? createdAt DateTime @default(now()) }

model KnowledgeDoc { id String @id @default(cuid()) title String source String content String tags String[] updatedAt DateTime @updatedAt }
```
Additional raw-SQL migration (M1): full-text search column + index on `KnowledgeDoc`:
```sql
ALTER TABLE "KnowledgeDoc" ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED;
CREATE INDEX IF NOT EXISTS knowledgedoc_tsv_idx ON "KnowledgeDoc" USING GIN (tsv);
```

### 6.2 Status machines (legal transitions — enforced in services, unit-tested)
- **Form:** SUBMITTED → UNDER_REVIEW → {APPROVED, REJECTED}; SUBMITTED → WITHDRAWN (by submitter only, before decision). Every transition writes a `FormEvent` + notifies the submitter (decisions) or the reviewer role (submission).
- **Complaint:** OPEN → IN_REVIEW → {RESOLVED, CLOSED}; RESOLVED → CLOSED. Events + notifications on each change.
- **FYP:** PENDING → {APPROVED, REJECTED} (decider = FYP_HEAD; remarks optional but recommended).
- **Resource request:** PENDING → RECOMMENDED → ALLOCATED | REJECTED; PENDING/RECOMMENDED → CANCELLED (owner). ALLOCATED creates exactly one Allocation in the same transaction.
- **Allocation:** ACTIVE → {COMPLETED, REVOKED}.
- **Mentorship request:** PENDING → {ACCEPTED, DECLINED, CANCELLED}; ACCEPTED → COMPLETED (after a completed session).
- **Mentorship session:** PROPOSED → CONFIRMED → COMPLETED; PROPOSED → CANCELLED.
- **Internship application:** APPLIED → SHORTLISTED → {ACCEPTED, REJECTED}; APPLIED → REJECTED.

### 6.3 API (Route Handlers; all JSON; Zod-validated; auth required unless marked public)
| Method & Path | Role(s) | Purpose |
|---|---|---|
| `POST /api/webhooks/clerk` | public (signature-verified) | User sync (create/update) |
| `GET /api/health` | public | Liveness + DB ping |
| `GET/POST /api/forms` | STUDENT/FACULTY (list own / submit) | Forms Center |
| `GET /api/forms/[id]` , `POST /api/forms/[id]/events` | owner / reviewer role | Detail + transitions (withdraw/approve/reject/comment) |
| `GET /api/reviews/forms` , `POST /api/forms/[id]/decision` | FACULTY/COORDINATOR/FYP_HEAD per template | Review queue + decisions |
| `GET/POST /api/complaints` ; `POST /api/complaints/[id]/events` | owner / FACULTY+COORDINATOR | Complaint lifecycle |
| `GET/POST /api/fyp` ; `POST /api/fyp/[id]/decision` | STUDENT / FYP_HEAD | FYP application |
| `GET/POST /api/resources/requests` ; `POST /api/resources/requests/[id]/recommend|allocate|reject` | STUDENT / FYP_HEAD | GPU/resource workflow |
| `GET /api/resources/allocations` ; `POST /api/resources/allocations/[id]/close` | owner / FYP_HEAD | Allocation tracking |
| `GET/POST/PATCH /api/admin/labs` , `/api/admin/resources` | FYP_HEAD | Inventory CRUD |
| `GET/POST/PATCH /api/internships` ; `POST /api/internships/[id]/apply` ; `POST /api/internships/applications/[id]/decision` | FYP_HEAD / STUDENT / reviewer | Internships |
| `GET /api/mentorship/mentors` ; `GET/POST /api/mentorship/requests` ; `POST /api/mentorship/requests/[id]/decision` ; `POST /api/mentorship/sessions` ; `POST /api/mentorship/sessions/[id]/decision` | STUDENT / MENTOR / FYP_HEAD(approve profiles) | Mentorship |
| `GET /api/notifications` ; `POST /api/notifications/[id]/read` ; `POST /api/notifications/read-all` ; `POST /api/admin/broadcast` | all / COORDINATOR+FYP_HEAD | Notifications |
| `GET /api/schedule/timetable` ; `GET /api/schedule/exams` ; `GET /api/schedule/clashes` | all (scoped) | Schedule read + clash view |
| `GET /api/reports/summary` (+ `?format=csv`) | FYP_HEAD | Reports |
| `POST /api/ai/chat` | STUDENT (FACULTY later — flag) | AI assistant (rate-limited) |

Conventions: consistent error shape `{ error: { code, message, details? } }`; 401 unauthenticated / 403 wrong role / 404 not-found-or-not-yours (don't leak existence); all list endpoints paginated (`?cursor=`) from day one.

### 6.4 Page routes (App Router, `src/app/(portal)/`)
`/dashboard` (role variant) · `/timetable` · `/exams` · `/planning` · `/notifications` · `/internships` (+`/[id]`) · `/complaints` (+`/new`) · `/forms` (+`/new/[key]`) · `/submissions` · `/reviews` · `/fyp` · `/resources/request` · `/resources/my` · `/mentorship` (+`/requests`) · `/chat` · `/mentor` (mentor portal: requests + sessions) · `/admin/fyp` · `/admin/requests` · `/admin/allocations` · `/admin/labs` · `/admin/inventory` · `/admin/internships` · `/admin/mentors` · `/admin/reports` · `/admin/broadcast` · `/coordinator/approvals` · `/coordinator/clashes` · `/coordinator/complaints` · `/coordinator/faculty` · `/faculty/complaints` · `/faculty/reviews` · `/faculty/courses`
(Each role's sidebar shows only its routes; guards enforced in layout + handlers.)

### 6.5 Design tokens (continuity with the FYP-I prototype)
Primary `#1e40af` · primary-dark `#1e3a8a` · primary-light `#dbeafe` · accent `#0ea5e9` · accent-2 `#14b8a6` · background `#f7f9fc` · surface `#ffffff` · text `#0f172a` · muted `#64748b` · border `#e2e8f0` · success `#10b981` · warning `#f59e0b` · danger `#ef4444`. Sidebar + topbar shell, stat-card grids, status badges, tracking timeline — all as in `docs/reference/prototype/setup.html`.

### 6.6 Notification events (exact matrix)
| Trigger | Recipients |
|---|---|
| Form submitted | reviewers of `reviewerRole` |
| Form decided / commented | submitter |
| Complaint submitted | FACULTY (if category=Faculty) + COORDINATOR |
| Complaint status changed | submitter (+ assignee) |
| FYP submitted | FYP_HEAD |
| FYP decided | applicant |
| Resource request submitted | FYP_HEAD |
| Resource request recommended/allocated/rejected | applicant |
| Allocation expiring ≤7 days | applicant (computed badge; no cron required in v1) |
| Internship posted | all students (broadcast-style) |
| Internship application decision | applicant |
| Mentorship request created | mentor |
| Mentorship request decided | student |
| Session proposed/confirmed | counterpart |
| Broadcast | chosen audience |

## 7. External Dependencies

All facts below verified **2026-09-20** from vendor docs/search; items marked ⚠ must be re-verified at setup time because these vendors change quotas frequently.

| Dependency | Why | What it provides | Limits (verified) | Cost | Fallback on failure |
|---|---|---|---|---|---|
| **Clerk** (@clerk/nextjs 7.9.4) | Auth/RBAC | Sessions, sign-in/up UI, user management, webhooks | Free tier = **50,000 MRU** (raised from 10k in Feb 2026; ⚠ older pages still say 10k — verify at signup). Dev instance (used for seeded demo users) caps at ~100 users — fine for demo. Hobby plan is capped (upgrade only needed past free) | $0 | Auth isn't easily swappable mid-flight; mitigation = keep DB roles authoritative so an auth swap wouldn't touch authorization logic. Demo risk ≈ 0. |
| **PostgreSQL — Neon** | Main DB | Serverless Postgres + pooling | Free: **100 CU-hours/project/month** (≈400h at 0.25 CU), **0.5 GB** storage, 5 GB transfer, scale-to-zero after 5 min inactivity; `pgvector` available on all plans (`CREATE EXTENSION vector`) | $0 | Local Docker Postgres (`docker-compose up db`) with same schema; switch `DATABASE_URL`. |
| **Vercel (Hobby)** | Hosting | Next.js deploy, previews, logs | Free, **non-commercial only** (student FYP = OK — never enable paid features on it). ~100 GB transfer/mo; function max duration 300 s; 1 concurrent build; 100 deploys/day; 50 MB function bundle | $0 | `npm run build && npm start` locally (offline mode) — M6 packages this. |
| **AI provider** (OpenAI-compatible) | AI assistant | Chat completions | **Groq (default)**: free tier ≈30 RPM, up to ~14,400 RPD entry models (no credit card). **Gemini**: free tier quota has been cut repeatedly (some Flash models ≈20 RPD; Flash-Lite ≈500 RPD per recent reports) — treat as ⚠ volatile. **OpenRouter**: free-tier models available. All three expose OpenAI-compatible endpoints; Gemini via its `/v1beta/openai` compatibility path | $0; optional ~$5 credits buffer for demo week (estimate) | Canned-response mode (the prototype's rule set + status lookups) behind `AI_FALLBACK=on`; UI labels “limited mode”. Optional paid top-up. |
| **Embeddings (optional, only if `RETRIEVAL_VECTOR=on`)** | Vector retrieval | Query/doc embeddings | Provider-dependent and volatile ⚠; if unavailable, stay on FTS | $0–small | Postgres FTS is the committed retrieval path. |
| **GitHub Actions** | CI | typecheck/tests/build | Free for public repos; service containers for Postgres | $0 | Run `npm run check` + docker locally. |
| **Email (optional)** | Notification channel | Transactional email | e.g. Resend free tier ⚠ verify | $0 | In-app notifications only (v1 default). |

## 8. Security & Privacy

### 8.1 Role → capability matrix (enforced server-side; one test per row)
| Capability | STUDENT | FACULTY | COORDINATOR | FYP_HEAD | MENTOR |
|---|---|---|---|---|---|
| Read own records (forms/complaints/FYP/allocations/notifications) | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| Submit forms / complaints / FYP / resource requests | ✅ | forms only | forms only | — | — |
| Review forms | — | ✅ (routed) | ✅ (routed) | ✅ (routed) | — |
| Manage complaints (status/assign) | — | ✅ | ✅ | — | — |
| Approve FYP applications | — | — | — | ✅ | — |
| Recommend/allocate resources; labs/inventory CRUD | — | — | — | ✅ | — |
| Post internships; approve mentors; broadcast; reports | — | — | broadcast + post | ✅ | — |
| Chat with AI | ✅ (FACULTY flagged later) | — | — | — | — |
| Act as mentor (requests/sessions) | — | — | — | — | ✅ |

### 8.2 Threats & mitigations
| Threat | Vector | Mitigation |
|---|---|---|
| Privilege escalation | Forged role in client state; calling other-role endpoints; tampered IDs | Authorization only from DB `User.role` via `requireRole`; ownership checks in services (`where {id, ownerId: me}`); “404 not yours” semantics; matrix tests |
| Broken object-level access | Guessing IDs of others’ forms/complaints | All queries scoped by ownership or reviewer role; integration test per object type |
| Injection (SQL) | User text into queries | Prisma parameterized queries everywhere; FTS via `websearch_to_tsquery` with bound params; no raw concatenation |
| XSS | Complaint/form/chat content rendered | React escaping; **no `dangerouslySetInnerHTML`**; markdown-lite rendering for AI answers sanitized |
| CSRF | Cross-site POSTs | Clerk session cookies (SameSite) + explicit auth check per handler; no state-changing GETs |
| Prompt injection (AI) | Knowledge docs / user input steering the model | Retrieved content wrapped as untrusted data in the prompt; no tool execution; output constrained by system prompt + post-hoc checks (citation required for policy answers); logged for review |
| Data leakage to LLM | Sending extra PII | Context = requester’s own records + public corpus only; explicit `toAIContext()` mappers with field allowlists; test asserts no cross-user fields |
| Abuse / cost run-out | AI endpoint hammering | Per-user rate limit (`AI_DAILY_LIMIT_PER_USER`, default 50/day; and 10/min) enforced in DB; 403 with friendly message; token caps |
| Secret leakage | Env in client bundle | Only `NEXT_PUBLIC_*` exposed; secrets server-only; `.env*` gitignored; CI uses no prod secrets |
| Supply chain | npm deps | Lockfile committed; `npm audit` in CI (non-blocking v1); minimal dependency set; Prisma+Next+Clerk+Zod+Tailwind only |
| Data retention/privacy | Student records | Single-university internal use; seeded demo data only for non-owner accounts; no real student PII during development; deletions cascaded where required by FK design |

## 9. Performance & Cost

### Performance expectations/limits
- Dashboards and lists: server-rendered, indexed queries → target < 1.5 s local, < 3 s on Vercel cold start (Neon wake ~0.5–2 s after 5-min idle — keep a warm ping before demos).
- AI reply: Groq typical 0.5–2 s for the bounded context (top-k=4 chunks, ≤500 output tokens) → meets the report’s 2–3 s NFR in normal conditions; document 3–8 s worst case politely in the report instead of overpromising.
- Bounded context per AI call: ≤ ~6 KB of retrieved text + last 6 turns → keeps request cost & latency low and quota-friendly.

### Cost model
| Item | Known/Estimated | Amount |
|---|---|---|
| Vercel Hobby | Known (vendor pricing page) | $0 (non-commercial) |
| Neon Free | Known | $0 |
| Clerk Hobby | Known | $0 (≤50k MRU) |
| Groq/Gemini/OpenRouter free tiers | Known limits, volatile quotas | $0 |
| Optional AI credits buffer (demo week) | Estimated | ~$5 one-time |
| Custom domain (optional) | Estimated | ~$10–12/yr |
| **Total required** | | **$0** |

## 10. Testing & Evaluation

### Strategy
- **Unit (Vitest):** clash algorithm matrix; RBAC matrix (8.1); every status machine’s legal/illegal transitions; Zod schemas per form template; AI context builder (ownership scoping, truncation); retrieval ranking; notification fan-out recipients; availability decrement math.
- **Integration (Vitest + ephemeral Postgres via docker/GitHub service):** each route handler happy path + 401/403/404/422 cases; full flows: form submit→review→decision; complaint lifecycle; FYP decision; resource request→recommend→allocate (incl. **concurrency test**: two parallel allocations for last available GPU → exactly one succeeds); mentorship request→accept→session; notification emitted on each transition; broadcast reach.
- **E2E (Playwright, against seeded DB, mocked AI provider in CI):** 5 role sign-ins; GPU golden path; forms golden path; notification badge appears after a decision; AI chat happy path + limited-mode path; empty-state snapshot for a fresh role.
- **AI evaluation (scripted, `npm run eval:ai`):** a golden set of ≥30 questions across: (a) personal data (“what’s my FYP status?”), (b) policy/knowledge (“what’s the deadline to add/drop?”), (c) out-of-scope (must refuse), (d) injection attempts (must not comply). Metrics recorded per run: grounded-answer rate, citation-presence rate, refusal-correctness, latency; results committed to `docs/evaluations/`. Re-run on any prompt/model change.
- **Security suite:** the §8.2 matrix-test rows as integration tests; `npm audit`; secret scan (gitleaks in CI optional).
- **Performance smoke:** dashboard TTFB and AI latency logged manually per milestone release checklist (documented, not CI-gated).

## 11. Implementation Roadmap

> Timeline note: owner could not confirm FYP-II dates yet. The plan is therefore **T-relative** (defence = T-0): keep M0–M3 done by **T-6 weeks**, M4–M5 by **T-4 weeks**, M6 from **T-3 weeks**, leaving ≥1 week buffer. Each milestone ends demoable; if time runs short, cut in the order listed in §13 (descope ladder) — never add.

### Phase 0 — Spikes (M0, ~2–3 days; reduces the 3 big unknowns)
- **Files:** `docs/spikes/notes.md` (results), throwaway branches only.
- **Work:** ① scaffold `create-next-app` (TS, Tailwind, App Router) + deploy to Vercel + Neon DB reachable via Prisma `SELECT 1`; ② Clerk app on dev instance; sign-in works; role claim round-trips; ③ AI provider key (Groq) — one chat call from a route handler with latency + exact quota observed (record in notes); ④ Postgres FTS sanity query over 3 sample docs.
- **DoD:** deployed URL shows logged-in email + role; AI ping returns <3 s; spike notes record exact verified quotas; go/no-go on provider choice.

### Phase 1 — Foundation (M1, ~1 week)
- **Files:** `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`, `src/lib/{auth,rbac,db,validation}`, `src/middleware.ts` (or the Next-16 `proxy` equivalent — follow `create-next-app` output), `src/app/(portal)/layout.tsx` + role shells, `src/server/services/*` skeletons, `.github/workflows/ci.yml`, `.env.example`.
- **Work:** full schema + migration (incl. FTS raw-SQL migration); Clerk middleware + webhook (`/api/webhooks/clerk`) + first-login upsert; RBAC module + matrix tests; role shells with all sidebar items (routes may stub); seed v1: users (5 roles), courses/timetable (with one deliberate raw clash pair), exams, labs (4 from prototype), resources (GPU inventory incl. RTX 4090/4080/3090, A100, H100 rows as prototyped), form templates (student+faculty sets), internships (6), knowledge docs (10–15 starters), degree plan (BSCS 8 semesters), mentors (3), sample complaints/FYP/requests; CI green; deploy pipeline proven.
- **DoD:** fresh clone → `.env` → `npx prisma migrate dev && npm run seed` → all 5 demo accounts sign in and see correct shells; RBAC tests green; deployed preview works; `docs/spikes/notes.md` updated with setup commands.

### Phase 2 — Core student flows (M2, ~1.5–2 weeks)
- **2a Timetable/Exams/Clash:** `src/server/clash.ts` + tests (room/faculty/cohort overlaps; exam-vs-class); student views; coordinator clash list + approximate resolution (mark resolved). Notifications not needed here.
- **2b Notifications:** service + fan-out + bell/read/unread + page + broadcast (coordinator/admin); integration tests for recipients.
- **2c Forms Center:** templates → dynamic renderer (`src/components/forms/DynamicForm.tsx`, Zod built from field schema); submit; my-submissions + timeline; review queue + decisions (faculty/coordinator); notifications wired end-to-end.
- **2d Complaints:** submit + track; faculty/coordinator management; notifications.
- **DoD each:** E2E student journey against seeded data; state machine tests; empty states; notifications appear for every transition in §6.6.

### Phase 3 — FYP + GPU/Resource showcase (M3, ~1–1.5 weeks)
- **Work:** FYP apply/status + FYP-Head review; resource request → recommend → allocate/reject (transactional decrement; concurrency test); labs + inventory CRUD; allocation tracking dashboard; My Allocations; reports page with utilization + counts (+ CSV should-have); notifications.
- **DoD:** GPU golden-path E2E green incl. concurrency; reports match seed math (assert exact numbers); demo script for this flow drafted.

### Phase 4 — Internships + Mentorship (M4, ~1 week)
- **Work:** internships CRUD (admin) + browse/apply/track (student) + decisions; mentorship: mentor profiles (seeded + admin approve), student browse/request, mentor portal (accept/decline/schedule), session lifecycle; notifications; mentor demo account onboarding instructions.
- **DoD:** both E2E green; no cross-user visibility (tests); seed includes 2 sample mentorship flows.

### Phase 5 — AI Assistant (M5, ~1 week)
- **Work:** finalize knowledge corpus (draft docs; **supervisor reviews content accuracy** — open question #2); FTS retrieval + ranking; context builder (own-data snapshot + chunks + history) with allowlist mappers; provider adapter (Groq default) + retries + timeout; canned fallback mode; chat UI (bubbles as prototype + sources chips); rate limits; logging (ChatSession/ChatMessage + tokens); guardrail tests (injection, out-of-scope, cross-user checks); eval script + ≥30-question golden set; results to `docs/evaluations/`; optional `RETRIEVAL_VECTOR` spike only if FTS answers prove weak.
- **DoD:** eval report committed with metrics; fallback demo (provider disabled) verified; latency recorded; ≥90 % grounded on golden set criterion (or documented gap with remediation).

### Phase 6 — Hardening & release readiness (M6, ~1 week + buffer)
- **Work:** full RBAC/security suite green; a11y basics (labels, focus, contrast); responsive check; empty/loading/error states everywhere; seed screenshot set for the report; **offline demo kit**: `docker-compose.yml` (Postgres) + `.env.offline` + `npm run demo:offline` (seed + start + canned AI) with a one-page runbook; final FYP-II documentation material (architecture diagram, ER diagram, test evidence tables, eval results); rehearsal ×2 (timed); tag `v1.0-fyp2-demo`.
- **DoD:** every acceptance criterion in §12 checked; rehearsal completes ≤15 min with zero blockers; artifacts linked in README.

### Rollback / recovery notes
- Each milestone is a merge to `main` only when CI is green; failing deploy → Vercel “Instant Rollback” to previous deployment.
- DB migrations are additive-only; every migration tested on a Neon branch before `main`.
- Seed script is idempotent (`upsert` by natural keys) so any environment can be rebuilt from scratch: `npm run seed:reset`.

## 12. Acceptance Criteria (all must be demonstrably true)

1. `npm run build` exits 0; CI (typecheck, lint, unit, integration, prisma validate, build) green on `main`.
2. A fresh environment (fresh Neon DB + `migrate deploy` + `seed`) is fully demoable within 15 minutes, no manual DB edits.
3. All 5 roles sign in (Clerk) and land on their correct portal; a user without a DB row cannot reach portal pages.
4. Student can: view timetable/exams with clash flags, submit every seeded form type, track statuses, file and track a complaint, submit an FYP application, submit a GPU/resource request, browse/apply internships, request a mentor, chat with AI.
5. Faculty/Coordinator can: review routed forms (approve/reject/comment), manage complaints, view clashes.
6. FYP Head can: decide FYP applications, recommend and allocate a resource request (availability decrements; cannot over-allocate — concurrency test proves it), manage labs/inventory, post internships, approve mentors, view reports whose numbers match the seed.
7. Every state transition in §6.6 produces exactly one notification to the correct recipient(s); unread badge is accurate.
8. AI assistant: answers personal-data questions from the requester’s own records; answers policy questions with ≥1 cited knowledge source; refuses out-of-scope; resists the injection test set; when the provider is disabled, the UI shows limited mode with working canned answers.
9. Authorization matrix (§8.1) verified by automated tests — including negative tests for every row.
10. The app is deployed publicly (Vercel URL) and additionally runs fully offline via the local kit; demo needs no internet.
11. No secrets in the repo; `.env.example` documents every variable needed to run.
12. FYP-II documentation material exists: system architecture, ERD, status machines, test evidence summary, AI evaluation results.

## 13. Risks & Unknowns (prioritized)

| # | Risk | Severity × Likelihood | Impact | Mitigation (architecture-changing?) |
|---|---|---|---|---|
| R1 | AI free-tier quota volatility (Gemini already cut twice; even Groq can change) | High × Medium | AI demo fails | Provider adapter + canned fallback + optional $5 credits; M0 measures real quota before committing. (No arch change — adapter was designed for this.) |
| R2 | Demo-day connectivity failure (university Wi-Fi, Vercel/Neon outage) | High × Medium | Nothing demos | Full offline kit (Docker Postgres + local build + canned AI) rehearsed in M6. (No arch change; motivated the fallback design.) |
| R3 | Time overrun (scope is large: 9 modules, 5 roles) | High × High | Incomplete defence story | T-relative plan with buffer; always-demoable milestones; descope ladder below. (No arch change.) |
| R4 | Scope creep pressure (faculty ask for attendance/results mid-project) | Medium × Medium | Chaos | Explicit out-of-scope list; any change goes through owner; descope ladder prevents asymmetry. |
| R5 | Mentor data sparse (real alumni not onboarded) | Medium × High | Mentorship demo thin | Seed 3–5 realistic mentor profiles + document how real onboarding works; flag as open question #3. |
| R6 | Knowledge corpus accuracy (AI tells students wrong deadlines) | Medium × Medium | Trust damage at defence | Corpus drafted from official sources & **reviewed by supervisor** before AI demo; citations shown; refusal when unsure. |
| R7 | Clerk/Hobby limits or region issues at demo | Low × Low | Sign-in issues | Dev instance verified in M0; demo accounts pre-created; fallback: staging with seeded accounts. |
| R8 | Client-side leakage of admin capability | Low × Medium | Security embarrassment | Server-side authz everywhere + negative tests; no client trust. |
| R9 | FYP-I report mismatch (attendance/fees in old report vs. real system) | Medium × High (certain to be asked) | Report inconsistency | FYP-II documentation explicitly frames scope shift (prototype-driven); note for supervisor review. |
| R10 | Free tier soft limits (Vercel non-commercial, Neon storage 0.5 GB) | Low × Low | Deploy pause | Data volume trivially small; keep non-commercial; monitor. |

**Descope ladder (cut in this order if schedule slips):** ① internship decisions + mentor sessions polish → ② CSV exports/email channel/vector retrieval → ③ mentorship module to read-only directory (keep requests) → ④ clash *resolution* UI (keep detection flags) → ⑤ coordinator faculty-assignment screen (keep approvals). **Never cut:** GPU workflow, forms, complaints, notifications, AI core, seed, offline kit.

## 14. Open Questions (require the owner)

1. **FYP-II calendar:** exact mid-evaluation / defence / report dates (owner said “not sure yet”). Until known, use the T-relative schedule in §11 and share the real dates when the university publishes them.
2. **Knowledge corpus ownership:** who writes/validates the policy documents for the AI (recommend: draft from university handbook + supervisor sign-off before M5 closes).
3. **Mentor accounts:** are real alumni available to be onboarded, or do we demo with seeded profiles (recommended for defence) and document real onboarding for the report?
4. **Interpretation check:** Timetable/Exam views and clash *flags* are included in scope as part of Academic Planning (they exist in the FYP-I prototype and the poster, though the deck’s FYP-II list doesn’t name them explicitly). Confirm or veto.
5. **AI account ownership:** whose Groq/Gemini account holds the key (recommend a team-owned account so the project survives if one member leaves); is a ~$5 credits buffer acceptable if free quotas choke during demo week?
6. **Demo environment:** will the defence require running on a university machine (and therefore offline mode as primary), or is a live deployed demo acceptable (offline as backup)?

## 15. Final Recommendation

Build **Option A exactly as specified in this document**: one Next.js 16 App Router app in `unisphere_2/`, Prisma 7 + Neon Postgres, Clerk 7 auth with 5 server-enforced roles, REST-ish Route Handlers for mutations, RSC for reads, in-app notifications, provider-agnostic AI assistant with retrieval over own-records + curated corpus, deployed on Vercel with a rehearsed offline fallback. Implement in the milestone order of §11 (M0 spikes first — they de-risk the three external dependencies before any real work). Treat the FYP-I prototype (`docs/reference/prototype/setup.html`) as the binding UI/UX reference: same shell, same palette, same screens and flows, now backed by real data. Ship a demo whose spine is the GPU/Resource workflow, because that is the project’s strongest differentiator and the poster’s highlight. Keep costs at $0; keep scope strictly to the deck’s module list; cut only along the §13 descope ladder if time bites.

## 16. Agent Handoff Specification

```yaml
objective: >
  Implement UniSphere FYP-II as a production-quality, demoable Next.js full-stack app in
  C:\Users\Lenovov\Documents\GitHub\unisphere_2 per docs/superpowers/plans/2026-09-20-unisphere-fyp2-implementation-plan.md.
  Repo currently contains only resources/ (do not modify resources/). No git commits exist yet —
  make an initial commit before starting milestone work, and commit per task thereafter.

stack_constraints:
  next: "16.x (App Router, TS strict) — follow create-next-app defaults incl. middleware/proxy naming for this version"
  react: "19.3.x"
  ui: "Tailwind 4.3 + shadcn/ui; tokens per plan §6.5"
  orm_db: "Prisma 7.10.x (STABLE — do NOT use prisma 8.0.0-rc) + PostgreSQL (Neon); pooled DATABASE_URL + DIRECT_URL"
  auth: "Clerk @clerk/nextjs 7.9.x; role in publicMetadata for shell, DB role authoritative for authorization"
  ai: "OpenAI-compatible provider via env (default Groq); adapter + canned fallback; no tool-calling in v1"
  validation: "Zod 4.x at every route boundary"
  tests: "Vitest 5 + Playwright 1.63 + dockerized Postgres for integration"
  tooling: "Bun 1.4 (package manager + script runner; bun/bunx replace npm/npx) · Turborepo 2.11 monorepo (apps/web + packages/db) · oxlint 1.85 / oxfmt 0.70 (no ESLint/Prettier)"
  deploy: "Vercel Hobby (non-commercial) + Neon; must also run offline (docker compose + local build)"

architecture_summary: >
  Single app. Reads via RSC calling src/server/services/*; writes via /api Route Handlers with Zod +
  requireRole + ownership checks; state machines per plan §6.2 emitting notifications per §6.6 in the
  same transaction; AI context = requester's own records + FTS knowledge chunks + last 6 turns.
  All money/cost decisions: keep $0. All authz: server-side only.

required_components:
  - prisma schema+migrations+seed (incl. FTS migration, demo clash pair, full GPU inventory, 5 role users)
  - lib: auth, rbac, db, validation; middleware/proxy guard; role shells & sidebars
  - services: forms, complaints, fyp, resources(allocation), notifications, internships, mentorship, schedule/clash, reports, chat/ai
  - api: per plan §6.3 table
  - ui: per plan §6.4 pages, DynamicForm renderer, StatusBadge/TrackTimeline, chat UI, reports
  - tests: per plan §10 incl. concurrency allocation test and RBAC negative matrix
  - ci: .github/workflows/ci.yml (typecheck, lint, unit, integration w/ PG service, prisma validate, build)
  - offline kit: docker-compose.yml, .env.offline, scripts/demo-offline.md (one-page runbook)

implementation_order:
  - M0 spikes (deploy pipeline, Clerk roles, AI quota measurement, FTS sanity) → record in docs/spikes/notes.md
  - M1 foundation (schema, auth, shells, seed, CI)
  - M2 core (2a schedule/clash → 2b notifications → 2c forms → 2d complaints)
  - M3 showcase (FYP workflow → resource request/recommend/allocate → labs/inventory → reports)
  - M4 internships + mentorship
  - M5 AI assistant (+ eval report)
  - M6 hardening, offline kit, docs, rehearsal

forbidden_assumptions:
  - Do NOT implement attendance, results/marks, fees, events, marketplace, canteen, carpool, native mobile, LMS/ERP imports.
  - Do NOT use PHP/MySQL/XAMPP anywhere (poster stack superseded by owner decision 2026-09-20).
  - Do NOT add microservices, queues, websockets, GraphQL, Server Actions (v1), state libraries, or any paid service.
  - Do NOT trust client-supplied role/userId; never render unsanitized HTML.
  - Do NOT put other users' data into AI context; do not let AI execute actions.
  - Do NOT modify resources/ or commit secrets; do not rename the repo.
  - Do NOT block on unavailable free tiers: switch provider env vars or enable fallback mode instead.

testing_requirements:
  - Every status transition + RBAC row + clash rule has unit tests.
  - Integration: each §6.3 endpoint happy-path + 401/403/404/422; GPU concurrency test must pass.
  - E2E (Playwright): 5 role sign-ins, GPU golden path, forms golden path, notification badge, AI happy + fallback.
  - AI eval: ≥30-question golden set; results committed under docs/evaluations/.

acceptance_criteria: "plan §12, items 1–12 — all demonstrable"

unresolved_questions: "plan §14 items 1–6 (owner answers pending; proceed with recommended defaults meanwhile)"

do_not_implement_until:
  - Owner approves this plan (planning phase ends only on explicit approval).
  - M0 spike notes exist (no blind dependency commitments).
  - Open question #4 (timetable scope interpretation) is confirmed or defaulted per plan.
```

---

## Appendix A — Process log (Passes 1–8) & stopping rationale

- **Pass 1 (Discovery):** 4 resource files fully extracted (deck outlines, 68-page report text + figure/survey OCR, WhatsApp poster OCR); located and analyzed the real FYP-I prototype (`setup.html`, 142 KB, 4 roles, full flows) in `hassan2002-6/fyp`; verified target repo empty; checked teammate accounts. Conflicts logged (stack, scope, mentorship, report-vs-product).
- **Pass 2 (Requirements):** refined from evidence; scope settled by owner decisions (deck-list only; mentorship in; attendance/results/fees out; AI = hosted API + retrieval).
- **Pass 3 (Architecture):** 4 options evaluated; Option A selected; architecture, deps, security, perf, cost drafted.
- **Pass 4 (Implementation design):** schema, endpoints, pages, services, AI subsystem, testing, seed, deployment defined.
- **Pass 5 (Adversarial):** 14 issues found (top ones: AI quota volatility, demo connectivity, scope/time, allocation race, report-vs-product mismatch). All mitigated within the plan (feeds §13; caused no architecture change — the adapter/fallback/offline-kit design already absorbs them; the concurrency test was added as a result).
- **Pass 6 (Validation):** every requirement mapped to a component & proof method; external deps re-verified against vendor sources on 2026-09-20 (Neon/Vercel/Clerk/Groq/Gemini/pgvector; Prisma=7.10 stable; Clerk↔Next 16 peers OK).
- **Pass 7 (Sequencing):** 7 milestones, spikes-first, always-demoable, T-relative with buffer and descope ladder.
- **Pass 8+ (Extra passes):** security audit (§8), cost audit (§9), simplification pass (removed tool-calling, websockets, Server Actions, vector-dependency, microservices), AI evaluation design (§10).
- **Why stop here:** every remaining uncertainty is either (a) an owner decision (open questions — flagged), (b) verifiable at M0 by design (quotas, versions), or (c) buffered by fallbacks. Another pass would not change architecture, scope, or sequencing.

## Appendix B — Evidence map & artifacts

| Artifact | Location | Note |
|---|---|---|
| FYP-I final deck (17 slides) | `docs/research/extracts/final_ppt_outline.json` | Module list + FYP-II work plan (scope authority) |
| FYP-I proposal deck OCR (16 slides) | `docs/research/extracts/unisphere1_ocr.md` | Historical; source of mentorship/SDGs narrative |
| FYP report (68 pp) text | `docs/research/extracts/report_text.json` | Generic/boilerplate chapters — not authoritative for scope; survey pages are real |
| Report figures + survey OCR | `docs/research/extracts/report_pages_ocr.md` | Survey: n=74; top pains: timetable clashes, course selection, missed deadlines |
| WhatsApp poster OCR (newest artifact) | `docs/research/extracts/poster_ocr.md` | Confirms role portals, GPU workflow highlight, SDG framing |
| FYP-I prototype (working HTML) | `docs/reference/prototype/setup.html` | **Binding UI/flow reference** (4 roles, all screens, tokens) |
| Prototype feature inventory | `docs/research/EVIDENCE.md` | Menus, data fixtures, forms library, notifications matrix |
| This plan | `docs/superpowers/plans/2026-09-20-unisphere-fyp2-implementation-plan.md` | The contract for FYP-II implementation |

## Appendix C — Prototype feature inventory (from `setup.html`, condensed)

Roles & users in prototype: student (Ahmad Khan), faculty (Dr. Sara Ali), coordinator (Mr. Imran Sheikh), FYP head (Dr. Kamran Shah).
Student menu: Dashboard · Timetable · Exam Schedule · Notifications · Internships · Complaint Box · Forms Center · My Submissions · FYP Application · My FYP Status · Request Resource · My Allocations · AI Chatbot · Academic Planning.
Faculty menu: Dashboard · Manage Courses · Upload Notifications · Student Complaints · Upload Timetable · Forms Center · My Submissions · Forms to Review · Communication.
Coordinator menu: Dashboard · Approve Timetables · Resolve Clashes · Manage Complaints · Assign Faculty · Forms Center · Forms to Review · Broadcast.
FYP Head menu: Dashboard · FYP Applications · Resource Requests · Allocation Tracking · Manage Labs · Manage Resources · Reports · Notifications.
Forms library — student: Add/Drop, Withdrawal, Semester Freeze, Transcript, Degree Verification, Scholarship, Leave · faculty: Leave, Research Grant, Outline Submission, Exam Paper, Attendance Adjustment · coordinator: Course Approval, Faculty Assignment, Registration Approval, Timetable Approval, Result Approval.
Prototype data fixtures: FYP apps (3), resource requests (2), allocations (1), labs (4), GPU/CPU/workstation inventory (7 rows incl. RTX 4090×4), notifications per role, internships w/ Apply, degree plan (BSCS, 8 semesters, 132 CH), chatbot canned intents (fyp/gpu/timetable/form/exam).

## Appendix D — Survey digest (report pages 45–54, n=71–74)

Top pain: timetable/exam clashes (~45–55%) and course-selection confusion (~41%); 56% juggle multiple platforms; 42–45% strongly agree a centralized system helps; 87% want a say in elective selection; alumni-mentorship interest high (≥70%); 71.6% would use the platform; free-text asks: central notifications/reminders, alumni module, FYP-partner finder, notes/marketplace (marketplace stays out of scope).

## Appendix E — Implementation status log (amendment, 2026-09-24)

**Scope note:** no scope changes. This appendix reconciles implementation detail with §6.4's
indicative route map and records milestone status honestly.

**Milestones:** M0 spikes ✅ (Vercel prod deploys, Clerk proxy + auth wall verified live, Neon
project pending API key, AI provider key pending). M1 foundation ✅ (26 models + migrations +
FTS, 685-line idempotent seed, RBAC matrix, portal shell, CI). M2 core ✅ (timetable/exams/clash,
notifications + broadcast, forms centre, complaint box). M3 showcase ✅ (FYP workflow,
request→recommend→allocate with guarded decrement, labs/inventory CRUD, reports + CSV).
M4 ✅ (internships, mentorship incl. sessions). M5 ✅ (provider-agnostic adapter, Postgres-FTS
retrieval + personal context, chat UI, 33-question eval suite). M6 🔄 hardening (security suite
✅ — RBAC matrix exhaustive + static guard scan; offline kit + demo script ✅; live-DB
integration tests + last-GPU race PENDING until Neon connects; screenshots/recording PENDING).

**Route-map additions (implementation detail of §6.4 intent, not scope growth):**
`/submissions/[id]` and `/complaints/[id]` (tracking detail pages required by the "file and
track" flows), `/chat?s=` (session selection on the single /chat route), `/mentor` console,
`/admin/{labs,inventory,mentors,internships,fyp,requests,allocations,reports,broadcast}` admin
screens behind capabilities, `/api/reports/summary?format=csv|json` (the §6.3 reports endpoint),
`/coordinator/approvals` + `/coordinator/faculty`.

**Deliberate omissions/deviations:** `Lab.location` dropped from CRUD (not in §6.1 data model —
schema is authority); attendance/results/fees/events remain out per the deck. Toolchain
amendment (bun/turbo/oxc) was recorded earlier in §7 and holds.

**Verification evidence:** `bun run lint|typecheck|test|build` all green; 235 tests (rbac, clash,
status, validation, ai, security); production deploy current on Vercel with Clerk env live.

**Pending external inputs:** ~~Neon API key (unblocks `migrate deploy`, seed, integration +
concurrency tests), Groq API key (full AI answers; canned fallback works meanwhile)~~, Vercel
deployment-protection toggle (dashboard approval), real-profile browser E2E (Playwright CDN
blocked — using `channel: "chrome"`).

## Appendix F — Live environment (amendment, 2026-09-25)

**Neon (live).** Provisioned from the signed-in browser session via the Neon CLI (`neon auth`
device+localhost OAuth; no API key pasted anywhere). Project **unisphere** (`calm-rain-34138616`,
aws-ap-southeast-1). `bunx prisma migrate deploy` applied `20260924100000_init` +
`20260924100100_knowledge_fts` to `neondb`; the idempotent seed loaded the full demo dataset
(9 users, 40 course-plan rows, 6 classes with one deliberate Monday room clash, 6 GPU resources,
6 form templates, 6 internships, **27** knowledge docs, sample flows). Pooled URL → runtime,
direct URL → migrations; both live in Vercel production+preview env and in `.env.local`
(gitignored).

**AI (live).** Provider default is now **CommandCode** — `COMMANDCODE_API_KEY` +
`https://api.commandcode.ai/provider/v1`, model **`deepseek/deepseek-v4.1-flash`**
(`AI_MODEL` overridable; `AI_FALLBACK_MODE=1` = knowledge-base-only demos). Resolution priority:
CommandCode → Groq → OpenAI → OpenRouter → custom `AI_BASE_URL`. Retrieval ranking fixed:
natural-language questions are tokenised, stop-worded and OR-joined (previously
`websearch_to_tsquery` ANDed every word and matched nothing), with title-weighted `ts_rank`
and an ILIKE fallback.

**Verification evidence (all re-run against live Neon + live CommandCode):**
- `bun run test` → **238 passed** (incl. new CommandCode resolution/priority/override cases).
- `scripts/eval-ai.ts` → **33/33 retrieval checks pass** (was 4/33 before the ranking fix).
- `scripts/test-concurrency.ts` → **PASS**: 8 concurrent allocators race the last GPU unit,
  exactly one wins, no negative availability (`SELECT … FOR UPDATE` path verified live).
- `scripts/smoke-ai.ts` → **PASS**: real `deepseek-v4.1-flash` answers all three demo questions,
  cites retrieved docs, persists 6 chat messages.
- `scripts/link-clerk-users.ts` → all five demo personas (`@shu.edu.pk`) linked to Clerk users;
  sign-in lands on seeded roles/data.
- Production `GET /api/health` → `{"ok":true,"db":"up","ai":{"provider":"commandcode",…}}`.

**Milestone deltas:** M0 ✅ (Neon + AI both live). M6 ✅ — live-DB integration + last-GPU race no
longer pending; screenshots/recording remain (see `docs/demo/screenshots/`).

**Remaining open questions (§14):** unchanged — FYP-II dates, corpus validator, real alumni
mentors, defence on university machines vs live URL. Demo passwords live only in
`apps/web/scripts/link-clerk-users.ts` (DEMO_USERS) and the team password manager.

## Appendix G — UI/UX overhaul (amendment, 2026-10-04)

**Motivation.** The M1–M6 build was feature-complete but visually inconsistent: every page rolled
its own header/empty/error markup, there was no dark-mode support, no mobile navigation, and the
landing page still read like a prototype. This amendment records the design-system pass delivered
on top of the same plan (no scope change — §6.5 palette and §6.4 route map still hold).

**Design foundations.**
- Rewritten `globals.css`: OKLCH palette (light + dark), semantic tokens for
  `success/warning/info`, sidebar tokens, `text-gradient`, `.card-lift` hover, `@utility page`
  page-frame (consistent gutters + `max-w-6xl` for every route).
- `ThemeProvider` (next-themes, class strategy) + `ThemeToggle` in the portal header; `Toaster`
  (sonner) mounted app-wide.

**Component kit (new shared primitives).**
- Shell: mobile nav via a `Sheet` drawer, sticky header with section label + page title, unread
  bell, user card, persisted theme toggle.
- `PageHeader` (icon, title, description, breadcrumbs, actions), `StatCard` (tone-mapped KPI),
  `EmptyState` (icon + CTA), `Alert` (variants: default/success/warning/destructive/muted),
  `SubmitButton` (+`FormError`, `useFormStatus` pending states), `ConfirmAction` (dialog around a
  server action with optional remarks), `StatusBadge` v2 (tone map across every status machine in
  §6.2), `ReviewActions` (shared pending state for queue decisions), `AuthShell` (split-screen auth).

**Page passes.** Landing rebuilt (hero with CSS app-mock, features, roles, trust, CTA, footer);
role-aware dashboards (per-role KPIs + today's classes/review queues/approvals/clash monitor/
pending requests + quick actions, assembled by `server/services/dashboard.ts`); timetable (today
highlight, legend, clash alerts), exams (next-exam countdown + clash banner), planning, forms
centre, dynamic form (field-level server errors, inline validation styling), submissions list +
detail (vertical event timeline, withdraw confirmation), shared review queue/decisions, chat
(sticky composer, suggestion chips, source cards, provider status), auth + not-provisioned/
setup-needed states, loading/error/404 boundaries.

**Verification.** `tsc --noEmit`, oxlint and the full vitest suite pass after the pass, and
`next build` compiles every route. Additionally, all five demo personas were signed in against the
running app and **34 authenticated page loads were checked** (dashboard, timetable, exams,
planning, forms, submissions, complaints, notifications, FYP, resources, internships, mentorship,
chat, clash monitor, approvals, review queues, admin FYP/requests/allocations/labs/inventory,
broadcast, reports) — zero runtime errors, zero auth losses — with full-page screenshots captured
to `docs/demo/screenshots/app/` (`capture_cdp.mjs` drives headless Chrome over CDP; sign-in uses
single-use Clerk sign-in tokens minted for the demo personas, so no password is ever handled).
Authenticated walk-throughs against the deployed alias are still blocked from this network
(`vercel.com` + `*.vercel.app` unreachable from this ISP — see Appendix F note); rerun
`capture_cdp.mjs` with `BASE` pointed at the production URL from a normal network to refresh the
captures there.

**No DB/API changes.** Every server action, query, RBAC guard and route is untouched — this was a
markup/UX pass only.

---

## Appendix H — FYP-II feature build (2026-10-08)

The FYP-II requirements document (spec §5–§19) added a second feature wave on top of M1–M6.
Everything below is implemented against the live database and covered by tests.

**Theme.** `setup2.html` is the authoritative design: the shipped theme now uses the crimson
`#c8102e` primary in `globals.css` (light + dark token sets), with the sidebar app shell, stat-card
grid and clash-highlighted tables from that prototype. No stray blue/violet utilities remain
(grepped).

**Schema (migration `20261008120000_fyp2_attendance_marks_messages_audit_clashreports`).**
`Role` + `ADMIN`; `NotificationType` + `MESSAGE`, `CLASH`; new models `AttendanceRecord`,
`Assessment` (quiz/assignment/midterm/final/project with `maxMarks`), `Score` (per-student marks),
`Message`, `AuditLog`, `ClashReport`; `CourseClass` gains `enrollments`; `User` gains the message /
clash / result relations. Applied with `prisma migrate diff` + hand-authored SQL +
`migrate resolve --applied` (the non-interactive shell cannot use `migrate dev`); helper:
`packages/db/scripts/new-migration.sh`.

**Services.** `server/services/attendance.ts` (student summary, class session, roster marking with
per-day upsert), `marks.ts` (assessment CRUD, score entry, publish → `CourseResult` + GPA/CGPA
helpers), `students.ts` (registration/name/course search + permitted academic profile, view
audited), `messages.ts` (recipient scoping per role, inbox/sent, read state, notification),
`audit.ts` (best-effort writer + reader), `clash-reports.ts` (student report → coordinator/admin
`CLASH` notification → resolution with the reporter notified).

**Routes.** Student: `/attendance`, `/marks`, `/clashes`. Faculty: `/faculty/attendance(+[classId])`,
`/faculty/marks(+[classId])`, `/faculty/students(+[id])`. Coordinator: `/coordinator/students(+[id])`
and the student-reported-clash queue on `/coordinator/clashes`. All roles: `/messages`.
Admin: `/admin/users` (role changes, audited + notified), `/admin/audit`.

**Authorisation.** The RBAC matrix (`lib/rbac.ts`) gained `attendance.manage`, `marks.manage`,
`students.search`, `messages.send`, `audit.view`, `users.manage`, `clashes.manage`; the matrix is
asserted role-by-role in `tests/rbac.test.ts` + `tests/security.test.ts` (now 358 tests). Services
re-check permission themselves (`can(user.role, …)`, class ownership) so a bypassed action cannot
escalate.

**Demo fleet.** Seed now creates 10 students (STU001–STU010), 3 faculty + co-supervisor
(saadia.karim@), coordinator, FYP head, mentor, **admin**, with enrolments, 540 attendance
records, 180 assessment scores, messages and audit entries. `link-clerk-users.ts` links all 18
Clerk users to one documented password (`UniSphere#Demo2026`, see README).

**Verification.** `bun run scripts/test-workflows.ts` (from `apps/web`) drives the spec's
end-to-end workflows against the live DB — clash report → queue → resolution notifications,
attendance marking → student view, assessment → scores → publish → student GPA + notification,
messaging round-trip, role change + audit, student search/profile, audit completeness, and
permission denials at the service boundary — **38/38 checks pass**, cleaning up everything it
creates. Two real bugs were found and fixed by that run: CGPA now counts current-semester results
once published, and the audit action name for publishing is asserted as `results.publish`.

---

## Appendix I — Realism wave: identities, coordinator changes, FYP Head desk (2026-10-09)

**Trigger.** *"make this platform more realistic … student have their proper student id and
course coordinate also have their id and portal where he can change the changes and fyp head get
their id and portal too where he/she receive request."*

**Identity.** Every account now carries its university ID end-to-end: students use registration
numbers (`S22CSC001`…`S22CSC010`), staff use employee IDs (`FAC001`–`FAC004` faculty, `COORD001`
coordinator, `FYP001` FYP Head, `ADMIN001` admin), alumni mentors use `ALU001`… IDs are seeded
(and re-seeding now repairs stale ones — `upsertUser` updates `registrationNo`/`employeeId`),
displayed in the topbar, the dashboard description, the FYP/supervision views and on the new
**`/profile`** page (visible to all six roles): identity card, role record (programme/batch/
semester/section for students; designation/office/courses/supervised groups for faculty; mentor
profile for alumni) and the role's full capability list (`capabilitiesFor()` +
`CAPABILITY_LABELS` from `lib/rbac.ts`).

**Coordinator owns the timetable.** New service `server/services/timetable-manage.ts` +
`/coordinator/timetable` (+`actions.ts`) let the coordinator **add, move, re-room and cancel**
sessions of any class. Saves are conflict-checked against the live grid through the same
`detectSlotClashes` engine the clash monitor uses — room / faculty / cohort double-bookings throw
a 409 `ServiceError` before anything is written; softer overlaps are returned as warnings. Every
write notifies the class faculty and enrolled students (`ANNOUNCEMENT`) and is audited
(`timetable.slot_create` / `timetable.slot_update` / `timetable.slot_delete`). New capability
`timetable.manage` (COORDINATOR + ADMIN), re-checked inside the service.

**FYP Head request desk.** `FypApplication` gained `supervisorId` (migration
`20261008233831_fyp_supervisor_assignment`). `decideFyp(user, id, decision, remarks,
supervisorId?)` validates that the supervisor is faculty, stores them on approval, notifies both
the group and the supervisor, and now guards itself with `can(role, "fyp.decide")`. The new
**`/fyphead`** console is the request inbox: pending applications in full (group, members,
registration numbers, domain, tech, preference, submitter + ID), approve-with-supervisor or
reject-with-reason dialogs, decision tiles, and a decided table carrying supervisor + employee ID.
The student's `/fyp` page shows *Supervisor: …* once assigned; the admin archive shows it too.
`/profile` links every role to the records they own.

**Verification.** `tests/rbac.test.ts` + `tests/security.test.ts` now assert `timetable.manage`
across all six roles (**370 unit tests**). `scripts/test-workflows.ts` gained sections 9–10
(coordinator add → clash-blocked duplicate → move → remove → audit; FYP approve + supervisor
notification + non-faculty rejection + student denial) for **52/52 checks**, cleaning up the
sessions/applications/notifications it creates. All 62 authenticated captures (six personas,
including `/profile` for every role, `/coordinator/timetable`, `/fyphead`) refresh from
production with 0 problems. The institutional wave adds four captures (coordinator exam manager
for the coordinator and the admin, faculty supervision, forms manager) — **66 pages, 0 problems**,
refreshed from production.

### Institutional accounts, exam management & FYP supervision

**Provisioning (spec §4/§5).** Accounts are issued, never self-registered: `AUTO_PROVISION=false`,
and `src/server/services/accounts.ts` owns the lifecycle — `createAccount` (role-aware form,
`nextInstitutionalId()` mints `S22CSC0xx`/`FAC0xx`/`COORD0xx`, invitation via Clerk),
`importAccountsFromCsv`, `setAccountActive` (portal `isActive` + Clerk ban), `updateAccountInfo`
and `initiateAccountRecovery` (single-use sign-in ticket, shown once, never logged). The public
sign-in (/sign-in) is a custom form over Clerk's signal API: **University ID or email**
(`resolveLoginIdentifier`), show/hide password, MFA fallback, Google SSO, `?ticket=` recovery and
`?__clerk_ticket=` links, `?redirect_url=` honouring; `/forgot-password` and `/sso-callback` are
public, and `requireUser()` bounces deactivated accounts to `/account-disabled`.

**Exam manager (spec §9).** `/coordinator/exams` (new `exam-manage.ts`): schedule / move / cancel
exams per course with hall + cohort double-bookings blocked by the clash engine and class-time
coincidences surfaced as advisories; faculty and enrolled students are notified, changes audited,
and the system never moves anything on its own.

**Coordinator record management (spec §7).** `/coordinator/timetable` gained courses & sections
(course code, title, section, semester, credits, faculty assignment with a busy-lecturer block and
a notification) and `/coordinator/students/[id]` gained an audited **record correction** form
(section/semester/batch with a reason; the student is notified).

**FYP supervision (spec §12).** `FypStatus` gained `CHANGES_REQUESTED`; the FYP Head can request
changes with remarks instead of deciding, the group revises and **resubmits in place**
(`resubmitFypApplication` → PENDING), `/faculty/fyp` is the supervisor workspace (supervised
groups + progress notes that notify the group and appear on the student's `/fyp` page), and every
note is audited (`fyp.progress_note`).

**Forms manager (spec §11).** Eleven more university form templates ship in the seed (bonafide,
enrollment verification, provisional certificate, semester registration, add/drop, exam recheck,
fee/dues, information correction, general application, faculty lab request) and `/admin/forms`
lets the administration add a template from a compact field description (`Label | type | optional`)
or retire one instantly.

**Verification (wave).** **376 unit tests** (7 files — `forms-admin.test.ts` covers the field
parser, `status.test.ts` the new FYP transitions) and **85/85 E2E checks** in
`scripts/test-workflows.ts` (new sections 11–13: account lifecycle + recovery + University-ID
resolution, class/faculty/exam management with clash blocks, FYP changes-requested → resubmit →
approve + progress notes).
