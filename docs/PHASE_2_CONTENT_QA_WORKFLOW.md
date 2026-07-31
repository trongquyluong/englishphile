# Englishphile Phase 2 — Content QA workflow

## Scope, status labels, and product decisions

This is the operating specification for Phase 2 PR 2, aligned with `main` at
`c8b93faaaf1670f432a340675951cc0c65ad088b` and the merged PR #21 audit.
It defines the workflow before the 21-problem/84-question pilot is authored.
It creates no pilot content, database evidence, publication, or diagnostic
eligibility.

- **Implemented** means enforced or produced by current repository code.
- **Required process** means a human gate recorded in the pack review record;
  the application may not enforce it.
- **Future proposal** means the capability does not exist yet.

Decisions:

1. Author in numbered split JSON files; use CSV only for genuinely flat data.
2. Import pilot content as `NEEDS_REVIEW`; never use immediate publish.
3. Automated checks do not replace linguistic, rendering, interaction, or
   calibration review.
4. Writing remains non-auto-scored. Non-exact Sentence Transformation responses
   also remain unscored (`isCorrect=null`).
5. Keep `LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` separate. The pure media contract is now implemented in JSON/CSV import, QA, and publication boundaries, but Listening remains blocked from the validation batch until the DTO projection, component playback, and approved media are integrated. See [`PHASE_2_LISTENING_CONTRACT.md`](PHASE_2_LISTENING_CONTRACT.md).
6. Defer HSG. Keep every pilot item diagnostic-ineligible until stable
   calibration evidence exists.

## Repository evidence and confirmed contradictions

This document uses repository evidence only. It makes no claim about a database,
Preview, Production, provider, environment, or deployed content.

- Phase 2 PR 4 implements the bounded Trios learner-safe contract. The
  structured source is only `metadata.sentences`; `passage` remains an optional
  display/compatibility mirror and is never split into a tuple.
- All 55 current `ERROR_IDENTIFICATION` questions lack renderable options.
  Phase 2 PR 3 now reports this as a non-fatal import/repository warning and
  enforces the complete contract in persisted QA and every publication path.
  The files remain unchanged and are not publication-ready; a separate reviewed
  content-repair PR must author their real A–D spans.
- Phase 2 PR 5 implements the Pronunciation target-span contract. The unchanged
  30 repository questions still have generic `metadata.focus` values but no
  authored target spans, so all 30 are now publication-blocked pending a
  separate human-reviewed repair PR.
- Phase 2 PR 6 replaces the Writing hard-coded English checklist/control copy
  with Vietnamese product chrome and a bounded authored-rubric presentation.
  The exact source remains `Question.answer.rubric`, whose supported shape is
  an ordered non-empty array of bounded strings. Missing or malformed rubrics
  render a fixed Vietnamese no-detail fallback; no criteria are fabricated.
- Listening enums, checker branches, and a component exist. Phase 2 PR 8 implements the pure JSON/CSV schema validation contract for audio, transcript, rights, and attribution (`metadata.listening`). The component still only reads unvalidated legacy aliases; DTO projection and learner component upgrades remain deferred.
- Persisted QA is enforced by bulk `publish-safe`. Single publish and immediate
  import-publish still use the repository's minimal publication layer in
  general, but Phase 2 PR 3 makes that layer complete and fail-closed for
  `ERROR_IDENTIFICATION`, Phase 2 PR 4 does the same for
  `TRIOS_GAPPED_SENTENCES`, and Phase 2 PR 5 does the same for
  `PRONUNCIATION_ODD_ONE_OUT`.
- `copyrightNote` is optional in Prisma/import schema. It is mandatory for this
  process, not an implemented schema error.
- The schema supports `SkillType.COLLOCATIONS`; pilot Collocations should use it
  even though current repository packs label collocation MCQ as
  `MULTIPLE_CHOICE`.

## A. Content lifecycle

Every stage requires its exit criteria and evidence. A checkbox without evidence
is not a completed gate.

