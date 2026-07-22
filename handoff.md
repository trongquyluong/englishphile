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

Security Phase 1D-B1, its first PR #12 import-integrity correction, and the narrower import-observability correction are committed on the Draft PR branch as a no-migration H-11 minimization pass. The narrowly bounded per-call import transaction-timeout correction is currently uncommitted for review. Both independent-practice handlers enforce the 72 KiB request limit while consuming the stream, then validate UTF-8/JSON and product-specific answer shapes. New writes retain answers only in their corresponding `SubmissionAnswer`, use `{ version: 1 }` in the non-null parent JSON, and persist only fixed learner-safe feedback. Random practice rejects mixed/foreign sets before its single transaction and partitions answer rows by the actual problem relation. New contest `answersJson` is a bounded versioned positive-allowlist review snapshot; the mapper reads only retained fields, ignores discarded canonical/metadata trees without traversing them, and supports scalar, Error Identification, and Writing learner-answer shapes. Legacy result reads are allowlisted without rewriting rows. Admin draft preview is explicitly protected by `requireAdmin`, passes `previewMode` to the production Client Component, and returns before the learner submission API, so removing draft submission from `/api/submissions` does not break preview or create preview persistence. Portable export omits password hashes and contest access codes and sanitizes historical diagnostic JSON, but remains plaintext. Its 32 KiB positive manifest parser validates only supported metadata and declared counts; dry-run validates that manifest and reports its declared counts without checking bundle files/rows or creating a Prisma client. Content audits use bounded snapshots, logs use safe action/error-class signals, non-TTY live imports need `--yes`, and Production signing refuses missing/empty/fallback secrets at `getAuthSecret()` itself.

The committed PR #12 correction serializes cooperating missing-taxonomy imports with a deterministic transaction-scoped advisory-lock set and maps missing SourceCollection/Topic IDs directly from `createManyAndReturn`. It retains User → optional ContentPack → content lock order, principal revalidation, and all-or-nothing writes. Import failures emit only safe static transaction stages and classifications. Upload-first commit returns 200 with `PARTIALLY_IMPORTED` when at least one file imports, returns 422 when all files fail, and the Vietnamese UI distinguishes full, partial, and failed completion. The original branch implementation and the corrected implementation both succeeded on a fresh isolated in-memory PGlite PostgreSQL engine for the synthetic missing-taxonomy path, so the Preview cause is not proven from repository evidence.

Latest owner-attested Preview evidence dated 2026-07-23 records that manual JSON dry-run passed with zero validation errors, then manual commit passed principal revalidation, ImportBatch creation, taxonomy locks, source lookup/creation, and topic lookup/creation before failing at the single nested `Problem.create`. The safe signal was `action=import-commit`, `errorClass=database`, `stage=problem-nested-create`, `prismaErrorKind=known-request`, and `prismaCode=P2028`. Prisma defines P2028 as a Transaction API error. Because raw message and metadata were intentionally not logged, transaction expiry is the leading evidence-based hypothesis, not a proven internal P2028 subtype. Upload-first remains untested.

The uncommitted timeout correction exports `IMPORT_TRANSACTION_TIMEOUT_MS = 15_000` and passes it only to the interactive transaction inside `executeImportPlanAtomically`. The prior callback used Prisma's documented 5,000 ms interactive-transaction default; `maxWait` remains omitted and therefore retains its documented 2,000 ms default. Fifteen seconds is a bounded operational allowance for the existing multi-round-trip remote sequence, not evidence that imports should normally consume fifteen seconds. No global Prisma option, retry, elapsed-duration log, query, write shape, lock, schema, migration, input bound, authorization decision, reconciliation behavior, response, or rollback behavior changes. Keep PR #12 Draft; after review, commit, and a new isolated Preview deployment, exactly one fresh manual Preview import probe remains pending before any upload-first probe.

