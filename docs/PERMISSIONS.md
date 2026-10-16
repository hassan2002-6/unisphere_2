# UniSphere — role permission matrix

> **Generated file — do not edit by hand.** The single source of truth is
> `apps/web/src/lib/rbac.ts`; regenerate with `bun scripts/gen-permissions.ts`
> from `apps/web`. Every portal page, server action and API route is checked
> against this matrix server-side (see `tests/security.test.ts`, which also
> statically fails the build if a page skips its guard).

## Matrix

| Capability | Student | Faculty | Coordinator | FYP Head | Mentor | Administrator |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Submit forms and requests (`forms.submit`) | ✅ | ✅ | ✅ | — | — | ✅ |
| File complaints (`complaints.submit`) | ✅ | — | — | — | — | — |
| Apply for an FYP (`fyp.submit`) | ✅ | — | — | — | — | — |
| Request GPU / lab resources (`resources.request`) | ✅ | — | — | — | — | — |
| Apply to internships (`internships.apply`) | ✅ | — | — | — | — | — |
| Submit coursework assignments (`assignments.submit`) | ✅ | — | — | — | — | — |
| Use the AI assistant (`chat.use`) | ✅ | — | — | — | — | — |
| Review form submissions (`forms.review`) | — | ✅ | ✅ | ✅ | — | ✅ |
| Handle complaints (`complaints.manage`) | — | ✅ | ✅ | — | — | ✅ |
| Configure complaint categories and routing (`complaints.route`) | — | — | — | — | — | ✅ |
| Decide FYP applications & assign supervisors (`fyp.decide`) | — | — | — | ✅ | — | ✅ |
| Manage resource requests and allocations (`resources.manage`) | — | — | — | ✅ | — | ✅ |
| Manage inventory (`inventory.manage`) | — | — | — | ✅ | — | ✅ |
| Publish internships (`internships.post`) | — | — | ✅ | ✅ | — | ✅ |
| Send broadcasts (`broadcast`) | — | — | ✅ | ✅ | — | ✅ |
| View operational reports (`reports.view`) | — | ✅ | ✅ | ✅ | — | ✅ |
| View scheduling clashes (`clashes.view`) | — | — | ✅ | — | — | ✅ |
| Resolve scheduling clashes (`clashes.manage`) | — | — | ✅ | — | — | ✅ |
| Edit the class timetable (`timetable.manage`) | — | — | ✅ | — | — | ✅ |
| Mark attendance (`attendance.manage`) | — | ✅ | — | — | — | ✅ |
| Enter marks and publish results (`marks.manage`) | — | ✅ | — | — | — | ✅ |
| Create assignments and grade submissions (`assignments.manage`) | — | ✅ | — | — | — | ✅ |
| Search student records (`students.search`) | — | ✅ | ✅ | ✅ | — | ✅ |
| Send internal messages (`messages.send`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read the audit log (`audit.view`) | — | — | ✅ | ✅ | — | ✅ |
| Manage users and roles (`users.manage`) | — | — | — | — | — | ✅ |
| Manage the AI assistant's knowledge base (`knowledge.manage`) | — | — | — | — | — | ✅ |
| Manage user profile photos (`profiles.manage`) | — | — | — | — | — | ✅ |
| Request corrections to student records (`corrections.request`) | — | ✅ | ✅ | — | — | ✅ |
| Review and apply data correction requests (`corrections.manage`) | — | — | — | — | — | ✅ |
| Configure admit-card eligibility and issue previews (`admitcards.manage`) | — | — | — | — | — | ✅ |

## Per-role capability lists

### Student (`STUDENT`)

- Submit forms and requests (`forms.submit`)
- File complaints (`complaints.submit`)
- Apply for an FYP (`fyp.submit`)
- Request GPU / lab resources (`resources.request`)
- Apply to internships (`internships.apply`)
- Submit coursework assignments (`assignments.submit`)
- Use the AI assistant (`chat.use`)
- Send internal messages (`messages.send`)

### Faculty (`FACULTY`)

- Submit forms and requests (`forms.submit`)
- Review form submissions (`forms.review`)
- Handle complaints (`complaints.manage`)
- Create assignments and grade submissions (`assignments.manage`)
- Mark attendance (`attendance.manage`)
- Enter marks and publish results (`marks.manage`)
- Search student records (`students.search`)
- Send internal messages (`messages.send`)
- View operational reports (`reports.view`)
- Request corrections to student records (`corrections.request`)

### Coordinator (`COORDINATOR`)

- Submit forms and requests (`forms.submit`)
- Review form submissions (`forms.review`)
- Handle complaints (`complaints.manage`)
- Publish internships (`internships.post`)
- Send broadcasts (`broadcast`)
- View scheduling clashes (`clashes.view`)
- Resolve scheduling clashes (`clashes.manage`)
- Edit the class timetable (`timetable.manage`)
- Search student records (`students.search`)
- Send internal messages (`messages.send`)
- View operational reports (`reports.view`)
- Read the audit log (`audit.view`)
- Request corrections to student records (`corrections.request`)

### FYP Head (`FYP_HEAD`)

- Review form submissions (`forms.review`)
- Decide FYP applications & assign supervisors (`fyp.decide`)
- Manage resource requests and allocations (`resources.manage`)
- Manage inventory (`inventory.manage`)
- Publish internships (`internships.post`)
- Send broadcasts (`broadcast`)
- View operational reports (`reports.view`)
- Search student records (`students.search`)
- Send internal messages (`messages.send`)
- Read the audit log (`audit.view`)

### Mentor (`MENTOR`)

- Send internal messages (`messages.send`)

### Administrator (`ADMIN`)

- Submit forms and requests (`forms.submit`)
- Review form submissions (`forms.review`)
- Handle complaints (`complaints.manage`)
- Configure complaint categories and routing (`complaints.route`)
- Decide FYP applications & assign supervisors (`fyp.decide`)
- Manage resource requests and allocations (`resources.manage`)
- Manage inventory (`inventory.manage`)
- Publish internships (`internships.post`)
- Send broadcasts (`broadcast`)
- View operational reports (`reports.view`)
- View scheduling clashes (`clashes.view`)
- Resolve scheduling clashes (`clashes.manage`)
- Edit the class timetable (`timetable.manage`)
- Mark attendance (`attendance.manage`)
- Enter marks and publish results (`marks.manage`)
- Create assignments and grade submissions (`assignments.manage`)
- Search student records (`students.search`)
- Send internal messages (`messages.send`)
- Read the audit log (`audit.view`)
- Manage users and roles (`users.manage`)
- Manage the AI assistant's knowledge base (`knowledge.manage`)
- Manage user profile photos (`profiles.manage`)
- Request corrections to student records (`corrections.request`)
- Review and apply data correction requests (`corrections.manage`)
- Configure admit-card eligibility and issue previews (`admitcards.manage`)

## Notes

- **View access** follows the capability plus record scoping inside each
  service (students see only their own records; faculty see their assigned
  courses; coordinators/admins see the whole institutional scope). The guard
  and the scope check are enforced on the server for every read and write.
- **Export** is `reports.view` (CSV via `/api/reports/summary?format=csv`).
- **Delete/archive**: academic records are archived/retired (form templates,
  users via deactivation, inventory) rather than hard-deleted; complaint and
  notification cleanup only happens through record edits.
- MENTOR retains a standard dashboard only — the alumni-mentorship workflow is
  retired from the active portal (DB models kept).
