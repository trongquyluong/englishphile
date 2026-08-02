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

Phase 2 PR 1 establishes a repository-only, database-free product/content audit
baseline at canonical base `52f0ec030196ec202c26872325a29d0ddb5d3db6`.
Run `npm run audit:content-packs` for readable tables or
`npm run --silent audit:content-packs -- --format=json` for machine-readable
output. The command shares the importer’s pure selector and JSON/CSV
normalizers, audits every importer-selected file, supports manifest-optional
packs, and compares any manifest bidirectionally with that selected set.
Numbered splits take precedence over `00-all-in-one` mirrors when both are
present. The baseline parses 2 packs, 17 selected split files, 101 problems,
and 495 questions with zero manifest mismatch and zero import-normalizer error;
see
[`docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md`](docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md)
for evidence classification, route journeys, quality findings, difficulty
rubric, backlog, curriculum proposal, and the first 21-problem/84-question
representative batch. This phase does not change learner/admin behavior or
weaken the Phase 1D-A learner-safe DTO.

Phase 2 PR 2 defines the pre-authoring workflow at canonical base
`c8b93faaaf1670f432a340675951cc0c65ad088b`. Its operational source is
[`docs/PHASE_2_CONTENT_QA_WORKFLOW.md`](docs/PHASE_2_CONTENT_QA_WORKFLOW.md),
with the reusable pack record at
[`content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md`](content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md).
It specifies eleven lifecycle stages, human linguistic/rendering/calibration
gates, contracts for all twelve pilot question types, and the 21/84 acceptance
boundary without creating content. Listening remains blocked, Writing remains
non-auto-scored, HSG is deferred, and pilot items remain diagnostic-ineligible
until stable calibration evidence exists.

The repository audit adds two non-blocking deterministic signals.
`rendererIncompatibleOptions` covers objective DTO/scorer failures such as too
few renderable options, invalid or scorer-equivalent duplicate IDs,
missing/invalid display text, and selected answers outside rendered options,
including `ERROR_IDENTIFICATION`. Historically, it exposed 55 existing Error Identification
questions with no renderable options. `duplicateNormalizedOptionTexts`
separately identifies editorial ambiguity after NFKC, whitespace, trim, and
lowercase normalization; renderers still display the original stringified
values. Neither warning changes import, database, learner, admin, scoring, or
publication behavior or replaces human linguistic review.

Phase 2 PR 3 implements the Error Identification contract on branch
`phase2/03-error-identification-contract` from canonical base
`1b9dccd0cc9ebf7ee8b948dce171b464bcb59c05`. The existing Prisma JSON fields
already support it, so there is no schema or migration change. A valid question
has exactly four renderable parts with unique canonical A–D IDs, non-empty
display text, a member `answer.correctPart`, and a non-empty bounded
slash-delimited `answer.correction`. The existing string `errorPart` import
alias is normalized to `correctPart`; no new answer field is introduced.

The same pure option/answer contract now feeds JSON/CSV normalization,
repository audit, persisted QA, minimal publication validation, immediate
import-publish validation, learner/admin DTO projection, and scoring.
`NEEDS_REVIEW` import keeps render/options gaps as exact-location warnings so
draft content can be repaired, while missing/unbounded answer data remains a
fatal import error. Persisted QA, bulk `publish-safe`, individual publish,
edit-to-publish, and immediate JSON/CSV import-publish all fail closed for any
contract gap.

The learner DTO emits only canonical `{id,text}` parts and returns an empty
option list for malformed persisted Error Identification data. It never emits
`correctPart`, correction variants, explanations, raw options, or metadata.
Admin preview remains separately answer-complete and keeps `rawOptions` for
repair, while the production renderer receives the same safe projection and
preview mode still suppresses submissions. The renderer uses one labelled
native radio group plus a separate correction input; legacy missing options
show a fixed Vietnamese unavailable notice without crashing. Scoring requires
both the canonical part and one normalized slash-delimited correction variant.
Writing and Sentence Transformation scoring are unchanged.

At the historical Phase 2 PR 3 checkpoint, the 55 legacy repository questions in
`content-packs/pilot-pack-001/07-error-identification-pack-001.json` and
`content-packs/content-pack-002/07-error-identification-pack-002.json` were
unchanged with `options=null`. They produced exactly 55 non-fatal
`rendererIncompatibleOptions` findings and 56 import-normalizer warnings (the
legacy `correctPart=OK` item adds one canonical-ID warning); the
repository audit exits zero. They are not publication-ready and every
publication path blocks them. A separate reviewed content-repair PR must author
real A–D spans; no options may be synthesized silently.

Phase 2 PR 3 evidence is repository/local only: pure and mocked-path tests,
typecheck, lint, full suite, human/JSON repository audit, deterministic JSON
comparison, synthetic-unreachable build, and `git diff --check` are the
required gates. No database, endpoint, environment value, provider, migration,
seed, import, publication, deployment, or legacy content repair is evidence for
this PR.

Phase 2 PR 4 implements the bounded Trios / Gapped Sentences contract on branch
`phase2/04-trios-contract` from canonical base
`a24ec7ffb606996b234f3d90c156ea366825f778`. The existing Prisma JSON fields
already support it. The only structured sentence source is
`metadata.sentences`: exactly three ordered, non-empty strings, each with
exactly one `_____` marker. `passage` is never split or repaired into the
tuple. One shared answer is resolved from the existing
`acceptedAnswers`/`accepted` aliases, must be a bounded single word, and never
comes from `display` or `metadata.sharedWord`.

The same database-free contract feeds JSON/CSV normalization, immediate
publication validation, persisted QA, individual/edit/bulk publication,
transaction-locked bulk `publish-safe` QA, learner/admin DTO projection,
scoring, and the repository audit. Ordinary `NEEDS_REVIEW` import retains
sentence defects as exact-location warnings; answer defects are fatal. Every
defect blocks publication. The learner DTO exposes only an all-or-nothing
`triosSentences` tuple and never full metadata or answer data. Admin preview
retains raw metadata/answer for repair while using that same safe tuple for
rendering.

`TriosQuestion` now renders the prompt, exactly three numbered sentences, and
one labelled native input with unique question-specific IDs. Missing safe data
shows a Vietnamese unavailable notice and no answer control. Disabled handlers
fail closed, and the answer shape remains a string. Scoring independently
requires one valid configured word plus a non-empty learner string; malformed
historical rows and blank values cannot score correct. Other text, Writing,
Sentence Transformation, and Error Identification scoring branches are
unchanged.

