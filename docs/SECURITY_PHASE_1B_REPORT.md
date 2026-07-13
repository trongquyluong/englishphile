# Englishphile Security Phase 1B Final Integrity Correction Report

**Repository:** Englishphile
**Branch:** `security-phase-1b-access-csrf-rate-limits`
**Correction date:** 2026-07-12
**Operational reconciliation date:** 2026-07-13
**Review state:** PR #2 merged into `main` at merge commit `45c551f`; deployed to Production
**Scope:** H-01, H-02, H-07, H-08, M-01, M-02, M-03, Writing quota integrity, replay protection, and authentication abuse controls

This report describes the Phase 1B implementation merged through PR #2 at merge commit `45c551f` and reconciles its operational status with owner-confirmed work completed on 2026-07-13. The repository supports the implementation and control-flow claims described below. Secret rotation, Vercel environment scopes, Neon project isolation, deployment state, runtime logs, and smoke checks are owner-attested dashboard or runtime evidence; this repository reconciliation did not independently query those platforms or access a database.

## Evidence boundary and operational reconciliation

Repository evidence confirms the PostgreSQL datasource, `SESSION_SECRET`-first compatibility behavior, `VERCEL_URL` origin fallback, Phase 1B migration file, security implementation, tests, and the absence of a configured cleanup scheduler in the branch. It does not reveal or verify deployed secret values or provider dashboard state.

Owner-attested evidence dated 2026-07-13 records that:

- production session, Gemini, and Neon role credentials were replaced; `AUTH_SECRET` was removed;
- the prior authenticated session was invalidated after a credential-rotation redeploy from the then-current pre-merge `main` branch, and a new sign-in succeeded;
- the old Gemini key was revoked after a successful credential-rotation Gemini check against the current production application;
- the credential-rotation redeploy from the pre-merge `main` branch completed successfully; `/api/health` returned HTTP 200 with `database=connected`; production sign-in, database reads, and a low-risk database write succeeded; and Vercel runtime logs showed no database authentication or Prisma connection errors;
- production reported all 15 migrations applied and the schema up to date;
- the independent `englishphile-nonprod` Neon project contains no production data, reported the same 15-migration chain applied, and reported its schema up to date;
- Production and Preview use distinct `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` values; Preview has no Gemini production key, no `AUTH_SECRET`, and no `NEXT_PUBLIC_APP_URL`, relying on `VERCEL_URL` for the exact deployment origin;
- the independent `englishphile-nonprod` project has a root branch named `production` and an isolated child branch named `preview`; Preview database connections target that non-production `preview` branch, not the Production Neon project;
- a synthetic Preview signup increased the User count only on the non-production `preview` branch while the production User count remained unchanged, verifying database isolation without copying production data;
- the earlier Preview deployment containing production values was deleted, Preview Deployment Protection is active, and the ignored `GEMINI_MODE` typo was removed;
- the isolated Preview redeploy passed health, signup/write, sign-out/sign-in, authenticated database-backed read, safe Gemini-unavailable behavior, and runtime-log review; GitHub PR checks also passed;
- Production variables were restored, and a subsequent credential-rotation Production redeploy from `main` passed health and sign-in checks;
- the active local clone is outside OneDrive, its local environment uses the independent non-production PostgreSQL project, and no production connection string was copied into the local environment; and
- PR #2 was merged into `main` at `45c551f`, and that merge commit was deployed to Vercel Production.

No secret value, connection string, password, token, hostname, cookie, deployment ID, or fabricated automated evidence is recorded here.

### Isolated Preview smoke evidence

Owner-attested browser, SQL-count, dashboard, runtime-log, and CLI results dated 2026-07-13 classify the isolated Preview smoke as **Passed**. `/api/health` reported the application healthy and database connected; signup and its database write succeeded; sign-out and sign-in succeeded; and an authenticated database-backed read succeeded. Gemini was unavailable safely because Preview intentionally has no `GEMINI_API_KEY`; this validates safe absence, not Gemini functionality. No database authentication error, Prisma connection error, or unexpected HTTP 500 was found in the newest tested Preview deployment logs.

The repository-only reconciliation did not access provider dashboards, inspect environment values, execute SQL, or connect to a database.

### Post-merge Production verification