| Stage | Owner and required input | Automated checks | Mandatory human checks | Pass/fail and evidence | Recovery |
| --- | --- | --- | --- | --- | --- |
| 1. Authoring | Content author; acceptance spec, type contract, difficulty rubric, lawful source | None is a repository gate during writing | Originality, correct skill/type/level, Vietnamese instruction, answer, distractors, explanation | Complete canonical fields; four questions/problem; source declaration. Evidence: draft + author role/initials | Return issues by slug/question index; never change slug merely to evade duplicate detection |
| 2. Import-schema validation | Technical reviewer; split JSON/CSV | Implemented normalizers parse JSON/CSV, enums, base fields, aliases, and type rules | Confirm normalization preserves meaning; inspect all warnings | Zero normalizer errors; every warning dispositioned. Evidence: command/admin dry-run result | Fix source file and rerun; do not patch temporary normalized output |
| 3. Repository audit | Technical reviewer; whole pack folder + manifest | `audit:content-packs`: shared selector, manifest/counts, normalizer issues, explanation/type signals, answer positions, exact prompts, renderer-option warning | Review heuristics, skew, and duplicate groups | Zero inventory errors and zero unresolved pilot renderer warnings. Evidence: human + JSON audit at commit SHA | Fix split/manifest; do not edit `00-all-in-one` to conceal split errors |
| 4. English linguistic review | Independent linguistic reviewer; normalized content | Grammar tools may suggest only; no implemented linguistic pass | Grammar, naturalness, register/collocation, uniqueness, distractors, explanation, originality | One defensible answer; zero language error; explanation names decisive evidence. Evidence: decisions/issues per question | Revise and rerun stages 2–4 |
| 5. Vietnamese instructional review | Vietnamese instructional reviewer; statement/instructions/explanations and renderer copy | Missing/short-copy signals only | Natural, precise instructions; consistent terminology; no retired classroom concepts or false answer-review promises | Learner can act without guessing. Evidence: copy sign-off | Revise copy; semantic change returns to stage 4 |
| 6. Rendering review | Technical reviewer; admin preview of reviewed item | DTO/component tests cover only parts of the surface | All passages, options, roots, keywords, targets, Trios sentences, rubric, and media visible; no raw JSON/truncation | Every required datum is visible. Evidence: screenshot/recording, viewport, slug, SHA | Fix data or block type for a dedicated renderer PR |
| 7. Learner interaction review | QA/technical reviewer; preview and test answers | Preview mode suppresses persistence; some component tests exist | Keyboard, focus/labels, changing answers, disabled state, audio controls, submitted answer shape | Accessible controls and checker-compatible shape; preview saves nothing. Evidence: interaction checklist | Data issue returns to author; component issue blocks type |
| 8. Difficulty calibration | Calibration lead + two independent reviewers; reviewed/renderable items | Audit counts labels only; it does not infer difficulty | Blind rating, feature rationale, time burden, expected-success band, later sample comparison | Meets section C agreement/bands. Evidence: review-record calibration table | Relabel/revise/retire; semantic revision reruns stages 2–7 |
| 9. Dry-run/import verification | Content admin + technical reviewer; signed-off splits/manifest | Implemented admin dry-run checks DB reuse and duplicate risk; import records pack/batch | Selected/ignored files, counts, duplicate actions, `NEEDS_REVIEW` target | Zero dry-run error; zero possible duplicate for pilot. Evidence: summary; later pack/batch IDs when import is authorized | Fix before import. Re-import does not overwrite; use reviewed edit or versioned slug |
| 10. Publish approval | Content lead approves; admin executes | Bulk `publish-safe` rechecks persisted QA and minimal publish rules | All mandatory reviews/evidence complete; correct scope; Listening excluded | `APPROVED_FOR_PUBLICATION`; Gym may publish provisionally but eligibility stays false. Evidence: decision + audit log | Keep/return to `NEEDS_REVIEW`, fix, rerun affected gates |
| 11. Monitoring/correction | Content lead; reports and aggregate own-practice analytics | No complete issue-triage/calibration dashboard exists | Ambiguity, abnormal success/time, accessibility/media incidents | No critical open issue; `KEEP`, `REVISE`, or `ARCHIVE` recorded | Archive immediately for wrong/ambiguous/unrenderable item; edit or versioned replacement then rerun gates |

## B. Operational quality rubric

| Criterion | Hard automated error | Automated warning/signal | Mandatory human judgment |
| --- | --- | --- | --- |
| Originality/licensing | None; source note is optional in schema | None | Confirm original/licensed source and permitted use |
| Grammatical accuracy | None | External grammar tools are suggestions only | Zero unintended error |
| Natural English | None | None | Idiomatic, contextually credible phrasing |
| Collocation/register | None | None | Conventional collocation and intended register |
| Ambiguity/uniqueness | Missing/non-member selected answer is signalled | Duplicate normalized option text | Exactly one defensible objective answer; accepted variants bounded |
| Distractors | None | Answer-position distribution | Plausible, parallel, non-trivial, and diagnostically meaningful |
| Explanation | Missing/whitespace is detected, but not an inventory exit error | `<45` characters is heuristic only | State rule/evidence and contrast strongest distractor when needed |
| Vietnamese instruction | Missing instructions is signalled | Missing/short explanation | Clear, natural, consistent learner language |
| Skill/type accuracy | Problem/question skill and difficulty mismatches are detected | Distribution inventory | Task genuinely measures the selected skill/type |
| Difficulty accuracy | None | Counts only | Apply section C blind review and empirical bands |
| Learner usefulness | None | None | Clear learning objective and actionable rationale |
| Rendering compatibility | Some normalizer rules | Reading/root/Trios/options and persisted QA signals | Preview the actual modular renderer |
| Accessibility | None | None | Keyboard, labels, focus, contrast, reflow; no color-only meaning |
| Media | None | None | Rights, transcript, audio quality, fallback, playback policy |

Hard automated errors (parse/schema/manifest/normalizer) must be fixed. Automated
warnings require a recorded disposition. Subjective linguistic quality and
difficulty are never automatic pass/fail rules.

## C. Difficulty calibration

Difficulty describes item demand, not learner age or a filename. `CHUYEN` is an
exam-purpose/format label, not an alias for C1.

**Các dải này là proposed acceptance targets, không phải empirical Englishphile
estimates.**