The unchanged pilot Trios file contains 3 problems and 15 questions. All 15
structurally use three ordered `metadata.sentences` strings with one `_____`
each and one `answer.accepted` word. This is not linguistic, ambiguity,
difficulty, or calibration approval: all 15 still require human review and are
not automatically pilot-ready. Phase 2 PR 4 evidence is repository/local only;
it includes no database, endpoint, import, publication, Preview, Production,
deployment, migration, seed, provider, browser-E2E, or content-pack change.

Phase 2 PR 5 implements the Pronunciation target-span contract on branch
`phase2/05-pronunciation-target-contract` from canonical base
`89eb8ce76a94b55bc6a0ca228f90a90e08f7478c`. The database-free shared
contract requires exactly four unique canonical A-D options, bounded non-empty
string text, one explicit valid target span per option, and a canonical member
`correctOptionId`. Spans use zero-based, half-open Unicode code-point offsets;
combining marks count as separate code points. No span is inferred, clamped,
repaired, or synthesized.

Normal `NEEDS_REVIEW` JSON/CSV import preserves supported `label`/`correctOption`
aliases and target-span data. Option/text/span defects are exact-location
warnings so repairable drafts remain importable; missing, malformed, blank, or
non-member answers are fatal. Persisted QA, individual publish,
edit-to-publish, immediate JSON/CSV publish, ordinary bulk publish, bulk
`publish-safe`, and transaction-locked reload/recheck all enforce the complete
contract.

The learner DTO projects Pronunciation options only as an all-or-nothing,
ordered A-D safe shape containing `id`, `text`, and the validated target span.
It remains answer-free and does not expose raw options, explanation, metadata,
`metadata.focus`, accepted/display aliases, or correct answers. The server-only
admin preview uses the same renderer-safe projection while retaining raw
options, answer, metadata, and explanation for authorized repair. The
Pronunciation renderer uses a semantic fieldset, labelled native radios,
question-specific IDs/names, visible underlining, and the shared code-point
slicer; malformed data shows a fixed Vietnamese review notice with no controls.

Pronunciation scoring now independently requires a complete option/span
contract, a canonical configured A-D member, and a canonical learner A-D
selection. Diagnostic scoring adds only server-side `options` to its scoring
projection; learner presentation queries remain unchanged. Historical
malformed rows cannot score true.

At the historical Phase 2 PR 5 checkpoint, the unchanged Pronunciation pack
contained 6 problems, 30 questions, and
120 options with no target spans. The repository audit reports 30
`pronunciationWithoutValidTargetSpans` findings and 120 new non-fatal
normalizer warnings, for 176 total normalizer warnings including the existing
56 Error Identification warnings. Inventory remains 2 packs / 17 files / 101
problems / 495 questions, 55 Error Identification renderer findings, 15 valid
Trios structures, and `hasInventoryErrors=false`.

The separate content-repair PR must have a human linguist identify and author
all four spans for each question, independently revalidate the pronunciation
answer, review ambiguity/dialect/register, improve the explanation, retain
`NEEDS_REVIEW`, and rerun repository audit, admin preview, learner rendering,
publication QA, answer-position, difficulty, and calibration review. Current
`metadata.focus` is insufficient. Structural success does not prove phonetic
correctness. Phase 2 PR 5 repairs or approves none of the 30 current items.

Phase 2 PR 6 implements bounded Writing learner presentation on branch
`phase2/06-writing-rubric-ux` from canonical base
`1c59c49caa71edaa011bd9f6eed5f2ced2af8f46`. The existing Prisma JSON storage
already supports the authored source, so there is no schema or migration
change. The exact source is `Question.answer.rubric`, used by the seed, Writing
import template, and current pilot Writing split as an ordered string array.

A pure all-or-nothing projector accepts one non-empty array of at most 12
strings, trims each criterion, bounds it to 240 UTF-16 code units, preserves
authored order/text, and returns `null` for missing, blank, over-bound, scalar,
object, nested-array, accessor, or otherwise malformed values. It never
stringifies unknown values, emits a partial rubric, mutates caller data, or
copies answer siblings, explanations, raw metadata, model/sample answers,
provider data, admin notes, or repair fields.

The existing positive learner Prisma selector remains answer-free. A dedicated
`server-only` reader selects `{id, answer}` only for already-authorized Writing
question IDs and immediately returns only the safe rubric map. The learner DTO
adds `writingRubric: {criteria: string[]} | null`; every non-Writing question
gets `null`. Problem detail, random practice, and diagnostic presentation use
the map. The admin-authorized, `server-only` preview DTO applies the same safe
projection for the production renderer while retaining its existing raw
answer/explanation/metadata/options repair fields. `requireAdmin`, learner
publication filters, and preview persistence suppression are unchanged.

`WritingQuestion` now uses Vietnamese fixed controls and guidance, explicit
question-specific label/control IDs, a live word count, fail-closed disabled
handlers, an authored criteria list, and a fixed missing/malformed-rubric
fallback. Authored English rubric text is displayed faithfully rather than
automatically translated. Criteria are explicitly framed as self-review, not
an answer or automatic score. Existing learner text is preserved when planning
fields change.

Writing practice scoring remains `isCorrect=null`, submission results remain
neutral `NEEDS_REVIEW`, and authored rubrics never become an answer key or
numeric correctness score. The separate Writing AI grader remains advisory
and its provider, model, quota, prompt, retry, recovery, persistence, and
retention behavior is unchanged. Exact/non-exact Sentence Transformation and
Error Identification, Trios, and Pronunciation behavior is unchanged.

Phase 2 PR 6 evidence is repository/local only: pure/mocked tests,
serialization non-disclosure, structural static rendering, focused scorer and
existing recovery/review regressions, full suite, typecheck, lint, synthetic
unreachable Production build, diff checks, and file-format checks. It includes
no database, endpoint, environment-value, provider, import, publication,
Preview, Production, migration, seed, deployment, browser-E2E, or screen-reader
verification. Human English/Vietnamese linguistic, rubric-quality, task
alignment, originality, difficulty, and calibration review remains required.

Phase 2 PR 7 is the documentation-only Listening contract design on branch
`phase2/07-listening-contract-design` from canonical base
`05c424e8aa990054cd9dd3428b444718e0760c9b`. Its authority is
[`docs/PHASE_2_LISTENING_CONTRACT.md`](docs/PHASE_2_LISTENING_CONTRACT.md).
It preserves `LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` as separate
answer/input/scoring types and proposes one versioned
`Question.metadata.listening` descriptor, a same-origin bounded pilot default,
reviewed transcript/attribution/rights evidence, fail-closed playback,
deterministic import/publication severities, an all-or-nothing learner DTO, and
small implementation PRs.