Owner-attested deployment, browser, health, and runtime-log evidence dated 2026-07-13 records that merge commit `45c551f` was deployed to Production and `/api/health` returned HTTP 200 with the database connected. An initial authenticated Writing request was rejected by exact-origin validation because the deployed `NEXT_PUBLIC_APP_URL` did not match the canonical Production origin. This was an operational configuration mismatch, not a successful hostile-origin security test. The canonical Production origin configuration was corrected, remained Production-only, and Production was redeployed. A subsequent authenticated Writing submission succeeded and returned grading results.

Repository evidence in `src/app/api/writing/grade/route.ts` confirms that origin validation runs before authentication-dependent user/global rate limiting, quota reservation, `providerStartedAt` persistence, and Gemini execution. The rejected request therefore exited before limiter, quota, or provider execution and did not consume a Writing quota slot. The same route returns a successful Writing result only after authentication succeeds, both database limiters allow, a quota reservation is acquired, `providerStartedAt` is persisted, Gemini succeeds, and `WritingSubmission` plus the `COMPLETED` reservation transition are persisted atomically.

Owner-attested post-merge runtime-log review found no Prisma initialization, database authentication, database connection, limiter/quota infrastructure-error, unexpected persistence, or HTTP 500 issue for the checked Production deployment. This verification covers Production health and the tested authenticated Writing/Gemini path. No private-contest Production smoke was reported or is claimed.

## Recovery assessment

This was a continuation of an interrupted correction pass. At recovery time, the branch already contained 20 tracked modifications and three untracked paths: this report, the new Phase 1B migration directory, and `src/lib/security/`. The current working tree was treated as authoritative. No existing work was reset, restored, or discarded.

The interrupted tree already contained substantial implementation work:

- new Prisma models for rate buckets, contest access grants, and Writing reservations;
- a new additive Phase 1B migration, now owner-confirmed as applied in production and the independent non-production project;
- POST-based private-contest access instead of access codes in URLs;
- request-origin validation on unsafe Route Handlers;
- conditional contest and diagnostic finalization;
- a fixed dummy-password path for missing users;
- initial database rate-limit callers and Writing reservation code;
- partially rewritten security documentation.

The recovered implementation still had release-significant defects. The database limiter could reset and authorize an active full bucket, several callers still used the process-local Map, the three write-heavy learner APIs had no limiter, Writing states and cleanup columns were inconsistent, access-grant mutation coverage was incomplete, tests copied implementation logic, and the documentation overstated completion. This continuation corrected those defects without discarding the earlier work.

The final pre-commit verification then confirmed four narrower issues: contest start availability was not revalidated after locking, the UTC Writing day still crossed the JavaScript/PostgreSQL boundary as a timestamp, equal-millisecond post-mutation grants could be rejected, and the unused compatibility Map performed a full capacity scan. This correction pass added the locked decision, explicit UTC key, equal-time grant policy, and removed the unused Map. It also corrected the public-auth assessment: an email-only bucket does not prevent random-identifier amplification.

## Final status summary