| Dimension | B2 | C1 | C2 | CHUYEN |
| --- | --- | --- | --- | --- |
| Language complexity | Standard complex clauses, clear cohesion | Denser clauses, stance/register sensitivity | Compressed structure, implicit cohesion, nuance | B2–C1 language in specialized-exam format |
| Inference burden | Zero/one direct inference | One/two contextual or discourse steps | Multi-step/pragmatic inference | Fast cross-sentence decisions where format requires |
| Distractor subtlety | Familiar B2 errors | Several plausible choices | Fine semantic/pragmatic distinctions | Fair exam traps, not trivia |
| Lexical rarity | Common/academic core | Less frequent but natural | Rare/idiomatic only with sufficient context | No obscurity used to fake difficulty |
| Transformation depth | One operation | Two operations or tight constraint | Multi-step meaning/stance preservation | Exam pattern plus time constraint |
| Time pressure | 60–90s/objective item | 75–120s | 90–150s | 45–90s depending on format |
| Expected target-cohort success | 65–85% | 45–70% | 25–50% | 30–60% timed |

Acceptance model:

- Pre-publication: two independent reviewers rate 100% of items. Exact-label
  agreement is at least 80% per level; no unresolved answer disagreement and no
  disagreement wider than one level.
- Calibration counts only the first eligible scored attempt per learner/item
  inside the stated calibration window. Repeated practice, retries, contest
  replay, and admin/test accounts must not inflate the sample.
- `PROVISIONAL`: at least 60 eligible first-attempt observations/item across at
  least 20 distinct learners; record success rate and median time. This is not
  diagnostic-ready.
- `STABLE`: at least 150 eligible first-attempt observations/item across at
  least 50 distinct learners, plus reviewer agreement and timing acceptance;
  success is in band and median time is at most 125% of the target ceiling.
- These are longer-beta calibration targets. `STABLE` is not required before
  the first controlled pilot publication, but diagnostic eligibility remains
  blocked until the required calibration level is achieved.
- Writing uses rubric/completion evidence, not correct-rate. Non-exact Sentence
  Transformation is not counted wrong. Listening has no sample until unblocked.
- HSG starts only after B2–CHUYEN complete a stable cycle across core auto-scored
  types.
- Calibration evidence lives in the Markdown review record. This PR claims no
  database implementation for that evidence and requires no personal learner
  data.

## D. Per-type authoring contracts

Common problem fields are `title`, `slug`, `skillType`, `questionType`,
`difficulty`, `statement`, `instructions`, `estimatedMinutes`, `topics`, and
`questions`. Common question fields are `type`, `skillType`, `difficulty`,
`prompt`, `passage`, `options`, `answer`, `explanation`, `rootWord`, `keyword`,
`targetSentence`, `lineNumber`, and `metadata`. Do not invent top-level fields.

Prefer canonical normalized answer names: `correctOptionId`, `correctPart`, and
`acceptedAnswers`. The importer also recognizes `correctOption`, `errorPart`, and
`accepted`.

| Type | Actual fields and renderer | Answer/scoring | Explanation, ambiguity, manual QA, blockers |
| --- | --- | --- | --- |
| `MCQ` | `prompt`, `options[{id,text}]`; `MultipleChoiceQuestion` | `correctOptionId`; auto exact ID | Explain decisive rule/strongest distractor; review uniqueness and balance |
| `READING_MCQ` | first non-empty shared `passage`, prompt/options; `ReadingQuestion` | `correctOptionId`; auto | Passage rights, textual evidence, inference uniqueness |
| `WRITING_PROMPT` | `prompt`; Vietnamese planning/essay controls; learner DTO receives only safe `writingRubric.criteria` projected from `answer.rubric` | answer object; `isCorrect=null` | Rubric is an ordered non-empty bounded string array; missing/malformed data shows a fixed no-detail fallback. Authored text is displayed faithfully, not translated. Human rubric/language/level/calibration review remains mandatory |
| `LISTENING_MCQ` | prompt/options; `ListeningQuestion` reads legacy `metadata.audioUrl/sectionType` | `correctOptionId`; auto | Pure validation contract is enforced at import/QA/publication boundaries, but learner projection and components are unimplemented. Listening stays blocked. |
| `LISTENING_SHORT_ANSWER` | prompt/text input; same metadata | `acceptedAnswers`; auto exact normalized text | Review accepted variants; validation contract is enforced, but projection is unimplemented and Listening stays blocked. |
| `PRONUNCIATION_ODD_ONE_OUT` | `prompt` + exactly four `options[{id,text,targetSpan:{start,end}}]`; IDs canonicalize to unique A-D; renderer orders A-D and underlines only the validated span | canonical member `correctOptionId`; auto-score independently requires the complete option/span contract and a canonical learner A-D selection | `start` inclusive and `end` exclusive in Unicode code points; text is a non-empty string of at most 200 code points and the target contains a Unicode letter. Normal `NEEDS_REVIEW` import retains option/span defects as warnings; malformed/missing/non-member answers are fatal. Persisted QA and every publication path enforce the full contract. Structural success never proves phonetic correctness |
| `GUIDED_CLOZE` | shared passage, slot prompt/options; `GuidedClozeQuestion` | `correctOptionId`; auto | Validate blank mapping, context, distractors, A–D balance |
| `OPEN_CLOZE` | shared passage, slot prompt; `OpenClozeQuestion` | `acceptedAnswers`; auto exact normalized text | UI expects one word; include all legitimate bounded variants |
| `WORD_FORMATION` | prompt + `rootWord`; dedicated renderer | `acceptedAnswers`; auto exact normalized text | Review word class, polarity/plural, and visible root |
| `SENTENCE_TRANSFORMATION` | prompt, optional `keyword`/`targetSentence`; dedicated renderer | exact accepted answer = true; otherwise `null` | Never count non-exact as wrong; review equivalence/variants; no active manual-grading UI |
| `ERROR_IDENTIFICATION` | `prompt` + exactly four parts `options[{id,text}]`; IDs canonicalize to unique A–D | canonical member `correctPart` + non-empty `correction`; auto-score requires both; `/` separates at most eight bounded variants | Normal `NEEDS_REVIEW` import warns and retains renderer/option gaps and a syntactically present string `correctPart` that is invalid or outside the rendered set. Missing/non-string/blank `correctPart`, missing/blank correction, and correction-bound violations remain import errors. Persisted QA, bulk safe, individual publish, edit-to-publish, and immediate import-publish enforce the full contract |
| `TRIOS_GAPPED_SENTENCES` | `prompt` + `metadata.sentences`; dedicated renderer shows exactly three numbered sentences and one labelled native text input | exactly one bounded shared word from `acceptedAnswers` or `accepted`; auto exact normalized text; metadata/display never authorizes scoring | Each trimmed sentence is non-empty and contains exactly one `_____` marker. Normal `NEEDS_REVIEW` import retains sentence-contract defects as warnings; answer defects are fatal. Persisted QA and every publication path enforce the full contract. Human linguistic/context review remains mandatory |

