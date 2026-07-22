# Englishphile Security Phase 1D-A Report

**Date:** 2026-07-17
**Implementation branch:** `security-phase-1d-a-diagnostic-answer-exposure`
**Production reconciliation branch:** `docs/phase1d-a-production-verification`
**Finding:** H-10 — diagnostic and learner answer-key exposure
**State:** Remediated in repository code; PR #10 merged at `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59`; owner-attested isolated Preview sentinel checks and selected Production structural, response-shape, authorization, regression, and runtime-log checks passed; PostgreSQL integration and ongoing monitoring remain outstanding

## Scope and disposition

Phase 1D-A applies the confirmed policy that canonical answers remain server-side. Learner browser boundaries may receive submitted-answer state, per-question correctness, fixed generic feedback, and aggregate score/progress data. They may not receive canonical answers, accepted-answer lists, model answers, corrections, answer-bearing explanations, raw answer metadata, unfiltered option objects, or server scoring configuration.

The original H-10 condition was exploitable with High severity because raw question records and answer-derived feedback crossed learner Server Component, Client Component, API, and stored diagnostic-result boundaries. Anonymous visitors could inspect published problem question props; authenticated learners could inspect random-practice/diagnostic props and harvest canonical text from submission feedback. Authorization and replay controls limited cross-user diagnostic reads but did not make answer-key fields learner-safe.

H-10 is remediated in repository code through positive allowlists and server-only scoring. PR #10 merged, and owner-attested evidence dated 2026-07-17 records both isolated Preview sentinel verification and selected Production verification at the explicitly bounded levels described below.

## Repository evidence

- PR #10 merged into `main` at merge commit `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59`.
- Learner question, submission, attempt-summary, and diagnostic-result DTOs use positive field allowlists rather than spreading persistence records.
- Practice responses use fixed generic feedback that is not derived from canonical answers or explanations.
- Diagnostic scoring remains server-side and `scoreDiagnosticAttempt` returns no sensitive result object.
- Newly finalized diagnostic metadata stores only allowlisted scoring/reporting fields; it does not duplicate canonical answers or answer-bearing feedback.
- Historical diagnostic rows were not rewritten, and learner-facing parsing ignores sensitive legacy keys through an allowlist.
- Diagnostic result reads require the current user ID, finalized `COMPLETED`/`NEEDS_REVIEW` status, and non-null completion; the DTO mapper independently enforces finalized status and completion.
- Admin editor/preview mapping remains separate, server-only, and answer-complete.
- Phase 1D-A has no schema change or migration.
- The committed local suite remains 366 tests: 242 runtime/helper/handler/action/page tests, 8 simulations, 116 static checks, and 0 PostgreSQL integration tests.

## Learner payload behavior

Learner question presentation contains only:

- stable question ID, question type, skill, difficulty, prompt/passage;
- normalized options with only `id` and display `text`;
- safe structural presentation values such as root word, keyword, target sentence, line number, ordering, problem title, audio URL, and section type.

Learner submission responses contain submission/aggregate status, score, total, question ID, boolean/null correctness, and one fixed feedback string:

- correct: `Chính xác.`
- incorrect: `Chưa chính xác. Hãy xem lại kiến thức liên quan.`
- manual review: `Đã ghi nhận câu trả lời. Nội dung này đang chờ xem xét.`

Feedback is selected only from correctness. `checkQuestionAnswer().feedback`, `correctAnswer`, and explanations remain internal to persistence/scoring and are not serialized to learners.

Diagnostic result data contains only attempt summary fields, aggregate skill/topic breakdowns, and aggregate scoring/confidence fields. It contains no per-question canonical answer, explanation, stored recommendation object, or raw Prisma attempt.

## Authorization, scoring, and persistence

