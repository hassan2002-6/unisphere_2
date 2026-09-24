# UniSphere — defence demo script (~12 minutes)

Five seeded demo accounts (password set in Clerk for all: see the team password manager):

| Role       | Email (demo)              | Lands on                |
| ---------- | ------------------------- | ----------------------- |
| Student    | student@shu.demo          | Dashboard (student)     |
| Faculty    | faculty@shu.demo          | Dashboard (faculty)     |
| Coordinator| coordinator@shu.demo      | Dashboard (coordinator) |
| FYP Head   | fyphead@shu.demo          | Dashboard (FYP head)    |
| Mentor     | mentor@shu.demo           | Mentor console          |

> Always start signed in as **student@shu.demo**. Switch roles from the Clerk user menu.

## 1. Landing & auth (0:00–0:45)

- Open **https://unisphere-hazel.vercel.app**. Point out the UniSphere landing page and that
  `/dashboard` bounces to Clerk when signed out (307 → `/sign-in?redirect_url=…`) — *"auth is
  enforced at the edge, and every page re-checks the role server-side."*
- Sign in as student. Dashboard shows live counts (forms, complaints, FYP, unread notifications).

## 2. Timetable + clash detection (0:45–2:45) — the FYP-I pain point

- `/timetable`: weekly grid with the seeded deliberate clash (CS course vs lab slot).
- The clashing slot is flagged with a red **Clash** badge — computed live from room, faculty, lab
  and cohort overlaps (no stored flags), including exam-vs-class collisions on `/exams`.
- Say: *"~50% of surveyed students reported timetable/exam clashes; here they surface before
  they burn a semester."*
- Sign in as coordinator → `/coordinator/clashes`: acknowledge/resolve a clash; the student
  side updates because it's one source of truth.

## 3. Forms centre (2:45–4:30)

- Student: `/forms` → pick *Bonafide certificate* → dynamic form renders from the template's JSON
  field spec → submit. Validation is the same zod schema on every entry point.
- `/submissions` → open the submission → timeline shows SUBMITTED now.
- Faculty: `/reviews` → start review → approve with a comment. Point at the `FormEvent` timeline.
- Student: notification bell has the approval; `/submissions` shows APPROVED.

## 4. Complaint box (4:30–5:45)

- Student: `/complaints/new` → category *Faculty* → file it.
- Point out routing: faculty-category complaints hit `/faculty/complaints` **and** the
  coordination office; the student tracks status on `/complaints/[id]`.
- Faculty: start review → resolve with a note. Student sees the resolved state + notification.

## 5. FYP + GPU/resource workflow (5:45–8:30) — the showcase

- Student: `/fyp` → submit an application (two in the seed already). FYP Head gets it in
  `/admin/fyp` — approve with remarks; student notified.
- Student: `/resources/request` → request *RTX 4090 — 24 GB* for a window; inventory panel shows
  live `available/quantity`.
- FYP Head: `/admin/requests` → **Recommend** → then **Allocate** against real inventory with a lab.
  Allocation decrements availability atomically — show `/admin/reports` utilisation bar moving.
- The closer: *"two simultaneous allocations of the last unit can't both succeed — the guarded
  decrement is a transactional race test"* (run `scripts/test-concurrency.ts` live if asked).
- `/admin/labs` + `/admin/inventory` for the physical inventory CRUD.

## 6. Internships + mentorship (8:30–10:30)

- `/internships`: browse (search/tags), open one, apply. `/admin/internships` as poster:
  shortlist → accept; student notified.
- `/mentorship`: mentor directory (approved only) → request mentorship.
- Mentor console (`/mentor`): set profile → FYP Head approves on `/admin/mentors` →
  accept request → propose session; student confirms on `/mentorship`; complete session
  closes the mentorship.

## 7. AI assistant (10:30–11:30)

- `/chat`: ask *"When is my next class?"* — personal context line cites the timetable;
  ask *"How do I request a GPU?"* — answer cites knowledge-base chips [1][2].
- Say: *"Retrieval is Postgres full-text over a curated university corpus plus the student's own
  records; if nothing matches it says so instead of inventing. Without an API key it still answers
  from the corpus (offline fallback)."*

## 8. Close (11:30–12:00)

- `/admin/broadcast`: send an announcement → bell badge increments for the recipient role.
- `/admin/reports`: operational counts + CSV export (`/api/reports/summary?format=csv`).
- Wrap: *"38 routes, 26 models, 235 automated tests including an RBAC/guard suite that fails the
  build if a page skips authorization."*

## Rehearsal checklist

- [ ] `bun run test` green; `bun run build` green; production deploy current
- [ ] Demo data pristine (`bun run seed` is idempotent — safe to re-run)
- [ ] All five demo accounts can sign in (Clerk test-mode OTP or password set)
- [ ] AI key present **or** the offline-fallback notice pre-explained
- [ ] Offline kit ready (docs/offline-demo.md) — laptop hotspot + local Postgres
- [ ] Screenshots fallback exported (docs/demo/screenshots/)