`SHORT_ANSWER` exists but is not a pilot substitute for
`LISTENING_SHORT_ANSWER`.

## E. Pilot batch acceptance specification

Each problem contains exactly four questions with parent/question skill, type,
and difficulty aligned.

| Area | Type | Problems | B2 | C1 | C2 | CHUYEN | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reading | `READING_MCQ` | 3 | 4 | 4 | 4 | 0 | 12 |
| Writing | `WRITING_PROMPT` | 2 | 0 | 4 | 0 | 4 | 8 |
| Listening | one of each Listening type | 2 | 4 | 4 | 0 | 0 | 8 |
| Pronunciation | `PRONUNCIATION_ODD_ONE_OUT` | 1 | 4 | 0 | 0 | 0 | 4 |
| Multiple Choice | `MCQ` | 1 | 4 | 0 | 0 | 0 | 4 |
| Guided Cloze | `GUIDED_CLOZE` | 1 | 0 | 4 | 0 | 0 | 4 |
| Open Cloze | `OPEN_CLOZE` | 1 | 0 | 4 | 0 | 0 | 4 |
| Word Formation | `WORD_FORMATION` | 2 | 0 | 4 | 4 | 0 | 8 |
| Sentence Transformation | `SENTENCE_TRANSFORMATION` | 2 | 0 | 4 | 4 | 0 | 8 |
| Error Identification | `ERROR_IDENTIFICATION` | 1 | 0 | 4 | 0 | 0 | 4 |
| Trios | `TRIOS_GAPPED_SENTENCES` | 1 | 0 | 0 | 4 | 0 | 4 |
| Collocations | `MCQ` + `COLLOCATIONS` | 1 | 0 | 4 | 0 | 0 | 4 |
| Phrasal Verbs | `MCQ` + `PHRASAL_VERBS` | 1 | 0 | 4 | 0 | 0 | 4 |
| Transitions | `MCQ` + `TRANSITIONS` | 1 | 0 | 4 | 0 | 0 | 4 |
| Grammar Focus | `MCQ` + `GRAMMAR_FOCUS` | 1 | 0 | 0 | 0 | 4 | 4 |
| **Total** |  | **21** | **16** | **44** | **16** | **8** | **84** |

There are 44 C1 questions because C1 deliberately covers eleven four-question
groups: Reading, Writing, Listening, Guided/Open Cloze, Word Formation,
Sentence Transformation, Error Identification, Collocations, Phrasal Verbs,
and Transitions. It is the broad bridge between B2 anchors and C2/CHUYEN
application; this is coverage rationale, not calibration evidence.

### Pack, file, slug, and source rules

- Editorial master scope: 21/84.
- Organizationally importable non-Listening core: `phase2-pilot-core-001`,
  19/76. It is not publication-ready while Pronunciation and Writing contracts
  remain unresolved and no reviewed pilot content has been authored.
- Separately blocked Listening extension: `phase2-listening-pilot-001`, 2/8,
  created only after the Listening media contract passes.
- Core split files: `01-reading` through separate files for Writing,
  Pronunciation, MCQ, Guided/Open Cloze, Word Formation, Sentence
  Transformation, Error Identification, Trios, Collocations, Phrasal Verbs,
  Transitions, and Grammar Focus. Do not author an all-in-one mirror.
- Slug: `p2-pilot-001-<skill>-<difficulty>-<nn>`, lowercase ASCII; no `DAY`,
  person, or third-party name.
- Source: `Englishphile Phase 2 Pilot 001 — <Area>`;
  `originalFileName` matches the split file; `copyrightNote` is mandatory by
  process; at least one meaningful topic and reviewed `estimatedMinutes`.

### Explanation, balance, duplication, and review

- Every explanation teaches the rule/evidence rather than repeating the answer.
  C1 contrasts the strongest distractor; C2 states the nuance; CHUYEN adds
  strategy only when useful.
