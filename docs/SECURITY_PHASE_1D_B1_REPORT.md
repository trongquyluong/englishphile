# Security Phase 1D-B1 Report — No-migration at-rest minimization

Date: 2026-07-26
Scope: repository implementation, separately identified owner-attested Preview evidence, and local dependency-audit triage
Disposition: H-11 **Partially remediated**

## Executive result

This pass implements the bounded H-11 subset that requires neither schema change nor historical data rewrite. It minimizes new independent-practice and contest persistence, sanitizes diagnostic JSON at portable export, removes unused portable contest credentials, replaces broad active content-audit snapshots, hardens operator confirmation/error output, and makes the Production signing-secret fallback fail closed.

It does not encrypt portable files, change retention/account-deletion policy, clean historical rows, change Writing/provider retention, or hash contest codes. The correction now includes a narrowly gated isolated PGlite PostgreSQL-engine integration suite; that is not managed PostgreSQL, pooler, failover, timeout, Preview, or Production evidence. The remaining plaintext operator-export risk is not a demonstrated anonymous or ordinary-learner application exploit. Those items keep H-11 open overall.

Owner-attested operational evidence dated 2026-07-26 records successful isolated Preview verification of the bounded timeout checkpoint at commit `4a869defacd6b932299bc8e0bc8b83897177cf6a`. This evidence is recorded separately from repository tests and local audit output. It does not close H-11 and is not Production evidence.

## Independent-practice boundary

`src/lib/security/submission-input.ts` is the production parser used by both practice Route Handlers. It rejects an honestly oversized `Content-Length` before consumption, but still enforces the limit while reading the actual `ReadableStream`; missing, malformed, or falsely small headers cannot bypass the byte counter. Reading stops and cancellation is attempted as soon as the limit is crossed. A fatal UTF-8 decoder and `JSON.parse` run only after the bounded read succeeds. The parser recursively clones objects into null-prototype maps without invoking accessors and rejects `__proto__`, `prototype`, and `constructor` at every object level. Learner-facing parse/relationship failures are generic and echo no submitted ID or answer.

Limits are:

| Limit | Value | Product basis |
|---|---:|---|
| Request body | 72 KiB | Small envelope above the bounded 64 KiB answer map |
| Answer entries | 50 | Existing maximum questions in an admin problem edit |
| Random question IDs | 20 | Existing random-practice UI maximum |
| Identifier | 128 UTF-8 bytes | Headroom for current generated identifiers while rejecting unbounded keys |
| Nesting depth | 3 | Supports current structured answers while excluding unrelated documents |
| Array length | 20 | Matches the largest current random set |
| One serialized answer | 16 KiB | Supports the existing bounded Writing answer object while rejecting unrelated documents |
| Serialized answer map | 64 KiB | Bounded aggregate below the request envelope |

After published/authorized questions are fetched, answer keys must be a subset of the fetched set. Random practice additionally requires the fetched IDs to exactly equal the unique submitted ID set. Any mixed or foreign set therefore reaches zero writes.

The production shape allowlist accepts strings for objective, cloze, transformation, matching/short-answer, reading, and listening questions; `{ part, correction }` strings for error identification; and `{ thesis, mainIdea1, mainIdea2, vocabulary, essay }` strings for Writing. Sparse arrays, non-finite numbers, accessors, unsupported prototypes, unexpected top-level fields, and non-JSON Prisma values fail before persistence.

Single and random persistence now run inside one Prisma transaction per request. `Submission.answers` contains only `{ "version": 1 }`; the learner answer is stored once in its corresponding `SubmissionAnswer.studentAnswer`; `feedback` is the existing fixed learner-safe correctness message; scoring still uses the canonical server-side checker. Random submissions receive only child answers belonging to that problem. Progress and recommendation behavior remains in the same transaction where applicable.

## Final integrity correction pass