The eight-case PostgreSQL-engine suite now runs only through the committed bootstrap command recorded in `docs/SECURITY_PHASE_1D_B1_REPORT.md`. The bootstrap ignores external database targets, reserves a random loopback port, directly owns a fresh in-memory PGlite child, verifies pinned package/server output plus read-only PGlite identity and freshness before DDL, applies all 16 current immutable migrations in order, verifies later schema effects, runs Vitest, and tears down its child/temp files in `finally`. Vitest independently requires the enable flag, exact confirmation, `NODE_ENV=test`, loopback, PGlite runtime identity, forbidden-target rejection, and empty application tables. Fixtures use a random per-run `epit-<uuid>` prefix; cleanup targets only matching user/batch/pack/source/topic/problem ownership plus child rows reached through matching problem/topic IDs. Read-only post-cleanup scans require every application table to be empty and never delete an unexpected row. No unscoped cleanup or manual fixed-port server is permitted.

H-11 remains **Partially remediated**. No schema or migration changed and no historical data was rewritten. Writing retention/deletion, account deletion/anonymization, general retention, historical contest/submission/audit rows, portable encryption, provider deletion, and plaintext contest codes at rest remain separately governed work. Repository tests use mocked collaborators/pure production helpers plus a separately gated eight-case isolated PGlite PostgreSQL-engine suite. That embedded engine is not separately installed PostgreSQL-server, pooler, timeout, or managed-provider evidence, and there is no new Preview/Production evidence for Phase 1D-B1.

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
- The Phase 1C-A forward migration downgrades all legacy teacher-role users to `STUDENT`, recreates only the `Role` enum, and preserves all classroom/assignment tables, rows, IDs, and foreign keys. It is applied in isolated Preview and Production and is immutable.
- The migration is explicitly transactional. Any future SQL correction requires a new additive migration; do not edit, rename, squash, or regenerate the applied Phase 1C-A migration.
- `ADMIN` users are global editorial peers. `Contest.createdById`, `ContentPack.importedById`, `ImportBatch.userId`, reviewer IDs, and similar fields are attribution rather than ownership boundaries.
- `OWNER_EMAIL` grants the same content-admin access as `ADMIN`; it is not a database role or super-admin tier.
- `/admin/layout.tsx` guards the complete admin page subtree, while every Server Action and Route Handler retains its own guard.
- Admin APIs return generic JSON 401/403 decisions and do not use redirect-style authorization.
- Classroom/assignment pages and UI components were removed. Legacy action names and the assignment API are safe not-found tombstones with no Prisma mutation path.
- `/api/submissions` remains the active independent-practice `SINGLE_PROBLEM` submission path; only `/api/assignments/[id]/submit` is retired. The seed no longer recreates classroom or assignment fixtures.
- Portable import is operator-level tooling. Explicit `ADMIN` remains or assigns `ADMIN`, legacy `TEACHER` becomes `STUDENT`, and unknown roles are rejected. The selected input-directory argument is now correctly used when resolving the fixed internal import-step filenames; this has pure helper coverage but no end-to-end import run.
- Phase 1C-B is merged and deployed: contest/problem child IDs are parent-bound, publish boundaries are serialized, and bulk/import mutations are atomic or explicitly per-file partial. H-05/H-06 are remediated, merged, deployed, and verified on selected Production paths; real PostgreSQL race/concurrency/rollback/duration evidence remains Test debt.

### Phase 1C-A Production reconciliation (owner-attested 2026-07-14)

- PR #6 merged at `df89089c89e56abed1feb0ab0569e77656d51598`. That merge commit was deployed to Vercel Production, and the canonical Production deployment reached READY.
- Before migration, Production aggregates were `storedAdminCount=1` and `legacyTeacherCount=0`; `OWNER_EMAIL` was configured and resolved to a current user; `usableAdministratorRemains=true`.
- Production reports all 16 migrations applied and Prisma schema up to date. `20260713160000_phase1c_a_role_policy` is applied and immutable.
- After migration, Production roles were `ADMIN=1` and `STUDENT=1`, with `unexpectedRoleCount=0` and `storedAdminCount=1`. `OWNER_EMAIL` still resolved to a current user and `usableAdministratorRemains=true`.
- Temporary Production credentials used for verification were cleared from the PowerShell process and clipboard. No credential or identity is recorded here.
- Production health returned HTTP 200 with database connected. Retired assignment API GET/POST returned generic 404; owner sign-out/sign-in and `/admin` access passed; an ordinary student was denied; and independent single-problem submission/persistence passed.
- Basic contest, diagnostic, and Writing smoke checks passed. This is not comprehensive authorization, persistence, concurrency, or security evidence for those flows.
- Checked Production logs reported no runtime error or sensitive value.
- An initial read-only aggregate preflight and migration-status check was recognized as targeting isolated Preview/nonproduction. It performed no mutation and was discarded as Production evidence. The correct Production target was then selected and independently verified before migration.
- The prior Preview verification remains valid dated history. At this 2026-07-14 Phase 1C-A checkpoint, Production success did not itself close H-05/H-06. The later Phase 1C-B reconciliation below records their subsequent merge, deployment, and selected Production verification. Private-contest smoke, PostgreSQL concurrency/rollback/locking/duration evidence, and the other unresolved findings remain pending.
- No claim is made that backup/export completed or that role-management writes were paused; those facts were not supplied as operational evidence.