- Across 48 selection-position questions including Listening MCQ and Error
  Identification, target A/B/C/D is exactly `12/12/12/12`. The 44-question core
  target is `11/11/11/11`. A four-question option subset uses each position once
  where the format permits; no run exceeds two.
- Zero exact substantive prompt duplicate and zero normalized duplicate option
  text.
- Admin dry-run exact and `>=0.90` similarity matches are skipped. Any possible
  duplicate at `0.75–0.89` blocks this pilot even though current import can retain
  it as `NEEDS_REVIEW`.
- 100% of questions need a linguistic reviewer different from the author and a
  technical rendering/interaction review.

### Rendering checklist and evidence mechanism

- Shared passages, options, root words, keywords, target beginnings, Error
  Identification parts, pronunciation target spans, Trios sentences, Writing
  rubric/copy, and media are visible and usable.
- Keyboard-only and mobile-width passes are recorded; preview creates no
  submission.
- Calibration status (`DRAFT`, `PROVISIONAL`, `STABLE`), sample size, aggregate
  success/time, screenshots, and reviewer decisions are stored in
  `REVIEW_RECORD.md`. This needs no unsupported database field.

Publication is blocked by any automated error, persisted QA `ERROR`, unclear
rights, ambiguity/language error, unresolved duplicate, missing review evidence,
immediate-publish use, unrenderable legacy Error Identification content, or
unresolved contracts for Pronunciation or Writing. Listening remains
separately blocked by its media contract.

Diagnostic eligibility is additionally blocked until status is `STABLE`, sample
and agreement bands pass, the item fits the deterministic blueprint, and the
item has an auto-scored contract. Pilot default is always false.

## F. Admin workflow assessment

| Stage | Implemented | Pilot workaround | Future proposal |
| --- | --- | --- | --- |
| Authoring | Copyable JSON/CSV templates; no full create form | Author split JSON outside app | Type-aware authoring |
| Parse/dry-run | Admin normalizer + DB reuse/duplicate checks | Save summary in review record | Exportable signed validation artifact |
| QA | Persisted `/admin/content-qa`, severity report | Disposition every warning manually | Review-record/type gates |
| Import | Upload-first, split preference, traceability, default review | Disable immediate publish | Lock immediate publish for controlled packs |
| Preview | Answer-complete admin DTO, production renderer, no submission | Screenshot each type/problem | Visual regression fixtures |
| Publish | Bulk safe rechecks QA; Error Identification also has the same fail-closed contract in single and immediate publish | Use only bulk `publish-safe` after sign-off | Enforced approval/reviewer separation for the wider human evidence gate |
| Correction | Admin JSON edit + archive/status | Minor edit then re-QA; major fix gets versioned slug | Versioned supersede/upsert |
| Re-import | Duplicate slugs skip; no overwrite | Never treat re-import as update | Explicit reviewed version replacement |
| Monitoring | Analytics/status/archive primitives | Manual issue log and sampling | Learner report queue/calibration dashboard |

Launch-critical gaps are: publish paths can bypass full evidence; no enforced
linguistic/rendering/calibration approval; current renderer contracts above;
and no versioned correction/re-import. Broad admin UI work is out of scope.

## G. Reusable review artifact

Copy
[`content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md`](../content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md)
to `REVIEW_RECORD.md` for a pack. It uses role/initials only and requests no
email, learner identity, or other unnecessary personal data.

## H. PR 2 audit automation preserved by PR 3

The audit adds two deterministic, non-blocking signals. Renderer compatibility
answers whether required controls/options can be projected, displayed, and
scored. For general option renderers,
`rendererIncompatibleOptions` reports too few renderable options,
missing/invalid IDs, scorer-equivalent duplicate IDs, missing/invalid display
text, and a selected answer outside the rendered options. For Error
Identification it uses the shared exact-four A–D validator.

The contract mirrors current code: learner option projection accepts only
`string` and `number` IDs/text and converts them with `String(...)`; scorer
membership trims and uppercases IDs. Error Identification gets selectable parts
only from the exact-four safe projection. The importer normalizes the
`errorPart` alias before the audit/contract checks; correction validation is now
part of the shared publication contract.

Editorial option ambiguity is separate:
`duplicateNormalizedOptionTexts` reports when distinct rendered choices
collapse under the audit heuristic of `String(...)` for DTO-supported values,
NFKC, collapsed whitespace, trim, and lowercase. Learner renderers do not apply
that normalization: they display the stringified values literally. The signal
therefore requires human review for possible ambiguity; it is not proof of
renderer incompatibility and does not replace linguistic review. Each JSON
finding carries the canonical location, question type, bounded prompt excerpt,
and up to 12 duplicate groups with up to eight bounded raw values per group;
occurrence and omission counts preserve remediation context without dumping
unbounded content.

Both audit signals remain review warnings and do not change
`hasInventoryErrors`. Phase 2 PR 3 separately changes Error Identification
import/learner/scoring/publication behavior through the contract described
below. No subjective
language/difficulty rule, explanation-length failure, licensing schema rule,
answer-position failure threshold, or invented Listening field was added.
Human and JSON modes keep option values and prompt excerpts bounded. Full
deterministic file/problem/question locations, issue codes or duplicate groups,
and safe option representations are available in JSON mode:
`npm run --silent audit:content-packs -- --format=json`.

