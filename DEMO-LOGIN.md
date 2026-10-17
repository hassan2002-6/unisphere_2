# UniSphere — demo login

Everything below is the **actual configured flow** of the deployed app. No
credentials are invented here; all accounts listed exist in the live database
and were created by the project's own provisioning scripts.

## Where

- **Production portal:** https://unisphere-hazel.vercel.app (backup alias:
  https://unisphere-shu.vercel.app)
- Sign-in page: `/sign-in` — one page for every role.

## Five-role demo accounts

| Role | University ID | Email |
| ---- | ------------- | ----- |
| Student | `S22CSC001` | `student@shu.edu.pk` |
| Faculty | `FAC001` | `faculty@shu.edu.pk` |
| Course Coordinator | `COORD001` | `coordinator@shu.edu.pk` |
| FYP Head | `FYP001` | `fyphead@shu.edu.pk` |
| Admin | `ADMIN001` | `admin@shu.edu.pk` |

Every account signs in through the same `/sign-in` page and lands on its own
role dashboard; the portal then enforces role restrictions server-side on every
page, action and API route. Passwords are never displayed in the app UI or
logs — see “The two ways in” below for how the shared demo credential is
managed.

## The two ways in

### 1. University ID + password (provisioned accounts)

1. Open `/sign-in`.
2. Enter your **University ID** (`S22CSC001`, `FAC001`, `COORD001`, `FYP001`,
   `ADMIN001`, …) or your `@shu.edu.pk` email.
3. Enter the password that was set for the account.

The seeded demo personas all share **one password: `UniSphere#Demo2026`**
(students `student@shu.edu.pk` … `student10@shu.edu.pk`, `faculty@`,
`faculty2@`, `faculty3@`, `saadia.karim@`, `coordinator@`, `fyphead@`,
`mentor@`, `admin@shu.edu.pk`). The full persona list with registration
numbers is in `README.md` → Demo accounts.

The application itself never displays passwords, API keys or verification
codes — not in the UI, not in logs, not in screenshots; this guide is the only
place the demo credential is recorded. Development builds additionally show a
**development-only demo roster** (roles + University IDs, no passwords) beneath
the sign-in form; production builds do not render it.

There is **no self-signup** — `AUTO_PROVISION="false"`. Accounts are issued by
the coordination office: an admin creates them in `/admin/users` (single form
or CSV batch via `/admin/data/import`), and the holder activates them.

### 2. Sign in with Google (Google-created accounts)

Accounts that were originally created by signing in with Google (for example
`cshassan421@gmail.com`, `groupfyp525@gmail.com`) have **no password**. On
`/sign-in` click **Continue with Google** — the custom form detects the
account after you type its email and points you at the Google button.

## The verification-code question, answered

If a demo sign-in ever asks for a **verification code** ("Check your email"),
you are hitting Clerk's **Device Trust** feature, not a password problem:

- Clerk's default policy demands an email code for the first password sign-in
  from an unrecognised device. The demo `@shu.edu.pk` mailboxes cannot receive
  that code, which is what made "it need verification code" happen.
- **Fix already applied:** every provisioned account carries
  `bypass_client_trust=true` (set by `scripts/link-clerk-users.ts`, the admin
  create-account flow in `accounts.ts` and the `user.created` webhook). Sign-in
  therefore completes without any code.
- If you create a **new** account and it still asks for a code, that account
  was not provisioned through the flows above — re-run
  `bun run scripts/link-clerk-users.ts` from `apps/web` (it re-applies the
  bypass for every demo account) or check the Clerk dashboard → Users →
  *Device Trust* setting for the instance.
- No universal code exists and none is documented on purpose: bypassing
  production authentication with an all-purpose code would be a security hole.

## Password resets (real flow)

- **Self-service:** `/forgot-password` → Clerk emails a reset link (works for
  any real mailbox; demo `@shu.edu.pk` boxes are catch-all and won't deliver).
- **Admin fallback:** `/admin/users/[id]` → **recovery** mints a single-use
  sign-in ticket; the account holder completes the reset from it. Tickets are
  single-use and never logged or printed.
- Stored passwords are never revealed — resets go through Clerk only.

## Requirements / environment

The demo login needs these environment variables present on the deployment
(names only — values live in Vercel project settings, never in the repo):
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DIRECT_URL`.

### Development setup from scratch (test accounts for all five roles)

1. **Environment** — copy `apps/web/.env.example` → `apps/web/.env.local` and
   fill in `DATABASE_URL` + `DIRECT_URL` (Neon/Postgres), the two Clerk keys
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk dashboard
   → API keys) and `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`).
2. **Clerk dashboard configuration** (one-time, in the Clerk app):
   - Enable **Email + password** sign-in (User & Authentication → Email).
   - Optional: enable the **Google** SSO connection so “Continue with Google”
     works.
   - Keep **sign-ups disabled** — the portal provisions accounts itself
     (`AUTO_PROVISION="false"`); there is no self-signup path.
3. **Seed the database** (creates the five demo roles + their records):
   `cd packages/db && bun run seed`
4. **Create/link the Clerk users**: `cd apps/web && bun run scripts/link-clerk-users.ts`
   — creates the persona accounts with the shared demo password, links each to
   its seeded DB row and applies the Device-Trust bypass on every account.
   Missing secrets are stated, not faked: without `CLERK_SECRET_KEY` the script
   prints `SKIP: CLERK_SECRET_KEY is not set.` and does nothing; without
   `DATABASE_URL` it prints `SKIP: DATABASE_URL is not set (seed must be loaded
   first).` — fix the environment, then rerun. It never prints passwords.
5. **Run the app** — `bun run dev` in `apps/web`, open `/sign-in`, sign in with
   a University ID from the table above.

There is no fake login path: authentication is Clerk’s; on success the portal
only attaches the matching database row (and its role) to the session.

If Clerk was ever reset (new app/keys), recreate the demo users with:

```bash
cd apps/web
bun run scripts/link-clerk-users.ts   # creates/links all personas + Device-Trust bypass
```

## Acceptance (tested live)

- Each demo role signs in through `/sign-in` and lands on its own role
  dashboard (student / faculty / coordinator / FYP head / admin).
- Deactivated accounts are refused at the portal (`isActive` gate →
  `/account-disabled`) as well as Clerk-side.
- Unauthorized role actions are refused server-side for every page, action and
  API route (see `docs/PERMISSIONS.md` and `tests/security.test.ts`).