The final review found and corrected these B1 integrity gaps before staging: the 72 KiB check previously occurred after full body buffering; the generic 4 KiB answer ceiling did not support the existing Writing shape; recursive JSON normalization lacked a production question-type allowlist; the single-problem route still admitted an editorial draft exception; contest storage/read JSON lacked complete retained-field bounds and incorrectly traversed discarded source trees; portable credential exclusion was not re-applied at the final serialized artifact; the portable manifest was unbounded/untyped and its raw metadata was logged; live-import flags and dry-run client creation were not fail-closed enough; safe error classification and Prisma observability needed a fixed signal; signature comparison accepted non-canonical encoding; and audit/rollback tests did not exercise enough actual writers and later-failure paths. The release-blocking correction pass also traced and runtime-tested the existing non-persisting admin preview boundary and removed parallel test-time contention without weakening or globally extending timeouts.

The admin draft preview does not submit through `/api/submissions`. Its production page calls `requireAdmin`, loads answer-complete draft content through the separate admin mapper, and passes explicit `previewMode` to `ProblemClient`. The Client Component’s production guard returns before its fetch callback. Preview therefore remains available for display and answer entry but intentionally does not score or persist submissions, progress, or recommendations. Ordinary learner submissions remain published-only.

## Contest attempt JSON

New `ContestAttempt.answersJson` shape:

```json
{
  "version": 1,
  "score": 0,
  "total": 0,
  "problems": [{
    "contestProblemId": "<id>",
    "problemId": "<id>",
    "title": "<presentation title>",
    "section": "<presentation section>",
    "results": [{
      "questionId": "<id>",
      "type": "<question type>",
      "prompt": "<exact presented text>",
      "rootWord": null,
      "studentAnswer": "<learner answer>",
      "isCorrect": true
    }]
  }],
  "sectionResults": [],
  "sectionBreakdown": []
}
```

The optional prompt/root-word snapshot is presentation-only and preserves historical review when editorial content later changes. The mapper reads only version, score, total, problems, section results, breakdowns, and their retained children. It does not traverse discarded canonical/accepted/model answers, explanations, feedback, options, metadata, raw maps, or Prisma records, so even oversized/deep/cyclic discarded trees cannot block valid storage. Retained fields remain bounded and retained cycles fail safely. MCQ and other ordinary contest answers use bounded JSON scalars; Error Identification also accepts `{ part, correction }`; Writing accepts both its current scalar textarea value and `{ thesis, mainIdea1, mainIdea2, vocabulary, essay }`. The learner result page passes current and documented pre-version legacy JSON through the positive mapper. Malformed structures and unknown versions fail closed to an empty review state. Ownership, contest/user binding, conditional finalization, score fields, replay winner, and leaderboard storage remain unchanged. Historical rows are not rewritten.

The contest boundary allows at most 500 logical result entries across at most 500 problem groups and 30 section groups, with at most 500 breakdown entries. IDs are capped at 128 UTF-8 bytes; titles at 1,024; sections at 512; prompts at 20,000; root words at 256; and one learner answer at 16 KiB. The final stored JSON is capped at 2 MiB. Retained structure has a fixed positive shape rather than an arbitrary whole-source depth walk. These bounds reuse the committed contest-import product ceiling where available.

## Portable export/import

Portable user and contest query shapes are explicit. They omit `passwordHash` and `Contest.accessCode`; the latter was not restored by the importer, so exporting it created an unnecessary plaintext credential copy. Contest metadata and `accessCodeUpdatedAt` remain for structural compatibility, but no empty reusable credential is substituted.

Diagnostic attempt rows are reconstructed using allowlists for skill breakdown, topic breakdown, and recommendation metadata. Current safe classifications/scores/profiles remain. Legacy `correctAnswer`, feedback, explanations, accepted/model answers, learner answers, nested unknown keys, and unknown top-level diagnostic fields are discarded from the new bundle. Source objects and database rows are not changed. Import continues to accept the sanitized compatible JSON shape.

Normal output does not print a connection target, raw manifest metadata, path, identity, control characters, or raw database/import error. A live import requires interactive confirmation or explicit `--yes`; non-TTY without that approval exits before creating the Prisma client. The manifest is rejected above 32 KiB before JSON parsing. Its positive schema accepts version `1.0` or a missing legacy version, a canonical ISO timestamp, and only known nonnegative safe-integer counts from 0 through 1,000,000. Unknown top-level legacy note/warning fields are ignored without traversal; unknown count names and invalid/prototype/accessor values fail closed. Dry-run validates only this manifest and reports its declared counts; it does not validate bundle files or rows, consult live database state, or create a Prisma client. Supported role mapping is unchanged. The format remains unencrypted plaintext and requires operator-controlled file protection and deletion.

