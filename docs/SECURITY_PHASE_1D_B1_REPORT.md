# Security Phase 1D-B1 Report — No-migration at-rest minimization

Date: 2026-07-20
Scope: repository implementation only
Disposition: H-11 **Partially remediated**

## Executive result

This pass implements the bounded H-11 subset that requires neither schema change nor historical data rewrite. It minimizes new independent-practice and contest persistence, sanitizes diagnostic JSON at portable export, removes unused portable contest credentials, replaces broad active content-audit snapshots, hardens operator confirmation/error output, and makes the Production signing-secret fallback fail closed.

It does not encrypt portable files, change retention/account-deletion policy, clean historical rows, change Writing/provider retention, or hash contest codes. The correction now includes a narrowly gated isolated PGlite PostgreSQL-engine integration suite; that is not managed PostgreSQL, pooler, failover, timeout, Preview, or Production evidence. The remaining plaintext operator-export risk is not a demonstrated anonymous or ordinary-learner application exploit. Those items keep H-11 open overall.

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

Owner-attested Preview evidence dated 2026-07-20 records that manual JSON dry-run passed with zero validation errors and manual commit then failed with the safe signal `action=import-commit`, `errorClass=database`, `stage=problem-create`. That broad stage proves transaction principal revalidation, taxonomy locking, source lookup/creation, topic lookup/creation, and ImportBatch creation completed before the failing helper call. It does not identify the failing database operation inside that call. Upload-first was deliberately not attempted at this checkpoint. The original and corrected missing-taxonomy paths both succeeded on the fresh isolated engine, so taxonomy failure did not reproduce and the exact inner operation/root cause remains unknown; neither create/re-fetch visibility nor transaction timeout is claimed as the cause.

`createProblemWithQuestions` retains exactly one nested `Problem.create`: the parent carries source, lifecycle, reviewer, ImportBatch, and optional ContentPack foreign-key fields, while `questions.create` and `problemTopics.create` remain nested in that same Prisma operation. Its query count, nested input, return value, default-client signature, transaction structure, ordering, IDs, and rollback behavior are unchanged. There are no separate Question or ProblemTopic Prisma calls, nested `connect` clauses, audit writes, post-create lookup, or post-create update. The only truthful inner stage is `problem-nested-create`, set immediately before the nested `Problem.create`; application code cannot observe which SQL statement Prisma performs internally for a nested relation. Batch finalization and optional content-pack reconciliation retain their existing later stages.

Failed atomic imports continue to log only `action`, safe `errorClass`, static `stage`, and `prismaCode`. `prismaCode` is an exact allowlist match from the typed `PrismaClientKnownRequestError` boundary and may be only `P2002`, `P2003`, `P2004`, `P2011`, `P2012`, `P2014`, `P2021`, `P2022`, `P2025`, or `P2034`; all other and non-Prisma errors produce `unknown`. A code such as `P2002` or `P2003` may narrow the database failure class, but it cannot identify which nested relation caused the failure. No message parsing is used, and message, metadata, targets, constraints, model/field values, cause, client version, query, stack, URLs, IDs, slugs, prompts, answers, and serialized errors are never included. Authorization failures remain outside this database-failure logger.

This observability-only correction neither fixes nor refactors the unknown Preview database failure. PR #12 remains Draft. Only after review, commit, and a new isolated Preview deployment may exactly one fresh manual-import probe be performed; no upload-first probe should precede that diagnostic checkpoint.

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

After this observability correction, the suite contains 451 cases across 40 files: 308 runtime production helper/handler/action/page/orchestrator cases with mocked collaborators where stated, 16 simulations (including five executable integration-runner guard cases and one mocked transaction-callback rollback case), 119 static source/structure checks, and 8 gated isolated PostgreSQL-engine integration cases. The default command runs 443 cases and reports the 8 explicitly gated integration cases as skipped; the integration command runs those 8 cases separately against the isolated engine. The nested-operation stage and safe-code cases invoke production helpers with mocked Prisma collaborators; they are not PostgreSQL evidence. The ImportCenter message wiring case remains explicitly static, and the upload route status cases invoke the production handler.

`prisma validate`, `prisma generate`, TypeScript typecheck, ESLint, and the optimized Next.js build pass. Build page collection used explicit synthetic unreachable process configuration and emitted only fixed generic database signals. The default test timeout was fixed at its cause: invalid XLSX signatures now fail before the expensive ExcelJS dynamic import, while the cleanup route is imported once at module setup rather than inside a five-second test body. No assertion, fixture, security check, or timeout was weakened, and no global timeout was increased. Both default test runs pass. `npm audit` and `npm audit --omit=dev` complete with nonzero status and report four moderate vulnerability instances across the existing PostCSS/Next and UUID/ExcelJS advisory paths. No audit fix, upgrade, or lockfile edit was performed. Prisma also reports its existing package-configuration deprecation warning.

## Safety boundary

Implementation and verification did not access Preview, Production, a managed database, deployed endpoint, browser, provider dashboard, or any real environment value/data. The correction used only bootstrap-constructed synthetic process configuration and a fresh owned in-memory local PostgreSQL engine. The runner applied the complete existing immutable migration chain only after disposable-engine verification. No schema/migration file, seed, backup, export, operator import, application cleanup, deployment, commit, push, or historical rewrite was executed.