## I. Phase 2 PR 3 — Error Identification contract

### Canonical data and scoring contract

No Prisma field or migration is required. The existing `Question.options Json?`
and `Question.answer Json` fields support the complete contract:

- `options` is exactly four renderer-supported objects;
- each option has one canonical ID from A, B, C, and D, with no duplicate after
  trim/uppercase normalization;
- each option has non-empty learner-visible `text`; string and finite JSON
  number primitives follow the existing learner projection and become strings;
- `answer.correctPart` is canonical A–D and belongs to the rendered set;
- `answer.correction` is a non-empty string;
- existing slash-delimited correction alternatives remain the only supported
  alternative contract: at most 8 variants, at most 240 characters per
  variant, and at most 1,000 characters in the complete field. Empty slash
  segments are invalid.

The importer alone accepts the existing string `errorPart` alias when
`correctPart` is not already a string. It then removes the alias and stores
trimmed/uppercased `correctPart`. It also normalizes the existing option
`label` alias and supported primitive ID/text values before running the shared
pure option validator. Persisted QA and publication require canonical `id`
fields; they do not treat `label` as a persisted substitute.

Scoring trim/uppercases the selected and expected part. It applies the existing
text-answer normalization independently to each slash-delimited correction
variant. A result is correct only when both a non-empty selected part and a
non-empty correction match. Missing/malformed answer configuration, a wrong
part, or a wrong correction returns false. Writing and Sentence Transformation
branches are unchanged.

### Import severity and legacy compatibility

The normal JSON and CSV import target remains `NEEDS_REVIEW`. Renderer/options
gaps and a syntactically present string `correctPart` that is invalid or not a
member of the rendered option set are `warning` issues with exact
`problems.<index>.questions.<index>...` or `rows.<number>.question...`
locations. This deliberately allows incomplete draft/review content to be
retained for admin repair without declaring the repository inventory malformed.
Missing/non-string/blank `correctPart` or correction and unbounded/malformed
correction alternatives remain import `error` issues because they are not a
bounded scoring answer.

At an immediate JSON/CSV publication boundary, every Error Identification
contract warning is promoted to a publication error before the atomic executor
can write published content. This repository enforcement is not database
evidence: it does not establish that unknown historical published rows were
inspected, repaired, or retroactively unpublished.

The two repository files still contain 55 legacy questions with `options=null`;
none was edited or silently given generated spans. Repository audit therefore
continues to exit zero, reports exactly 55
`rendererIncompatibleOptions` findings, and now also carries 56 non-fatal
normalizer warnings with file/problem/question
paths (one legacy `correctPart=OK` adds a separate canonical-ID warning). JSON order remains
deterministic and option values/excerpts remain bounded.
`duplicateNormalizedOptionTexts` stays a separate editorial signal.

### Publication, DTO, rendering, and evidence

The same pure contract is enforced in:

1. persisted content QA (`ERROR`, `canPublish=false`);
2. bulk `publish-safe`, including its under-lock QA recheck;
3. individual status publish and edit-to-publish minimal validation;
4. immediate JSON/CSV import-publish before published rows can be written.

Every boundary rejects missing options, counts other than four, non-A–D or
duplicate canonical IDs, missing display text, invalid/non-member
`correctPart`, missing correction, and invalid correction bounds.

The learner DTO still positively allowlists presentation fields. For Error
Identification it emits only canonical safe `{id,text}` A–D parts when the
complete option projection is renderable; malformed persisted options produce
an empty list. It never emits `correctPart`, correction data, accepted
alternatives, explanation, raw options, or metadata. Admin preview remains a
separate server-only answer-complete mapper, carries `rawOptions` for repair,
uses the safe canonical options for the production renderer, and suppresses
submission persistence through existing preview mode.

The existing learner interaction remains one native labelled radio group plus
a separate correction input. Invalid legacy preview data shows a fixed
Vietnamese unavailable notice instead of invalid part controls and does not
crash. This PR does not create a new reviewed-answer surface; existing
learner-safe submission feedback and admin-only answer access remain unchanged.

Repository tests cover pure contract fixtures, JSON/CSV normalization,
immediate publication, persisted QA, individual and bulk publication, learner
DTO non-disclosure/fail-closed behavior, admin preview mapping, renderer
interaction shape, scoring, the 55-question repository inventory, and
deterministic audit output. They are repository/local evidence only: no
database, deployed environment, provider, import, publication, migration,
seed, or content repair was executed.

## J. Phase 2 PR 4 — Trios / Gapped Sentences contract

### Canonical structured data and accepted word

`metadata` must be an object and `metadata.sentences` must be an array of
exactly three strings. Each string is trimmed for the safe projection, must
remain non-empty, and must contain exactly one underscore run equal to
`_____`. Source order is preserved. The contract never splits `passage`,
synthesizes a sentence, repairs a marker, or returns a partial tuple.

The answer uses the repository-supported `acceptedAnswers`/`accepted` aliases.
Either a string or a one-string array is accepted; if both aliases exist, both
must be valid and equal after trimming. The shared answer must be one
Unicode-letter word, with optional internal ASCII/curly apostrophes or hyphens,
and is bounded at 80 Unicode code points. Whitespace-separated, blank,
multiple, conflicting, malformed, or over-bound values fail. `display` and
`metadata.sharedWord` are never scoring authorities and cannot synthesize an
answer.

