# Security Phase 1D-D1 — Bounded Writing AI

Date: 2026-07-28

## Verdict

Phase 1D-D1 is implemented and locally verified. Writing AI now has a
zero-cost-oriented Cloudflare Workers AI provider boundary, two
provider-started attempts per learner per UTC day, and a bounded site-wide
UTC-day allowance. Provider configuration and quota infrastructure fail
closed.

This does not close H-11. Essay text, prompts, normalized model feedback, and
Writing submission rows retain their existing lifecycle. A separately approved
retention/deletion phase is still required.

## Provider boundary

- Provider: Cloudflare Workers AI, called directly from the server.
- Reviewed model: `@cf/qwen/qwen3-30b-a3b-fp8`.
- AI Gateway is not used.
- The API token is server-only and must have only the Workers AI permission
  required for the configured account.
- The model override is fail-closed: any model other than the reviewed model
  disables the grader until it is explicitly reviewed in code.
- Output is requested with JSON Schema and independently validated with Zod.
  Malformed or incomplete output is rejected and never persisted as a
  successful grade.
- The output budget is capped at 1,400 tokens and the provider request has a
  50-second timeout inside the existing 60-second route duration.
- Logs contain only fixed operation, status, and error-class context. Essay
  text, prompts, provider output, credentials, and raw provider errors are not
  logged.

Required server configuration:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_WRITING_MODEL=@cf/qwen/qwen3-30b-a3b-fp8
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

Only a reservation that reaches the provider-start marker consumes one of the
learner's two daily attempts. A validation error or site-wide limit denial
releases the unstarted learner reservation. Once the provider starts, provider
failure consumes the learner slot to prevent unlimited free retries.

The global allowance is stored through the existing atomic database rate-limit
primitive under action `writing-grade-daily-global` and the current UTC date.
Missing or failed limiter infrastructure prevents the provider call. A denied
global allowance may conservatively remain consumed if a later pre-provider
transition fails; it never permits spending beyond the configured ceiling.

## Learner communication

The learner workflow uses concise product language and does not expose
provider, infrastructure, or configuration details inline. The Privacy page
identifies Cloudflare Workers AI, explains the purpose and data-processing
boundary, and advises learners to provide only content needed for practice.
The Terms page records automated Writing processing and links to the Privacy
page for the provider and data details.

The UI reports two daily Writing grades and derives usage from quota
reservations, not merely from completed Writing submissions. Failed
provider-started attempts therefore remain visible in the daily allowance.

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

- Prisma generation: passed.
- Typecheck: passed.
- Lint: passed.
- Focused quota/review/page/API/disclosure tests: 4 files, 17 passed.
- Complete test suite: 52 files, 506 passed, 8 opt-in PGlite tests skipped.
- Production build: passed with an explicit unreachable synthetic database
  configuration; expected database collection failures were sanitized.
- `npm audit --omit=dev`: exit 0, zero vulnerabilities.
- Full `npm audit`: exit 1, retaining only the documented development-only
  brace-expansion/ESLint finding.

Focused coverage includes:

- exact reviewed-model and global-limit configuration;
- direct Workers AI endpoint and bearer authentication;
- JSON Schema request and both supported response envelopes;
- score normalization and invalid-output rejection;
- provider 429 mapping;
- no essay/token logging on network failure;
- learner two-attempt quota behavior;
- site-wide exhaustion and infrastructure failure before provider invocation;
- reservation release when a provider call has not started;
- immediate quota-state transition from a successful API response;
- current-user and prompt-scoped latest-review selection;
- bounded positive mapping of stored Writing feedback;
- restored essay, grade feedback, and quota rendering after a refresh;
- provider-neutral learner copy and consolidated Privacy/Terms disclosure.

No PGlite or managed PostgreSQL test ran for this phase. No real Cloudflare
request, database, endpoint, Preview, Production, migration, import, export,
backup, cleanup, deployment, or data rewrite was performed.

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
5. Verify that the same learner receives at most two provider-started grades in
   one UTC day and that another learner has an independent allowance.
6. Without refreshing, require the quota card to change from 2/2 to 1/2 after
   the first successful grade. Refresh the page, return through “Xem lại”, and
   require the same learner’s latest essay and feedback to remain visible and
   editable.
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
