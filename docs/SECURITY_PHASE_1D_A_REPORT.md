# Englishphile Security Phase 1D-A Report

**Date:** 2026-07-17
**Branch:** `security-phase-1d-a-diagnostic-answer-exposure`
**Finding:** H-10 — diagnostic and learner answer-key exposure
**State:** Local implementation remediated; owner-attested isolated Preview sentinel verification passed for the tested boundaries at commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b`; Production deployment, Production verification, and PostgreSQL integration remain pending

## Scope and disposition

Phase 1D-A applies the confirmed policy that canonical answers remain server-side. Learner browser boundaries may receive submitted-answer state, per-question correctness, fixed generic feedback, and aggregate score/progress data. They may not receive canonical answers, accepted-answer lists, model answers, corrections, answer-bearing explanations, raw answer metadata, unfiltered option objects, or server scoring configuration.

The original H-10 condition was exploitable with High severity because raw question records and answer-derived feedback crossed learner Server Component, Client Component, API, and stored diagnostic-result boundaries. Anonymous visitors could inspect published problem question props; authenticated learners could inspect random-practice/diagnostic props and harvest canonical text from submission feedback. Authorization and replay controls limited cross-user diagnostic reads but did not make answer-key fields learner-safe.

H-10 is remediated in local code through positive allowlists and server-only scoring. Owner-attested isolated Preview evidence dated 2026-07-17 verifies the tested browser/RSC and response boundaries described below. This report does not mark H-10 deployed to or verified in Production.

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

## Verification results

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — passed with Prisma 6.19.3; no schema change was generated.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed with zero warnings after correction.
- `npm.cmd test` — 29 files and 366 tests passed.
- `npm.cmd run build` — passed. Dotenv files were temporarily held by pathname without reading them, and non-URL synthetic configuration caused existing build-time health queries to fail validation before any endpoint or database connection attempt.
- `git diff --check` and `git diff --cached --check` — passed after all intended Phase 1D-A files were staged.

No online or offline npm audit is part of this correction pass. The four previously documented moderate advisories remain unresolved; the prior offline zero result is not authoritative remediation evidence. No migration, seed, import, export, deployment, commit, or push was run.

## Owner-attested isolated Preview operational reconciliation (2026-07-17)

PR #10 is recorded as Draft/open for this reconciliation; no provider query or PR-state mutation was performed during the documentation pass. Commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b` reached READY in isolated Preview, and health passed with the database connected.

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

The sentinel values were synthetic and non-sensitive, and their exact values are intentionally not recorded. No account identity, cookie, deployment ID, infrastructure hostname, database identifier, or protected URL is recorded. Browser and RSC inspection was owner-attested operational evidence; browser automation is not claimed. This evidence does not establish PostgreSQL integration, transaction/concurrency behavior, database-row contents, or historical-row cleanup. Synthetic Preview fixture cleanup was not reported. Production deployment and Production verification remain pending. H-11 at-rest remediation and dependency-advisory resolution are not claimed.

## Schema and migration

No Prisma schema change was necessary. No migration was created, applied, or deployed. Existing persisted columns can hold the reduced JSON shape.

## Remaining deployment and verification plan

1. Keep PR #10 Draft/open until the normal review decision; this documentation pass does not modify PR state.
2. Run isolated PostgreSQL integration for finalization winner/replay behavior if separately authorized; do not inspect or rewrite historical rows as part of H-10 remediation.
3. Deploy through the normal release process only after approval.
4. Repeat bounded Production authorization and learner-payload smoke checks without recording identities, secrets, protected URLs, or synthetic answer values.

## Remaining findings and Test debt

- Production deployment and Production verification remain pending.
- Synthetic Preview fixture cleanup was not reported.
- There is no PostgreSQL integration evidence for this phase.
- H-09 signed-session invalidation remains unresolved.
- H-11 contest answer-key storage at rest remains unresolved.
- Random-email authentication bucket amplification remains unresolved.
- Four moderate dependency advisories remain unresolved.
- Private-contest Production smoke remains outstanding.
- Existing PostgreSQL concurrency, rollback, timeout, recovery, and exactly-once Test debt remains.
- Ongoing runtime-log monitoring remains an operational requirement.
