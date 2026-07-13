# Englishphile Security Phase 1C-A Report

**Date:** 2026-07-13
**Branch:** `security-phase-1c-admin-authorization-idor`
**Base commit:** `a887b6f3d2a07f464aa2f3a2a2123f6b095b35ff`
**Scope:** Role policy, content-admin authorization, admin guard consistency, and classroom/assignment application decommissioning
**State:** Phase 1C-A is committed at `5a17d56`; owner-attested Preview verification is recorded below; migration applied in isolated Preview only and immutable; Production unchanged and pending

## Evidence boundary and Preview reconciliation

Repository evidence confirms the committed role policy, authorization helpers, admin layout/API wiring, retired-feature tombstones, independent-practice persistence path, tests, and migration SQL. It does not independently establish GitHub/Vercel state, deployed environment configuration, database contents, HTTP results, or runtime logs.

The following operational facts are owner-attested evidence dated 2026-07-14. This reconciliation did not query GitHub or Vercel, access a database, inspect environment values, or invoke an endpoint:

- PR #6 remains open and Draft, and GitHub/Vercel checks passed.
- The Phase 1C-A application was deployed to an isolated Vercel Preview. Production application code and Production database remain unchanged by Phase 1C-A.
- The isolated Preview database reports all 16 migrations applied and Prisma schema up to date. Migration `20260713160000_phase1c_a_role_policy` is applied in Preview only, remains unapplied in Production, and is now immutable.
- The Preview role postflight found two `STUDENT` rows, no stored `ADMIN`, and no unexpected role. The configured `OWNER_EMAIL` resolved to a current Preview user, so a usable content administrator remained without recording an identity.
- Post-migration health reported database connected. Owner sign-out/sign-in and content-admin access to `/admin` passed, while an ordinary `STUDENT` was denied.
- Retired classroom, assignment, teacher, and grading page routes returned not found. Retired assignment API GET and POST returned the generic application HTTP 404.
- Independent single-problem practice submission and persistence passed.
- Checked Preview runtime logs contained no reported Prisma enum error, database-authentication error, unexpected HTTP 500, or sensitive value.

Initial direct `Invoke-WebRequest` observations did not reach the application because Vercel Deployment Protection intercepted them: GET followed Vercel authentication and appeared as HTTP 200, while POST was blocked by Vercel with HTTP 401. Those observations are invalid application tests and are not application security defects. Corrected tests used authenticated Vercel CLI protection bypass and reached the application, which returned the expected generic HTTP 404 for both GET and POST.

During manual Preview setup, a Preview-only non-production database credential was inadvertently exposed in terminal/chat input. The owner immediately treated it as compromised, rotated it, updated Preview `DATABASE_URL` and `DIRECT_URL`, removed the old value from PowerShell history and clipboard, and subsequently validated the rotated credential through successful Preview health and migration operations. Production variables were unchanged. The incident is operationally remediated with no remaining repository action indicated.

## Selected product policy

Englishphile is an independent-practice platform. The supported principals for this phase are:

- `STUDENT`: normal learner; no `/admin` or retired classroom/assignment management access.
- `ADMIN`: global content administrator for the shared editorial corpus.
- `OWNER_EMAIL`: not a database role. A current database user whose normalized email matches the server configuration receives the same content-admin access as `ADMIN`.
- Cron/service: separate bearer identity for the cleanup scheduler; unchanged.

There is no teacher role, classroom product workflow, owner role, or super-admin tier. ADMIN-to-ADMIN content mutation is intentional. `Contest.createdById`, `ContentPack.importedById`, `ImportBatch.userId`, `reviewedById`, and comparable fields record attribution and audit history rather than ownership.

## Authorization implementation

`src/lib/auth/content-admin-policy.ts` is the pure production policy boundary. It normalizes owner email matching with trimming and lowercase comparison, accepts stored `ADMIN`, accepts an owner-email-matching `STUDENT`, and rejects missing or ordinary student identities.

`getCurrentUser()` remains the principal source. The signed session payload stores only `userId` and `expiresAt`; role and email are selected from the current `User` row on each request. Client-supplied role, email, owner flag, and user ID do not participate in authorization.

`requireContentAdmin()` is the explicit page/action helper. `requireAdmin` remains as a documented compatibility alias so existing Server Actions retain their local guard without broad unrelated churn. Its semantics are now unambiguously content-admin semantics and contain no teacher branch.

`requireContentAdminApi()` reloads the current user and returns a generic JSON-safe decision:

- missing/deleted/invalid session user: HTTP 401 with `{"error":"Không có quyền truy cập."}`;
- authenticated non-admin student: HTTP 403 with the same generic body;
- stored `ADMIN` or owner-email match: authorized user object from the database.

The five admin Route Handlers use this shared decision before rate-limit bucket mutation. Origin validation remains present for unsafe methods, resource parsing occurs only after authorization, and fail-closed database rate-limit behavior is unchanged. The contest XLSX parser no longer calls a redirecting page helper.

`src/app/admin/layout.tsx` guards the entire admin page subtree, including `/admin/contests-builder/import`. Existing page checks and all action-local checks remain defense in depth; the layout is not treated as a Server Action or Route Handler authorization boundary.

## Role migration

The new forward migration is:

`prisma/migrations/20260713160000_phase1c_a_role_policy/migration.sql`

It wraps the complete enum replacement in an explicit PostgreSQL `BEGIN`/`COMMIT` transaction and performs these operations in order:

1. Updates all `User.role = 'TEACHER'` rows to `STUDENT`.
2. Drops the `User.role` default.
3. Renames the old PostgreSQL `Role` enum.
4. Creates a new `Role` enum containing only `STUDENT` and `ADMIN`.
5. Converts `User.role` through text to the new enum.
6. Restores the `STUDENT` default.
7. Drops only the obsolete enum type.
8. Commits only after the new type and default are fully installed.

Repository inspection found `User.role` is the only column using the PostgreSQL `Role` enum. `ClassroomRole` is a separate retained enum and is not changed. The migration contains no `DROP TABLE`, no `CASCADE`, and no classroom/assignment delete. All user IDs, sessions, classroom rows, membership rows, assignment rows, assignment submissions, manual grades, and foreign keys are preserved.

The least-privilege downgrade is deterministic for any number of legacy rows. The enum conversion and default changes require a lock on `User`; the deployment window must pause role-management writes and should be kept short. An error rolls the complete migration back instead of leaving a renamed enum or missing default. The 2026-07-13 implementation pass did not deploy or runtime-test the migration. Owner-attested evidence dated 2026-07-14 now records successful execution in isolated Preview only. Production lock duration and migration behavior remain unverified.

## Portable role compatibility

`parsePortableUserRole()` implements the portable boundary:

- `STUDENT` remains `STUDENT`;
- `ADMIN` remains `ADMIN`;
- legacy `TEACHER` input becomes `STUDENT`;
- every unknown value is rejected rather than mapped to `ADMIN`;
- only an explicit supported `ADMIN` value remains `ADMIN`; legacy `TEACHER` never becomes `ADMIN`.

Portable export also normalizes any legacy value to `STUDENT`, so new bundles emit only supported roles. The portable importer is an operator-level database tool, not an HTTP authorization path. During an authorized operator-run import, an explicit `ADMIN` bundle value can preserve or assign `ADMIN` to the target account; this is not an unprivileged user-controlled promotion path. Export and import warnings use aggregate downgrade counts only. Row error logging uses file name and ordinal rather than imported email, user ID, raw row data, or the underlying error value.

The committed importer also corrects a real input-directory bug. `readJson(directory, filename)` previously received the step filename in both positions, which attempted to read from a directory named after each file. It now uses the operator-selected `opts.inputDir` as the first argument. The fixed filenames come from the internal `importSteps` list. Production code resolves them through a pure helper that rejects absolute and nested names; focused non-database runtime tests cover selected-directory resolution and rejection of traversal/absolute names. No import command or end-to-end import was run by the implementation or reconciliation passes.

The application HTTP signup path continues to derive `STUDENT` server-side and never accepts a client role.

## Classroom and assignment decommissioning

Deleted application pages cover all teacher dashboards, classroom lists/details/join, assignment builder/detail/result/analytics, student detail, and grading pages. Assignment UI builder/runner components and the legacy classroom permission, teacher analytics, and manual-grading mutation libraries were also removed.

Legacy Server Action exports remain as compatibility tombstones. Each immediately invokes the centralized server-only not-found boundary and imports no Prisma repository. This covers class creation/update, join-code regeneration, classroom join, assignment creation/status mutation, and manual grading.

The former assignment submission Route Handler exposes generic JSON 404 responses for GET, POST, PUT, PATCH, and DELETE. It performs no authentication disclosure, request parsing, answer checking, rate limiting, or database mutation because the feature is unavailable for every principal, including `ADMIN` and `OWNER_EMAIL`.

Student analytics no longer query active assignments or classroom membership. Historical `ManualGrade` rows can still influence previously recorded submission analytics, but no application grading surface can create or modify them.