The inventory was independently recomputed from all 17 importer-selected split
files: 101 problems and 495 questions overall, with exactly 0 Listening
problems and 0 Listening questions for both types and every difficulty. The
selected packs contain no `metadata.audioUrl`, `metadata.sectionType`, or
transcript key, and no local audio asset exists under the inspected
application/content roots. Contest-section fields, documentation paths, and
synthetic test strings are capability/examples only; they do not prove a real
asset, transcript, licence, provider workflow, database row, or publication.

Current problem detail/random practice pass any non-blank metadata audio URL to
native controls and leave answer controls visible when audio is missing.
Diagnostic and problem-backed contest renderers can show Listening answer
controls without rendering audio. Persisted QA and every problem publication
path lack a complete media/transcript/rights contract. The proposed follow-ups
must therefore enforce one pure contract at normal/immediate import, persisted
QA, individual/edit/ordinary bulk publication, bulk `publish-safe`, and its
transaction-locked recheck before any content work.

Project-owner approval is still required for storage/provider cost, public
versus authenticated audio, transcript visibility during assessment, replay
and seek/speed policy, dialect policy, permitted licence categories, retention,
deletion, and accommodation/ranking treatment. Until those decisions and the
implementation PRs are approved, Listening remains synthetic-fixture-only,
unpublished, and diagnostic-ineligible. PR 7 changes no schema, migration,
package, lockfile, dependency, importer, QA, DTO, scorer, renderer, test,
content pack, media, database, provider, deployment, or runtime behavior.

Phase 2 PR 8 implements the pure Listening validation contract on branch
`phase2/08-listening-contract-enforcement` from canonical base
`f5be3cb4643ade6af00a6a09d76beb279a842499`. The shared `metadata.listening`
descriptor validation enforces exactly the bounds proposed in PR 7: same-origin
`/media/listening/` reference, MIME type `audio/mpeg`, byte/duration bounds,
transcript text/language, explicit attribution, rights classification/evidence,
and fail-closed fallback behavior.

The contract is now enforced at all defined validation boundaries: normal JSON/CSV
import normalization, immediate import-publish, individual status publication,
edit-to-publish, ordinary bulk publish, bulk `publish-safe`, and its transaction-locked
QA recheck. The static repository audit adds a new `listeningContractIssues` category,
maintaining the current 0/0 Listening inventory.

Phase 2 PR 8 evidence is repository/local only, using synthetic fixtures. It does
not implement the learner/admin DTO projection, rendering components, storage/provider
integration, or real Listening content. It executes no database, deployed environment,
migration, import, or provider request. Listening problems remain unpublished and
diagnostic-ineligible.

Phase 2 PR 9 implements the pure learner-safe and admin projection boundaries for Listening. It extracts `projectListeningPresentation` which validates the presentation payload and explicitly returns a fixed `UNAVAILABLE` state because delivery is not yet configured. It omits legacy `audioUrl` and `sectionType` and ensures the transcript text and raw `assetRef` are never exposed to learners. For `LISTENING_MCQ`, learner options are structurally suppressed (empty array `[]`) whenever the media presentation is unavailable, preventing blind guessing. Admin previews consume the same safe projection structure while retaining the raw metadata and original options for potential repairs.

Phase 2 PR 9 evidence is repository/local only: pure serialization tests in `learner-security.test.ts` and `listening-contract.test.ts` prove boundaries are upheld, including the suppression of MCQ options. Playback components, storage/provider integration, and real content remain unimplemented.

Security Phase 1D-D1 implements the Writing grader through Cloudflare Workers
AI directly. A narrow Production hotfix changes the only reviewed model from
`@cf/qwen/qwen3-30b-a3b-fp8` to
`@cf/meta/llama-3.1-8b-instruct-fast`; every other configured model fails
closed. The server requires a Cloudflare account ID and narrowly scoped API
token, does not use AI Gateway, requests JSON Schema output with an exact
2,000-token cap, and independently validates and bounds every provider result
with Zod before persistence.

The hotfix follows an owner-observed Production `INVALID_RESPONSE`. The
provider call started, the previous provider-started learner-slot policy reduced
the allowance from 2 to 1, and no `WritingSubmission` was persisted. Raw
provider output was intentionally not retained, so the exact malformed field,
envelope subtype, or truncation subtype cannot be claimed.

Writing learner quota now means two successfully persisted grades per UTC day.
A failed provider-started request releases only its exact still-`PENDING`
learner reservation when no successful submission transaction committed. The
site-wide UTC-day allowance remains provider-attempt based and is never
refunded. The site cap defaults to 15 and accepts only integers from 1 through
100; Production is owner-configured separately at 100 and Preview at 15.
Existing six-per-learner/ten-minute and global short-window limits remain.
Recoverable failures save only a bounded essay/target/timestamp/version draft
in `sessionStorage`, keyed by a server-derived opaque user-and-prompt HMAC, and
expire it within 24 hours. A successful persisted grade clears that draft.
Learner pages remain provider-neutral.

Legacy/current `FAILED` quota rows are excluded from successful-grade usage and
are atomically reusable through the same unique slot key; `PENDING` and
`COMPLETED` rows remain occupied and cannot be recycled. No Production data
cleanup or rewrite was performed. Managed-PostgreSQL execution of the
conditional conflict update remains Preview/Production verification debt.
Restored or newly preserved failed drafts clear older visible feedback and
stored-review mode. “Bỏ bản nháp” removes only the browser draft and restores
the latest unchanged server review without another provider call. Browser
storage is best-effort: access/load/save/clear failures cannot override a
successfully returned grade, alter quota, or initiate a provider retry.

Local hotfix verification passes Prisma validation/generation, typecheck, lint,
10 focused files with 101 passed, the complete 57-file suite with 557 passed
and 8 opt-in PGlite cases skipped, the production build with an explicit
unreachable synthetic database target, `npm audit --omit=dev` with zero
vulnerabilities, and `git diff --check`. No integration database test ran.
Prisma and Next reported
automatic local env-file loading/discovery even though relevant process values
were explicitly overridden with synthetic loopback/blank values; no value was
printed and no real endpoint was contacted. Retain this tooling caveat.

Owner-attested Preview evidence is recorded separately from repository tests.
At hotfix commit `02e9ef357ab08b985fdc10abdead1303ca8cbe49`, Preview reached
`READY`, health/database passed, and the reviewed model was
`@cf/meta/llama-3.1-8b-instruct-fast`. PR #18 remained OPEN and Draft. Starting
from displayed learner quota `1/2`, an offline failure preserved the essay,
did not reduce the displayed quota, restored the draft after same-session
navigation, and showed no older feedback while the newer failed draft was
active. One real AI grade succeeded; quota changed immediately, refresh
preserved the successful essay and feedback, and “Xem lại” restored the latest
server-backed review. “Bỏ bản nháp” restored that review without a provider
request. The checked runtime window had no errors or sensitive log data.