### Import, publication, DTO, renderer, scorer, and audit

- Ordinary `NEEDS_REVIEW` JSON/CSV import retains missing or malformed sentence
  data as exact-location warnings. Every accepted-answer defect is a fatal
  import error. Both formats use the same pure contract and no new top-level
  field.
- Immediate JSON/CSV publication promotes sentence warnings to errors before
  the atomic executor. Persisted QA, individual publish, edit-to-publish,
  ordinary bulk publish, bulk `publish-safe`, and its transaction-locked QA
  reload/recheck block every sentence or answer defect.
- The positive learner DTO exposes only
  `triosSentences: [string, string, string] | null`. A malformed source produces
  `null`; raw metadata, `sharedWord`, accepted answers, display answer,
  explanation, and raw options are not projected. Admin preview keeps raw
  metadata/answer for repair but uses the same safe tuple for its renderer.
- The renderer shows the prompt, exactly three numbered sentences, and one
  labelled native text input with question-specific IDs. A missing safe tuple
  shows a Vietnamese unavailable notice and no input. Disabled handlers also
  fail closed when invoked directly; the submitted answer remains a string.
- Runtime scoring independently requires one valid configured word and a
  non-empty learner string, then uses the existing exact-text normalization.
  Blank or malformed historical configurations cannot score correct. Open
  Cloze, Word Formation, Listening Short Answer, Short Answer, Writing,
  Sentence Transformation, and Error Identification keep their existing
  branches.
- `triosWithoutThreeSentences` uses the safe sentence contract and no longer
  accepts a three-line `passage` fallback. It detects malformed entries and
  invalid gap counts without exposing shared answers.

Repository inspection at canonical base
`a24ec7ffb606996b234f3d90c156ea366825f778` finds 15 current Trios questions
across three problems in
`content-packs/pilot-pack-001/08-trios-pack-001.json`. All 15 use
`metadata.sentences`, have exactly three ordered strings with one `_____` each,
and use one `answer.accepted` word. The pack is unchanged. This is structural
evidence only: all 15 items still require human linguistic, ambiguity,
naturalness, explanation, difficulty, and calibration review and are not made
pilot-ready by this contract.

Phase 2 PR 4 evidence is repository/local only. It does not claim database,
import, publication, Preview, Production, browser-E2E, deployed endpoint,
linguistic quality, or calibration verification.

## K. Boundary and recommended next small PR

Phase 2 PR 5 contains no repaired repository Pronunciation questions,
Prisma/migration, broad UI redesign, database-backed execution, executed
import/publication, HSG, or diagnostic enablement. Its renderer tests are
structural/static repository evidence, not browser-E2E evidence.

Use the following independently reviewable bounded follow-ups. The Writing
learner-presentation item is implemented by Phase 2 PR 6 in this branch; the
remaining content-repair and Listening items are not:

1. **Error Identification content repair:** author and independently review
   real A–D spans for the 55 legacy questions; do not synthesize them from
   sentence text or metadata.
2. **Trios linguistic review:** independently review the unchanged 15 current
   items; contract conformance alone does not approve their language or level.
3. **Pronunciation content repair:** follow the separate migration plan below;
   do not infer target spans or publish the unchanged legacy items.
4. **Writing learner presentation (implemented in Phase 2 PR 6):** fixed
   controls are Vietnamese; the learner-safe DTO carries only a bounded
   `writingRubric` projection from `Question.answer.rubric`; missing/malformed
   data shows a fixed fallback. Writing stays non-auto-scored and separate AI
   feedback stays advisory.
5. **Listening contract design (Phase 2 PR 7 documentation):** see
   [`PHASE_2_LISTENING_CONTRACT.md`](PHASE_2_LISTENING_CONTRACT.md) for the
   repository inventory, proposed audio/transcript/rights/fallback/playback
   contract, publication matrix, DTO boundary, migration policy, owner
   decisions, and small-PR sequence. It implements no runtime contract.
6. **Listening pure contract implementation (Phase 2 PR 8):** implements the pure `metadata.listening` validation contract, integrated into JSON/CSV normalization, immediate import-publish, individual/edit publish, bulk `publish-safe`, persisted QA, and repository audit. No media integration, DTO projection, rendering, database interaction, or real content is implemented yet.
7. **Listening DTO and learner integration:** implement the learner-safe and admin projection boundaries and playback components.
8. **Listening content repair:** author, review, and validate real media assets and metadata against the pure contract.

## L. Writing authored-rubric presentation

The repository-authored rubric source is `Question.answer.rubric`. The seed,
Writing import template, and current pilot Writing split use one ordered array
of criterion strings. `metadata.planningHints` and
`metadata.suggestedLength` are separate authored metadata and are not part of
this bounded rubric projection.

Phase 2 PR 6 adds an all-or-nothing pure presentation contract. It accepts only
a non-empty array of at most 12 strings, trims each string, limits each visible
criterion to 240 UTF-16 code units, preserves authored order/text, and returns
`null` for missing, blank, over-bound, scalar, object, nested-array, or otherwise
malformed values. It does not mutate input, invoke accessors, stringify unknown
values, or copy answer siblings, explanations, metadata, provider data, admin
notes, samples, or model answers. No partial rubric is emitted.

