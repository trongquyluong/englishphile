# Security Phase 1D-D1 — Bounded Writing AI

Date: 2026-07-28

## Verdict

Phase 1D-D1 has a narrowly scoped Production `INVALID_RESPONSE` recovery
hotfix. Local verification and owner-attested Preview reconciliation are
recorded separately below; Production deployment and post-merge verification
remain pending. Before this hotfix, the owner observed a real Production
submission reach the provider and return an unusable structured result. The
learner allowance changed from 2 to 1 under the previous provider-started
policy, but no `WritingSubmission` was created, so completion and review could
not be restored.

Raw provider output was intentionally not logged or retained. The safe
root-cause classification is `WritingGraderError: INVALID_RESPONSE`; the exact
malformed field, provider envelope subtype, JSON truncation subtype, or other
schema defect remains unprovable and is not claimed.

This does not close H-11. Essay text, prompts, normalized model feedback, and
Writing submission rows retain their existing lifecycle. A separately approved
retention/deletion phase is still required.

## Provider boundary

- Provider: Cloudflare Workers AI, called directly from the server.
- Reviewed model: `@cf/meta/llama-3.1-8b-instruct-fast`.
- The previous `@cf/qwen/qwen3-30b-a3b-fp8` model and arbitrary configured
  model names are rejected.
- AI Gateway is not used.
- The API token is server-only and must have only the Workers AI permission
  required for the configured account.
- The model override is fail-closed: any model other than the reviewed model
  disables the grader until it is explicitly reviewed in code.
- Output is requested with JSON Schema and independently validated with Zod.
  Malformed or incomplete output is rejected and never persisted as a
  successful grade.
- The output budget is capped at exactly 2,000 tokens and the provider request has a
  50-second timeout inside the existing 60-second route duration.
- The JSON Schema and normalizer retain exactly four criterion objects; cap
  criterion comments at 140 characters and the overall comment at 240; cap
  strengths and priority issues at four each; cap detailed feedback at three
  entries with quote/issue/explanation/revision bounds of 100/80/140/140
  characters; cap the suggested thesis/paragraph at 160/360; require three to
  four next-practice tasks; and cap warnings at three. Modestly oversized
  allowlisted strings/lists are safely truncated; malformed, unknown-key, or
  excessively oversized shapes fail closed. The total remains recomputed from
  normalized criterion scores.
- Logs contain only fixed diagnostic events, provider HTTP status class, and an
  allowlisted finish reason (`stop`, `length`, `content_filter`, or `unknown`).
  Essay text, prompts, feedback, raw bodies, credentials, identities,
  reservation IDs, and raw Prisma/provider errors are not logged.

