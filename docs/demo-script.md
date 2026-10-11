# UniSphere — defence demo script (~12 minutes)

18 seeded demo personas — one password for all: **`UniSphere#Demo2026`** (set in Clerk by
`link-clerk-users.ts`; students are STU001–STU010 in `student@` … `student10@shu.edu.pk`):

| Role        | Email (demo)                                     | Lands on                |
| ----------- | ------------------------------------------------ | ----------------------- |
| Student     | student@shu.edu.pk (+ student2…student10@)        | Dashboard (student)     |
| Faculty     | faculty@shu.edu.pk (+ faculty2@, faculty3@, saadia.karim@) | Dashboard (faculty) |
| Coordinator | coordinator@shu.edu.pk                            | Dashboard (coordinator) |
| FYP Head    | fyphead@shu.edu.pk                                | Dashboard (FYP head)    |
| Mentor      | mentor@shu.edu.pk                                 | Mentor console          |
| Admin       | admin@shu.edu.pk                                  | Dashboard (admin)       |

> Every role signs in through the same **/sign-in** page. Start as **student@shu.edu.pk**.
> Switch roles from the Clerk user menu (or a private window for a second persona at once).

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
- As a student, `/clashes` → *Report a clash* (timetable or exam) → coordinators get a CLASH
  notification instantly; the report appears in their queue with a resolution note.

## 2b. Attendance, marks & GPA (2:45–3:30) — new in FYP-II

- Student `/attendance`: per-course sessions with present/late/absent/excused, 75% warnings, and
  the recent-session log. Say: *"Attendance is captured by faculty, not by a separate register."*
- Student `/marks`: midterm marks per assessment with class averages, projected grade, published
  results, semester GPA and CGPA.
- Faculty `/faculty/attendance` → pick a class/date → mark the roster in one screen.
- Faculty `/faculty/marks` → enter scores, add an assessment, then **Publish results** → students
  get a notification, results feed GPA.

## 2c. Messaging, search, admin (3:30–4:00)

- `/messages` (any role): compose to the people you are allowed to reach; unread badge in the
  sidebar bell/menu.
- Faculty `/faculty/students`: search by name/reg-no/course → permitted academic profile
  (attendance, midterm, results, CGPA) — the view is audited.
- Admin `/admin/users` + `/admin/audit`: roles and the action trail (everything above is logged).
- Admin `/admin/forms`: the **forms manager** — add a form (label/type lines build the fields),
  retire one with a click; students see the change immediately in `/forms`.

## 2d. University IDs, coordinator changes & the FYP request desk (4:00–5:00)

- **Every account carries its university ID.** Students use registration numbers (`S22CSC001`…),
  staff use employee IDs (`FAC001` faculty, `COORD001` coordinator, `FYP001` FYP Head) — the ID
  shows in the top bar, on the dashboard and on **My Profile** (sidebar → My Profile), together
  with the record attached to it and the role's full capability list.
- Sign in as **coordinator** → `/coordinator/timetable`: the weekly grid is editable — move a
  session, change the room, add or cancel one. Room/faculty/cohort double-bookings are rejected
  before they save (*try booking E2E-100 twice*), and every change notifies the class faculty +
  enrolled students and lands in the audit log.
- Sign in as **FYP Head** → `/fyphead`: the request desk. Every application submitted by a group
  lands here; approving one assigns the faculty supervisor (both sides get a notification),
  rejecting one records the reason. The decided table carries the supervisor and employee ID.
- Student `/fyp` then shows the assigned supervisor with their employee ID on the approved project.

## 2e. Accounts, exams & FYP supervision (5:00–6:00)

- **One sign-in for everyone** — `/sign-in` accepts a University ID (`S22CSC003`) *or* an email;
  the form maps the ID to the account and signs you in. Signed-out deep links bounce here with
  `?redirect_url=`, and `/forgot-password` lets a holder reset without staff help. There is **no
  self-signup**: accounts are issued by the coordination office.
- Admin `/admin/users`: **New account** (role-aware form → institutional ID is generated:
  `S26CSC0xx` for students, `FAC0xx`/`COORD0xx` for staff) and **CSV import** for a whole batch.
  Every row has a **Status** badge; deactivate/reactivate blocks sign-in immediately
  (`isActive` at the portal + Clerk ban). The account page (`/admin/users/[id]`) carries the
  identity card, audit history and a **recovery link** (single-use) for password resets.
- Coordinator `/coordinator/exams`: schedule, move or cancel exams per course; an exam that
  collides with a hall or a cohort that already sits another exam is **blocked**, class-time
  coincidences surface as advisories. Students + faculty are notified.
- Coordinator `/coordinator/timetable`: the same page now also manages **courses & sections** —
  create a section and assign faculty (an already-busy lecturer is refused), and correct a
  student's record from `/coordinator/students/[id]`.
- Faculty `/faculty/fyp`: the **supervision workspace** — supervised groups, members,
  registration numbers, and a progress-note box; each note notifies the group and appears on the
  student's `/fyp` page. FYP Head `/fyphead` can also **Request changes** instead of deciding —
  the group revises and resubmits in place.

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
- `/admin/audit`: every important action (role change, marks published, clash resolved…) is in the
  audit trail; `/admin/users` shows the 18 personas and lets an admin adjust a role.
- Wrap: *"45 portal routes, 35 models, 358 automated tests including an RBAC/guard suite that fails
  the build if a page skips authorization."*

## Rehearsal checklist

- [ ] `bun run test` green; `bun run build` green; production deploy current
- [ ] Demo data pristine (`bun run seed` is idempotent — safe to re-run)
- [ ] Demo accounts can sign in — 18 personas, one password `UniSphere#Demo2026`
      (re-link with `bun run scripts/link-clerk-users.ts` if Clerk was reset)
- [ ] AI key present **or** the offline-fallback notice pre-explained
- [ ] Offline kit ready (docs/offline-demo.md) — laptop hotspot + local Postgres
- [ ] Screenshots fallback exported (`docs/demo/screenshots/` — `01-landing.png`,
      `01-landing-mobile.png`, `02-sign-in.png` recap the 2026-10 design refresh, and
      `docs/demo/screenshots/app/` holds 54 authenticated full-page captures across all six
      personas: `student-*`, `coordinator-*`, `faculty-*`, `fyphead-*`, `mentor-*`, `admin-*`)