| Finding or control | Status | Final assessment |
|---|---|---|
| C-00 credential rotation | Remediated | Owner-attested production session, Gemini, and database credential rotation plus successful post-rotation checks; not independently dashboard-verified by this repository pass |
| H-01 private contest brute-force protection | Remediated | Database-backed, atomic fixed-window limiter |
| H-02 access code in URL | Remediated | POST Server Action plus signed HttpOnly database grant |
| H-07 unsafe-request origin validation | Remediated | Exact origin or independent same-origin browser signal required |
| H-08 classroom join-code RNG | Remediated | `node:crypto` `randomInt()` |
| Writing daily quota integrity | Remediated | Five database slots per user per UTC day |
| Locked contest start availability | Remediated | Availability, content, and private access are revalidated under the locked current state before resume/create |
| Contest start/final-submit replay | Remediated | Advisory start serialization and conditional finalization |
| Diagnostic start/final-submit replay | Remediated | Advisory start serialization and transactional conditional finalization |
| Authentication missing-user work | Remediated | Fixed, valid dummy scrypt hash verified on missing-user path |
| Public authentication abuse controls | Partially remediated | Per-account atomic limiting exists, but no trustworthy client/network abuse dimension was established |
| Random-email auth bucket amplification | Unresolved | Unique attacker-chosen email digests can create distinct database rows indefinitely without scheduled cleanup |
| M-01 write-route abuse limiting | Remediated | All identified write-heavy learner routes use the database limiter |
| M-02 distributed enforcement | Remediated | Every current limiter caller is database-backed; the unused process-local helper was removed |
| M-03 process-local Map growth | Remediated | The unused compatibility Map was removed |
| H-05 contest admin ownership | Unresolved | Outside this correction pass and still open |
| H-06 content admin ownership | Unresolved | Outside this correction pass and still open |
| PostgreSQL concurrency integration | Test debt | No safe isolated PostgreSQL integration run was established |
| Cleanup scheduling | Operational requirement | Helpers exist; no cron, Vercel Cron, GitHub workflow, or package-script caller exists |
| Production Phase 1B migration | Applied | Owner-attested 15-migration production status and schema up to date; migration is immutable |
| Non-production migration chain | Applied | Owner-attested independent project with all 15 migrations and schema up to date |
| Production/Preview isolation | Verified | Owner-attested distinct database credentials and session secrets plus a synthetic write confined to the non-production `preview` branch; no production Gemini key in Preview |
| Credential-rotation production redeploy | Passed | Redeployed from the then-current pre-merge `main`; health, auth, database read/write, and Gemini checks validated rotated credentials before PR #2 merged |
| Phase 1B application deployment | Deployed | PR #2 merged into `main` at `45c551f`; owner attests that merge commit was deployed to Production |
| Preview database isolation | Verified | Owner-attested synthetic write changed only the non-production `preview` branch User count; production remained unchanged |
| Isolated Preview smoke | Passed | Owner-attested 2026-07-13 health, auth, read/write, safe Gemini absence, and runtime-log checks |
| PR #2 | Merged | Owner-attested PR state is `MERGED` |
| Post-merge Phase 1B Production verification | Passed | Owner-attested health and authenticated Writing/Gemini path after canonical-origin correction; repository evidence confirms the success-path ordering |
| Private-contest Production smoke | Not tested | No final Production private-contest smoke was reported; none is claimed |

## Atomic database rate limiter

`src/lib/security/rate-limit.ts` performs authorization with one parameterized PostgreSQL statement:

```sql
INSERT INTO "RateLimitBucket" (
  "action", "subject", "count", "windowStart", "expiresAt"
)
VALUES ($action, $subject, 1, $now, $expiresAt)
ON CONFLICT ("action", "subject") DO UPDATE
SET
  "count" = CASE
    WHEN "RateLimitBucket"."expiresAt" <= $now THEN 1
    ELSE "RateLimitBucket"."count" + 1
  END,
  "windowStart" = CASE
    WHEN "RateLimitBucket"."expiresAt" <= $now THEN $now
    ELSE "RateLimitBucket"."windowStart"
  END,
  "expiresAt" = CASE
    WHEN "RateLimitBucket"."expiresAt" <= $now THEN $expiresAt
    ELSE "RateLimitBucket"."expiresAt"
  END
WHERE
  "RateLimitBucket"."expiresAt" <= $now
  OR "RateLimitBucket"."count" < $limit
RETURNING "count", "expiresAt";
```

The actual implementation uses Prisma tagged templates; the variables above illustrate parameters and are not string concatenation.

Authorization properties:

- first use inserts count 1;
- active use increments only while count is below the policy limit;
- expired use resets the first request to 1;
- a second concurrent expired-window request observes the committed reset and increments to 2;
- an active full bucket returns no row and is denied;
- there is no later read that can change a denial into authorization;
- attempts 1 through `limit` are allowed and attempt `limit + 1` is denied;
- `(action, subject)` is the database uniqueness boundary, so actions and subjects remain isolated;
- policies require positive finite integers and bounded action/subject keys;
- results are discriminated as `allowed`, `rate-limited`, or `infrastructure-error`;
- database and validation failures do not authorize;
- sign-in and sign-up store SHA-256 account-identifier digests, not email addresses or credentials.

The runtime unit tests use the production rate-limit factory with a mocked atomic store. The PostgreSQL statement itself has static structural tests. Real PostgreSQL concurrency remains Test debt.

## Limiter callers and failure policies