Required server configuration:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_WRITING_MODEL=@cf/meta/llama-3.1-8b-instruct-fast
WRITING_AI_GLOBAL_DAILY_LIMIT=15
```

The site-wide limit defaults to 15 when omitted and rejects configured values
outside the integer range 1–100. Operators may set a lower value to fit the
available free allowance.

## Quota and failure behavior

The request boundary retains this order:

1. Exact-origin validation.
2. Authentication.
3. Provider/configuration availability.
4. Existing learner and global short-term burst limits.
5. Bounded request parsing and prompt lookup.
6. Two-per-learner UTC-day reservation.
7. Site-wide UTC-day allowance.
8. Provider-start marker.
9. Cloudflare request.
10. Atomic completed-submission persistence.

The learner's “2 lượt chấm bài/ngày” now means two successfully persisted
grades. Validation errors and site-wide denials release unstarted learner
reservations. After the provider starts, an invalid result, provider
rate-limit/content block, network/provider failure, or unexpected pre-commit
failure releases only the exact `reservationId + userId` row while it remains
`PENDING` with `providerStartedAt` set. The atomic success transaction changes
that row to `COMPLETED` and creates `WritingSubmission`; the release predicate
therefore never deletes or reopens a completed slot. If release or authoritative
quota reading fails, the response remains conservative and does not claim that
an allowance was restored.

Legacy and current `FAILED` rows do not count as occupied learner slots.
Reservation acquisition uses one PostgreSQL `INSERT ... ON CONFLICT ... DO
UPDATE ... WHERE status = 'FAILED'` statement to recycle only the conflicting
same-user/date/slot failed row. Recycling resets it to `PENDING`, clears
provider-start/completion/failure fields, and applies the new expiry; `PENDING`
and `COMPLETED` rows cannot be recycled. No Production row was deleted,
modified, or manually rewritten for this hotfix. The already observed
`FAILED/INVALID_RESPONSE` row becomes reusable through deployed application
semantics, not an operational data cleanup.

The global allowance is stored through the existing atomic database rate-limit
primitive under action `writing-grade-daily-global` and the current UTC date.
Missing or failed limiter infrastructure prevents the provider call. A denied
global allowance may conservatively remain consumed if a later pre-provider
transition fails; it never permits spending beyond the configured ceiling.
Once a provider call is attempted, this global UTC-day allowance is not
decremented or refunded even when the learner reservation is released. The
existing six Writing requests per learner per ten minutes and global
short-window limiter are unchanged.

## Learner communication

The learner workflow uses concise product language and does not expose
provider, infrastructure, or configuration details inline. The Privacy page
identifies Cloudflare Workers AI, explains the purpose and data-processing
boundary, and advises learners to provide only content needed for practice.
The Terms page records automated Writing processing and links to the Privacy
page for the provider and data details.

The UI reports two daily successfully persisted Writing grades. Successful and
recoverable failed grade responses carry a bounded authoritative `remaining`
value whenever the current quota can be read safely, and the Client Component
updates the quota card from it. A failed grade is never labeled submitted or
graded.

For a recoverable failure, the client saves only `{ version, essayText,
targetWordCount, timestamp }` in `sessionStorage`. The storage key contains a
server-derived HMAC over the authenticated user and static prompt, so the raw
user ID and prompt are not stored or passed as key material. Draft restoration
reapplies the existing essay character/word bounds and target-word-count
allowlist, rejects malformed/oversized/future values, expires after at most 24
hours, and is limited to the same browser session. A different authenticated
user receives a different opaque key. Each successful review carries a bounded
integer millisecond timestamp derived from its persisted
`WritingSubmission.createdAt`; it exposes no identity or provider data.
Successful persistence and response attempt to clear the draft. Feedback,
provider payloads, credentials, user IDs, email addresses, and prompt text are
never placed in browser storage.

A browser draft is restored only when no successful server review exists or its
timestamp is strictly newer than the latest persisted review timestamp. Older
or equal-time drafts cannot hide the server review and are removed on a
best-effort basis. Restoring or preserving a newer failed draft clears older
visible feedback and exits stored-review mode, so the draft is shown only as
ungraded. “Bỏ bản nháp” restores the unchanged latest server-backed review only
after browser deletion is confirmed; on deletion failure the draft remains
visible with a generic retry message and no provider request. Forms remount by
prompt slug, preventing state from one Writing prompt carrying into another.
`sessionStorage` is strictly best-effort: property access and all
load/save/clear operations are guarded. Storage failure cannot replace a
successful API result with an error, hide returned feedback, alter quota, or
trigger another provider request.

## Writing review UX correction

Owner testing of the initial Preview found two presentation defects: the quota
card stayed at its pre-submit value until a full refresh, and a refresh removed
the visible essay/feedback even though the successful submission was already
stored. The Gym card consequently offered “Xem lại” without restoring the
review.

The correction keeps the quota card inside the Writing Client Component and
updates it from the bounded `remaining` value returned by the successful grade
API. It does not reserve another slot or make a second provider call.

On initial page load or refresh, the server now selects only the newest
`WritingSubmission` matching both the current session `userId` and the selected
static `promptSlug`. Only `essayText`, `targetWordCount`, and `resultJson` are
selected. Stored feedback crosses the learner Server Component boundary only
after a bounded positive mapper validates the complete expected grade shape and
discards unknown keys. Malformed, oversized, or unsupported historical values
fail closed to no restored review. The learner’s saved essay and latest safe
feedback are then restored, so “Xem lại” is functional and the learner can edit
the essay before using another daily attempt. Completed Gym cards link directly
to the restored feedback section.

This adds no schema, migration, provider call, or duplicated persistence. It
does not change Writing retention: the existing essay/result row remains stored
under the previously documented lifecycle, so H-11 remains **Partially
remediated**.

## Local verification

- Prisma validation: passed.
- Prisma generation: passed.
- Typecheck: passed.
- Lint: passed.
- Focused draft-freshness/review/page/API/quota/security tests: 10 files, 101
  passed.
- Complete test suite: 57 files, 557 passed, 8 opt-in PGlite tests skipped.
- Production build: passed with an explicit unreachable synthetic database
  configuration; expected database collection failures were sanitized.
- `npm audit --omit=dev`: exit 0, zero vulnerabilities.
- Full `npm audit` was not requested or rerun; the prior documented
  development-only brace-expansion/ESLint finding is unchanged.
- `git diff --check`: passed.

Focused coverage includes:

- exact reviewed-model and global-limit configuration;
- direct Workers AI endpoint and bearer authentication;
- JSON Schema request and both supported response envelopes;
- score normalization and invalid-output rejection;
- provider 429 mapping;
- bounded allowlisted diagnostics for HTTP class, envelope, empty result, JSON
  decoding, schema validation, finish reason, and persistence failures;
- no synthetic essay/token/provider/database sentinel in captured logs or
  learner errors;
- learner two-attempt quota behavior;
- exact release of only a still-`PENDING`, provider-started learner reservation;
- release after invalid/provider/network/rate-limit/persistence failures while
  leaving the global provider-attempt allowance consumed;
- conservative release-failure behavior and authoritative bounded failure
  `remaining` values where safely readable;
- at-most-two concurrent successful daily persistence calls;
- site-wide exhaustion and infrastructure failure before provider invocation;
- reservation release when a provider call has not started;
- immediate quota-state transition from successful and recoverable failed API
  responses;
- strict draft-versus-review freshness, same-session failed-essay restoration,
  24-hour expiry, malformed and oversized rejection, opaque cross-user
  isolation, and deletion-confirmed discard behavior;
- current-user and prompt-scoped latest-review selection;
- bounded positive mapping of stored Writing feedback;
- restored essay, grade feedback, and quota rendering after a refresh;
- provider-neutral learner copy and consolidated Privacy/Terms disclosure.

No PGlite or managed PostgreSQL test ran for this phase. Local verification did
not access a real Cloudflare account, database, endpoint, Preview, Production,
migration, import, export, backup, cleanup, deployment, or data rewrite.
Relevant environment variables were explicitly overridden with synthetic
loopback or blank values. Prisma and Next nevertheless reported their automatic
local env-file discovery/loading behavior; no env value was printed, and the
build used the explicit synthetic process values. The final review must retain
this tooling caveat rather than claiming that the CLI skipped local env files.
Mocked behavioral concurrency tests and a precise static SQL assertion cover
legacy `FAILED` reuse. Executing the conditional `ON CONFLICT` statement against
managed PostgreSQL remains Preview/Production verification debt; no external
database was accessed for this review.

## Owner-attested Preview reconciliation

The owner separately verified the deployed Preview behavior. This is
operational evidence, not repository test evidence or browser automation.

- At hotfix commit `02e9ef357ab08b985fdc10abdead1303ca8cbe49`, the Preview
  target reached `READY`; health and database checks passed. PR #18 remained
  OPEN and Draft.
- Preview used the reviewed
  `@cf/meta/llama-3.1-8b-instruct-fast` model. The learner began with `1/2`
  displayed attempts.
- An offline network failure preserved the essay without reducing the displayed
  learner quota. Navigating away and back in the same browser session restored
  the failed draft, and older feedback was absent while that newer ungraded
  draft was active.
- One real AI grade then succeeded. The quota updated immediately without a
  refresh; refreshing preserved the successfully graded essay and feedback;
  and “Xem lại” restored the latest successful server-backed review.
- “Bỏ bản nháp” restored the latest successful review and triggered no provider
  request.
- The checked Preview runtime window contained no errors and no sensitive data
  in the checked logs.

This is evidence for one successful real Preview grade and the specifically
observed failure/draft/review flows. It is not comprehensive provider or model
coverage. It does not claim a second real AI attempt, provider-retention
verification, or managed-PostgreSQL execution of the conditional `FAILED`-row
recycling SQL.

Earlier Preview checkpoints remain historical evidence:

- The initial provider integration at `d8ff4a8` graded a bounded Writing
  submission successfully with the configured Cloudflare account, token,
  reviewed model, and site-wide daily limit of 15.
- The review-state correction at `3b58991` updated the quota without refresh,
  restored the latest essay and feedback after refresh, linked “Xem lại” to the
  feedback section, treated an edited essay as the newest submission, and
  preserved cross-user isolation.
- The learner-copy correction at
  `6844d2b23722e1d176809243b0afe9fa12d2cacb` displayed provider-neutral quota
  wording, removed provider wording from the Writing workflow, preserved the
  review/refresh behavior, and exposed the data-processing disclosure through
  Privacy and Terms instead.
- PR #18 remained OPEN, Draft, and mergeable at this checkpoint. Vercel and
  Vercel Preview Comments both passed for the copy-correction head.
- Checked Preview runtime windows contained no relevant error or sensitive
  data.

The copy-only checkpoint did not repeat the provider call or claim a new
quota-consumption, database, cross-user, or provider-retention test. It remains
historical evidence for the previous reviewed model only. The current
owner-attested Preview reconciliation above supersedes only the statement that
Llama-model Preview retesting was pending. Production deployment and post-merge
verification remain pending; Production is not described as passing.

## Deployment runbook

1. In Cloudflare, enable Workers AI for the intended account and create a
   dedicated API token with the narrowest Workers AI account permission.
2. In Vercel Preview, configure the four server variables above. Use a Preview
   token separate from Production when possible. Never expose the token through
   a `NEXT_PUBLIC_` variable or paste it into logs/chat.
3. Deploy the exact review commit to Preview and require `READY`, passing health
   and database status, owner/admin access, and ordinary-learner admin denial.
4. Submit one synthetic non-sensitive essay. Require a structured result,
   bounded Vietnamese feedback, no canonical/provider fields in unrelated
   learner responses, and no raw provider response in the UI.
5. Verify that the same learner receives at most two successfully persisted
   grades in one UTC day and that another learner has an independent allowance.
   In an isolated synthetic failure check, require the learner slot to remain
   available while the global provider-attempt allowance remains consumed.
6. Without refreshing, require the quota card to change from 2/2 to 1/2 after
   the first successful grade. For a recoverable failure, navigate away and
   back in the same session, require “Đã khôi phục bản nháp chưa được chấm.”,
   and require no completed/submitted label. After retry success, require the
   draft to be cleared. Refresh the page, return through “Xem lại”, and require
   the same learner’s latest successful essay and feedback to remain visible
   and editable.
7. Temporarily lower the site-wide limit in an isolated Preview window and
   verify deterministic denial before provider invocation after the ceiling.
   Restore the intended cap and redeploy.
8. Inspect the bounded runtime-log window. Require no essay, prompt, API token,
   provider response, personal sentinel, or raw error.
9. Configure separate Production credentials, redeploy the known merged commit,
   and repeat one bounded synthetic smoke. Record provider deployment
   provenance, health, origin/auth boundaries, quota behavior, and log outcome.

## Remaining decisions

- Define and enforce retention/deletion for Writing essays, prompts, normalized
  feedback, provider-side data, and backups.
- Give learners a deletion path or maintain a tested operator deletion
  procedure during invite-only beta.
- Confirm Cloudflare account-level data controls and operational token rotation.
- Monitor actual neuron consumption and lower the global cap if the selected
  model exhausts the free daily allowance before 100 requests.
- Reassess model quality and cost before changing the allowlisted model.

H-11 remains **Partially remediated**.