## Audit and logging

Every active `ContentAuditLog` caller was inventoried. Question, problem, topic, source, and content-pack updates use resource-specific mappers. New snapshots contain only IDs, classifications/status, source/topic relations, reviewer/timestamps where present, and up to 32 changed field names. Existing set-based lifecycle snapshots were already bounded and remain transaction-coupled. No historical audit row is rewritten. The atomic import path itself creates no `ContentAuditLog` row.

The shared Prisma client keeps error-event observability but emits only a fixed action and error class; it does not print Prisma event messages, queries, targets, or raw errors. Touched operator clients no longer enable raw Prisma error logging. Contest spreadsheet parsing logs a fixed operation label plus a fixed error class. Admin promotion does not print the selected identity. The canonical-content audit report no longer outputs/stores prompts, answers, or explanations. Portable/safe export scripts do not print destination/connection details or raw error objects. Provider/platform automatic logging and redaction are not asserted.

## Signing boundary

`getAuthSecret()` itself rejects missing, whitespace-only, and the committed local fallback when `NODE_ENV` is Production. Its error is generic. Development/test may retain the documented fallback. Session and private-contest grant HMAC paths both call this boundary and use the shared timing-safe comparator. Signatures must use canonical base64url encoding; malformed characters, non-canonical encodings, truncation, oversize values, and unequal decoded lengths fail safely before equal-length timing comparison. Session payload, cookie flags, expiry, database user reload, grant invalidation, and authorization semantics are unchanged.

## Evidence and remaining work

Tests added in the original Phase 1D-B1 pass import production helpers and exercise runtime helpers/handlers with mocked repositories where stated. They cover input bounds/prototype safety, foreign/mixed zero-write behavior, minimized persistence, per-problem partitioning, transaction failure control flow, contest storage/read allowlists, diagnostic export/non-mutation, final export serialization, confirmation/client-creation order, safe error classification, audit sentinel absence, and signing behavior. Source-structure tests remain static.

The PR #12 correction pass adds a separately gated import integration suite. It invokes the production manual route, upload-first route/orchestrator, atomic import helper, and Prisma client against a fresh in-memory PGlite PostgreSQL engine through its PostgreSQL wire-protocol socket. It covers missing, existing, and mixed source/topic taxonomy; ADMIN and normalized `OWNER_EMAIL` transaction authorization; nested Problem/Question/ProblemTopic writes; content-pack reconciliation; two-principal missing-taxonomy concurrency; and real engine rollback after a later callback failure. Upload-route runtime coverage separately proves full success, mixed `IMPORTED`/`FAILED` success with `PARTIALLY_IMPORTED`, and all-failed 422 behavior; the production component status helper distinguishes those same three outcomes. The engine is PostgreSQL compiled to WebAssembly, but its socket multiplexer is not equivalent to a separately installed PostgreSQL server or managed provider. In particular, this does not replace full PostgreSQL-server concurrency, timeout, pooler, or failover evidence. No Preview, Production, managed provider, deployed endpoint, or real data was accessed.

The integration boundary is fail closed twice. The committed bootstrap ignores any pre-existing database target, reserves a random loopback port, directly owns a fresh `memory://` PGlite socket child, verifies the pinned transient package versions and server startup output, and performs a minimal read-only engine/identity/freshness probe. The runtime version must identify PGlite/embedded PostgreSQL, the child must still be owned and live, and its current schema must contain zero base tables. No DDL runs before those checks, and the constructed connection target is never printed.