| Caller | Policy | Subject | Failure policy |
|---|---:|---|---|
| Sign-up | 5/hour | hashed normalized email | Server Action temporary-failure or rate-limit redirect |
| Sign-in | 10/15 minutes | hashed normalized email | Server Action temporary-failure or rate-limit redirect |
| Private contest code | 5/15 minutes | user | one generic missing/wrong/limited/temporary redirect |
| Contest start | 6/10 minutes | contest + user | Server Action temporary-failure or rate-limit redirect |
| Contest submit | 8/10 minutes | contest + user | Server Action temporary-failure or rate-limit redirect |
| Diagnostic start | 6/10 minutes | user | Server Action temporary-failure or rate-limit redirect |
| Diagnostic submit | 8/10 minutes | user | Server Action temporary-failure or rate-limit redirect |
| Writing per user | 6/10 minutes | user | Route Handler: generic 503 or generic 429 |
| Writing global | 60/10 minutes | global marker | Route Handler: generic 503 or generic 429 |
| Contest XLSX parse | 10/hour | admin | Route Handler: generic 503 or generic 429 |
| Content-pack commit | 5/hour | admin | Route Handler: generic 503 or generic 429 |
| JSON/CSV validate | 30/10 minutes | admin | Route Handler: generic 503 or generic 429 |
| JSON/CSV commit | 12/10 minutes | admin | Route Handler: generic 503 or generic 429 |
| Content-pack validate | 30/10 minutes | admin | Route Handler: generic 503 or generic 429 |
| `/api/submissions` | 30/minute | user | Route Handler: generic 503 or generic 429 |
| `/api/practice/random` | 60/minute | user | Route Handler: generic 503 or generic 429 |
| `/api/assignments/[id]/submit` | 12/minute | user | Route Handler: generic 503 or generic 429 |

Server Action redirects are not HTTP 503 responses. Route Handlers explicitly return 503 for limiter infrastructure failure and 429 for rate-limit exhaustion.

The sign-in and sign-up subjects are hashes of normalized, attacker-controlled email input. The per-account limit is atomic and shared across instances, but an unauthenticated attacker can rotate random emails to bypass that dimension and create a new `RateLimitBucket` row for each subject. No trustworthy deployment-aware client identifier was established in this pass, so no proxy header was promoted to a security boundary and no small global bucket was added that could let one attacker lock out all users. Public authentication abuse controls are therefore **Partially remediated**, and unique-subject database amplification is **Unresolved** pending a multi-dimensional auth limiter in Security Phase 2.

The unused process-local compatibility helper `src/lib/rate-limit.ts` was removed. M-02 and M-03 are Remediated with respect to that historical Map; this is not a claim that the separate public-auth unique-subject risk is solved.

## Writing reservation lifecycle

The Writing quota uses five unique database slots per `(userId, quota_date)`. The production helper derives an explicit UTC `YYYY-MM-DD` key and every raw SQL insert, status query, and cleanup day comparison binds that key through a Prisma tagged parameter cast as `${quotaKey}::date`. It does not depend on a JavaScript timestamp being implicitly converted to PostgreSQL `DATE` under the session timezone. Slot acquisition uses parameterized `INSERT ... ON CONFLICT DO NOTHING RETURNING id`; it does not reinterpret infrastructure failures as quota exhaustion.

Lifecycle:

1. Authentication, origin validation, request parsing, prompt lookup, and word-count validation occur before reservation.
2. The route reserves one of slots 1 through 5 for the UTC quota day.
3. The route persists `providerStartedAt` while the reservation is still `PENDING`.
4. If that persistence fails, the route does not call Gemini and attempts a safe cancellation.
5. Gemini runs outside database transactions.
6. Provider success is followed by one short transaction that writes `WritingSubmission` and changes the reservation to `COMPLETED`.
7. Every provider-started failure, including network, provider throttling, content blocking, invalid response, and unexpected persistence failure, attempts to change the reservation to `FAILED` with `failureCode`.
8. If the failure-state write itself fails, the provider-started `PENDING` row remains conservatively occupied and non-reclaimable for that quota day.
9. Quota status counts every row for the UTC quota day regardless of `PENDING`, `COMPLETED`, or `FAILED`.

The sixth same-day reservation is denied. No `in quotaConsumingErrors` expression remains. A post-insert count cannot leak a slot because remaining capacity is derived conservatively from the acquired slot number rather than a fallible read after insertion.

## Access codes and grants

`constantTimeEquals()` now:

- bounds raw and normalized UTF-8 input to 128 bytes;
- normalizes both values consistently;
- copies each value into a fixed 128-byte buffer;
- always performs the fixed-size `timingSafeEqual()` for bounded inputs;
- separately requires original encoded lengths to match.

Therefore `"A"` and `"A\u0000"` cannot compare equal. Runtime tests import the production comparison helper and cover this regression.