- Diagnostic presentation is selected separately from diagnostic scoring. Presentation selectors do not load answer/explanation fields; scoring selectors load them only on the server.
- `getDiagnosticQuestionsForAttempt` scopes by attempt and user and returns a learner-safe attempt summary plus learner question DTOs.
- `scoreDiagnosticAttempt` scopes the attempt by ID, current user, and `IN_PROGRESS`, computes correctness/score/profile/recommendations server-side, preserves the transaction and conditional single-winner finalization, blocks replay, and returns `void`.
- Result lookup scopes by attempt ID and current user ID, allows only `COMPLETED` and `NEEDS_REVIEW` with a non-null completion timestamp, and returns `null` for missing, foreign, incomplete, abandoned, or stale/disallowed attempts. Page/action behavior maps this to the same generic unavailable flow.
- `toLearnerDiagnosticResultDTO` independently rejects a result unless its status is `COMPLETED`/`NEEDS_REVIEW` and `completedAt` is non-null, so an over-returning or changed repository selector cannot bypass the completion gate.
- `getLatestFinishedDiagnosticAttempt` now also requires non-null `completedAt`. This is a semantic consistency correction: the function feeds finished-attempt UX, so a status-only row without a completion timestamp is not treated as genuinely finished. Other status-oriented helpers were not broadened or changed.
- The learner result path contains no role- or email-based cross-user bypass. The production-page test confirms stored-ADMIN and owner-shaped current-user fixtures are still scoped to their own session user ID; separate content-admin policy tests, not this page test, establish `OWNER_EMAIL` matching.
- Newly finalized diagnostic `recommendationJson` stores only question ID, problem ID, skill, difficulty, correctness, section/coverage identifiers, and aggregate scoring. It stores no duplicated `correctAnswer` or answer-bearing feedback.
- Historical rows were not rewritten. The learner parser reconstructs allowlisted fields and ignores legacy sensitive keys instead of spreading stored JSON.

## Ordinary practice and review surfaces

The same answer-key policy is applied to published problem presentation, random practice presentation, single-problem submission, random-practice submission, learner analytics, skill analytics, wrong-question review, and contest result rendering. Submitted learner answers and correctness remain visible; canonical answers and stored answer-bearing feedback do not.

Contest scoring storage is not redesigned by this phase. H-11 remains the separate at-rest finding. The learner contest-result page no longer renders the stored canonical-answer or feedback fields.

## Admin boundary

Admin editor/preview access uses an explicitly separate server-only mapper that retains answer, explanation, metadata, and raw option fields. Learner DTOs are not reused or weakened to serve admin editing. Existing `ADMIN` and normalized `OWNER_EMAIL` authorization remains in place.

## Portable export boundary

Portable backup/export is operator-only server-side tooling, not a learner browser boundary. It may contain historical server-side diagnostic or contest data, including legacy answer material. Phase 1D-A did not run an export and did not clean historical rows.

## Runtime and static evidence

Runtime/helper/handler/action coverage includes:

- recursive sentinel sanitization of learner question/problem/submission/diagnostic DTOs;
- raw option-property, metadata, explanation, accepted-answer, correction, and model-answer removal;
- fixed correct/incorrect/manual-review feedback;
- exact response shapes for both practice handlers, including arbitrary published identifiers;
- diagnostic presentation shape and historical JSON sanitization;
- server-side canonical scoring, safe new finalization storage, `void` scoring return, and replay rejection;
- owned finalized result acceptance and equivalent unavailable results for foreign, missing, incomplete, abandoned, and stale/disallowed selector inputs;
- a runtime test that imports and invokes the real diagnostic result page, with `requireUser`, result selectors, recommendations, and `redirect` mocked, proving that stored-ADMIN, owner-shaped STUDENT, and ordinary-STUDENT fixtures are scoped only by `requireUser().id` and receive no query-parameter cross-user bypass;
- direct Server Action authorization/error handling with generic local redirects;
- explicit admin preview answer access.