## Phase 1C-B Parent Binding And Atomic Admin Mutations

- PR #8 is merged at `e17105e6e65d30a009dffd56fe20d29d3ca69bd1`. Owner-attested evidence dated 2026-07-17 records that the merge commit reached READY in Production and became the canonical Production deployment.
- Global `ADMIN` and `OWNER_EMAIL` peer policy is unchanged; no creator ownership was introduced.
- Contest section/question create, update, and delete paths lock the claimed contest and scope child IDs through actual relations. Cross-parent and missing resources use the same generic unavailable result.
- Contest publication locks the contest, validates schedule/sections/questions, and transitions status within one transaction. Builder metadata/archive and legacy contest problem replacement use the same parent lock discipline; learner contest-attempt locking remains unchanged.
- Problem/question editing locks the problem, rejects duplicate/foreign question IDs before writing, preserves omitted questions, and commits content, lifecycle, and audits together.
- Every Phase 1C-B mutation transaction locks/reloads the current user and reapplies the `ADMIN`/normalized `OWNER_EMAIL` policy before parent/resource locks. Principal, parent, then deterministic-child lock order is documented; outer action/API guards remain.
- Single/bulk problem status, QA-safe/error bulk flows, diagnostic eligibility, source/topic audit writes, and content-pack archive are atomic. Bulk status is limited to 50 unique problems and 1,000 related questions, rechecks pack membership where applicable, and uses set-based writes with lifecycle-only audit payloads.
- JSON/CSV parsing and validation stay outside the content transaction. Normalized commit limits are 25 problems, 250 questions, 100 topic associations, 50 unique topics, and 25 unique sources. Invalid/oversized plans create no content.
- Multi-file packs store an ordered durable plan whose entries and linked batches carry a server-derived entry key, normalized filename, import type, ordinal, and SHA-256 of exact UTF-8 content. Every occurrence of a duplicate normalized filename is rejected before content import; reconciliation consumes one exact batch per entry, refuses duplicate imported identities, and never counts failed entries.
- The internal exact-plan `resumeContentPackId` primitive is runtime-tested with mocked collaborators, but no active API, Server Action, or UI exposes it. Normal HTTP retry creates a new pack. Authenticated operational recovery and real concurrent exactly-once behavior remain future work/Test debt.
- No schema or migration changed, and no Phase 1C-B migration exists or was required. All applied migrations remain immutable.
- Runtime tests use production helpers/orchestrators with mocked transaction and repository collaborators. Simulated rollback is callback evidence only; static structure tests remain labeled static. Real PostgreSQL lock, race, rollback, timeout, duration, and contention tests remain Test debt.
- The corrected suite contains 320 tests: 206 runtime/helper/handler/action/orchestrator tests, 8 simulations, 106 static checks, and zero PostgreSQL integration tests. Final correction-pass command results are recorded in `docs/SECURITY_PHASE_1C_REPORT.md`.

### Phase 1C-B isolated Preview reconciliation (owner-attested 2026-07-17)

- Commit `8f1073a0638b4de24923adc9c537b1e0f348228f` reached READY with database connected. The tested unauthenticated admin API request returned 401; owner-equivalent access passed and an ordinary `STUDENT` was denied.
- Valid contest edit/publication and problem/question edit with lifecycle propagation passed.
- An exact duplicate pack was rejected with zero content writes. Case-only duplicate filenames were rejected while one distinct file imported exactly once. A normal unique pack produced the expected totals.
- A manifest-only/zero-entry submission was blocked by the UI with zero content writes.
- Independent practice and basic contest, diagnostic, and Writing regression smoke passed. Checked runtime logs reported no runtime errors or sensitive values, and the Git worktree was clean.