Private access authorization is transactionally ordered:

- code verification and grant creation lock the current contest row with `FOR UPDATE`;
- all application/import code or visibility mutations update `accessCodeUpdatedAt` and delete existing contest grants in the same transaction;
- contest start obtains the signed grant ID, locks the current contest row, revalidates user, contest, expiry, mutation timestamp, and current visibility, and only then creates or resumes the attempt;
- an old-code authorization racing a mutation is either rejected after the mutation or its new grant is deleted by the later mutation;
- legacy editor updates, builder updates, and portable-import visibility updates all invalidate grants;
- a PRIVATE to PUBLIC to PRIVATE sequence cannot revive an earlier grant;
- grant validation rejects missing grants, wrong user, wrong contest, exact-expiry boundary, deleted contest, and grants created before the mutation timestamp;
- a grant created at the same millisecond as the mutation boundary is accepted; transactional grant deletion under the same Contest row lock is the authoritative revocation invariant, while the timestamp is a fallback for older rows;
- grant creation writes `createdAt` explicitly after acquiring the Contest lock instead of relying on PostgreSQL transaction-start time;
- required User and Contest foreign keys use cascade deletion.

The portable importer intentionally does not restore contest access codes from the portable bundle. Grant invalidation is correct, but a newly restored PRIVATE contest still requires an admin to configure a new code before learner use.

## Request-origin behavior

Unsafe Route Handlers call `validateRequestOrigin()` before cookie-authenticated mutation. The production decision helper is dependency-injected with normalized trusted origins and is runtime-tested.

- exact trusted origin: accepted;
- subdomain and host-suffix tricks: rejected;
- wrong scheme: rejected;
- wrong port: rejected;
- `Origin: null`: rejected;
- missing Origin plus `Sec-Fetch-Site: same-origin`: accepted as independent same-origin proof;
- missing Origin plus cross-site navigate: rejected;
- missing Origin without independent proof: rejected.

No wildcard credentialed CORS configuration was found.

## Cleanup race safety

All cleanup helpers use a batch limit of 500 and reassert eligibility in the modifying statement.

- Rate buckets: the outer delete rechecks `expiresAt < cutoff`, so a renewed bucket cannot be deleted.
- Access grants: the outer delete rechecks expiry.
- Writing unstarted rows: only expired `PENDING` rows with `provider_started_at IS NULL` are reclaimed.
- Writing provider-started rows: only prior-quota-day, expired `PENDING` rows are reconciled to `FAILED`.
- Writing archival: only prior-day `COMPLETED` or `FAILED` rows older than seven days are deleted.
- Writing maintenance statements run in one short database transaction.

Cleanup errors return zero and never authorize a protected request. No scheduler is configured, so invoking cleanup remains an Operational requirement. Without scheduling, distinct public account identifiers can accumulate database rate-bucket rows even though authorization remains fail-closed.

## Replay protection

### Contest

- attempt creation is serialized per contest/user with a parameterized PostgreSQL advisory transaction lock;
- the locked Contest query selects `contestType`, `status`, `startsAt`, `endsAt`, `visibility`, and `accessCodeUpdatedAt`;
- one shared production decision helper drives both display-time availability and the authoritative locked decision;
- after the lock, current availability, current content existence, and private access against that same locked state are checked before any existing-attempt lookup or create; one current problem/section row is held `FOR SHARE` so the content that authorized creation cannot be concurrently deleted before the attempt is written;
- DRAFT, ARCHIVED, future-start, and ended LIVE contests cannot start or resume; ended `PRACTICE_CONTEST` and `PAST_EXAM` attempts remain startable/resumable under the intentional old-content policy;
- finalization uses a database conditional update scoped by attempt ID, contest ID, authenticated user ID, and `IN_PROGRESS` status;
- score, total, status, user ID, submitted time, and elapsed time are computed server-side;
- arbitrary or prototype-like answer IDs are filtered against stored contest question IDs using null-prototype maps;
- a losing simultaneous final submit cannot overwrite the winner.

### Diagnostic

- attempt creation is serialized per user with a parameterized PostgreSQL advisory transaction lock;
- finalization claims the attempt with ID, authenticated user ID, and `IN_PROGRESS` status;
- profile and recommendation effects execute only after the claim and inside the same transaction;
- a losing transaction rolls back without partial side effects;
- completed-attempt replay is rejected;
- answer parsing uses null-prototype maps, and scoring uses only own properties for the stored attempt question IDs;
- answers outside stored question IDs are ignored safely.

