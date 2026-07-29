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
5. Keep `LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` separate, but block both
   from the validation batch and publication until the media contract is fixed.
6. Defer HSG. Keep every pilot item diagnostic-ineligible until stable
   calibration evidence exists.

## Repository evidence and confirmed contradictions

This document uses repository evidence only. It makes no claim about a database,
Preview, Production, provider, environment, or deployed content.

- PR #21 proposed renderer correctness as the next PR; this approved PR instead
  establishes the QA workflow first. Renderer debt remains a publication gate.
- The audit finds Trios sentences in `metadata.sentences`/`passage`, but the
  learner DTO does not carry `metadata.sentences` and `TriosQuestion` only shows
  `prompt`.
- All 55 current `ERROR_IDENTIFICATION` questions lack renderable options.
  Import validation only requires `correctPart` and `correction`, while the
  learner renderer requires options.
- Pronunciation pack metadata has `focus`, but no learner-safe target-span or
  underline contract renders it.
- Writing uses a hard-coded checklist and English control labels; authored
  rubric data is not rendered.
- Listening enums, checker branches, and a component exist, but there is no
  dedicated schema/import contract for audio or transcript. The component only
  reads unvalidated `metadata.audioUrl` and `metadata.sectionType`.
- Persisted QA is enforced by bulk `publish-safe`, but single publish and
  immediate import-publish use only minimal publish validation.
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
| `WRITING_PROMPT` | `prompt`; `WritingQuestion` with fixed planning/checklist UI | answer object; `isCorrect=null` | Mandatory rubric review; authored rubric not rendered and English UI remains a publication blocker |
| `LISTENING_MCQ` | prompt/options; `ListeningQuestion` reads `metadata.audioUrl/sectionType` | `correctOptionId`; auto | Audio/transcript/rights/fallback contract unresolved: block validation/publication |
| `LISTENING_SHORT_ANSWER` | prompt/text input; same metadata | `acceptedAnswers`; auto exact normalized text | Review accepted variants; remains separately blocked with Listening |
| `PRONUNCIATION_ODD_ONE_OUT` | prompt/options; `PronunciationQuestion` | `correctOptionId`; auto | Target grapheme must be explicit; current target-span contract is absent, so block |
| `GUIDED_CLOZE` | shared passage, slot prompt/options; `GuidedClozeQuestion` | `correctOptionId`; auto | Validate blank mapping, context, distractors, A–D balance |
| `OPEN_CLOZE` | shared passage, slot prompt; `OpenClozeQuestion` | `acceptedAnswers`; auto exact normalized text | UI expects one word; include all legitimate bounded variants |
| `WORD_FORMATION` | prompt + `rootWord`; dedicated renderer | `acceptedAnswers`; auto exact normalized text | Review word class, polarity/plural, and visible root |
| `SENTENCE_TRANSFORMATION` | prompt, optional `keyword`/`targetSentence`; dedicated renderer | exact accepted answer = true; otherwise `null` | Never count non-exact as wrong; review equivalence/variants; no active manual-grading UI |
| `ERROR_IDENTIFICATION` | prompt + options; dedicated part/correction renderer | `correctPart` + `correction`; auto both, `/` separates correction variants | Import does not require options. Pilot requires four unique A–D options and member `correctPart` |
| `TRIOS_GAPPED_SENTENCES` | current component renders only prompt | exactly one shared `acceptedAnswers`; auto | Review three natural contexts; learner DTO omits stored sentences, so block publication |

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
- Importable core release: `phase2-pilot-core-001`, 19/76, excluding Listening.
- Blocked future release: `phase2-listening-pilot-001`, 2/8, created only after
  the Listening contract passes.
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
immediate-publish use, or current Writing/Pronunciation/Trios/Listening blocker.

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
| Publish | Bulk safe rechecks QA; single publish is weaker | Use only bulk `publish-safe` after sign-off | Enforced approval/reviewer separation |
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

## H. Minimal automation in this PR

The audit adds two deterministic, non-blocking signals. Renderer compatibility
answers whether required controls/options can be projected, displayed, and
scored. `rendererIncompatibleOptions` therefore reports fewer than two
renderable options, missing/invalid IDs, scorer-equivalent duplicate IDs,
missing/invalid display text, and a selected answer outside the rendered
options, including for Error Identification.

The contract mirrors current code: learner option projection accepts only
`string` and `number` IDs/text and converts them with `String(...)`; scorer
membership trims and uppercases IDs. Error Identification gets selectable parts
from the same projected options and accepts normalized `correctPart` or the
import alias `errorPart`; correction validation remains the importer's separate
rule.

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

Both signals are review warnings: neither changes `hasInventoryErrors`, import,
database, learner, admin, scoring, or publication behavior. No subjective
language/difficulty rule, explanation-length failure, licensing schema rule,
answer-position failure threshold, or invented Listening field was added.
Human mode prints only bounded counts. Full deterministic file/problem/question
locations, issue codes or duplicate groups, and safe option representations are
available in JSON mode:
`npm run --silent audit:content-packs -- --format=json`.

## I. Boundary and recommended next small PR

This PR contains no real pilot questions, Prisma/migration, UI redesign,
database-backed execution, import/publication, HSG, or diagnostic enablement.

Use the following independently reviewable bounded PRs; none is implemented in
this branch:

1. **Error Identification options:** importer/audit/persisted-QA contract and
   renderer tests.
2. **Trios:** learner-safe DTO projection and three-sentence rendering.
3. **Pronunciation:** target-span schema/normalization, safe DTO, renderer, and
   migration plan.
4. **Writing:** Vietnamese controls and authored-rubric presentation while
   preserving non-auto-scoring.
5. **Listening contract design:** audio policy, transcript, rights, fallback,
   playback, accessibility, import validation, and DTO design.
6. **Listening implementation and content:** only after the contract-design PR
   is reviewed and approved.
