# Offline demo kit

The defence may run on university machines with flaky Wi-Fi. This kit makes UniSphere run
**offline-first on a laptop** for everything except Clerk sign-in, with a recorded fallback if
even that's impossible.

## What works without internet

| Capability                 | Offline? | Notes |
| -------------------------- | -------- | ----- |
| All portal pages + DB flows| ✅       | Local Postgres, seeded |
| AI assistant               | ✅       | Canned fallback answers from the knowledge base (no API key needed) |
| Clash detection, allocation, reports | ✅ | Pure server logic — no external calls |
| Clerk sign-in              | ❌       | Needs internet (or the recorded/screenshot fallback below) |
| External internship links  | ❌       | Non-blocking — everything in-app still works |

## Prerequisites (installed once, online)

1. **Bun** 1.4+ — `powershell -c "irm bun.sh/install.ps1 | iex"`
2. **PostgreSQL 16+** — Docker: `docker run -d --name unisphere-pg -e POSTGRES_PASSWORD=shu -p 5433:5432 postgres:16`
   *(or any local Postgres; port 5433 avoids clashes with an existing 5432)*
3. Repo cloned with `bun install` completed, Prisma client generated.
4. Demo accounts already exist in Clerk (created during setup) — sign-in cookies on the demo
   browser profile survive if you warm them up ~1h before (Clerk sessions last days).

## Cold-start (5 commands, ~2 minutes)

```bash
cd <repo>
export DATABASE_URL="postgresql://postgres:shu@localhost:5433/unisphere"
export DIRECT_URL="$DATABASE_URL"

cd packages/db
bunx prisma migrate deploy      # 26 tables, FTS index
bun run seed                    # idempotent demo data

cd ../../apps/web
bun run dev                     # http://localhost:3000
```

`.env.offline.example` holds these values — copy it over `apps/web/.env.local` *plus* your
Clerk keys (Clerk keys are required to boot; they don't need to be valid for build, only for
sign-in).

## If there is no internet at all (no Clerk)

Use the **recorded fallback** — both hands-free:

1. `docs/demo/video/` — full 12-minute walkthrough recording (per docs/demo-script.md beats).
2. `docs/demo/screenshots/` — beat-by-beat stills for slides.
3. The slides can pair each screenshot with the live architecture story (Postgres FTS, guarded
   decrement race, RBAC guard suite) — all verifiable from the repo itself:

```bash
bun run test                                  # 235 tests, no network needed
bun run scripts/test-concurrency.ts           # with the local Postgres above
bun run scripts/eval-ai.ts                    # 33 retrieval checks against local seed
```

## Pre-defence checklist

- [ ] Local Postgres container running (`docker ps`) and seeded today
- [ ] `bun run dev` boots in <10s; `/dashboard` renders after sign-in
- [ ] Browser profile warmed: all 5 demo accounts signed in at least once
- [ ] Phone hotspot as primary network + university Wi-Fi as backup
- [ ] Recorded video + screenshots on a USB stick AND the laptop
- [ ] Production URL open in a second tab as the resilience option