Only after bootstrap verification does the runner apply every immutable `prisma/migrations/*/migration.sql` file in lexical order through a pinned transient PostgreSQL simple-query client. The current chain contains 16 migrations. `prisma migrate deploy` was tested against the verified owned embedded socket but did not complete there, so the runner uses the compatible per-file transport rather than claiming deploy compatibility. A post-DDL read-only check verifies representative baseline and later schema effects, including Writing, contest-builder, rate-limit/grant/quota tables, contest access-code lifecycle columns, and the final `STUDENT`/`ADMIN` role enum. The runner then launches Vitest with an owned temporary configuration that supplies only its constructed target and the required guard values. Child output is captured and never echoed on failure; only fixed safe stage/error-class signals are emitted. The runner terminates the owned server and removes its temporary configuration/report directory in `finally`, including failure and signal paths.

Vitest retains a separate defense-in-depth guard. Before fixture mutation it requires `RUN_IMPORT_POSTGRES_INTEGRATION=1`, the exact confirmation `CONFIRM_DISPOSABLE_IMPORT_DATABASE=I_CONFIRM_THIS_IS_A_DISPOSABLE_IMPORT_TEST_DATABASE`, `NODE_ENV=test`, `IMPORT_POSTGRES_TEST_ENGINE=pglite`, a PostgreSQL loopback target, runtime PGlite identity, no Preview/Production/Neon/Vercel marker, and empty application tables. Generic guard errors disclose neither target nor raw database details. The runner guard protects DDL setup; the Vitest guard independently protects fixture mutation.

Every fixture uses one random per-run `epit-<uuid>` prefix. Cleanup is limited to: `User.id`, `ImportBatch.userId`, and `ContentPack.importedById` starting with that prefix; `Problem.slug`, `Topic.slug`, and `SourceCollection.name` starting with it; and `Question`/`ProblemTopic` rows reached only through those owned problem/topic IDs. There is no unscoped `deleteMany`, including final cleanup. After each cleanup and final cleanup, a read-only scan asserts that every application base table is empty, excluding `_prisma_migrations`. An unexpected row fails the suite and is never deleted unless it matches a proven current-run ownership predicate.

The exact complete integration command is:

```powershell
npx.cmd --yes --package=@electric-sql/pglite@0.4.3 --package=@electric-sql/pglite-socket@0.1.3 --package=pg@8.16.3 --call "node scripts/run-import-postgres-integration.mjs"
```

The command does not accept an operator-provided database target and requires no second terminal or manual server teardown. The packages are pinned transient tooling, not repository dependencies. This remains embedded-engine evidence, not an installed or managed PostgreSQL-server, pooler, failover, timeout, Preview, Production, Neon, or provider test.

## Owner-attested Preview operational reconciliation

The following is owner-attested operational evidence dated 2026-07-26, not repository or automated-test evidence. PR #12 Preview commit `4a869defacd6b932299bc8e0bc8b83897177cf6a` reached `READY` on the `preview` deployment target; Vercel and Vercel Preview Comments checks passed, and PR #12 remained open and Draft throughout verification.

### Historical failure and bounded diagnosis

Earlier manual Preview imports reached `problem-nested-create` and failed with the safe signal `errorClass=database`, `prismaErrorKind=known-request`, and `prismaCode=P2028`. Prisma defines P2028 as a Transaction API error. Raw Prisma errors, imported values, connection details, and credentials were intentionally not logged. The sequence already completed principal revalidation, ImportBatch creation, taxonomy advisory locks, and source/topic lookup or creation before entering the single nested `Problem.create`. This evidence supports a transaction-timeout diagnosis for the observed Preview path, but it does not prove the exact internal P2028 subtype because the raw message and metadata were not retained.

The committed bounded correction gives only `executeImportPlanAtomically` a 15-second per-call interactive-transaction timeout. It changes no global Prisma timeout, adds no retry, and changes no query, write shape, lock order, schema, or migration. Fifteen seconds remains an operational allowance, not an expected transaction duration.

### Latest-commit import verification

Both previously missing-taxonomy paths completed successfully:

| Path | Result | Source | Problem | Imported shape |
| --- | --- | --- | --- | --- |
| Manual JSON | `IMPORTED` | `Phase 1D-B1 Timeout Probe 20260723c` | `phase1d-b1-timeout-import-probe-20260723c` | 1 problem, 1 question |
| Upload-first JSON | `IMPORTED` | `Phase 1D-B1 Upload Timeout Probe 20260726d` | `phase1d-b1-upload-timeout-probe-20260726d` | 1 problem, 1 question |

