# UniSphere — demo login

Everything below is the **actual configured flow** of the deployed app. No
credentials are invented here; all accounts listed exist in the live database
and were created by the project's own provisioning scripts.

## Where

- **Production portal:** https://unisphere-hazel.vercel.app (backup alias:
  https://unisphere-shu.vercel.app)
- Sign-in page: `/sign-in` — one page for every role.

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
