# Content pack review record

> Copy as `REVIEW_RECORD.md` for one pack. Do not record email, user ID, learner
> data, secret, environment value, or endpoint.

## 1. Identity and source

- Pack name/version/folder:
- Commit SHA and manifest:
- Split files and expected problem/question counts:
- Source collection/original filenames:
- Originality/licensing declaration and evidence reference:
- Author role/initials:
- Linguistic reviewer role/initials:
- Vietnamese-copy reviewer role/initials:
- Technical reviewer role/initials:
- Calibration lead role/initials:

## 2. Scope

- [ ] No unlicensed worksheet/book/site content.
- [ ] `DAY` is source metadata only.
- [ ] No HSG.
- [ ] Import target is `NEEDS_REVIEW`.
- [ ] Every item defaults `isDiagnosticEligible=false`.
- [ ] Blocked Listening files are outside the importer-selected pack.
- Out-of-scope notes:

## 3. Schema and audit evidence

- Normalizer/admin dry-run reference:
- Normalizer errors/warnings and disposition:
- Human audit: `npm run audit:content-packs`
- JSON audit: `npm run --silent audit:content-packs -- --format=json`
- Audit commit SHA:
- Manifest/inventory errors:
- Missing/short explanations and disposition:
- Exact prompt duplicate groups and disposition:
- Renderer-incompatible option sets and disposition:
- Normalized option-text ambiguity groups and disposition (count/evidence; accepted or revised):
- Answer positions `A/B/C/D`:
- Skill/difficulty mismatches and disposition:

## 4. Linguistic and instructional review

| File / problem slug | Questions | Grammar/naturalness | Unique answer | Distractors/register | Explanation | Vietnamese copy | Issues/decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | PASS/FAIL | PASS/FAIL | PASS/FAIL/N/A | PASS/FAIL | PASS/FAIL |  |

- [ ] Every objective item has one defensible answer.
- [ ] Accepted text variants are complete but bounded.
- [ ] Error Identification has exactly one intended error.
- [ ] Explanations state rule/evidence and strongest-distractor contrast when needed.
- Open linguistic/copy blockers:

## 5. Rendering and interaction evidence

| Type / problem slug | Viewport/browser | Required data visible | Keyboard/labels | Answer control | Evidence reference | Decision |
| --- | --- | --- | --- | --- | --- | --- |
|  |  | PASS/FAIL | PASS/FAIL | PASS/FAIL |  |  |

- [ ] Shared passage and line breaks render correctly.
- [ ] Options have unique non-empty IDs/text and answer membership.
- [ ] Root/keyword/target beginning renders correctly.
- [ ] Error Identification renders parts plus correction.
- [ ] Pronunciation target span is visible without color-only meaning.
- [ ] Trios renders all three sentences.
- [ ] Writing is not auto-scored and rubric/copy passes.
- [ ] Listening audio/transcript/rights/accessibility evidence passes if unblocked.
- [ ] Admin preview creates no submission.
- Rendering/interaction blockers:

## 6. Difficulty and calibration

| Level | Items | Reviewer agreement | Attempts/learners | Target/actual success | Median time | Status |
| --- | ---: | ---: | --- | --- | --- | --- |
| B2 |  |  |  | 65–85% /  |  | DRAFT/PROVISIONAL/STABLE |
| C1 |  |  |  | 45–70% /  |  | DRAFT/PROVISIONAL/STABLE |
| C2 |  |  |  | 25–50% /  |  | DRAFT/PROVISIONAL/STABLE |
| CHUYEN |  |  |  | 30–60% /  |  | DRAFT/PROVISIONAL/STABLE |

- Target cohort definition without personal data:
- Outliers/disposition:
- [ ] HSG remains deferred.
- [ ] No item is diagnostic-eligible before `STABLE`.
- Calibration blockers:

## 7. Admin verification

- Selected/ignored files:
- Exact/high-similarity duplicates skipped:
- Possible duplicates (pilot requires zero):
- ContentPack/ImportBatch reference (blank until import is authorized):
- Persisted QA errors/warnings:
- [ ] Import uses `NEEDS_REVIEW`, not immediate publish.
- [ ] Planned publication path is bulk `publish-safe`.

## 8. Blockers and approval

| ID | Severity | Scope | Owner role | Recovery | Status |
| --- | --- | --- | --- | --- | --- |
|  | BLOCKER/WARNING |  |  |  | OPEN/CLOSED |

- Decision: `REJECTED / REVISION_REQUIRED / APPROVED_FOR_GYM / APPROVED_FOR_PUBLICATION`
- Approved scope and explicit exclusions:
- Diagnostic decision: `BLOCKED` (default)
- Content lead role/initials and date:
- Notes:

## 9. Revision history

| Revision/date | Files or slugs changed | Reason | Gates rerun | Reviewer role/initials |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