Single-problem practice returned a successful learner response. Its wrong-answer response exposed no canonical answer, explanation, raw metadata, options, or checker feedback. Owner-attested isolated-Preview database checks were all true: `submissionFound`, `parentShapeValid`, `childAnswerCountValid`, `childRelationshipValid`, and `feedbackShapeValid`.

Random practice remained learner-safe and partitioned answers by the actual problem. Owner-attested isolated-Preview database checks were all true: `randomSubmissionCountValid`, `parentShapesValid`, `childAnswerCountValid`, `oneChildPerSubmission`, `perProblemRelationshipValid`, and `feedbackShapesValid`.

The latest single/random checkpoint used the current owner-equivalent account on its own learner surface. It did not attempt to read or mutate another user's data, and ordinary-`STUDENT` practice behavior was not rerun on commit `4a869defacd6b932299bc8e0bc8b83897177cf6a`. The ordinary-`STUDENT` admin-denial result from `e8e3a6752c74055f973af3d47a2135bc52ed98b9` remains historical admin-boundary evidence only; it is not latest-commit practice evidence. No configured owner email value is recorded.

The Preview operations used the Neon branch named `preview`. The synthetic problem and source markers were absent from its parent branch named `production`, and no mutation was intentionally performed against that parent branch. This is narrow branch-isolation evidence and must not be generalized to every Production database or provider environment. The final ten-minute runtime-log postflight returned `Fetched 0 logs`; no new import, submission, or random-practice error was observed after the successful checkpoint.

Direct unauthenticated API probes were intercepted by Vercel Deployment Protection. Their HTTP 401 results are inconclusive for application-level origin or authentication behavior and are not recorded as application 401/403 evidence.

### Historical-versus-latest boundary

At the earlier isolated Preview checkpoint on commit `e8e3a6752c74055f973af3d47a2135bc52ed98b9`, `OWNER_EMAIL` admin access, ordinary-`STUDENT` admin denial, answer-complete admin draft preview, preview POST suppression, contest-result learner safety, diagnostic regression, and Writing regression passed; checked logs exposed no runtime error or sensitive value. Later commits changed import safety, observability, safe error classification, and the bounded import timeout. Those contest, diagnostic, Writing, and admin-preview behaviors were not rerun on `4a869defacd6b932299bc8e0bc8b83897177cf6a`; the earlier result remains historical evidence, not a latest-commit retest. No Phase 1D-B1 Production deployment or verification is claimed, and no historical sensitive row was rewritten.

The valid-plan callback is a bounded but multi-round-trip remote sequence. The table counts application-level awaited database operations; Prisma can translate an operation, especially a nested create, into multiple internal SQL statements or protocol exchanges.

| Order | Operation | Application-level database calls |
| --- | --- | --- |
| 1 | Principal lock and revalidation | One `User ... FOR UPDATE` query. |
| 2 | Optional ContentPack lock | One `ContentPack ... FOR UPDATE` query, then one manifest lookup. |
| 3 | Committed-file lookup, where applicable | One linked imported-batch lookup; an existing exact committed identity returns before new writes. |
| 4 | ImportBatch creation | One `ImportBatch.create` with `VALIDATED` status. |
| 5 | Taxonomy advisory locks | One deterministic, sorted, transaction-scoped advisory-lock query when keys exist. |
| 6 | Source lookup/create | One source lookup and, only when sources are missing, one `createManyAndReturn`. |
| 7 | Topic lookup/create | One topic lookup when topic names exist and, only when topics are missing, one `createManyAndReturn`. |
| 8 | Problem graph writes | Exactly one nested `Problem.create` per bounded problem, carrying nested Question and ProblemTopic creates; at most 25 problem operations under the unchanged input limit. |
| 9 | ImportBatch finalization | One `ImportBatch.update` to `IMPORTED`. |
| 10 | Optional ContentPack reconciliation | One pack lookup, one linked-batch lookup, and one pack update while the earlier pack lock remains held. |