`POST /api/submissions` is not an assignment endpoint. It remains the active independent single-problem submission path and continues to create `Submission`/`SubmissionAnswer` records, update `UserProblemStatus`, and complete matching learning recommendations. Only `POST /api/assignments/[id]/submit` is retired. Contest attempts, diagnostic attempts, Writing submissions, random practice, profiles, streaks, achievements, and non-classroom analytics remain active.

The seed no longer creates classroom, assignment, assignment-submission, or assignment/problem-link fixtures. It retains independent `SINGLE_PROBLEM` demo submissions and progress. The seed was inspected only and was not run.

No navigation link, dashboard card, public page, redirect, builder component, or active route exposes a teacher, classroom, join-code, assignment, assignment-submission, or grading workflow.

## Test classification

Runtime tests import production helpers, actual safe Route Handlers, and actual Server Action tombstones and cover:

- stored `ADMIN`, owner-email `STUDENT`, ordinary `STUDENT`, nonmatching email, empty owner configuration, and missing user decisions;
- trimmed and case-insensitive owner matching;
- the actual API guard's distinct 401/403 statuses, shared generic JSON body, database-loaded caller boundary, and absence of redirect results;
- portable `STUDENT`/`ADMIN` preservation, legacy downgrade, unknown-role rejection, and the rule that only explicit `ADMIN` remains `ADMIN`;
- portable selected-directory path resolution and traversal/absolute-name rejection through the production pure helper;
- retired feature denial for anonymous, student, admin, and owner-like principals;
- the actual assignment submission Route Handler returning 404 without parsing a request body;
- the actual join, assignment, classroom, and manual-grade Server Action tombstones terminating at the mocked retired-feature boundary;
- the actual independent-practice submission Route Handler reaching mocked `Submission`, `UserProblemStatus`, and recommendation repositories with `SINGLE_PROBLEM` semantics;
- production contest-attempt, diagnostic-attempt, and Writing-finalization functions reaching mocked persistence inside their real transaction control flow;
- deployment preflight acceptance only when a stored admin exists or the configured owner email resolves to a current user.

Static tests are explicitly labeled static and cover:

- explicit migration transaction boundaries, enum ordering, default restoration, no `DROP TABLE`, no `CASCADE`, and no classroom/assignment mutation;
- Prisma user-role enum contents and retained legacy models;
- admin layout wiring;
- current-user database role/email reload and absence of cookie role claims;
- shared JSON API guard wiring before database rate limiting;
- retained action-local guards;
- absence of a teacher-role privilege branch;
- source-level absence of Prisma and removed grading/classroom mutation imports in retired action/API tombstones, deleted retired pages, no retired seed fixtures, and unchanged contest/diagnostic/Writing persistence wiring.

These tests are not PostgreSQL integration tests. Owner-attested Preview migration execution verifies the tested operational path but is not general PostgreSQL authorization, race, lock-duration, rollback-failure, or concurrency integration evidence.

The final suite contains 235 tests: 134 runtime tests that import production helpers, handlers, actions, parsers, or persistence functions (with mocked collaborators where stated); 8 simulated resource-limit calculations that do not invoke a production enforcement boundary; and 93 static source/structure checks. The runtime category is not database integration evidence.

## Finding status

- Teacher-role global-admin overprivilege: **Remediated in code and verified in isolated Preview; Production deployment pending.**
- Missing admin import page guard: **Remediated in code and verified through Preview admin access boundaries; Production deployment pending.**
- Classroom/assignment attack surface: **Decommissioned in code and smoke-tested in Preview; Production deployment pending.**
- Phase 1C-A migration: **Applied in isolated Preview; unapplied in Production; immutable.**
- Admin-lockout protection: **Passed in Preview through a current `OWNER_EMAIL` match; Production aggregate preflight remains required.**
- H-05: **Partially remediated / policy clarified.** Shared global contest editing is intended; cross-parent contest/section/problem/question binding and publish TOCTOU remain.
- H-06: **Partially remediated / policy clarified.** Shared global content editing is intended; cross-parent nested IDs and bulk/TOCTOU transaction boundaries remain.
- PostgreSQL integration: **Preview migration execution is operational evidence; real authorization/concurrency integration remains Test debt.**
- H-09, H-10, H-11: **Unresolved.**
- Random-email authentication amplification: **Unresolved.**
- Dependency advisories: **Unresolved.**
- Private-contest Production smoke: **Operational requirement; not claimed.**

