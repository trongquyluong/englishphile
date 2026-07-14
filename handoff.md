# Englishphile Handoff

## Goal

Prepare Englishphile for public beta while preserving the current product direction:

- Englishphile is a personalized English practice platform for specialized English exam preparation.
- Main learner flow: sign up as a learner, take diagnostic, receive Gym recommendations, practice, review analytics, join contests, read Wiki.
- Main navigation: Trang chu, Gym, Contests, Wiki, Ve Englishphile.
- Supported database roles are `STUDENT` and `ADMIN`. Public signup must remain learner-only.
- Site owner/admin manages content, imports, QA, contests, Wiki, and publishing.
- Classroom and assignment application features are decommissioned; retained tables and rows are historical data only.
- Do not run seed or reset imported/local data unless the user explicitly accepts that reset.

## Current Progress

Phase 1-9 are already implemented:

- Local auth with hashed passwords and signed session cookies.
- Learner-only public signup with username, full name, school, province/city, and confirm password.
- Content-admin access accepts stored `ADMIN` or a current database user whose normalized email matches `OWNER_EMAIL`; role and email are reloaded from the database for each authorization decision.
- Diagnostic system with blueprint, scoring, confidence, skill/topic profiles, and recommendations.
- Gym hub and subpages for Reading, Writing, Listening, and Use of English.
- Problem bank, solving UI, submissions, wrong questions, and learner analytics.
- Contests mode with public contest list/detail/start/result/leaderboard and admin contest builder.
- Wiki route, with `/theory` kept as a compatibility redirect.
- Upload-first JSON/CSV/content-pack import workflow with duplicate detection and content QA.
- Content lifecycle: DRAFT, NEEDS_REVIEW, PUBLISHED, ARCHIVED.
- Admin tools for import, content packs, QA, review, problems, sources, topics, diagnostic bank, contests, and Wiki placeholder.

Phase 10 beta readiness was completed:

- Added/updated `.env.example` with `DATABASE_URL`, `SESSION_SECRET`, `AUTH_SECRET`, `OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, and `NODE_ENV`.
- Added config helper: `src/lib/config.ts`.
- Session secret now uses `SESSION_SECRET`/`AUTH_SECRET` via config helper.
- Added basic in-memory rate limiter: `src/lib/rate-limit.ts`.
- Applied rate limiting to sign-in, sign-up, diagnostic start/submit, contest start/submit, and admin import endpoints.
- Added admin promotion script: `scripts/promote-admin.ts`.
- Added safe database scripts:
  - `scripts/db-backup.ts`
  - `scripts/db-export.ts`
  - `scripts/db-stats.ts`
  - `scripts/db-utils.ts`
- Added package scripts:
  - `prisma:deploy`
  - `prisma:studio`
  - `admin:promote`
  - `db:backup`
  - `db:export`
  - `db:stats`
- Added health/status:
  - `src/lib/health.ts`
  - `/api/health`
  - `/status`
- Added beta legal/support pages:
  - `/privacy`
  - `/terms`
  - `/contact`
- Added footer links for Privacy, Terms, Contact, Status in `src/components/layout/AppShell.tsx`.
- Added admin beta checklist:
  - `/admin/beta-checklist`
  - Shows owner config, published problems, diagnostic readiness, latest backup, review queue count, duplicate warnings, active contests, and legal-page checks.
- Added admin nav/dashboard links to the beta checklist.
- Added metadata polish to root layout and key pages.
- Updated `README.md` and `AGENTS.md` with beta launch, admin, backup/export, migration, and no-seed instructions.

Validation completed successfully:

```bash
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name phase10_beta_launch_readiness
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run db:backup
npm.cmd run db:stats
npm.cmd run db:export
```

Important: `npm run prisma:seed` was not run.

Smoke checks completed:

- `/api/health` returned `ok: true` and `database: connected`.
- `/status`, `/privacy`, `/terms`, `/contact`, and `/auth/sign-up` loaded.
- Signup includes confirm password and no role selector.
- Latest safe export was checked and contains no `passwordHash`.
- Dev server was started at `http://localhost:3000` after validation.

Current local data stats from `npm run db:stats` at the time of handoff:

- users: 2
- publishedProblems: 23
- needsReviewProblems: 101
- archivedProblems: 0
- diagnosticEligibleProblems: 0
- contentPacks: 4
- contests: 0
- diagnosticAttempts: 1

## Phase 1C-A Role Policy And Classroom Decommissioning