Runtime tests exercise the production replay guards with mocked repositories and the production submission-input parsers. Static tests verify their wiring into contest and diagnostic code. Actual simultaneous PostgreSQL start/final-submit testing remains Test debt.

## Authentication missing-user behavior

Sign-in uses the same generic Vietnamese wrong-credentials response for a missing user and a wrong password. `verifyLoginPassword()` always calls the password verifier once. A nonexistent user uses a real, fixed, precomputed scrypt hash with production-shaped salt and output; no dummy hash is generated per request.

This is constant-work password verification, not a claim that the entire authentication request is constant-time. Runtime tests import the production verifier factory and confirm the dummy-hash path.

## Test classification

The suite contains 133 cases:

- 59 production-runtime cases:
  - 42 Phase 1B cases importing production comparison, origin, grant, locked contest-start, submission-input, password, limiter, Writing, and replay helpers/factories;
  - 17 existing Phase 1A cases executing production DTO, signature, and parser helpers.
- 74 non-runtime or static cases:
  - 36 explicitly static Phase 1B structural checks;
  - 38 older Phase 1A source, literal, constant-restatement, or simulated checks.

The mocked limiter, Writing, and replay concurrency cases are runtime unit tests of production factories. They are not PostgreSQL integration tests and are not described as such.

No safe isolated `TEST_DATABASE_URL` was established or used. This pass did not fall back to `DATABASE_URL`. PostgreSQL tests for the real upsert, slot uniqueness, advisory locks, conditional updates, grant locking, and cleanup races remain Test debt.

## Schema and migration integrity

Only the then-new migration `20260711152247_add_security_rate_limits` was corrected before its first application. Previously applied migrations were not changed.

The schema and migration align on:

- database-generated text UUID defaults for all three new model IDs;
- `WritingQuotaReservationStatus` values `PENDING`, `COMPLETED`, and `FAILED`;
- mapped Writing columns `quota_date`, `slot_number`, `provider_started_at`, `completed_at`, `failure_code`, and `expires_at`;
- unique slot and `(action, subject)` constraints;
- slot-number CHECK from 1 through 5;
- rate count CHECK of at least 1;
- required User and Contest foreign keys;
- `ON DELETE CASCADE` and `ON UPDATE CASCADE` behavior;
- cleanup and lookup index names;
- `Contest.accessCodeUpdatedAt` and its index.

Owner-attested operational evidence dated 2026-07-13 records 15 migrations and an up-to-date schema in production. The owner also reports that the same 15-migration chain was deployed successfully to the independent, empty `englishphile-nonprod` project and that its schema is up to date. The Phase 1B migration is now immutable: it must not be modified, renamed, regenerated, or squashed, and any future database change requires a new additive migration.

Before PR #2 merged, the owner reported that a credential-rotation redeploy from the then-current `main` branch passed HTTP 200 health with `database=connected`, new sign-in, database reads, a low-risk database write, and Gemini checks. After PR #2 merged at `45c551f`, the owner separately confirmed deployment of that merge commit and passed post-merge health plus the authenticated Writing/Gemini path after correcting the canonical-origin configuration. These are owner-attested deployment/runtime results, not checks performed by this repository-only reconciliation.

## Unresolved findings

| Finding | Status | Reason |
|---|---|---|
| H-05 contest admin ownership/IDOR | Unresolved | Not changed by this pass |
| H-06 problem/content admin ownership/IDOR | Unresolved | Not changed by this pass |
| H-09 stateless signed-session invalidation | Unresolved | Architectural limitation remains |
| H-10 diagnostic answer data in result payload | Unresolved | Not changed by this pass |
| H-11 unencrypted contest result answer data | Unresolved | Not changed by this pass |
| Random-email authentication bucket amplification | Unresolved | Per-email limiting does not bound the number of attacker-selected subjects |
| Four moderate dependency advisories | Unresolved | Automated fixes propose breaking dependency changes |

## Test debt