This retains the existing User -> optional ContentPack -> deterministic taxonomy/content lock order, one nested `Problem.create` per problem, and all-or-nothing rollback. `IMPORT_TRANSACTION_TIMEOUT_MS = 15_000` is passed only as `{ timeout: IMPORT_TRANSACTION_TIMEOUT_MS }` to this `executeImportPlanAtomically` transaction call. `maxWait` is not made explicit, so Prisma's documented 2,000 ms default remains in force. Fifteen seconds is a bounded operational allowance for the existing sequence, not evidence that transactions should normally consume fifteen seconds. No global Prisma transaction default is changed, and no automatic retry or elapsed-time logging is added.

`createProblemWithQuestions` retains exactly one nested `Problem.create`: the parent carries source, lifecycle, reviewer, ImportBatch, and optional ContentPack foreign-key fields, while `questions.create` and `problemTopics.create` remain nested in that same Prisma operation. Its query count, nested input, return value, default-client signature, transaction structure, ordering, IDs, and rollback behavior are unchanged. There are no separate Question or ProblemTopic Prisma calls, nested `connect` clauses, audit writes, post-create lookup, or post-create update. The only truthful inner stage is `problem-nested-create`, set immediately before the nested `Problem.create`; application code cannot observe which SQL statement Prisma performs internally for a nested relation. Batch finalization and optional content-pack reconciliation retain their existing later stages.

Failed atomic imports continue to log only `action`, safe `errorClass`, static `stage`, fixed `prismaErrorKind`, and `prismaCode`. `prismaCode` may be only `P2002`, `P2003`, `P2004`, `P2011`, `P2012`, `P2014`, `P2021`, `P2022`, `P2024`, `P2025`, `P2028`, or `P2034`; all other codes and ambiguous errors produce `unknown`. Recognition accepts either the imported typed Prisma error classes or a guarded bundled-copy identity made only from exact fixed names and required own data-property descriptors; reflection fails closed. `prismaErrorKind` is restricted to `known-request`, `unknown-request`, `initialization`, `validation`, `rust-panic`, `not-prisma`, or `unknown`. `P2024` (connection-pool timeout), `P2028` (transaction API error), and bundled-copy recognition remain diagnostic hypotheses until a later safe signal identifies one. A code may narrow the failure class, but it cannot identify which nested relation caused a `P2002` or `P2003`. No message parsing or object enumeration is used, and message, metadata values, targets, constraints, model/field values, cause, client version values, query, stack, URLs, IDs, slugs, prompts, answers, and serialized errors are never included. Authorization failures remain outside this database-failure logger.

This minimal bounded correction changes only the per-call interactive-transaction timeout. It does not change query, write, lock, schema, migration, dependency, input-bound, authorization, reconciliation, response, error-redaction, or rollback behavior. No retry is added. The isolated PGlite suite can verify PostgreSQL semantics and rollback within its stated boundary, but it does not prove managed remote latency, pooler behavior, failover behavior, or the inferred expiry subtype. The owner-attested manual and upload-first Preview probes now pass on the timeout commit; PR #12 remains open and Draft.

The correction pass also fixes the confirmed superficial upload-first success signal: `/api/admin/import/files/commit` now returns success only when at least one validated file actually reached `IMPORTED`; an all-failed pack returns 422, and the import UI distinguishes full success, partial success, and failure instead of deriving completion from dry-run-valid file counts.

Remaining H-11 work:

- encryption and lifecycle controls for plaintext portable bundles;
- a policy and implementation for Writing drafts/submissions/model feedback/provider output;
- general retention/expiry and abandoned-record cleanup;
- account deletion/anonymization and relation policy;
- plaintext contest access-code hashing via a future additive schema migration;
- separately approved historical diagnostic/contest/submission/audit data shaping;
- historical classroom/assignment retention policy;
- provider deletion/log-retention verification;
- separately installed PostgreSQL-server rollback/concurrency/pooler/timeout/data-shaping tests beyond the embedded isolated engine evidence above.

## Schema/data-operation decision

No Prisma schema or migration is required for this bounded implementation. New minimized shapes fit existing JSON columns. Removing or transforming historical JSON is an operational data-shaping task, not a schema migration, and requires separate authorization, backup, rollback design, dry-run counts, and isolated PostgreSQL evidence. Hashing contest access codes requires a future additive migration and transition plan. No such operation occurred here.

