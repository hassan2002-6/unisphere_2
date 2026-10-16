# UniSphere — Requirements Checklist (2026-10-16 goal)

Status key: **DONE** = implemented + tested · **NEW** = implemented this goal round ·
**PARTIAL** = works with documented limits · **BLOCKED** = needs institutional access ·
**N/A** = not applicable.

## §1 Audit
- DONE — Repo/workspace audit complete (Next.js 16 + React 19, bun+turbo monorepo,
  Prisma + Neon Postgres, Clerk auth, CommandCode AI, Tailwind + shadcn-style UI,
  vitest + scripted E2E). Existing features catalogued; regressions fixed instead
  of hidden.

## §2 UI redesign
- DONE — Red/white SHU identity from the approved prototype (`resources/setup2.html`
  is the authoritative design); grouped sidebar, compact dashboard cards, tables with
  search/filters/pagination, empty/loading/error states, responsive 390px→desktop
  (verified via `app-mobile/` captures).
- DONE — No fabricated branding: text wordmark + shield glyph; official SHU photos
  NOT bundled (no authorization); campus address/phone only as verified public facts
  in the AI knowledge base.

## §3 Login and identity
- DONE — Custom `/sign-in` (Institutional ID or email + password), Google button,
  reset flow, clear errors, responsive.
- DONE — Root-caused the verification-code demand: Clerk **Device Trust** on
  development keys; resolved per account (`bypass_client_trust=true`) — no universal
  code, no auth bypass. Documented in `DEMO-LOGIN.md`.
- DONE — `AUTO_PROVISION="false"`; no public self-signup.

## §4 Profile photos, all five roles
- DONE — Upload/change own photo (header + profile + dashboard), content-sniffed
  (magic bytes), size-capped, stored as DB `Bytes` (persistent, not localStorage),
  served via auth-checked route, default avatar, cross-device persistence
  (E2E section 17). Admin can remove a photo via account management.

## §5 Student admission + institutional IDs
- DONE — Admin: create individual account; validated CSV import with per-row error
  report; institutional IDs (`S22CSC0xx`, `FAC0xx`, `COORD001`, `FYP001`, `ADMIN001`);
  name/official email/program/semester/section; Clerk linkage (pending placeholder
  until first sign-in); activate/deactivate; recovery-link issuance; duplicate
  detection (ID + email + Clerk mapping); downloadable template.
- NEW — Account-setup status column (Linked / Invited-not-linked / Deactivated) in
  Admin → Data → Accounts.
- PARTIAL — Invitation emails: no email provider configured; the supported path is
  admin-issued single-use recovery links (documented). Institutional ID rule is
  configurable seed data, not invented against real university records.

## §6 Data management + correction workflow
- DONE — Admin → Data screens: students, faculty, accounts, courses, enrollments,
  timetable, exams, assignments, complaints, forms, FYP, resources, notifications;
  search by ID/name; edit permitted fields; audit log.
- NEW — Faculty **data-correction requests**: faculty opens a student record they
  cannot edit → submits a correction request (field, old, new, reason) → routed to
  Admin → approve/reject with note → value applied + audit + both notified. Old/new
  shown; validation; whitelisted fields only.
- PARTIAL — Approval routing for corrections is Admin (and Coordinators for course
  data) — configurable per university policy, not hardcoded to roles we don't have.

## §7 Role permissions
- DONE — Server-side matrix (`lib/rbac.ts`) enforced in every page, action, API route
  and file download; statically scanned by `tests/security.test.ts` (28 capabilities ×
  6 roles) + E2E negative tests. Buttons hidden ≠ authorization.
- NEW — Capabilities added this round: `corrections.request`, `corrections.manage`,
  `admitcards.manage`.

## §8 Gmail-style complaints
- DONE — Canonical complaint + refNo, categories, routing rules, priorities; status
  machine; PUBLIC/INTERNAL event visibility (internal notes hidden from students);
  attachments; forward/reassign; escalation/overdue; search/filters; audit history.
- NEW — **Multi-recipient (To/CC)**: recipient rows on one canonical record (no
  duplicates), compose with To + CC multi-select from the staff directory, per-recipient
  inbox with unread state, CC is read-only (cannot resolve/forward unless assigned),
  all recipients notified with a direct link.
- Required test (§8): student → Faculty (To) + Coordinator (CC): both see it, faculty
  responds, history recorded, student sees permitted update, CC cannot resolve. → E2E.
- PARTIAL — Recipient directory = configured staff roles (FACULTY, COORDINATOR,
  FYP_HEAD, ADMIN). Dean/VC office names are university-specific and remain configurable.

## §9 Forms + approvals + PDF
- DONE — Configurable templates (fields/validation/attachments/SLA/active), refNos,
  approver portals, approve/reject-with-reason/request-corrections, timestamps +
  audit, sequential chains with template snapshots, documents (upload/download),
  admin chain editing without corrupting submitted forms.
- NEW — **Finalized PDF**: once the chain completes, a downloadable PDF with form
  details, refNo, per-step approval history (actor, role, timestamp, decision) and an
  explicitly-labelled *in-portal approval representation* — no fabricated signatures,
  no legal-validity claim (documented distinctly from cancellation-proof e-signatures).
- Required test (§9): submit → correction → resubmit → approve → PDF contains the
  correct approval info. → E2E.