The existing positive learner Prisma selector remains answer-free. A dedicated
`server-only` source reader selects `{id, answer}` only for already-authorized
Writing question IDs, immediately applies the pure projector, and returns only
the safe map. The learner DTO adds exactly
`writingRubric: {criteria: string[]} | null`; non-Writing questions always get
`null`. Problem detail, random practice, and diagnostic presentation use that
safe map. Admin preview applies the same safe projection for the production
renderer while its existing admin-authorized, `server-only` DTO retains raw
answer/explanation/metadata/options for repair. `requireAdmin` and preview
submission suppression are unchanged.

Fixed learner controls are now Vietnamese: `Luận điểm chính`, `Ý chính 1`,
`Ý chính 2`, `Từ vựng dự định dùng`, `Bài viết`, the Vietnamese placeholder,
live word count guidance, and `Tiêu chí tự rà soát`. Authored rubric strings are
shown faithfully and are not automatically translated. Missing/malformed
rubrics show “Người biên soạn chưa cung cấp bộ tiêu chí chi tiết cho đề này.” The
renderer states that criteria are for self-review, not an answer or automatic
score.

Writing scoring is unchanged: `checkQuestionAnswer` returns `isCorrect=null`,
submission results use the neutral review state, and neither the rubric nor AI
feedback becomes an answer key or automatic correctness score. The separate
Writing AI grader retains its reviewed advisory framing, quota, retry,
recovery, provider, and persistence policies; this PR changes none of them.
Exact/non-exact Sentence Transformation and Error Identification, Trios, and
Pronunciation scoring contracts are unchanged.

Evidence for this PR is repository/local only: pure projection tests, mocked
server-source tests, DTO serialization/non-disclosure tests, structural
server-rendered component tests, existing recovery/review tests, scoring
regressions, typecheck, lint, full suite, synthetic-unreachable Production
build, diff checks, and file-format checks. It is not browser-E2E,
screen-reader, Preview, Production, provider, managed-database, import,
publication, linguistic, rubric-quality, difficulty, or calibration evidence.
Human reviewers must still assess English/Vietnamese quality, rubric
appropriateness, task alignment, level, originality, difficulty, and
calibration before publication.

## M. Pronunciation target-span migration plan

Phase 2 PR 5 changes code, tests, audit signals, authoring guidance, and the
sample import template only. It does not change
`content-packs/pilot-pack-001/01-pronunciation-pack-001.json`, repair any current
question, or approve any pronunciation answer.

Repository inspection at canonical base
`89eb8ce76a94b55bc6a0ca228f90a90e08f7478c` confirms 6 Pronunciation
problems and 30 `PRONUNCIATION_ODD_ONE_OUT` questions. Every question has four
options using the supported `label` alias, an answer using the supported
`correctOption` alias, and a generic `metadata.focus`; none of the 120 options
has `targetSpan`. `metadata.focus` is insufficient because it does not identify
the exact grapheme within each displayed option.

The separate repair PR must process every one of the 30 questions
individually:

1. A human linguist identifies the intended grapheme without automated
   inference.
2. The reviewer authors all four zero-based, half-open Unicode-code-point
   target spans.
3. The answer is independently revalidated against the actual pronunciation;
   the existing answer is not presumed correct.
4. Ambiguity, dialect, and register are reviewed and recorded.
5. The explanation identifies the decisive pronunciation contrast.
6. Answer-position balance and difficulty/calibration review remain mandatory.
7. The repaired content remains `NEEDS_REVIEW`; structural validation does not
   authorize publication.
8. Repository audit, persisted/admin publication QA, admin preview, and learner
   rendering checks are rerun before any later publication decision.

No span may be inferred from `metadata.focus`, the correct answer, matching
letters, phonetic assumptions, capitalization, `accepted`, `display`, an
external dictionary, or AI. Passing the structural contract proves only that
the renderer and scorer have bounded deterministic data; it does not prove
phonetic, dialectal, ambiguity, difficulty, or calibration correctness. After
this contract PR, all 30 unchanged questions are publication-blocked until the
separate repair and human approval are complete.

## N. Phase 2 PR 7 — Listening contract design

[`PHASE_2_LISTENING_CONTRACT.md`](PHASE_2_LISTENING_CONTRACT.md) is the
documentation authority for future problem-bank Listening work. It preserves
`LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` as separate answer/input/scoring
types and proposes one versioned `metadata.listening` descriptor, a same-origin
pilot default, reviewed transcript and rights evidence, fail-closed playback,
deterministic issue-code/severity families, an all-or-nothing learner DTO, and
transaction-locked publication enforcement.

Repository inventory remains 0 Listening problems and 0 Listening questions
across all five difficulties. No selected pack contains an audio URL,
`sectionType`, or transcript key, and no local audio asset was found in the
repository application/content roots. Contest-section audio/transcript fields,
documentation examples, and synthetic test strings are capability/examples,
not asset, provider, licence, transcript, database, or publication evidence.

The design does not select a storage provider, approve cost, settle public
versus authenticated delivery, expose transcripts during assessment, set
replay limits, approve dialect/licence policy, or define retention/deletion.
Those project-owner decisions block real implementation/content. This PR
changes no schema, importer, QA, scorer, DTO, renderer, test, content pack,
media, database, provider, or runtime behavior.