- The user-role model is now `STUDENT` and `ADMIN` only in Prisma.
- The Phase 1C-A forward migration downgrades all legacy teacher-role users to `STUDENT`, recreates only the `Role` enum, and preserves all classroom/assignment tables, rows, IDs, and foreign keys. It is applied in isolated non-production Preview only, remains unapplied in Production, and is immutable because it has now been applied in an environment.
- The migration is explicitly transactional. Before applying it to Production, use aggregate-only checks to confirm at least one stored `ADMIN` or a current user matching configured `OWNER_EMAIL`, record the legacy-role count, confirm the downgrade cannot remove the final usable administrator, and pause role-management writes.
- `ADMIN` users are global editorial peers. `Contest.createdById`, `ContentPack.importedById`, `ImportBatch.userId`, reviewer IDs, and similar fields are attribution rather than ownership boundaries.
- `OWNER_EMAIL` grants the same content-admin access as `ADMIN`; it is not a database role or super-admin tier.
- `/admin/layout.tsx` guards the complete admin page subtree, while every Server Action and Route Handler retains its own guard.
- Admin APIs return generic JSON 401/403 decisions and do not use redirect-style authorization.
- Classroom/assignment pages and UI components were removed. Legacy action names and the assignment API are safe not-found tombstones with no Prisma mutation path.
- `/api/submissions` remains the active independent-practice `SINGLE_PROBLEM` submission path; only `/api/assignments/[id]/submit` is retired. The seed no longer recreates classroom or assignment fixtures.
- Portable import is operator-level tooling. Explicit `ADMIN` remains or assigns `ADMIN`, legacy `TEACHER` becomes `STUDENT`, and unknown roles are rejected. The selected input-directory argument is now correctly used when resolving the fixed internal import-step filenames; this has pure helper coverage but no end-to-end import run.
- H-05 and H-06 are only partially remediated: global-peer policy is clarified, but cross-parent ID binding, publish TOCTOU, and bulk transaction work remains Phase 1C-B.

### Phase 1C-A Preview reconciliation (owner-attested 2026-07-14)

- PR #6 remains open and Draft; GitHub/Vercel checks passed, and the Phase 1C-A application was deployed to an isolated Vercel Preview. Production application code and Production data remain unchanged by Phase 1C-A.
- Preview reports all 16 migrations applied and Prisma schema up to date. `20260713160000_phase1c_a_role_policy` is applied in Preview only and must never be edited; any future SQL correction requires a new additive migration.
- The Preview role postflight found two `STUDENT` rows, no stored `ADMIN`, and no unexpected role. The configured `OWNER_EMAIL` resolved to a current Preview user, preserving usable content-admin access. No identity or infrastructure value is recorded.
- Preview health reported database connected; owner sign-out/sign-in and `/admin` access passed; an ordinary student was denied; retired classroom, assignment, teacher, and grading pages returned not found; and retired assignment API GET/POST returned generic 404.
- Independent single-problem practice submission and persistence passed. Checked Preview logs reported no Prisma enum error, database-authentication error, unexpected 500, or sensitive value.
- Initial direct HTTP checks were invalid application evidence because Vercel Deployment Protection intercepted them: GET followed Vercel authentication and appeared as 200, while POST was blocked with 401. Authenticated Vercel CLI protection bypass reached the application and produced the expected generic 404 for both methods.
- During manual Preview setup, a Preview-only non-production database credential was inadvertently exposed in terminal/chat input. The owner treated it as compromised, rotated it, updated Preview `DATABASE_URL` and `DIRECT_URL`, removed the old value from PowerShell history and clipboard, and subsequently validated the rotated configuration through successful Preview health and migration operations. Production variables were unchanged. The incident is operationally remediated.
- Preview evidence does not prove Production behavior. Production backup/export, aggregate admin-lockout preflight, migration application, immediate application deployment, authorization/retirement/practice smoke checks, and runtime-log inspection remain required.

## What Worked

- Centralizing content-admin policy and API decisions keeps page, action, and Route Handler semantics consistent.
- OWNER_EMAIL support is useful for local owner access without exposing admin signup.
- Keeping public signup learner-only avoided role leakage.
- No schema changes were needed for Phase 10, so Prisma migration was a clean no-op.
- The backup/export/stats scripts worked without seeding or mutating user content.
- Safe export works by selecting user fields explicitly and excluding credential hashes.
- Turbopack build passed cleanly after scoping filesystem checks in `/admin/beta-checklist`.
- Using `npm.cmd` on Windows worked reliably for npm scripts.
- Stopping only workspace-related Next dev processes before Prisma validation avoided SQLite/dev-server conflicts.

## What Did Not Work