The production-page test is not an end-to-end cookie/session test. Its owner-shaped STUDENT fixture represents a current user already resolved by the mocked session boundary; it does not independently verify `OWNER_EMAIL` configuration matching. Existing content-admin policy tests remain the evidence for normalized `OWNER_EMAIL` resolution.

Static tests are labeled `Phase 1D-A static wiring checks (not runtime/browser evidence)`. They cover Server Component DTO wiring, practice response serializers, diagnostic result selector wiring, allowlisted diagnostic persistence, separate admin mappings, and removal of canonical-answer rendering from learner review pages.

Mocked Prisma/transaction collaborators establish production-helper behavior but are not PostgreSQL integration evidence. The production-page test imports the actual page but mocks its session and repository/result collaborators. At the local repository-verification checkpoint, no browser automation, cookie/session integration, page-source inspection, RSC flight-payload inspection, deployed endpoint invocation, real database access, environment-value inspection, or provider access was performed. The later browser/RSC observations below are separate owner-attested isolated Preview operational evidence, not repository tests.

The complete suite contains 366 tests: 242 runtime/helper/handler/action/page tests, 8 simulations, 116 explicitly static checks, and 0 PostgreSQL integration tests.

## Local verification results (historical repository checkpoint)

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — passed with Prisma 6.19.3; no schema change was generated.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed with zero warnings after correction.
- `npm.cmd test` — 29 files and 366 tests passed.
- `npm.cmd run build` — passed. Dotenv files were temporarily held by pathname without reading them, and non-URL synthetic configuration caused existing build-time health queries to fail validation before any endpoint or database connection attempt.
- `git diff --check` and `git diff --cached --check` — passed after all intended Phase 1D-A files were staged.

No online or offline npm audit was part of that correction pass. The four previously documented moderate advisories remain unresolved; the prior offline zero result is not authoritative remediation evidence. No migration, seed, import, export, deployment, commit, or push was run during that local verification checkpoint.

## Owner-attested isolated Preview operational reconciliation (2026-07-17)

At this historical Preview checkpoint, PR #10 was Draft/open. It subsequently merged as recorded in the Production section below. Code commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b` reached READY in isolated Preview, and health passed with the database connected.

The owner attests that the following tested boundaries passed:

- a missing-Origin POST was rejected with HTTP 403 by the origin guard;
- a same-origin unauthenticated submission was rejected with HTTP 401 by the authentication boundary;
- anonymous published-problem HTML and its RSC payload contained neither synthetic canonical-answer nor explanation sentinel;
- authenticated single-problem and random-practice responses contained only learner-safe result fields and fixed generic feedback;
- diagnostic-start HTML and RSC payloads contained neither sentinel;
- diagnostic-result HTML and RSC payloads contained neither sentinel and remained aggregate-only;
- foreign and incomplete diagnostic attempts followed the unavailable flow;
- an authorized admin preview retained answer and explanation access;
- ordinary `STUDENT` admin denial passed; and
- checked Preview runtime logs reported no runtime errors or sensitive values.

The sentinel values were synthetic and non-sensitive, and their exact values are intentionally not recorded. No account identity, cookie, deployment ID, infrastructure hostname, database identifier, or protected URL is recorded. Browser and RSC inspection was owner-attested operational evidence; browser automation is not claimed. This evidence does not establish PostgreSQL integration, transaction/concurrency behavior, database-row contents, or historical-row cleanup. Synthetic Preview fixture cleanup was not reported. At this historical checkpoint Production deployment and verification were still pending; the later selected Production evidence is recorded below. H-11 at-rest remediation and dependency-advisory resolution are not claimed.

## Owner-attested selected Production operational reconciliation (2026-07-17)

### Deployment

- PR #10 is `MERGED`; merge commit `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59` became the canonical READY Production deployment.
- The Production deployment source was confirmed separately as that merge commit because the Vercel CLI did not report commit metadata.
- Health returned HTTP 200 with the database connected.
- No deployment ID, infrastructure hostname, protected URL, or provider-internal identifier is recorded.