This owner-attested checkpoint covers one real Preview grade, not comprehensive
provider/model behavior. It does not claim a second real AI attempt,
provider-retention verification, or managed-PostgreSQL execution of conditional
`FAILED`-row recycling. Earlier provider,
review-state, and copy-correction Preview evidence remains historical and is
recorded in the D1 report.

Owner-attested post-merge Production evidence is separate from both local and
Preview evidence. PR #19 merged as
`f42d80f1c7cfaffdd877c68bab12d2fb2f48d9f7`; a Production deployment created
after the merge reached `READY`, and provider commit metadata matched that
merge. Health passed with `ok=true` and `database=connected`; missing-Origin
and same-origin anonymous POSTs returned 403 and 401 respectively. Production
used `@cf/meta/llama-3.1-8b-instruct-fast`.

One real Production Writing grade succeeded without an `INVALID_RESPONSE`
learner error. Quota updated immediately and decreased by exactly one
successful grade; refresh preserved the essay/feedback; and “Xem lại” restored
the latest server-backed review. The previously failed learner allowance was
available. This is consistent with `FAILED` rows no longer occupying learner
slots, but no Production row inspection or standalone managed-PostgreSQL
execution test of the conditional recycling SQL occurred.

OWNER admin access and ordinary `STUDENT` denial passed. Home/public
navigation, visible images/logo, diagnostic, contest, and Writing regressions
passed. The checked Production runtime window contained no errors or sensitive
log data. The operational Git checkpoint was `main` with a clean tracked
worktree and index.

This is one real Production grade, not comprehensive provider/model coverage.
No second real Production AI attempt, provider-retention/deletion verification,
blanket security completion, or public-signup release clearance is claimed.
Raw output from the historical Production failure was not retained, so its
exact malformed field, envelope subtype, and truncation subtype remain
unprovable. Audits, tests, build, Prisma, typecheck, and lint were not rerun
during the wording-only Production reconciliation.

Only stale Prisma schema comments changed in the implementation hotfix; there
is no structural schema, migration, dependency, or lockfile change. The D1
Writing invalid-response hotfix is Production-verified within the selected
owner-attested boundaries above. Writing essay/result and provider-side
retention/deletion remain unchanged, so H-11 remains **Partially remediated**.
See
`docs/SECURITY_PHASE_1D_D1_WRITING_AI_REPORT.md`.