| Item | Status | Required follow-up |
|---|---|---|
| Atomic limiter concurrency on PostgreSQL | Test debt | Run against an isolated `TEST_DATABASE_URL` only |
| Writing slot and lifecycle concurrency | Test debt | Exercise six simultaneous reservations and state transitions on isolated PostgreSQL |
| Contest and diagnostic simultaneous start/submit | Test debt | Exercise advisory locks and conditional updates on isolated PostgreSQL |
| Grant lock and mutation race | Test debt | Race authorization/start against code and visibility changes on isolated PostgreSQL |
| Cleanup predicate races | Test debt | Renew/finalize rows while cleanup runs on isolated PostgreSQL |

## Operational requirements

| Item | Status | Requirement |
|---|---|---|
| C-00 credential rotation | Remediated | Preserve the owner-attested rotated configuration; do not reintroduce `AUTH_SECRET` or share secrets across environments |
| Phase 1B migration | Applied and immutable | Production and non-production application is owner-confirmed as of 2026-07-13; preserve the migration unchanged and use a new additive migration for future database changes |
| Phase 1B application deployment | Deployed | PR #2 merged at `45c551f` and the merge commit was deployed to Production |
| Cleanup scheduler | Operational requirement | Implement, configure, and monitor a bounded recurring caller before public exposure; none exists now |
| Isolated Preview smoke | Passed | Owner-attested 2026-07-13; Gemini absence passed safely and was not a functionality test |
| Post-merge Production verification | Passed | Health and tested authenticated Writing/Gemini path passed after canonical-origin correction |
| Private-contest Production smoke | Not tested | No final Production private-contest check was reported |

## Remaining operational order

1. Implement, configure, and monitor bounded cleanup scheduling before public exposure.
2. Carry random-email authentication bucket amplification and the other unresolved findings into their documented future security phases.
3. Run real PostgreSQL concurrency tests only against an isolated `TEST_DATABASE_URL`, never by falling back to `DATABASE_URL`.

## Pre-reconciliation verification outcomes

| Command | Outcome |
|---|---|
| `npx.cmd prisma validate` | Exit 0; schema valid; Prisma package-configuration deprecation warning only |
| `npx.cmd prisma generate` | Exit 0; Prisma Client 6.19.3 generated |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run lint` | Exit 0; no lint errors or warnings reported |
| `npm.cmd test` | Exit 0; 4 files and 133 tests passed |
| `npm.cmd run build` | Exit 0; production build compiled, typechecked, and generated 68 pages |
| `npm.cmd audit` | Exit 1; 4 moderate vulnerabilities remain |
| `npm.cmd audit --omit=dev` | Exit 1; the same 4 moderate production vulnerabilities remain |
| `git diff --check` | Exit 0; no whitespace errors; Git emitted existing LF-to-CRLF next-touch warnings |
| `git diff --stat` | Exit 0; tracked changes only |
| `git status --short` | Exit 0; all work remains uncommitted |

Required searches were also repeated for limiter read/update patterns, expired reset code, `allowDbFailure`, allow-on-database-error paths, every limiter caller, Writing states and error membership, cleanup predicates, contest code/visibility mutations, grant mutations, copied test logic, replay handlers, scheduler configuration, M-01/M-02/M-03 claims, and incomplete/TODO markers. No production `allowDbFailure`, `in quotaConsumingErrors`, limiter read-then-authorize path, unbounded security caller, or configured scheduler was found.

The operational reconciliation pass reruns the prescribed non-database checks and records its exact results in the owner handoff; it does not rerun `npm audit` or any migration command.

## npm audit result

Both audit commands reported 4 moderate vulnerabilities:

- `postcss < 8.5.10` through Next.js, advisory GHSA-qx2v-qp2m-jg93;
- `uuid < 11.1.1` through `exceljs`, advisory GHSA-w5hq-g745-h8pq.

The proposed automated resolutions require forced breaking dependency changes. No `npm audit fix` command was run. These advisories remain Unresolved.

## Review state

PR #2 is merged into `main` at merge commit `45c551f`, and the owner attests that commit was deployed to Production. This post-merge documentation pass leaves only its two security-document corrections uncommitted for owner review. It does not alter application behavior, Prisma schema, or any migration.

## Safety confirmation

- This reconciliation did not read or print `.env` or any real environment-variable value.
- This reconciliation did not access a database.
- This reconciliation did not run a migration command; the owner-attested production and non-production applications predate this pass.
- No schema or migration file was changed.
- No secret value, connection string, password, API key, token, hostname, or cookie was inspected or printed.
- No `npm audit fix` command was run.
- No existing change was discarded.
- No commit or push occurred.
- The reconciliation changes remain uncommitted for owner review.