### Phase 1C-B selected Production reconciliation (owner-attested 2026-07-17)

- Production health passed with database connected. The tested unauthenticated admin multi-file commit request returned 401.
- Owner sign-out/sign-in and admin access passed; an ordinary `STUDENT` was denied.
- Valid low-risk contest and problem/question mutations passed and were successfully restored.
- Independent-practice submission/persistence and basic contest, diagnostic, and Writing regression smoke passed.
- Checked runtime logs reported no runtime errors or sensitive values.

Duplicate/identity testing was not repeated in Production. The Production mutations were valid low-risk checks followed by restoration; regression checks were basic smoke; and log review covered only the checked deployment/time window. No comprehensive authorization, concurrency, rollback, timeout, deadlock, exactly-once, hostile-origin, PostgreSQL integration, or Production content-pack recovery test is claimed. H-09, H-11, random-email authentication amplification, four moderate dependency advisories, and private-contest Production smoke remain unresolved/outstanding. H-10 has a later Phase 1D-A merged remediation with isolated Preview and selected Production reconciliation below. Authenticated content-pack recovery and ongoing runtime-log monitoring remain operational requirements.

## Phase 1D-A Diagnostic Answer Exposure — Merged With Selected Production Checks Passed

- PR #10 merged into `main` at `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59`. H-10 is remediated in repository code, and owner-attested evidence records that this merge commit became the canonical READY Production deployment. Isolated Preview sentinel verification also passed for the tested boundaries at code commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b`.
- Central learner DTOs now positive-allowlist question presentation, submission results, diagnostic attempt summaries, and finalized diagnostic results. Prisma records are mapped inside Server Components or server-only selectors before learner Client Component/API/RSC boundaries.
- Learner options contain only `id` and display `text`. Canonical answers, accepted answers, model answers, corrections, explanations, raw metadata/options, and scoring configuration are excluded. Fixed Vietnamese feedback depends only on `isCorrect`.
- `/problems/[slug]`, `/practice/random`, `/diagnostic/start`, `/diagnostic/result`, `/api/submissions`, and `/api/practice/random` use the safe mappings. Learner analytics, skill analytics, wrong-question review, and contest-result review no longer render canonical answers or stored answer-bearing feedback.
- Diagnostic presentation and scoring selects are separate. Scoring still loads answer/explanation server-side, derives correctness and weighted profiles on the server, uses the existing ownership predicate, transaction, conditional `IN_PROGRESS` winner, and replay guard, and now returns `void`.
- Newly finalized `recommendationJson` retains only question/problem/skill/difficulty/correctness plus aggregate scoring metadata. No historical row cleanup or rewrite was performed. Historical JSON can still contain server-side legacy answer data; learner parsing ignores it through positive allowlists.
- Result reads require attempt ID plus current user ID, finalized `COMPLETED`/`NEEDS_REVIEW` status, and non-null completion. The DTO mapper independently enforces both finalized status and non-null `completedAt`; `getLatestFinishedDiagnosticAttempt` now uses the same completion predicate. Missing, foreign, incomplete, abandoned, and stale/disallowed attempts share the unavailable path.
- A runtime test imports and invokes the real diagnostic result page. With `requireUser`, result selectors, recommendations, and `redirect` mocked, stored-ADMIN, owner-shaped STUDENT, and ordinary-STUDENT fixtures are scoped only by `requireUser().id`; query `userId`/`ownerId` values cannot select another learner. This is not cookie/session integration, and the owner-shaped fixture does not independently verify `OWNER_EMAIL` matching; existing content-admin policy tests remain that evidence.
- Admin problem editor/preview behavior remains separate and answer-complete through a server-only admin mapper. STUDENT/ADMIN/OWNER_EMAIL policy is unchanged.
- Operator-only portable export remains outside learner boundaries and may contain historical server-side diagnostic/contest data. No export was run and historical rows were not rewritten during Phase 1D-A.
- No Prisma schema change or migration was required or created.
- Runtime coverage uses production DTOs, handlers, selectors, scoring, and actions with mocked Prisma/collaborator boundaries. Static checks are explicitly labeled static. Browser/RSC sentinel inspection passed only as owner-attested isolated Preview operational evidence; real PostgreSQL integration remains Test debt.
- The complete correction-pass suite has 366 tests: 242 runtime/helper/handler/action/page tests, 8 simulations, 116 static checks, and zero PostgreSQL integration tests. Final command results are recorded in `docs/SECURITY_PHASE_1D_A_REPORT.md`. No npm audit is part of this correction pass; the prior offline zero result is not authoritative, and the four documented moderate advisories remain unresolved.
- The focused report is `docs/SECURITY_PHASE_1D_A_REPORT.md`. H-09, H-11 at-rest storage, random-email authentication amplification, four moderate dependency advisories, private-contest smoke, PostgreSQL concurrency/rollback/recovery Test debt, synthetic Preview fixture-cleanup confirmation, and ongoing runtime-log monitoring remain unresolved or outstanding.

