# UniSphere — Evidence Map

Compiled 2026-09-20 during the FYP-II planning pass. Everything below was extracted from the four files in `resources/` (left untouched) plus public GitHub repositories. Extraction artifacts are in `docs/research/extracts/`.

## 1. Sources

| Source | What it is | Reliability for planning |
|---|---|---|
| `resources/Unisphere Final ppt.pptx` (17 slides, mtime 2026-06-30) | FYP-I final presentation. Key Modules list; "Work Planned for FYP-II" list; technology stack (Next.js, React, Tailwind, Shadcn UI / Next.js API Routes, Prisma / PostgreSQL Neon / Clerk / GitHub / Vercel); FYP-II objective list. | **Authoritative** for scope + stack (owner-confirmed 2026-09-20). |
| `resources/Unisphere1.pptx` (16 slides, mtime 2026-02-24) | FYP-I **proposal** deck, slides stored as images (recovered via OCR). Modules (Academic Planning, AI Complaint Routing, AI Chatbot, Alumni Mentorship, Notifications, Internships), in/out-of-scope lists, roles (Students/Admin/Alumni), team division. | Historical baseline; several items evolved (complaint routing dropped; coordinator/FYP-head roles added later). |
| `resources/UNISPHRE NEW REPORT.pdf` (68 pp, created 2026-07-01) | FYP-I report on the university template. Chapters 1–5 are largely generic/boilerplate (references list is from an unrelated radar-signal-processing template; SRS describes attendance/marks/fees not present in the product). Pages 45–54 contain **real survey results (n=71–74)**. | Generic chapters: **not** authoritative. Survey section: valuable primary data. |
| `resources/WhatsApp Image 2026-09-20 at 9.06.54 PM.jpeg` (2026-09-20) | Project **poster** (newest artifact). Role portals (Students, Faculty, Program Coordinators), feature list (complaint box, internships, timetable + clash detection, forms center, notifications, AI chatbot, academic planning), **GPU Resource Request workflow as "FYP Highlight"** (4 steps: student submits → FYP Head reviews/recommends → Lab Admin allocates → allocated & notified), SDGs, and a stack line (**HTML/CSS/JS + PHP + MySQL + XAMPP**). | Marketing summary of the product. Its stack line **conflicts with the deck** and was superseded by the owner's 2026-09-20 decision (Next.js stack). |
| `github.com/hassan2002-6/fyp` → `setup.html` (pushed 2026-06-03) | The actual **FYP-I prototype**: one 142 KB self-contained HTML/CSS/JS file with 4 role portals and all major flows using mock data. Copied to `docs/reference/prototype/setup.html`. | **Binding UI/flow reference** for FYP-II implementation. |
| `github.com/hassan2002-6/unisphere_2` | Target repository for FYP-II (created 2026-09-20, empty at planning time). | Confirmed empty; no other UniSphere code found on teammate accounts. |

## 2. Confirmed facts
- Team (Salim Habib University, BS Computer Science): Ishan Rajwani (S23CSC031), Carol Swan (S23CSC006), M. Hassan Siddiqui (S22CSC003). Supervisor: Mr. Ateeque Rahman; Co-supervisor: Ms. Saadia Karim. Session Spring 2026 – Fall 2026 → FYP-II runs in Fall 2026.
- FYP-I delivered: requirement analysis, literature review, architecture & DB planning, UI/UX, and a clickable prototype; plus the report and presentations.
- Prototype roles: **Student, Faculty, Program Coordinator, FYP Head/Admin**. Prototype has no persistence (in-memory JS state, no backend, no real auth) and no mentorship module.
- Prototype modules/screens: dashboard, timetable (with clash flags), exam schedule, notifications, internships, complaint box, forms center (7 student + 5 faculty form types), submissions tracking, FYP application, resource request (GPU/CPU/workstation) + allocations, labs + inventory, reports. Chatbot answers are canned keyword responses. See Appendix C of the plan for the full menu/fixture inventory.
- FYP-II scope (deck): backend, DB integration, auth, AI chatbot, APIs, testing & deployment; complaint workflow, notification system, internship management, mentorship system; modules incl. Academic Planning, Student Dashboard, GPU Allocation.
- Survey (n≥71): top pain points are timetable/exam clashes and course-selection confusion; multiple disconnected platforms; strong demand for centralized notifications; ~70 %+ interest in alumni mentorship; 71.6 % would use the platform.

## 3. Contradictions found (and resolutions)
1. **Tech stack** — deck (Next.js/Prisma/Postgres/Neon/Clerk/Vercel) vs poster (PHP/MySQL/XAMPP) vs report ("Python/Node; MySQL/PostgreSQL"). **Resolved by owner 2026-09-20: Next.js stack.**
2. **Module scope** — report SRS includes attendance/results/fees; deck + prototype + poster do not. **Resolved: implement the deck's list only; attendance/results/fees/fees are out of scope.**
3. **Mentorship** — in the Feb proposal + survey (strongly) + deck FYP-II list; absent from the June prototype and the poster. **Resolved: in scope (deck-list rule); design included in the plan.**
4. **Prototype maturity** — deck calls it "High-Fidelity Prototype"; it is a single-file mock, not a codebase. Treated as UI/flow reference, not a foundation.
5. **Report integrity** — its figures/references belong to an unrelated template; do not use it as a requirements source. Keep its survey data; avoid carrying its attendance/fees language into FYP-II documentation (see plan risk R9).

## 4. Missing information (as of planning)
- FYP-II calendar (mid-evaluation/defence/report dates) — owner "not sure yet"; plan is T-relative.
- LLM provider account ownership and any paid-credits tolerance (~$5 buffer suggested).
- Knowledge-corpus content ownership/validation (needs supervisor review).
- Real alumni availability for the mentorship module (seeded profiles proposed).
- University demo constraints (offline machines?) — offline kit planned regardless.

## 5. How the artifacts were produced
- **PPTX → JSON outlines:** `python-pptx` (`pptx_read.py` from the Hermes powerpoint skill).
- **PDF → text:** `pdfplumber` per-page extraction; **PDF → images:** PyMuPDF renders; image-only deck slides/pages and the WhatsApp poster → **Windows.Media.Ocr** (PowerShell WinRT) locally. No external OCR service used.
- Exact extraction outputs are preserved under `docs/research/extracts/`:
  - `final_ppt_outline.json` — final deck structure/text.
  - `unisphere1_outline.json` + `unisphere1_ocr.md` — proposal deck structure + OCR text.
  - `report_text.json` — full per-page report text.
  - `report_pages_ocr.md` — OCR of figure/survey pages (incl. survey charts).
  - `poster_ocr.md` — OCR of the WhatsApp poster.