## Repository verification

After this timeout correction, the suite contains 467 cases across 41 files: 323 runtime production helper/handler/action/page/orchestrator cases with mocked collaborators where stated, 17 simulations (including five executable integration-runner guard cases, one mocked transaction-callback rollback case, and the no-sleep P2028 rethrow/no-retry case), 119 static source/structure checks, and 8 gated isolated PostgreSQL-engine integration cases. The default command runs 459 cases and reports the 8 explicitly gated integration cases as skipped; the integration command runs those 8 cases separately against the isolated engine. The new runtime cases invoke the production `executeImportPlanAtomically` helper and assert the exact `{ timeout: 15_000 }` option, omission of `maxWait`, unchanged mocked global defaults, principal and optional-pack lock ordering, and taxonomy locking before the nested create. Existing authorization-denial, stage/kind/code, nested-create, bounds, reconciliation, and rollback coverage remains intact. The synthetic P2028 case rethrows the same error after exactly one transaction and one nested-create attempt, with no sleep and no retry. These mocked/synthetic cases are not PostgreSQL or managed-latency evidence. The ImportCenter message wiring case remains explicitly static, and the upload route status cases invoke the production handler.

`prisma validate`, `prisma generate`, TypeScript typecheck, ESLint, and the optimized Next.js build passed for the timeout correction. Build page collection used explicit synthetic unreachable process configuration and emitted only fixed generic database signals. The focused timeout/observability run passed 30 cases across 3 files. The guarded PGlite bootstrap verified a fresh owned engine, applied and checked all 16 immutable migrations, and passed all 8 isolated cases. Both required ordinary default-parallel test runs passed 459 cases and skipped only the 8 gated cases. An additional two-process stress invocation caused the existing valid-XLSX case to cross its unchanged five-second timeout in one process; the ordinary required runs immediately passed, and no test or global timeout was changed.

## Dependency-advisory triage — 2026-07-26

Both read-only audit scopes exited 1. The current registry result supersedes the stale six-finding statement without any manifest or lockfile change:

- `npm.cmd audit`: 20 top-level vulnerable-package entries; npm metadata summarized them as 1 Moderate and 19 High.
- `npm.cmd audit --omit=dev`: 13 top-level vulnerable-package entries; npm metadata summarized them as 1 Moderate and 12 High.

These are vulnerable dependency-package entries, not 20 or 13 independent GHSAs. Full-scope entries are `@eslint/config-array`, `@eslint/eslintrc`, `archiver`, `archiver-utils`, `brace-expansion`, `eslint`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `exceljs`, `glob`, `minimatch`, `next`, `postcss`, `readdir-glob`, `rimraf`, `sharp`, `uuid`, and `zip-stream`. Production-scope entries are `archiver`, `archiver-utils`, `brace-expansion`, `exceljs`, `glob`, `minimatch`, `next`, `postcss`, `readdir-glob`, `rimraf`, `sharp`, `uuid`, and `zip-stream`.

Read-only primary-package metadata from `npm view next@16.2.12 version dependencies optionalDependencies --json` confirms that Next 16.2.12 still declares `postcss: 8.4.31` and optional `sharp: ^0.34.5`. The Next-native GHSAs are patched from Next 16.2.11, so Next 16.2.12 is a valid patch-level path for the Next-native advisories. It is not a verified remediation for the independent PostCSS or Sharp advisories.