### Phase 1D-A isolated Preview reconciliation (owner-attested 2026-07-17)

- At this historical Preview checkpoint PR #10 was Draft/open. It subsequently merged as recorded above and in the Production reconciliation below.
- Commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b` reached READY in isolated Preview, and health passed with the database connected.
- A missing-Origin POST was rejected with 403 by the origin guard. A same-origin unauthenticated submission was rejected with 401 by authentication.
- Anonymous published-problem HTML/RSC and diagnostic-start HTML/RSC contained neither synthetic canonical-answer nor explanation sentinel.
- Authenticated single-problem and random-practice responses contained only safe result fields and fixed generic feedback.
- Diagnostic-result HTML/RSC contained neither sentinel and remained aggregate-only. Foreign and incomplete diagnostic attempts followed the unavailable flow.
- Authorized admin preview retained answer/explanation access, while ordinary `STUDENT` admin denial passed.
- Checked Preview runtime logs reported no runtime errors or sensitive values.
- Sentinel values were synthetic and non-sensitive; their exact values are not recorded. No account identity, cookie, deployment ID, infrastructure hostname, database identifier, or protected URL is recorded.
- Browser/RSC inspection was owner-attested operational evidence, not a repository test; browser automation is not claimed. PostgreSQL integration, transaction/concurrency verification, database-row inspection, and historical-row cleanup are not claimed. Production deployment and selected verification occurred later and are recorded separately below.
- Synthetic Preview fixture cleanup was not reported.

### Phase 1D-A selected Production reconciliation (owner-attested 2026-07-17)

- PR #10 is `MERGED`. Merge commit `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59` became the canonical READY Production deployment, and its deployment source was confirmed separately because the Vercel CLI did not report commit metadata.
- Health returned HTTP 200 with the database connected. No deployment ID, infrastructure hostname, protected URL, or provider-internal identifier is recorded.
- A missing-Origin submission POST returned 403 at the origin guard; a separate same-origin unauthenticated submission returned 401 at authentication.
- Existing published-problem HTML/RSC contained none of the tested forbidden answer-key tokens. Authenticated single-problem and random-practice responses contained only expected safe fields and fixed generic feedback.
- Diagnostic start/result remained learner-safe and aggregate-only; a nonexistent/incomplete own diagnostic attempt followed unavailable behavior. Analytics, skill analytics, wrong-question review, and contest-result review exposed no canonical-answer fields.
- Authorized admin preview retained answer/explanation access. Owner sign-out/sign-in and admin access passed, and ordinary `STUDENT` admin denial passed.
- Independent-practice write/persistence and basic contest, diagnostic, and Writing regression smoke passed.
- Checked runtime logs reported no runtime errors or sensitive values within the checked deployment/time window. Git branch/status was `main`/clean at the operational checkpoint.
- Production used no synthetic sentinel fixtures, so Production sentinel verification is not claimed. Its HTML/RSC evidence was structural forbidden-token inspection and is weaker than isolated Preview sentinel evidence.
- No comprehensive browser automation, security testing, hostile-origin testing, concurrency, rollback, timeout, exactly-once behavior, PostgreSQL integration, database-row inspection, or historical-row cleanup is claimed. The contest/diagnostic/Writing checks were regression smoke only.
- No Production schema migration was needed or run for Phase 1D-A. H-11 and dependency-advisory remediation are not claimed.
- The Production documentation reconciliation used supplied owner-attested facts only; it did not access a database, environment value, endpoint, browser, logs, GitHub, Vercel, Neon, or another provider and did not modify PR/provider state.

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