### Origin and authentication

- A missing-Origin submission POST returned HTTP 403 at the origin guard.
- A separate same-origin unauthenticated submission returned HTTP 401 at authentication.
- These results verify distinct boundaries and are not conflated.

### Learner answer boundaries

- Existing published-problem HTML and its RSC payload contained none of the tested forbidden answer-key tokens.
- Authenticated single-problem and random-practice responses contained only the expected safe fields and fixed generic feedback.
- Diagnostic start/result remained learner-safe and aggregate-only; a nonexistent/incomplete own diagnostic attempt followed the unavailable behavior.
- Analytics, skill analytics, wrong-question review, and contest-result review did not expose canonical-answer fields.
- Authorized admin preview retained answer and explanation access.

### Authorization, persistence, regression, and logs

- Owner sign-out/sign-in and admin access passed; ordinary `STUDENT` admin denial passed.
- Independent-practice write and persistence passed.
- Basic contest, diagnostic, and Writing regression smoke passed.
- Checked runtime logs reported no runtime errors or sensitive values, limited to the checked deployment/time window.
- Git branch/status was `main`/clean at the operational checkpoint.

Production used no synthetic sentinel fixtures, so this is not Production sentinel verification. The HTML/RSC evidence was structural forbidden-token inspection and is weaker than the isolated Preview synthetic-sentinel evidence. The supplied facts do not establish comprehensive browser automation, comprehensive security testing, hostile-origin testing, concurrency, rollback, timeout, exactly-once behavior, PostgreSQL integration, database-row inspection, or historical-row cleanup. The contest, diagnostic, and Writing checks were regression smoke only. No Production schema migration was needed or run for Phase 1D-A. H-11 at-rest remediation and dependency-advisory resolution are not claimed.

## Schema and migration

No Prisma schema change was necessary, and no Phase 1D-A migration exists. No Production schema migration was needed or run for this phase. Existing persisted columns can hold the reduced JSON shape.

## Remaining operational verification plan

1. Run isolated PostgreSQL integration for finalization winner/replay behavior if separately authorized; do not inspect or rewrite historical rows as part of H-10 remediation.
2. Continue bounded runtime-log monitoring and repeat selected Production authorization and learner-payload checks after relevant releases.
3. Keep future operational records free of identities, secrets, protected URLs, deployment/provider identifiers, and canonical-answer values.

## Remaining findings and Test debt

- Synthetic Preview fixture cleanup was not reported.
- There is no PostgreSQL integration evidence for this phase.
- H-09 signed-session invalidation remains unresolved.
- H-11 contest answer-key storage at rest remains unresolved.
- Random-email authentication bucket amplification remains unresolved.
- Four moderate dependency advisories remain unresolved.
- Private-contest Production smoke remains outstanding.
- Existing PostgreSQL concurrency, rollback, timeout, recovery, and exactly-once Test debt remains.
- Ongoing runtime-log monitoring remains an operational requirement.

## Documentation-pass safety

This Production reconciliation used only the supplied owner-attested runtime facts and local repository documentation. It did not access a database, environment value, endpoint, browser, logs, GitHub, Vercel, Neon, or another provider, and it did not run Prisma, typecheck, lint, tests, build, audit, migration, seed, import, export, deployment, commit, push, or PR/provider mutation operations.

## Historical linkage to Phase 1D-B1

Phase 1D-B1 builds on this phase’s learner allowlists without changing the Phase 1D-A conclusion or rewriting diagnostic rows. The later no-migration pass reuses the positive diagnostic metadata/breakdown sanitizers at the portable-export boundary so historical answer-bearing keys are not reproduced in new bundles. It does not prove that such rows exist, clean any database row, or close H-11. See `docs/SECURITY_PHASE_1D_B1_REPORT.md` for the repository-only implementation boundary.