- BLOCKED — Official Dean/VC **signature image**: requires an approved asset from the
  university; the label clearly distinguishes in-portal approval from a signature.

## §10 Enrollment + faculty-form integration / admit card
- BLOCKED (integration) — No authorized SHU API/export access; scraping forbidden and
  not attempted. The supported mechanism is the validated manual CSV import (students,
  enrollments) with templates, duplicate detection, error reports — ready for an
  authorized data drop.
- NEW — **Admit-card workflow (internal preview)**: configurable prerequisites
  (required approved form e.g. Faculty Examination Form, enrollment check, optional
  fee-clearance flag off by default); Admin config + eligibility board; student sees
  exactly which prerequisite is missing and how to resolve it; when eligible, a
  *watermarked internal preview PDF* — explicitly NOT an official university-issued
  admit card.
- Required test (§10): generation blocked while prerequisite missing; allowed when
  satisfied. → E2E.

## §11 Timetable + exam conflicts
- DONE — Central scheduling: coordinator/Admin create/edit slots; conflict detection
  (student/faculty/room/exam); clash report + resolutions; edits apply to the shared
  course/section slot (all enrolled students see it via their enrollment — no per-student
  records); affected-user notifications; audit trail.
- NEW — Impact preview before publish (affected students, conflicting slots,
  alternatives), timetable **revision history + revert** (each publish records a
  before/after snapshot; revert creates a new revision), students' timetable shows an
  "updated" indicator after a recent change.
- Required test (§11): create conflict → detect → resolve via coordinator → publish
  once → affected students see the same updated schedule. → E2E.

## §12 Assignments
- DONE — Faculty create per assigned course (instructions, deadline, attachments,
  grading rules); students see only their courses' assignments; submit with file;
  late flag; resubmission; grading + feedback; guarded downloads; DB-backed (no
  localStorage).
- DONE — Mentorship module stays removed from the active product (nav, routes, copy);
  DB models + data retained.

## §13 Notifications
- DONE — In-app centre: unread count, read/unread, per-type categories, timestamps,
  direct links, mark-one/all-read.
- NEW — Bulk timetable revisions group into one notification per affected student
  (change summary + link), never one per slot-edited; duplicate prevention via
  event-keyed creation.
- PARTIAL — Email: optional per spec; no provider configured → not claimed.

## §14 AI chatbot
- DONE — CommandCode provider (deepseek-v4.1-flash), grounded retrieval over the KB,
  refusals for policy/out-of-scope questions, role/record boundaries (never exposes
  records), no privileged actions via chat, safe retries, timeouts, rate-limit, honest
  offline fallback, Admin KB management + unanswered-question capture.
- NEW — Verified public SHU facts (campus address NC-24 Deh Dih, Dr. Salim Habib Road,
  Korangi Creek, Karachi 74900; main line 021-111-248-338) as an official-source KB
  document after checking shu.edu.pk — plus eval questions on them and on
  refusing private-data requests.

## §15 Data migration + handover
- DONE — Synthetic demo data labelled; CSV templates; import reports; dry-run-style
  validation (errors before commit); duplicate detection; audit trail; deployment
  + backup/restore runbook; env vars by name; security model; known limitations —
  `docs/FINAL-REPORT.md` + `docs/HANDOVER.md`.
- BLOCKED — Real student/faculty data import: requires written university authorization
  and an authorized environment; not attempted and never scraped.

## §16 Performance / reliability / maintainability
- DONE — Measured hot paths (`scripts/measure-perf.ts` against live Neon): dashboards
  p50 ≈ 0.33–0.45 s, lists 0.09–0.53 s; no widget pulls attachment bytes (omit/select);
  indexes on hot filters; pagination throughout; transactions for multi-record ops;
  rate limits; audit logs; accessible labels (E2E a11y checks); no destructive schema
  changes without migrations.
- PARTIAL — Caching: deliberately none beyond Next defaults (private data). No
  staging environment provisioned (documented in HANDOVER).

## §17 Automated tests
- DONE — 509 unit/integration (vitest) + 165-check scripted E2E against the live DB +
  38-question AI eval (38/38); scripts clean up their records.
- NEW — E2E sections for the §8 complaint test (To acts / CC read-only, unread view),
  §9 PDF finalization (pre-approval has no finalized timestamp; renderer output embeds
  ref no + approval label), §10 admit-card eligibility (blocked → approved → eligible),
  §11 timetable publish-once (impact preview, one revision per publish, revert, student
  notice audit), §5/§6 correction request audit (pending → approved → value applied,
  decided-once); AI eval extended with SHU-fact + privacy-refusal questions.

## §18 Stages
- DONE — Stage 1 (audit/login) → 9 (performance/docs) executed in order across waves;
  this round: Stages 4–7 gaps closed (multi-recipient, PDF, admit card, timetable
  revisions, corrections), Stage 8 (AI facts), Stage 9 (tests + docs + deploy).

## §19 Final report
- DONE — `docs/FINAL-REPORT.md` (structure, files, workflows, evidence, limitations,
  start/run/test instructions, per-role demo logins in `DEMO-LOGIN.md`); updated this
  round with the new modules.
- Demo script: `docs/demo-script.md`. Handover checklist: `docs/HANDOVER.md`.