| Advisory-bearing package and locked version | Severity and advisories | Direct/transitive path | Production audit | Patched path reported by npm | Disposition |
| --- | --- | --- | --- | --- | --- |
| `next@16.2.10` | High aggregate: 4 High and 5 Moderate GHSAs (`GHSA-6gpp-xcg3-4w24`, `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`, `GHSA-4c39-4ccg-62r3`, `GHSA-p9j2-gv94-2wf4`, `GHSA-q8wf-6r8g-63ch`, `GHSA-955p-x3mx-jcvp`) | Direct production dependency; the repository uses App Router Server Actions and `next/image`. | Yes | Next-native advisories are patched from `16.2.11`; `next@16.2.12` is the current npm-proposed aggregate Next update. This is semver patch-level, not major, but outside the exact `16.2.10` pin. | **Release-blocking** for public-beta release; test the patch-level Next update in a separate dependency phase. |
| `postcss@8.4.31` under Next; `8.5.16` in development/build chains | High aggregate: 2 High and 1 Moderate (`GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`) | Transitive; Production path is `next > postcss`; full scope also includes Tailwind/Vite build paths. No direct application import was found. | Yes | `GHSA-qx2v-qp2m-jg93` is patched in 8.5.10, `GHSA-6g55-p6wh-862q` in 8.5.12, and `GHSA-r28c-9q8g-f849` in 8.5.18. The aggregate safe floor is therefore PostCSS `>=8.5.18`; `postcss@8.5.16` remains affected by `GHSA-r28c-9q8g-f849`. Next 16.2.12 still directly declares `8.4.31`, so no verified compatible remediation was established in this pass. | **Independently release-blocking**; a separate phase must test an upstream version, reviewed override, or other compatible resolution. No override is pre-approved as safe. |
| `sharp@0.34.5` | High (`GHSA-f88m-g3jw-g9cj`) | Transitive production path `next > sharp`; repository `next/image` use makes the image stack present. | Yes | The GHSA floor is Sharp `>=0.35.0`, while Next 16.2.12 declares `^0.34.5`, which excludes 0.35.x. No verified compatible remediation was established in this pass. | **Independently release-blocking**; a separate phase must test an upstream version, reviewed override, or other compatible resolution. No override is pre-approved as safe. |
| `brace-expansion@1.1.15`, `2.1.2`, and `5.0.7` | High (`GHSA-3jxr-9vmj-r5cp`, `GHSA-mh99-v99m-4gvg`) | Transitive production path through direct `exceljs@4.4.0`: `exceljs > archiver/readdir-glob > glob/minimatch > brace-expansion`; full scope also includes ESLint chains. | Yes | Version 5.0.7 remains affected by the later OOM advisory and requires 5.0.8. npm's available production resolution is forced `exceljs@3.4.0` and marked breaking; full scope also proposes major `eslint@10.8.0`. | **Unresolved pending more evidence** and a focused ExcelJS/tooling remediation; no safe automatic resolution was established. |
| `uuid@8.3.2` | Moderate (`GHSA-w5hq-g745-h8pq`) | Transitive production path `exceljs > uuid`; no direct repository UUID import or affected buffer-API call was found. | Yes | Patched UUID is `>=11.1.1`, but npm proposes forced `exceljs@3.4.0` and marks it breaking. | **Separately tracked, non-blocking for PR #12**; still unresolved and requires a reviewed ExcelJS strategy. |

Next is directly reachable as the application framework. ExcelJS is directly reachable only in the bounded server-side admin contest-XLSX parser; brace-expansion and UUID are indirect through ExcelJS. This source inspection narrows paths but does not establish non-exploitability. No `npm audit fix`, dependency install, upgrade, manifest edit, or lockfile edit occurred. A separate dependency-remediation phase must test the verified Next-native patch path, independently resolve PostCSS and Sharp through an upstream version, reviewed override, or other compatible approach, and investigate a safe ExcelJS chain. This pass does not assert that any override is already safe.

Documentation-reconciliation verification used explicit synthetic unreachable database/application configuration and did not inspect existing environment values. `git diff --check`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build` each exited 0. The default test command passed 459 cases and skipped the 8 explicitly gated PGlite cases, preserving the 467-case classification above. The two required read-only audit commands each exited 1 with the advisory counts recorded above; no fix command ran.

## Safety boundary

Implementation and repository verification did not access Preview, Production, a managed database, deployed endpoint, browser, provider dashboard, or any real environment value/data. The correction used only bootstrap-constructed synthetic process configuration and a fresh owned in-memory local PostgreSQL engine. The runner applied the complete existing immutable migration chain only after disposable-engine verification. The 2026-07-26 operational facts above are owner-attested and separately labeled; this documentation reconciliation did not access those systems. No schema/migration file, seed, backup, export, operator import, application cleanup, deployment, commit, push, or historical rewrite was executed.