Phase 1C-B must bind every nested contest/problem/question mutation to the supplied parent, use scoped atomic mutations where sufficient, close publish read-check-write races, and make authorization-sensitive bulk mutations transactional. Phase 1C-A does not claim those defects are fixed.

## Required production order

Preview success does not satisfy the Production gate. Production must still follow this order:

1. Confirm Production backup/export.
2. Run aggregate-only counts for stored `ADMIN` and legacy teacher roles.
3. Confirm configured Production `OWNER_EMAIL` resolves to a current user without printing the identity.
4. Stop unless a stored `ADMIN` or matching owner user remains usable.
5. Pause role-management writes.
6. Apply the immutable Phase 1C-A migration through Production `DIRECT_URL`.
7. Verify Production migration status.
8. Deploy the merged application immediately.
9. Verify `STUDENT`, `ADMIN`, and `OWNER_EMAIL` behavior.
10. Verify retired routes cannot mutate.
11. Verify independent practice and global content administration.
12. Inspect Production runtime logs without recording sensitive values.

The short migration-to-code window should be minimized. The previous application contains references to the removed enum value in legacy feature paths, so role-management and legacy routes must remain quiescent until the new application is deployed.

The owner-run preflight can use aggregate queries equivalent to the following through approved operational tooling; `$1` represents the configured owner value and must not be printed or persisted in command history:

```sql
SELECT "role"::text AS role, COUNT(*)::bigint AS count
FROM "User"
WHERE "role" IN ('ADMIN', 'TEACHER')
GROUP BY "role"::text;

SELECT COUNT(*)::bigint AS configured_owner_user_count
FROM "User"
WHERE LOWER(BTRIM("email")) = LOWER(BTRIM($1));
```

The deployment is allowed only when `ADMIN count > 0 OR configured_owner_user_count > 0`; it must also record the aggregate legacy count and confirm that the downgrade will not remove the last usable content administrator.

## Historical implementation-pass local verification

The 2026-07-13 implementation/integrity pass completed these local non-database checks. They are retained as historical repository evidence and are separate from the owner-attested Preview evidence above:

- `npx.cmd prisma validate`: passed; schema valid; Prisma package-configuration deprecation warning only.
- `npx.cmd prisma generate`: passed; Prisma Client 6.19.3 generated.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed with no warnings.
- `npm.cmd test`: passed, 13 files and 235 tests (134 runtime, 8 simulated, and 93 static).
- `npm.cmd run build`: passed; Next.js 16.2.10 compiled and generated all 63 static entries. Retired teacher/classroom/assignment pages are absent from the route table; the assignment API 404 tombstone remains intentionally present, and independent submission, contest, diagnostic, random-practice, and Writing routes remain present.
- `npm.cmd audit`: exited 1 with four moderate transitive advisories (`postcss` through Next.js and `uuid` through ExcelJS).
- `npm.cmd audit --omit=dev`: exited 1 with the same four moderate advisories.

No automated audit fix was run because the suggested forced resolutions are breaking dependency changes. At that time, no database or deployed endpoint was tested. The later Preview-only operational evidence is recorded above; Production migration/runtime behavior remains unverified.

## Documentation-reconciliation local verification (2026-07-14)

This documentation-only reconciliation reran the required local checks against commit `5a17d56` plus the documentation changes:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed with no warnings.
- `npm.cmd test`: passed, 13 files and 235 tests. The classification is unchanged: 134 production runtime/helper/handler tests with mocked collaborators where stated, 8 simulations, 93 static checks, and no PostgreSQL integration test.
- `npm.cmd run build`: passed with Next.js 16.2.10 and 63 generated page-data entries. Its configured build script performed Prisma Client generation only; no migration command or database operation ran.
- `npm.cmd audit`: exited 1 with the same four moderate transitive advisories (`postcss` through Next.js and `uuid` through ExcelJS).
- `npm.cmd audit --omit=dev`: exited 1 with the same four moderate advisories.
- `git diff --check`: passed.

No audit fix was run. The audit result is unchanged and remains Unresolved.

## Safety boundary

The 2026-07-13 implementation pass did not access a database, apply or inspect migration status, run seed/backup/export/import, inspect environment values, invoke deployed endpoints, modify Vercel/GitHub configuration, deploy, commit, or push. Those statements remain historical facts about that pass.

This 2026-07-14 documentation reconciliation likewise does not access a database, run a migration command, change schema or migration files, run seed/backup/export/import, inspect environment values, invoke endpoints, query or modify GitHub/Vercel state, deploy, commit, or push. Its documentation changes remain uncommitted for owner review.