Security Phase 1D-C2 dependency implementation is recorded at commit `7e582904c392a743dc8a0e62c5d18f4d494efd19`. The formula-validation UI correction began from that HEAD and is recorded at commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5`. During the supplied Preview verification, PR #16 remained OPEN and Draft, was MERGEABLE, and targeted `main`; that remains historical Preview state. PR #16 later merged as commit `0852c05f9acde31f8bfed0887b2749616edf65f6`, and selected owner-attested Production verification passed within the limits below.

Owner-attested initial dependency Preview evidence records that Vercel and Vercel Preview Comments passed. A generated valid XLSX reached the actual application contest parser running on Preview and rendered title `Phase 1D-C2 Preview XLSX Probe`, one section, and one question. ExcelJS externalization worked, no optional S3-module resolution failure appeared, no contest draft was created, and the checked runtime log window returned no logs.

Before correction, a formula-bearing XLSX posted to `/api/admin/contests-import/parse` returned HTTP 200 with `application/json`, but the page reached the generic App Router error UI without a corresponding checked server-log error. Local reproduction against the actual application import-page source established the cause: the parser and route correctly returned `{ data: null, errors: [...], warnings: [] }`; `handleFileChange()` incorrectly created a `preview` state; and preview JSX dereferenced `state.data.info` while `data` was `null`.

The corrected import page uses a dedicated bounded validation state, structurally decodes the route response, renders fixed Vietnamese formula guidance without raw workbook/formula content, exposes no draft-creation action while validation fails, and recovers to a valid preview on a subsequent upload. Formula/shared-formula rejection remains fail-closed; formula output is capped at 20 locations plus one overflow record. A ZIP end-of-central-directory precheck rejects an incomplete `PK`-only container before ExcelJS, resolving the repeated existing-test timeout without changing any timeout.

Owner-attested correction Preview evidence at head `a743e3a18c1fab825f07d6ae81b8de87bdc461c5` records both remote checks successful with zero failing or pending checks. A formula workbook rendered “File Excel chưa hợp lệ — không thể tạo contest draft.” with fixed guidance to convert formulas to static values. Raw formula content and the generic error page were absent; draft creation was unavailable while validation failed; upload remained available; and a later valid upload recovered to normal preview with the draft button restored. No contest draft was created, and the checked Preview runtime-error and sensitive-data log checks were clear.

Generated-workbook parser tests, repository runtime tests of the actual exported Route Handler with the real parser, and the application-source upload transition/view all pass. These are repository/local runtime evidence, not deployed Production evidence. Focused correction verification is 6 files/36 tests. Two consecutive final normal suites each pass 46 files with 479 passed and 8 skipped; build passes with explicit unreachable synthetic database configuration. The UI test uses the application-source transition helper and view, but it is not a fully mounted browser test. No ordinary-`STUDENT` C2 retest, contest persistence, every-path ExcelJS/ZIP/Sharp/platform/cache/provider check, managed PostgreSQL test, or browser automation is claimed.

Authentication/session material exposed during investigation was treated as compromised. The affected old Preview deployment was deleted, Preview signing material was rotated, Production used separate rotated signing material, and Production was redeployed after rotation with a passing health check. No protected value or operational identifier is recorded. This containment is not application-code evidence and does not establish C2 Production functional verification.

Owner-attested selected C2 Production evidence records that the deployment target was Production, reached `READY`, and was created after PR #16 merged as commit `0852c05f9acde31f8bfed0887b2749616edf65f6`. Provider commit metadata was not reported, so no provider-reported metadata match is claimed. Health returned HTTP 200 with `ok=true` and `database=connected`.

A same-origin anonymous submission in a fresh unauthenticated browser context returned HTTP 401. Current missing-Origin status was not reverified because PowerShell, Node `fetch`, `HttpClient`, and `WebClient` did not receive an HTTP response. No status `0` is recorded and no current HTTP 403 is claimed. The missing-Origin HTTP 403 from Phase 1D-C1 Production is historical C1 evidence only.

`OWNER_EMAIL`-equivalent owner/admin access passed. A valid XLSX rendered the normal Preview with one section and one question, and no contest draft was created. A formula-containing XLSX produced bounded in-page validation and showed the formula cell location; raw formula content and the generic error page were absent, and the draft action was suppressed while invalid. Retrying a valid XLSX succeeded and restored the draft button. Ordinary-`STUDENT` admin denial passed.

Home/public navigation, visible images and the logo, practice submission, diagnostic, contest, and Writing regressions passed. No exact image format or comprehensive Sharp/libvips coverage is claimed. Checked Production runtime logs returned `No logs found`; no sensitive data was observed in the checked logs. The operational Git checkpoint was branch `main`, with the tracked worktree and index clean.

Security Phase 1D-C2 started on `security-phase-1d-c2-transitive-dependencies` at full HEAD `0cae690f1a66ea2089bc7de847bc27ee023bb461`. Scoped overrides retain `exceljs@4.4.0`, `archiver@5.3.2`, and `zip-stream@4.1.1` while resolving ExcelJS to `unzipper@0.12.5` and `uuid@11.1.1`, `readdir-glob@3.0.0`, Archiver Utils to `glob@13.0.6`, and Minimatch 10.2.5 to `brace-expansion@5.0.8`. No direct dependency changed; Next 16.2.12, PostCSS 8.5.18, Sharp 0.35.0, and ESLint Config Next 16.2.10 remain unchanged.

Global brace-expansion 5 was rejected because it breaks Minimatch 3's callable CommonJS contract. A fully patched Archiver 7 candidate was rejected because ExcelJS streaming output failed. Local real-workbook testing of the actual application parser found that it read letter-keyed legacy rows rather than ExcelJS numeric `row.values`; the adapter now supports ExcelJS values and rejects its formula/shared-formula shapes. `serverExternalPackages: ["exceljs"]` keeps this Node-only route dependency external after Turbopack independently reproduced an unused optional Unzipper S3 resolution failure.

Final production audit exits 0 with zero vulnerable dependency-package entries. Full audit exits 1 with one High package entry, `brace-expansion@1.1.15`, representing two advisories on development-only ESLint/Minimatch 3 paths. The instance is absent from production installation, is not imported by application code, and receives no request pattern; residual risk is local/CI denial of service from a crafted operator-controlled lint pattern. Prisma validate/generate, typecheck, lint, 6 focused files/52 tests, the full 43-file suite with 470 passed and 8 skipped, and a production build using an explicit unreachable loopback database configuration pass. Zero PGlite/PostgreSQL integration tests ran.

Phase 1D-C2 clears the production dependency-advisory condition for public beta but does not grant blanket release clearance for unrelated gates. Production `npm audit` zero remains implementation-checkpoint evidence; the full audit retains the documented development-only brace-expansion/ESLint finding. Audits, tests, build, lint, typecheck, Prisma commands, and npm install were not rerun during the documentation-only Production reconciliation. H-11 remains **Partially remediated**. See `docs/SECURITY_PHASE_1D_C2_REPORT.md`.

Security Phase 1D-C1 framework dependency remediation was implemented at `87b239b3709262d9adf9e00ed439c20f4fc14985`, received the PR #14 documentation follow-up at `d5d8cfd4b402a31f742bdbaec5b7671c1f47801e`, and merged through PR #14 at `e4483e6e6af0b8b1fad3c70d6ebc017436731cd2` on 2026-07-27 at `01:41:29Z`. Local Git confirms that the current HEAD on `docs/phase1d-c1-production-verification` is the PR #14 merge commit; this documentation pass did not query or mutate GitHub/provider state. Exact `next@16.2.12` removes the nine Next-native advisory paths. Because that Next release still declares `postcss@8.4.31` and optional `sharp@^0.34.5`, the manifest also controls exact production `postcss@8.5.18` and `sharp@0.35.0` and applies a Next-scoped `$postcss`/`$sharp` override. The resulting valid tree has one PostCSS 8.5.18 instance shared by Next, Tailwind, and Vite, plus one Sharp 0.35.0/libvips 8.18.3 runtime instance shared by the root and Next.

Normal install, dependency runtime probes, 15 focused files/141 tests, Prisma validate/generate, typecheck, lint, the complete 41-file suite with 459 passed and 8 opt-in PGlite cases skipped, and the Next 16.2.12 production build all pass. The synthetic probes cover PostCSS parse/process and the 8.5.18 source-map traversal boundary, Sharp in-memory metadata/resize/PNG encoding, and Next's production image optimizer. All three tracked `next/image` components compile. Final audits no longer report Next, PostCSS, or Sharp: full scope now has 17 vulnerable-package entries summarized as 1 Moderate and 16 High; `--omit=dev` has 10 summarized as 1 Moderate and 9 High. Both audit commands correctly exit 1.

Historical owner-attested isolated Preview evidence dated 2026-07-27 records that PR #14 source commit `87b239b3709262d9adf9e00ed439c20f4fc14985` reached `READY` on the Preview target while PR #14 was OPEN and Draft. Health/database and home rendering passed. The Next image request returned HTTP 304, and the browser reported the cached representation type as WebP. HTTP 304 means the browser successfully revalidated and reused an existing cached representation; visible images and the logo rendered correctly. This was not a fresh HTTP 200 image response. It does not claim that the 304 response body contained image data or that the response included a `Content-Type: image/webp` header; the supplied evidence reported only `304/webp`. `OWNER_EMAIL`-equivalent admin access and ordinary-`STUDENT` admin denial passed; public pages/App Router navigation plus practice submission, diagnostic, contest, and Writing regressions passed; and the checked Preview runtime window contained no runtime error or sensitive log data.

Those Preview observations are owner-attested operational evidence, separate from repository/local verification and the later Production evidence. They do not test every image format, platform binary, or cache state and do not claim direct Sharp or libvips execution. They establish no managed PostgreSQL, pooler, failover, concurrency, rollback, migration, or Production evidence.

Owner-attested selected Production evidence dated 2026-07-27 records that a Production deployment created after the PR #14 merge reached `READY`, with provider-reported commit metadata matching merge commit `e4483e6e6af0b8b1fad3c70d6ebc017436731cd2`. Health/database passed; missing-Origin submission returned HTTP 403 and same-origin anonymous submission returned HTTP 401. Home rendering passed. A Next image request returned a fresh HTTP GET 200 OK response, and visible images and the logo rendered correctly. `OWNER_EMAIL`-equivalent admin access and ordinary-`STUDENT` admin denial passed; public pages/App Router navigation plus practice submission, diagnostic, contest, and Writing regressions passed; and the checked Production runtime window contained no runtime error or sensitive log data. The operational Git checkpoint was branch `main`, with tracked worktree and index clean.

No browser-reported or response `Content-Type` was supplied for the Production image check, so no WebP, AVIF, PNG, or other exact format is claimed. The Production GET 200 observation does not establish direct Sharp or libvips execution or test every image input, output format, platform binary, cache state, or optimizer branch. The successful build, local synthetic optimizer probe, historical Preview cache revalidation, and Production GET 200 observation remain separate evidence. The selected Production checks do not cover every route and establish no managed PostgreSQL integration, pooler, failover, concurrency, rollback, migration, or data-shaping evidence. No import, migration, seed, export, backup, cleanup, historical rewrite, or data rewrite was performed for C1 Production verification, and no protected operational identifier or value is recorded.

No audit was rerun during this documentation pass. The latest known full audit remains exit 1 with 17 vulnerable-package entries (1 Moderate/16 High), and the production audit remains exit 1 with 10 entries (1 Moderate/9 High); Next, PostCSS, and Sharp remain absent. Public-beta release remains blocked pending separately scoped Phase 1D-C2 remediation/reassessment of brace-expansion, minimatch/glob consumers, the ExcelJS/archiver chain, and UUID. H-11 remains **Partially remediated**. See `docs/SECURITY_PHASE_1D_C1_REPORT.md`.

Security Phase 1D-B1, its PR #12 import-integrity and observability corrections, and the bounded import transaction-timeout correction are merged. PR #12 merged at `2026-07-26T16:01:29Z` with merge commit `954783040c02e3d71f68babb8c00e917409408e1`; selected owner-attested Production verification is recorded below. This remains a no-migration H-11 minimization pass; H-11 is **Partially remediated**, not closed. Both independent-practice handlers enforce the 72 KiB request limit while consuming the stream, then validate UTF-8/JSON and product-specific answer shapes. New writes retain answers only in their corresponding `SubmissionAnswer`, use `{ version: 1 }` in the non-null parent JSON, and persist only fixed learner-safe feedback. Random practice rejects mixed/foreign sets before its single transaction and partitions answer rows by the actual problem relation. New contest `answersJson` is a bounded versioned positive-allowlist review snapshot; the mapper reads only retained fields, ignores discarded canonical/metadata trees without traversing them, and supports scalar, Error Identification, and Writing learner-answer shapes. Legacy result reads are allowlisted without rewriting rows. Admin draft preview is explicitly protected by `requireAdmin`, passes `previewMode` to the production Client Component, and returns before the learner submission API. Portable export omits password hashes and contest access codes and sanitizes historical diagnostic JSON, but remains plaintext.

The committed PR #12 correction serializes cooperating missing-taxonomy imports with a deterministic transaction-scoped advisory-lock set and maps missing SourceCollection/Topic IDs directly from `createManyAndReturn`. It retains User → optional ContentPack → content lock order, principal revalidation, and all-or-nothing writes. Import failures emit only safe static transaction stages and classifications. Upload-first commit returns 200 with `PARTIALLY_IMPORTED` when at least one file imports, returns 422 when all files fail, and the Vietnamese UI distinguishes full, partial, and failed completion. The original branch implementation and the corrected implementation both succeeded on a fresh isolated in-memory PGlite PostgreSQL engine for the synthetic missing-taxonomy path, so the Preview cause is not proven from repository evidence.

Historical owner-attested Preview evidence records that earlier manual imports failed at `problem-nested-create` with `errorClass=database`, `prismaErrorKind=known-request`, and `prismaCode=P2028`. P2028 is a Transaction API error. The safe sequence and later successful correction support a transaction-timeout diagnosis for that observed path, but the exact internal subtype remains unknown because raw message/meta, imported values, connection details, and credentials were intentionally not logged.

The committed correction exports `IMPORT_TRANSACTION_TIMEOUT_MS = 15_000` and passes it only to the interactive transaction inside `executeImportPlanAtomically`. No global Prisma timeout or `maxWait` changed, no retry was added, and no query, write shape, lock order, schema, migration, input bound, authorization, reconciliation, response, or rollback behavior changed.

Historical owner-attested isolated Preview evidence dated 2026-07-26 records that commit `4a869defacd6b932299bc8e0bc8b83897177cf6a` reached `READY`, both Vercel checks passed, and PR #12 remained Draft at that Preview checkpoint. Manual JSON imported source `Phase 1D-B1 Timeout Probe 20260723c` and problem `phase1d-b1-timeout-import-probe-20260723c`; upload-first JSON imported source `Phase 1D-B1 Upload Timeout Probe 20260726d` and problem `phase1d-b1-upload-timeout-probe-20260726d`. Each path created one problem with one question, and both missing-taxonomy paths completed successfully.

Owner-attested single-problem and random-practice responses remained learner-safe. All reported persistence-shape checks passed, including parent/child shape, child count and relationship, per-problem partitioning, and fixed feedback. This checkpoint used the current owner-equivalent account on its own learner surface; it did not test another user's data, and ordinary-`STUDENT` practice behavior was not rerun on `4a869def...`. Historical ordinary-`STUDENT` admin denial at `e8e3a675...` remains admin-boundary evidence only, and no configured owner email value is recorded. Preview operations used the Neon branch named `preview`; the synthetic source/problem markers were absent from its parent branch named `production`, with no intentional parent mutation. This is narrow branch-isolation evidence, not a claim about every Production database. The final ten-minute log query returned `Fetched 0 logs`. Deployment Protection intercepted direct unauthenticated probes, so those 401s are not application authorization evidence.

The earlier `e8e3a6752c74055f973af3d47a2135bc52ed98b9` Preview checkpoint remains historical evidence for owner/student admin boundaries, answer-complete admin preview with POST suppression, contest result safety, diagnostic, and Writing. Those paths were not rerun on `4a869def...`; no latest-Preview-commit retest is claimed.

Owner-attested Production evidence supplied for the 2026-07-27 reconciliation records that the canonical Production deployment was created after the PR #12 merge and reached `READY`. Provider commit metadata was not reported, so no direct provider-reported SHA match is claimed. Health returned HTTP 200 with `ok=true` and `database=connected`; missing-Origin and same-origin unauthenticated submissions returned 403 and 401 respectively; owner-equivalent admin access and ordinary-`STUDENT` admin denial passed.

One bounded synthetic manual import passed with zero dry-run errors and created one source, one topic, one problem, and one question. Its single-problem learner response contained only `submissionId`, `status`, `score`, `total`, and answer entries containing `questionId`, `isCorrect`, and fixed generic feedback. It contained no canonical answer, explanation, options, metadata, checker feedback, or synthetic explanation sentinel. All ten supplied read-only persisted-shape checks passed: `problemFound`, `problemQuestionCountValid`, `submissionFound`, `parentShapeValid`, `childAnswerCountValid`, `childRelationshipValid`, `incorrectFlagValid`, `childPayloadSafe`, `feedbackExactGeneric`, and `feedbackContainsNoCanonicalMaterial`.

Admin preview retained answer access without issuing a submission POST. The synthetic problem was archived; anonymous and ordinary-`STUDENT` access to its archived learner route was unavailable. Owner/admin visibility was privileged administrative visibility, not learner exposure. Contest listing, diagnostic landing, Writing landing, owner-admin access, and ordinary-`STUDENT` denial regressions passed. Production error-log inspection found no relevant runtime error or sensitive value. Git ended on `main` with tracked state clean before this documentation branch was created.

Production random-practice persistence and upload-first import were not rerun; their operational evidence remains Preview-only. No managed PostgreSQL concurrency, rollback, failover, pooler, duration, or timeout testing, and no historical-data cleanup, is claimed. No deployment ID, infrastructure hostname, credential, connection information, configured owner email value, user ID, submission ID, or synthetic answer value is recorded. No schema change or migration occurred.

The eight-case PostgreSQL-engine suite now runs only through the committed bootstrap command recorded in `docs/SECURITY_PHASE_1D_B1_REPORT.md`. The bootstrap ignores external database targets, reserves a random loopback port, directly owns a fresh in-memory PGlite child, verifies pinned package/server output plus read-only PGlite identity and freshness before DDL, applies all 16 current immutable migrations in order, verifies later schema effects, runs Vitest, and tears down its child/temp files in `finally`. Vitest independently requires the enable flag, exact confirmation, `NODE_ENV=test`, loopback, PGlite runtime identity, forbidden-target rejection, and empty application tables. Fixtures use a random per-run `epit-<uuid>` prefix; cleanup targets only matching user/batch/pack/source/topic/problem ownership plus child rows reached through matching problem/topic IDs. Read-only post-cleanup scans require every application table to be empty and never delete an unexpected row. No unscoped cleanup or manual fixed-port server is permitted.

At the Phase 1D-B1 checkpoint, H-11 remained **Partially remediated**. No schema or migration changed and no historical data was rewritten. Portable-export encryption/lifecycle, Writing/provider-output retention, account deletion and general retention, historical sensitive-row cleanup, plaintext contest-code hashing, provider deletion/log-retention verification, and managed PostgreSQL/pooler/timeout evidence remained open. Existing concurrency, rollback, and data-shaping Test debt also remained. PGlite was embedded-engine evidence, not managed PostgreSQL, pooler, failover, timeout, or Production evidence. Public-beta release was blocked by the then-current Next, PostCSS, Sharp, brace-expansion, and other unresolved dependency findings; the current post-Phase-1D-C1 disposition is recorded above.

The historical 2026-07-26 read-only audit snapshot superseded the prior six-finding statement: full scope contained 20 top-level vulnerable-package entries summarized by npm metadata as 1 Moderate and 19 High, while `--omit=dev` contained 13 summarized as 1 Moderate and 12 High; these were dependency-package entries, not independent GHSAs, and both commands exited 1. Next-native advisories were release-blocking with a verified patch-level path from Next 16.2.11 and npm-proposed Next 16.2.12. PostCSS and Sharp were independently release-blocking: the three PostCSS advisories were patched in 8.5.10, 8.5.12, and 8.5.18 respectively, making `>=8.5.18` the aggregate safe floor and leaving `postcss@8.5.16` affected by `GHSA-r28c-9q8g-f849`; Next 16.2.12 still declared PostCSS 8.4.31 and Sharp `^0.34.5`, so no compatible fix had yet been verified. Brace-expansion 5.0.7 remained affected by the later OOM advisory requiring 5.0.8; the ExcelJS chain remained unresolved pending more evidence. UUID remained separately tracked and non-blocking for PR #12 but unresolved. No audit fix, install, dependency, manifest, or lockfile change occurred at that historical checkpoint.

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

### Phase 2 Listening PR 3A — Listening playback accessibility (branch `phase2/10-listening-playback-accessibility`)
- Branch identifier `phase2/10-listening-playback-accessibility` is not GitHub PR #10; this is the "PR 3A: unavailable/accessibility UI state" pass.
- Implemented an explicit unavailable-only `ListeningQuestion` renderer with no answer-control branch and structural accessibility states (status region, polite live, question-specific heading target).
- No approved `READY` DTO variant, no delivery resolver, no approved playback policy. Actual audio playback, transcript visibility, and storage delivery remain unimplemented.
- Future playback must use a positive runtime validator for a complete resolved-delivery shape and is out of scope here.


### Phase 2 PR 11A: Error Identification content repair pilot 001

- 24 canonical A–D structural repairs in `pilot-pack-001`.
- Q7 `BLOCKED_DIALECT_AMBIGUITY`.
- Q25 `BLOCKED_NO_ERROR_ITEM`.
- 30 untouched questions in the other pack.
- Q23 pre-existing apostrophe-normalization scoring debt.
- All content remains `NEEDS_REVIEW`.
- Required future human linguistic, ambiguity, rendering, answer, difficulty, and calibration review.
- No import, publication, database, deployment, or provider action.
- 31 remaining renderer findings at the PR 11A checkpoint
- 152 normalizer warnings at the PR 11A checkpoint

### Phase 2 PR 11B: Error Identification content repair pack 002

- Historical baseline before content repair: 55 renderer-incompatible Error
  Identification rows and 176 total normalizer warnings.
- State after PR 11A and before this pass: 31 renderer findings and 152
  normalizer warnings.
- Reviewed all 30 rows in
  `content-packs/content-pack-002/07-error-identification-pack-002.json` before
  structural editing; 26 received canonical A–D repairs.
- Four pack-002 rows remain unchanged and fail closed: Q7
  `BLOCKED_REGISTER_AMBIGUITY`, Q9 `BLOCKED_MANDATIVE_AMBIGUITY`, Q27
  `BLOCKED_NO_ERROR_ITEM`, and Q30 `BLOCKED_MANDATIVE_AMBIGUITY`.
- Verified current repository audit: 5 renderer findings, 126 normalizer
  warnings, 30 Pronunciation target-span findings, and
  `hasInventoryErrors=false`.
- Pilot Q25 remains `BLOCKED_NO_ERROR_ITEM`; pilot Q7 remains
  `BLOCKED_DIALECT_AMBIGUITY` editorially despite valid A–D structure; pilot
  Q23 retains known pre-existing apostrophe-normalization scoring debt.
- All repaired content remains `NEEDS_REVIEW`. Structural validity does not
  establish linguistic, difficulty, calibration, or publication approval.
- No import, publication, database, migration, seed, deployment, Preview,
  Production, browser-E2E, or provider action.

### Phase 2 PR 13: bounded Unicode-apostrophe scoring correction

- The scorer now treats U+0027, U+2018, and U+2019 as equivalent under the
  existing punctuation-insensitive scoring policy. It does not broadly remove
  arbitrary Unicode punctuation or repair missing letters, spaces, or word
  order.
- Stored content was not rewritten. Pilot Q23 retains its authored U+2019 text
  and remains `NEEDS_REVIEW` and `PENDING_HUMAN_SIGN_OFF`.
- This scorer equivalence does not establish linguistic, difficulty,
  calibration, or publication approval. The five Error Identification
  blockers and repository-audit counts remain unchanged: 5 renderer findings,
  126 normalizer warnings, 30 Pronunciation target-span findings, and
  `hasInventoryErrors=false`.
- Evidence is repository/local only. No import, publication, database,
  migration, seed, deployment, Preview, Production, browser-E2E, provider, or
  GitHub action is claimed.

### Phase 2 PR 14: bounded persisted Content QA review signals

- Persisted admin QA now emits `EXPLANATION_TOO_SHORT` only for trimmed,
  non-empty explanations from 1 through 44 UTF-16 code units. The shared
  threshold is 45; blank/missing explanations retain only the existing
  missing-explanation warning.
- Persisted admin QA emits at most one problem-level `ANSWER_POSITION_SKEW`
  warning for the existing option-audit family. It triggers when at least four
  eligible questions put more than 50% of answers in one A-D position, or when
  at least eight eligible questions omit any A-D position. Fewer than four
  eligible questions never trigger it.
- Only structurally valid, exact-four, canonical A-D questions with a member
  answer contribute. Malformed, partial, duplicate, non-member, inherited,
  accessor-backed, unsupported, and Error Identification questions are
  excluded. Messages expose only bounded aggregate A/B/C/D counts, never a
  per-question answer map or raw answer data.
- Both signals are heuristic `WARNING`s. They do not establish semantic
  quality, linguistic correctness, explanation adequacy, difficulty,
  calibration, or publication approval. `canPublish` remains `errors === 0`,
  and warning-only problems remain eligible for `getPublishableProblemIds` and
  warning-tolerant bulk publication.
- The current post-repair repository audit output and exit semantics remain
  unchanged: `rendererIncompatibleOptions: 5`, `normalizerWarnings: 126`,
  `pronunciationWithoutValidTargetSpans: 30`, `shortExplanations: 437`, and
  `hasInventoryErrors: false`. The new persisted QA warning total depends on
  actual database rows and is not claimed from repository-only evidence.
- Evidence is repository/local only. No real database, deployed admin page,
  import, publication, migration, seed, deployment, Preview, Production,
  provider, or GitHub action is claimed.

### Phase 2 PR 15: bounded persisted substantive exact-duplicate prompt QA

- Persisted admin-only Content QA adds `DUPLICATE_PROMPT_EXACT` as a
  question-level `WARNING` at `questions.<orderIndex>.prompt`. It reports only
  the count of other active questions in the exact normalized group and never
  exposes comparison IDs, problems, raw/normalized prompts, answers, options,
  explanations, metadata, provider data, or user data.
- The shared pure contract accepts only safe strings, trims, applies NFKC,
  collapses whitespace to one ASCII space, trims again, and applies
  `toLocaleLowerCase("en")`. The normalized minimum is 20 UTF-16 code units.
  Punctuation, digits, diacritics, symbols, and wording remain significant.
  `PRONUNCIATION_ODD_ONE_OUT` and `TRIOS_GAPPED_SENTENCES` generic prompts are
  excluded.
- Grouping accepts only own data properties for `id`, `problemId`, `type`, and
  `prompt`, rejects accessor/inherited fields without invoking getters,
  deduplicates question IDs, ignores self-only matches, and returns groups and
  members in deterministic ordinal order.
- A non-empty target QA run makes one extra narrow query through the injected
  client, selecting only `id`, `problemId`, `type`, and `prompt`, ordered by
  `problemId` then `id`. Questions and parents must both be non-`ARCHIVED`, so
  active `DRAFT`, `NEEDS_REVIEW`, and `PUBLISHED` rows participate. Empty
  target results skip the corpus query. There is no arbitrary truncation or
  N+1 query. A future normalized fingerprint/index may be needed at larger
  scale; no schema or migration is added now.
- The warning is editorial and non-blocking. It does not change `errors === 0`,
  `canPublish`, `getPublishableProblemIds`, ordinary bulk, or `publish-safe`.
  Structural errors and imported `DUPLICATE_POSSIBLE` metadata errors remain
  blocking.
- Import fingerprint/similarity detection remains separate and unchanged:
  exact/high-similarity imports are skipped and possible matches remain
  `NEEDS_REVIEW`. PR 15 does not edit importer production code or thresholds.
- Repository audit JSON remains byte-identical with exactly three substantive
  duplicate groups and state `5/126/30/437/false`. Persisted warning totals are
  database-dependent. Evidence is repository/local and mocked-client only; no
  real database, deployed admin page, semantic duplicate judgment, linguistic
  review, publication approval, import, migration, seed, deployment, provider,
  or GitHub action is claimed.

### Phase 2 PR 16: human-reviewable Pronunciation repair pilot 001

- Historical baseline: 6 problems, 30 `PRONUNCIATION_ODD_ONE_OUT` questions,
  and 120 options without authored `targetSpan` in the pilot split file.
- Reviewed every row under a declared General British primary variety and
  structurally repaired 20 rows. Repaired options are canonical ordered A-D,
  use exact zero-based half-open Unicode-code-point spans, retain all option
  texts and answer positions, and have target-specific Vietnamese explanations.
- Ten complete question objects remain canonical-base-identical and fail
  closed: Q2/Q10/Q29 `BLOCKED_DIALECT_AMBIGUITY`;
  Q3/Q11/Q14/Q17/Q21 `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`; Q7/Q20
  `BLOCKED_UNCLEAR_UNDERLINE`.
- Current repository audit: `rendererIncompatibleOptions: 5`,
  `normalizerWarnings: 46`, `pronunciationWithoutValidTargetSpans: 10`,
  `shortExplanations: 419`, `duplicatePromptGroups: 3`, and
  `hasInventoryErrors: false`. Inventory/manifests, answer positions, and the
  five Error Identification renderer findings are unchanged.
- The full Q1-Q30 record, target slices, evidence, blockers, and reconciliation
  are in
  [`docs/PHASE_2_PRONUNCIATION_REPAIR_PILOT_001.md`](docs/PHASE_2_PRONUNCIATION_REPAIR_PILOT_001.md).
- All repaired rows remain `NEEDS_REVIEW` and `PENDING_HUMAN_SIGN_OFF`.
  Structural validity is not linguistic or dialect approval, naturalness,
  difficulty, calibration, accessibility certification, or publication
  approval. Blocked rows remain fail-closed.
- Evidence is repository/local and dictionary-reference only. No real database,
  import, publication, Preview, Production, browser-E2E, migration, seed,
  deployment, provider, or GitHub action occurred. Listening remains separately
  blocked pending approved delivery work; this PR does not complete all modes.
