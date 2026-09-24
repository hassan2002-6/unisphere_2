# M0 Spike Notes — 2026-09-24 (plan §11, Phase 0 DoD)

Environment: Windows 10 · Bun 1.4.2 · Node 22 (Vercel) · Next 16.3.6 · Turborepo 2.11.3 · Prisma 7.10.0 · Clerk CLI 3.3 / @clerk/nextjs 7.9.5 · Vercel CLI 59.26

## ① Scaffold + deploy pipeline + DB reachability

- Monorepo scaffolded (Turborepo): `apps/web` (Next 16.3.6, React 19.3, Tailwind 4.3, App Router, TS strict) + `packages/db` (Prisma 7.10).
- **Vercel**: project `unisphere` linked (root dir `apps/web`, framework nextjs). Deploy pipeline **verified**: 3 successful deployments (preview + 2 production).
  - Production URL: `https://unisphere-hassans-projects-02a69c66.vercel.app`
  - Verified anonymously: `/` serves the landing (UniSphere), `/dashboard` **redirects to Clerk sign-in** (auth wall live). ✅
- Deployment Protection: enabled by default on the team; `curl` sees 302 → use `vercel curl` or the browser for unauthenticated checks.
- **Neon**: project pending — needs the owner's API key (OAuth flow window too short for chat round-trip). `DIRECT_URL`/`DATABASE_URL` go in `.env` + Vercel env.
  - DB reachability check (`SELECT 1`) runs via `GET /api/health` once Neon is connected (returns `{ok, db, latencyMs}`).

## ② Clerk (auth + role claim)

- Clerk app created via CLI: `app_3JlxYeQtlqJe8WLyhhcVYXB4abC` (dev instance, owner cshassan421@gmail.com).
- Keys pulled to `apps/web/.env.local` (never committed); env vars set on Vercel for **production + preview**.
- `src/proxy.ts` (Next 16's middleware) — `clerkMiddleware` protects everything except `/`, `/sign-in/*`, `/sign-up/*`, `/api/health`, `/api/webhooks/clerk`.
- Landing, sign-in/up, dashboard, setup-needed, not-provisioned pages built; role portal shell + RBAC matrix implemented (`src/lib/rbac.ts`, plan §8.1) with 93 passing matrix tests.
- Role round-trip design: **DB `User.role` is authoritative** (never client metadata); first login attaches the Clerk id to the pre-provisioned (seeded) email row; `AUTO_PROVISION=false` disables auto-creation.
- Webhook `/api/webhooks/clerk` implemented (Svix-verified). Set `CLERK_WEBHOOK_SECRET` after configuring the endpoint in the Clerk dashboard.
- Remaining for full DoD: owner signs in once with the 5 demo accounts after seeding (Neon pending).

## ③ AI provider (Groq)

- **Not yet started — the owner must supply a free API key** (console.groq.com → API Keys; no credit card needed).
- Plan records observed quota in this file after the first real call from a route handler (expect ~30 RPM free tier; verify exactly).
- Provider adapter is env-driven (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_FALLBACK_MODE`) so the canned fallback mode proves the demo without any key.

## ④ Postgres FTS sanity

- FTS migration authored (`packages/db/prisma/migrations/20260924100100_knowledge_fts/migration.sql`): generated `tsv` column + GIN index on `KnowledgeDoc`.
- Sanity query (`websearch_to_tsquery`) to run right after Neon connects; retrieval path committed as FTS-first (pgvector optional behind `RETRIEVAL_VECTOR`).

## Pitfalls hit (worth remembering)

- **Prisma 7**: no `url` in `datasource` — the CLI reads it from `prisma7.config.ts` (`DIRECT_URL ?? DATABASE_URL` for migrations; runtime uses the `@prisma/adapter-pg` driver adapter). `prisma migrate diff --to-schema-datamodel` was renamed → **`--to-schema`**. Client generator is `prisma-client` with explicit output (`generated/prisma`), not `prisma-client-js`.
- **Next 16**: middleware is now `proxy.ts` ("functionality unchanged"); `create-next-app` docs live in `node_modules/next/dist/docs/`.
- **Playwright browsers**: `cdn.playwright.dev` download times out on this network (even with a 300s connection timeout) → E2E will use `channel: "chrome"` against the installed Chrome (154) instead of a downloaded Chromium.
- **agent-browser**: first run can wedge; `agent-browser close --all` then `--debug open <url>` clears it. Hermes real-profile mode is now enabled (`browser.use_real_profile`).
- **Vercel CLI on Windows**: auth token lives in `%APPDATA%\com.vercel.cli\Data\auth.json`.
- **shadcn CLI**: `-b` now selects the base library (`radix|base|aria`), not the base color.
- **Migrate checksums**: init migration generated offline with `migrate diff --from-empty --to-schema … --script` (no DB required); `migrate deploy` will apply it to Neon as-is.