- `git diff` was not useful because this workspace appears to have most files untracked. Use filesystem inspection and validation commands instead of relying on git diff for current changes.
- A first build produced a Turbopack warning from broad `process.cwd()` filesystem tracing in `/admin/beta-checklist`. This was fixed by adding `/* turbopackIgnore: true */` to the relevant `path.join` calls.
- Some existing files print mojibake in PowerShell output. Narrow `apply_patch` matching can fail on those encoded lines. When needed, replace small whole files or patch nearby ASCII-safe context.
- The first safe export smoke check found the literal string `passwordHash` in a manifest warning, not in exported user data. The export script was rewritten to avoid the sensitive field name in exported files and console output.
- Do not run seed as a convenience check. The user explicitly wants imported/local data preserved.

## Phase 10.5 — Vercel + Neon Deployment Readiness

Phase 10.5 completed deployment readiness for free beta on Vercel + Neon.

### What Changed

- **Prisma schema**: switched from `sqlite` to `postgresql` provider. Added `directUrl = env("DIRECT_URL")` for Neon pooled+direct connection support.
- **Migration lock**: updated to `provider = "postgresql"`.
- **Migration files**: replaced SQLite-specific PRAGMA/REDEFINE migrations (phase3, phase6, phase8) with no-ops; added `20260707010000_phase10_5_postgres_baseline` for PostgreSQL-compatible schema setup.
- **`.env.example`**: added `DIRECT_URL` documentation, Neon pooled vs direct connection explanation, and clearer section headers.
- **`src/lib/config.ts`**: added `directUrl` and `isProduction` fields; validates `SESSION_SECRET` in production.
- **New scripts**:
  - `scripts/db-export-portable.ts` — exports all content data (users safe, source collections, topics, content packs, problems, questions, theory notes, contests, diagnostic attempts, profiles, recommendations) as a portable JSON bundle. No `passwordHash` included.
  - `scripts/db-import-portable.ts` — imports portable bundle into a target PostgreSQL database with FK-safe upsert logic and production URL confirmation prompt.
  - `package.json`: added `db:export:portable` and `db:import:portable` scripts; updated `build` to include `prisma generate`.
- **`/admin/beta-checklist`**: added deployment environment panel, `SESSION_SECRET` check, `DATABASE_URL` type check, portable export reminder, and production mode warning banner.
- **`README.md`**: added "Deploy miễn phí với Vercel + Neon" section with step-by-step instructions, production checklist, and warnings.
- **`AGENTS.md`**: added deployment section with Vercel + Neon rules.

### Database Strategy

- **Production**: PostgreSQL on Neon Free.
- **Local dev**: requires an isolated PostgreSQL database (an independent Neon project or local Postgres). SQLite is not a supported current development path.
- **Historical SQLite data**: preserved — no seed, no reset. Use `npm run db:export:portable` to move content to Neon.
- **Migration**: `npm run prisma:deploy` for production. `npm run prisma:migrate` for local dev.

### Data Portability

Run these to move local content to Neon:

```bash
# Export local content (safe, no passwordHash)
npm run db:export:portable

# Import into Neon (requires DIRECT_URL or --url)
npm run db:import:portable -- --input exports/englishphile-portable-<timestamp>
```

User accounts must sign up again on production (passwords are not exported). The owner account can use the promotion script after signup.

## Next Steps

1. Open `http://localhost:3000/admin/beta-checklist` as the OWNER_EMAIL/admin account and resolve warnings.
2. Mark enough published problems as diagnostic-eligible in `/admin/diagnostic`; current local count is `0`.
3. Publish or archive the 101 NEEDS_REVIEW problems after QA and preview.
4. Create at least one public contest in `/admin/contests` if beta should expose Contests immediately.
5. For production deployment:
   - Create Neon project and copy connection strings.
   - Push repo to GitHub and import into Vercel.
   - Add environment variables in Vercel: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV=production`.
   - Run `npm run prisma:deploy` or let Vercel build trigger migration.
   - Run `npm run db:export:portable` then `npm run db:import:portable` to move content.
   - Sign up owner account and run `npm run admin:promote` if needed.
6. Before any production migration or large import, run `npm run db:backup`.
7. Use `npm run prisma:deploy` for production migrations. Do not use migrate-dev in production.
8. Re-test as both anonymous learner and owner/admin:
   - public signup
   - sign-in/sign-out
   - dashboard
   - diagnostic
   - Gym
   - recommendations
   - contests
   - Wiki
   - admin import/upload
   - content QA
   - beta checklist
9. Keep classroom/assignment application surfaces decommissioned and preserve their historical database rows.
10. Continue following `AGENTS.md`, especially:
    - UI text Vietnamese, code/types/database English.
    - No old coding-practice comparison wording.
    - No public teacher signup.
    - Student-facing content uses PUBLISHED problems only.
    - Upload-first import and duplicate guardrails remain mandatory.
    - Never run seed on populated data without explicit approval.
    - Vercel Hobby + Neon Free for free beta deployment.
    - Do not use SQLite for deployed production.
