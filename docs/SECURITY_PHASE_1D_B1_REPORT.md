# Security Phase 1D-B1 Report — No-migration at-rest minimization

Date: 2026-07-18
Scope: repository implementation only
Disposition: H-11 **Partially remediated**

## Executive result

This pass implements the bounded H-11 subset that requires neither schema change nor historical data rewrite. It minimizes new independent-practice and contest persistence, sanitizes diagnostic JSON at portable export, removes unused portable contest credentials, replaces broad active content-audit snapshots, hardens operator confirmation/error output, and makes the Production signing-secret fallback fail closed.

It does not encrypt portable files, change retention/account-deletion policy, clean historical rows, change Writing/provider retention, hash contest codes, or add PostgreSQL integration. The remaining plaintext operator-export risk is not a demonstrated anonymous or ordinary-learner application exploit. Those items keep H-11 open overall.

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

Every active `ContentAuditLog` caller was inventoried. Question, problem, topic, source, and content-pack updates use resource-specific mappers. New snapshots contain only IDs, classifications/status, source/topic relations, reviewer/timestamps where present, and up to 32 changed field names. Existing set-based lifecycle snapshots were already bounded and remain transaction-coupled. No historical audit row is rewritten.

The shared Prisma client keeps error-event observability but emits only a fixed action and error class; it does not print Prisma event messages, queries, targets, or raw errors. Touched operator clients no longer enable raw Prisma error logging. Contest spreadsheet parsing logs a fixed operation label plus a fixed error class. Admin promotion does not print the selected identity. The canonical-content audit report no longer outputs/stores prompts, answers, or explanations. Portable/safe export scripts do not print destination/connection details or raw error objects. Provider/platform automatic logging and redaction are not asserted.

## Signing boundary

`getAuthSecret()` itself rejects missing, whitespace-only, and the committed local fallback when `NODE_ENV` is Production. Its error is generic. Development/test may retain the documented fallback. Session and private-contest grant HMAC paths both call this boundary and use the shared timing-safe comparator. Signatures must use canonical base64url encoding; malformed characters, non-canonical encodings, truncation, oversize values, and unequal decoded lengths fail safely before equal-length timing comparison. Session payload, cookie flags, expiry, database user reload, grant invalidation, and authorization semantics are unchanged.

## Evidence and remaining work

Tests added in this phase import production helpers and exercise runtime helpers/handlers with mocked repositories where stated. They cover input bounds/prototype safety, foreign/mixed zero-write behavior, minimized persistence, per-problem partitioning, transaction failure control flow, contest storage/read allowlists, diagnostic export/non-mutation, final export serialization, confirmation/client-creation order, safe error classification, audit sentinel absence, and signing behavior. Mocked transaction rollback tests prove callback behavior, not PostgreSQL rollback. Source-structure tests remain static. There is no PostgreSQL integration, database, Preview, Production, provider, or endpoint evidence in this pass.

Remaining H-11 work:

- encryption and lifecycle controls for plaintext portable bundles;
- a policy and implementation for Writing drafts/submissions/model feedback/provider output;
- general retention/expiry and abandoned-record cleanup;
- account deletion/anonymization and relation policy;
- plaintext contest access-code hashing via a future additive schema migration;
- separately approved historical diagnostic/contest/submission/audit data shaping;
- historical classroom/assignment retention policy;
- provider deletion/log-retention verification;
- real isolated PostgreSQL rollback/concurrency/data-shaping tests.

## Schema/data-operation decision

No Prisma schema or migration is required for this bounded implementation. New minimized shapes fit existing JSON columns. Removing or transforming historical JSON is an operational data-shaping task, not a schema migration, and requires separate authorization, backup, rollback design, dry-run counts, and isolated PostgreSQL evidence. Hashing contest access codes requires a future additive migration and transition plan. No such operation occurred here.

## Repository verification

The final suite contains 426 tests across 37 files: 298 runtime production helper/handler/action/page/component/orchestrator tests with mocked collaborators where stated, 10 simulations, 118 static source/structure checks, and 0 PostgreSQL integration tests. Both required default parallel `npm.cmd test` runs pass all 426 tests. The release-blocking focused run covered 86 tests across 8 files.

`prisma validate`, `prisma generate`, TypeScript typecheck, ESLint, and the optimized Next.js build pass. Build page collection used explicit synthetic unreachable process configuration and emitted only fixed generic database signals. The default test timeout was fixed at its cause: invalid XLSX signatures now fail before the expensive ExcelJS dynamic import, while the cleanup route is imported once at module setup rather than inside a five-second test body. No assertion, fixture, security check, or timeout was weakened, and no global timeout was increased. Both default test runs pass. `npm audit` and `npm audit --omit=dev` complete with nonzero status and report four moderate vulnerability instances across the existing PostCSS/Next and UUID/ExcelJS advisory paths. No audit fix, upgrade, or lockfile edit was performed. Prisma also reports its existing package-configuration deprecation warning.

## Safety boundary

Implementation and verification are repository-only. No real database, endpoint, browser, provider, environment value, migration, seed, backup, export, import, cleanup, deployment, commit, push, or historical rewrite is part of this phase.
