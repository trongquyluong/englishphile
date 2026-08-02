# Englishphile Phase 2 — Product and content audit baseline

## Scope and evidence boundary

This report is the repository-only baseline for Phase 2 PR 1.

- Canonical base: `main` at `52f0ec030196ec202c26872325a29d0ddb5d3db6`.
- Evidence inspected: tracked application code, Prisma schema, import normalization and validation, content-pack QA, modular question renderers, static Wiki/Writing sources, the two repository content-pack manifests, and the complete 17-file set selected by the shared importer selector.
- Inventory command: `npm run audit:content-packs`.
- Machine-readable command: `npm run --silent audit:content-packs -- --format=json`.
- The audit is database-free. It does not instantiate Prisma, read environment values, inspect deployed pages, or call an external provider.
- The audit and importer share one pure JSON/CSV selector and normalization contract. Numbered split files keep importer order and take precedence over `00-all-in-one` mirrors when both are present.
- A manifest is optional, matching importer behavior. When present, it is checked bidirectionally: missing, duplicate, invalid, or unlisted importer-selected files are inventory errors.

Repository evidence describes what is committed and what pure/local tests prove. It does not prove which content is imported, published, or used in a database.

Preview evidence and Production evidence are separate operational evidence classes. Historical, owner-attested Preview and Production observations remain documented in the Phase 1D security reports and `handoff.md`; they were not rechecked for this audit. This report makes no new claim about current Preview or Production content, database rows, environment configuration, provider behavior, deployment state, or runtime logs.

## Repository content inventory

The following values are parsed from every importer-selected file after the real JSON/CSV normalization and type-specific validation path. They are not hard-coded into the audit implementation.

| Inventory | Count |
| --- | ---: |
| Content packs | 2 |
| Importer-selected split files | 17 |
| Problems | 101 |
| Questions | 495 |
| Option-based questions | 230 |
| Manifest count mismatches | 0 |
| Malformed manifests/payloads | 0 |
| Import-normalizer errors | 0 |

| Pack | Split files | Problems | Questions |
| --- | ---: | ---: | ---: |
| Englishphile Content Pack 002 | 7 | 55 | 275 |
| Englishphile Pilot Database Pack 001 | 10 | 46 | 220 |

### Inventory by skill

| Skill | Problems | Questions |
| --- | ---: | ---: |
| Error Identification | 11 | 55 |
| Grammar Focus | 4 | 20 |
| Guided Cloze | 4 | 15 |
| Multiple Choice | 19 | 95 |
| Open Cloze | 4 | 15 |
| Phrasal Verbs | 8 | 40 |
| Pronunciation | 6 | 30 |
| Reading | 2 | 10 |
| Sentence Transformation | 15 | 75 |
| Transitions | 4 | 20 |
| Trios / Gapped Sentences | 3 | 15 |
| Word Formation | 20 | 100 |
| Writing | 1 | 5 |
| Listening | 0 | 0 |
| **Total** | **101** | **495** |

No repository problem is labelled with the separate `COLLOCATIONS` skill. The collocation pack uses the `MULTIPLE_CHOICE` skill and `MCQ` question type.

### Inventory by question type

| Question type | Questions |
| --- | ---: |
| Error Identification | 55 |
| Guided Cloze | 15 |
| MCQ | 175 |
| Open Cloze | 15 |
| Pronunciation Odd One Out | 30 |
| Reading MCQ | 10 |
| Sentence Transformation | 75 |
| Trios / Gapped Sentences | 15 |
| Word Formation | 100 |
| Writing Prompt | 5 |
| Listening MCQ | 0 |
| Listening Short Answer | 0 |
| Short Answer | 0 |
| **Total** | **495** |

### Inventory by difficulty

| Difficulty | Problems | Questions |
| --- | ---: | ---: |
| B2 | 0 | 0 |
| C1 | 0 | 0 |
| C2 | 0 | 0 |
| CHUYEN | 101 | 495 |
| HSG | 0 | 0 |

The repository bank therefore cannot currently support a genuinely difficulty-balanced diagnostic or progression despite the five-level schema and weighted scoring rules.

### Option answer-position distribution

The audit supports `correctOptionId` and `correctOption`, and option identifiers stored as `id` or `label`.

| Position | Questions | Share of option questions |
| --- | ---: | ---: |
| A | 156 | 67.8% |
| B | 44 | 19.1% |
| C | 18 | 7.8% |
| D | 12 | 5.2% |
| **Total** | **230** | **100%** |

This is a strong answer-position imbalance. It is editorial debt, not a malformed-input condition, so the CLI reports it without returning a failure exit code.

### Repository quality signals

| Signal | Count | Interpretation |
| --- | ---: | --- |
| Problems without instructions | 0 | Structural check |
| Missing explanations | 0 | Structural/editorial check |
| Historical Phase 2 audit baseline: explanations shorter than 45 characters | 440 | Heuristic signal only; not an automatic editorial failure |
| Word Formation without root word | 0 | Type-specific check |
| Reading without a shared passage | 0 | Type-specific check |
| Trios without exactly three sentences in passage/metadata | 0 | Type-specific check |
| Question/problem skill mismatches | 0 | Structural consistency |
| Question/problem difficulty mismatches | 0 | Structural consistency |
| Option questions with missing/non-member correct option | 0 | Structural consistency |
| Option-rendered questions incompatible with the learner renderer | 55 | PR 2 warning: current Error Identification data has no renderable options |
| Substantive exact duplicate prompt groups | 3 | Editorial duplicate review |

Repeated generic Pronunciation and Trios instructions are excluded from substantive duplicate detection because their distinguishing content is carried by options or three-sentence metadata. Very short Cloze slot labels are also below the substantive prompt threshold.

### Later persisted-QA note: Phase 2 PR 14

Phase 2 PR 14 adds two deterministic persisted admin-review warnings without
changing this repository-audit baseline, its JSON shape, ordering, bytes, or
exit behavior. `EXPLANATION_TOO_SHORT` marks only trimmed, non-empty
explanations from 1 through 44 UTF-16 code units; the threshold is 45, and
blank/missing explanations retain only their existing warning.

`ANSWER_POSITION_SKEW` evaluates each problem independently across the same
option family used by the repository answer-position inventory:
`PRONUNCIATION_ODD_ONE_OUT`, `MCQ`, `GUIDED_CLOZE`, `READING_MCQ`, and
`LISTENING_MCQ`. It excludes `ERROR_IDENTIFICATION` and every unsafe,
malformed, structurally invalid, incomplete, duplicate-ID, or non-member-answer
question. It emits at most one warning when at least four eligible questions
have a position above 50%, or when at least eight eligible questions omit any
A-D position. Fewer than four eligible questions never trigger it.

These are heuristic `WARNING`s, not structural validation, linguistic or
semantic approval, correctness proof, difficulty/calibration evidence, or
publication approval. Warning-only problems remain publishable because
persisted QA still derives `canPublish` exclusively from `errors === 0`.
Existing Error Identification, Pronunciation, Trios, Listening, import, and
publication blockers are unchanged.

The current post-repair repository audit remains unchanged at
`rendererIncompatibleOptions: 5`, `normalizerWarnings: 126`,
`pronunciationWithoutValidTargetSpans: 30`, `shortExplanations: 437`, and
`hasInventoryErrors: false`. Persisted warning totals depend on actual database
rows, so no total is claimed here. No real database or deployed admin QA page
was inspected for PR 14.

## Current learner journeys

The route inventory below is repository evidence. Database-dependent availability or counts are not asserted.

1. **Public orientation and account access**
   - `/` introduces diagnostic-first learning, Gym, Contests, Wiki, wrong-question review, and the product story.
   - `/about`, `/contact`, `/status`, `/privacy`, and `/terms` provide product, support, health, privacy, and terms surfaces.
   - `/auth/sign-up` creates a learner account only; `/auth/sign-in` starts an authenticated session.
   - `/profile` lets an authenticated learner manage their profile and study goal.

2. **Diagnostic placement**
   - `/diagnostic` explains the initial check and redirects a learner with a completed diagnostic toward Gym.
   - `/diagnostic/start` presents the selected diagnostic questions.
   - `/diagnostic/result` shows completion-gated aggregate level, confidence, skill/topic breakdown, and recommendations.
   - The required scored blueprint is 26 Use of English questions plus 5 Reading questions. Writing is optional and unscored; Listening is optional and excluded when unavailable.

3. **Personal dashboard and recommendations**
   - `/dashboard` summarizes diagnostic status, recommendations, progress, recent submissions, Gym entry points, Contests, Wiki, and profile.
   - `/recommendations` combines stored deterministic recommendations, published fallback problems, and wrong-question retries.
   - `/practice/adaptive` lets the learner choose time, focus, and skill, then returns a list of published unsolved/recommended problems.

4. **Gym**
   - `/gym` is the central practice hub.
   - `/gym/reading` lists published Reading practice and skill state.
   - `/gym/writing` lists the separate static Writing prompt bank and links to the grader/review flow.
   - `/gym/listening` is an explicit future-ready empty state when no Listening content exists.
   - `/gym/use-of-english` links to Pronunciation, Multiple Choice, Open Cloze, Guided Cloze, Word Formation, Sentence Transformation, Error Identification, Trios, Collocations, Phrasal Verbs, Transitions, and Grammar Focus.
   - `/reading`, `/writing`, `/listening`, and `/use-of-english` redirect to the corresponding Gym routes.

5. **Problem bank and independent practice**
   - `/problems` filters the published problem bank by skill, difficulty, topic, source, query, and learner status.
   - `/problems/[slug]` renders a published problem through the modular question renderers and records an independent-practice submission.
   - `/practice/random` creates a 5/10/20-question random session from published questions filtered by skill/difficulty.
   - `/wrong-questions` lists the learner’s own wrong answers and retry links.
   - `/skills` links skill summaries to filtered practice.

6. **Analytics**
   - `/analytics` shows the learner’s overall practice/diagnostic summary, weak skills/topics, wrong questions, and recommendations.
   - `/analytics/skills/[skillType]` shows the learner’s own detail for one skill, including topics, recommended problems, wrong questions, and recent submissions.

7. **Contests**
   - `/contests` lists available public/private contest entries with availability and resume/result state.
   - `/contests/[id]` shows contest metadata, access-code flow where required, sections, rules, and start/resume/result actions.
   - `/contests/[id]/start` supports timed attempts for legacy problem-backed and section/question-backed contests.
   - `/contests/[id]/result` gives learner-safe result review.
   - `/contests/[id]/leaderboard` shows display names, score/time, and status without email.

8. **Wiki**
   - `/wiki` and `/wiki/[slug]` render the static repository article bank.
   - `/theory` redirects to `/wiki`.

9. **Writing grader**
   - `/gym/writing/grader` uses the selected static prompt, persists bounded Writing submissions for authenticated learners, and shows the latest server-backed review.
   - Provider-backed grading is a separate, bounded Phase 1D-D1 flow and is not exercised by this repository audit.

Classroom, assignment, join-code, teacher-dashboard, assignment-submission, and manual-grading application journeys are retired and are not learner journeys.

## Current admin journeys

Every `/admin` page is protected by the admin layout, and mutation/API boundaries retain their own authorization checks.

1. **Admin overview and beta readiness**
   - `/admin` summarizes content operations and links to imports, packs, QA, review, problem bank, taxonomy, diagnostic setup, contests, Wiki, and beta readiness.
   - `/admin/beta-checklist` checks repository/runtime configuration plus database-backed readiness counts when actually run by an administrator.

2. **Import**
   - `/admin/import` provides upload-first multi-file JSON/CSV validation, dry-run preview, duplicate handling, commit, history, and an advanced manual-paste path.
   - It prefers split files over `00-all-in-one`, defaults imports to `NEEDS_REVIEW`, and supports explicit immediate publishing only after admin review.
   - PDF/DOCX/OCR and ZIP extraction are not implemented.

3. **Content packs and QA**
   - `/admin/content-packs` lists imported packs and persisted counts.
   - `/admin/content-packs/[id]` shows manifest/import traceability, distributions, QA summary, related sources/problems, and bounded bulk lifecycle actions.
   - `/admin/content-qa` runs persisted-content QA and allows only error-free items through the safe bulk-publish path.

4. **Editorial review and problem management**
   - `/admin/review` filters the `DRAFT`/`NEEDS_REVIEW` queue and links edit, preview, publish, and archive actions.
   - `/admin/problems` searches and filters the full editorial bank and supports bounded bulk lifecycle changes.
   - `/admin/problems/[id]` shows metadata, source/topics, questions, options/answer JSON, and lifecycle actions.
   - `/admin/problems/[id]/edit` edits problem/question fields with JSON validation before save.
   - `/admin/problems/[id]/preview` uses the answer-complete admin DTO and production renderer with persistence disabled.

5. **Sources and topics**
   - `/admin/sources` and `/admin/sources/[id]` inspect source collections, import history, lifecycle distribution, and linked problems.
   - `/admin/topics` and `/admin/topics/[id]` inspect/edit taxonomy, hierarchy, and linked content.

6. **Diagnostic bank**
   - `/admin/diagnostic` shows coverage by blueprint/skill/difficulty and manages `isDiagnosticEligible` for published problems.

7. **Contests**
   - `/admin/contests`, `/admin/contests/new`, `/admin/contests/[id]`, and `/admin/contests/[id]/edit` manage legacy problem-backed contests, using published problems by default and validating publication on the server.
   - `/admin/contests-builder`, `/admin/contests-builder/new`, and `/admin/contests-builder/[id]/edit` manage section/question-backed contests including Listening metadata.
   - `/admin/contests-builder/import` validates and imports the supported Excel contest format into a draft.

8. **Wiki**
   - `/admin/wiki` reads Prisma `TheoryNote` rows and currently acts as an overview/placeholder rather than managing the static public article bank.

## Broken, incomplete, confusing, and empty experiences

### Confirmed rendering and review conflicts

- **Trios rendering is incomplete.** All 15 repository Trios questions carry three sentences in `metadata.sentences`, but `TriosQuestion.tsx` renders only `question.prompt` and a text input. The learner cannot see the three sentences needed to solve the question.
- **Post-submission copy conflicts with the safe DTO.** `ProblemClient.tsx` says submitting opens “đáp án đúng và giải thích”, while the Phase 1D-A learner-safe response intentionally returns only correctness and fixed generic feedback. This PR must not weaken that DTO. Any future review contract must be explicitly completion-gated and must never expose active contest or diagnostic answers.
- **Pronunciation target marking is not represented.** The renderer adds a generic instruction and renders plain option text. The repository format has no consistently rendered target-span/underline contract, so the learner may not know which letters are being compared.

### Empty or split content systems

- **Listening is empty.** The repository packs contain zero Listening problems/questions, and `/gym/listening` explicitly displays a preparation/empty state.
- **Wiki has two disconnected sources.** Public Wiki reads one static repository article from `src/lib/wiki-content.ts`; `/admin/wiki` reads Prisma `TheoryNote` records. Admin edits cannot change the public static article bank.
- **Writing has two disconnected sources.** Writing Gym reads 10 static prompts from `src/lib/writing-prompts.ts`, while the repository content packs contain 1 Writing problem with 5 Writing questions intended for import. The imported bank and static grader catalog are not one curriculum.

### Selection, calibration, and count limitations

- **Diagnostic difficulty is imbalanced.** All 495 pack questions are `CHUYEN`. The deterministic weight table supports B2/C1/C2/CHUYEN/HSG, but repository content cannot calibrate those levels.
- **Adaptive practice is a recommendation list, not an adaptive sequence.** Time is converted to a requested item count; there is no within-session response-based difficulty update.
- **Random practice is shallow.** It loads all matching published questions, shuffles in memory, and has a disabled “include wrong questions” placeholder. It does not guarantee balanced skill/difficulty coverage or passage-group integrity.
- **Contest counts are inconsistent.** The list reports `_count.problems`; detail calculates one “question” per linked problem plus standalone section questions, while the start page expands all questions inside linked problems. Learners may see different counts for the same contest.

### Editorial and admin quality limitations

- **Mojibake exists in admin JSX.** Confirmed examples include corrupted separators/placeholders in problem/source/review/admin detail surfaces. This is source-level presentation debt, not a terminal-display inference.
- **Problem editing is JSON-heavy.** Options, answers, and metadata are edited in generic textareas. Validation prevents invalid JSON from saving, but the workflow is error-prone and does not provide type-specific editorial affordances.
- **At the PR 1 baseline, editorial QA was insufficient for the present debt.** It caught important structural errors but did not signal severe answer-position imbalance or very short explanations, and it still did not establish cross-pack duplicate resolution, difficulty calibration, renderability approval, or curriculum coverage. The later Phase 2 PR 14 note above records the two new warning-only signals without converting them into failures.
- **Explanations were mostly too short for independent learning at the historical Phase 2 audit baseline.** At that historical checkpoint, 440/495 were below the 45-character heuristic; the current post-repair repository count is 437. Length alone is not proof of poor quality, but this concentration warrants structured review.

## Must fix before a controlled beta

1. Render all three Trios sentences from learner-safe presentation data and add renderer tests.
2. Reconcile post-submission UI copy with the Phase 1D-A DTO. Design a completion-gated review contract before exposing any answer/explanation, with explicit contest and diagnostic exclusions.
3. Define and render a safe pronunciation target-marking field; migrate/normalize affected content through admin-reviewed tooling.
4. Create and QA a multi-difficulty representative bank, then recalibrate the deterministic diagnostic against it.
5. Correct contest counts so list, detail, start, and result use one defined unit.
6. Remove confirmed admin mojibake from user-visible JSX.
7. Expand QA to cover answer-position balance, short-explanation review, substantive exact duplicates, difficulty coverage, and renderer-required metadata.
8. Decide the controlled-beta treatment for Listening: publish a validated minimum bank or clearly keep it excluded from diagnostic and beta promises.

## Should improve during beta

1. Replace generic answer/option/metadata JSON textareas with type-aware editors while retaining raw JSON as an advanced escape hatch.
2. Unify public Wiki publishing with the admin `TheoryNote` lifecycle, or explicitly retire one source.
3. Unify static Writing prompts and imported Writing problems into one reviewed catalog.
4. Make random sessions passage-aware and stratified by skill/difficulty; implement the wrong-question option.
5. Make adaptive sessions react to answers within the session and explain each next-item choice.
6. Add editorial dashboards for explanation depth, duplicate clusters, answer-position skew, missing level coverage, and pack-to-published drift.
7. Add learner feedback/reporting on questionable content with an admin triage queue.

## Post-beta ideas

- Calibrated item statistics from sufficient real attempts, with minimum-sample rules and no opaque level changes.
- Versioned curriculum releases and content retirement/replacement history.
- Audio/transcript workflow with accessibility review for Listening.
- Spaced review queues for vocabulary, collocations, transformations, and wrong answers.
- Controlled content experiments with explicit success metrics.
- AI-assisted authoring only as an admin-reviewed drafting aid; deterministic scoring and publication gates remain authoritative.

## Proposed difficulty rubric

Difficulty is the cognitive/linguistic demand of an item, not the age of the learner or the source filename.

| Level | Working definition | Typical language demand | Item design and distractors | Expected support |
| --- | --- | --- | --- | --- |
| B2 | Independent upper-intermediate control | Common academic vocabulary, standard complex sentences, explicit argument structure | One main inference or grammar decision; distractors reflect common B2 errors | Clear context; limited ambiguity; direct explanation |
| C1 | Advanced flexible control | Less frequent lexis, dense clauses, register/collocation sensitivity | Multiple plausible options requiring context, discourse, or precise usage | Explanation contrasts the correct choice with the strongest distractor |
| C2 | Near-mastery comprehension and expression | Nuance, idiom, subtle stance, compressed/implicit cohesion | Fine-grained semantic or pragmatic distinctions; multi-step inference | Explanation names the decisive linguistic evidence |
| CHUYEN | Vietnamese specialized-English entrance-exam alignment | Mixed B2–C1 language with exam-specific transformations, word formation, cloze, and time pressure | Familiar chuyên formats, deliberate traps, cross-sentence control | Strategy plus language explanation; source/exam objective recorded |
| HSG | High-selectivity olympiad-style challenge | Broad/rare lexis, sophisticated syntax, idiomatic precision, cross-text reasoning | Several defensible-looking distractors; synthesis or exceptional precision | Full rationale, why alternatives fail, and prerequisite knowledge |

`CHUYEN` and `HSG` are assessment-purpose labels, not simple synonyms for C1 and C2. A future calibration pass should record both linguistic level evidence and exam-format purpose.

## Proposed curriculum progression

1. **Foundation diagnosis:** B2/C1 anchor items across Reading and core Use of English; no result from a single format.
2. **Core control:** grammar focus, standard MCQ, guided/open cloze, common collocations, and explicit reading comprehension.
3. **Productive transformation:** word formation, sentence transformation, error identification, and short constructed answers.
4. **Discourse and nuance:** transitions, phrasal verbs, advanced collocations, Trios, inference, author stance, and vocabulary in context.
5. **CHUYEN application:** timed mixed sets that mirror specialized-English entrance formats without reorganizing the product around source days.
6. **HSG challenge:** selective high-complexity sets after stable performance at the preceding levels.
7. **Integrated production:** Writing and Listening tracks with their own rubrics, evidence, and completion rules; neither should distort auto-scored level when unscored/unavailable.
8. **Review loop:** wrong answers and weak topics feed deterministic recommendations back into Gym; solved content gives way to spaced retry and challenge items.

## Quality-control workflow

1. **Author against a specification:** assign skill, question type, difficulty evidence, topic, objective, renderer-required fields, answer, and explanation.
2. **Run repository audit:** `npm run audit:content-packs`; resolve importer-normalizer errors and bidirectional manifest/selected-set mismatches before import. Review heuristic signals without treating every short explanation as an automatic failure.
3. **Run import dry-run:** normalize aliases, validate JSON and type-specific answer requirements, and detect exact/high/possible duplicates.
4. **Import as `NEEDS_REVIEW`:** retain source, import batch, and content-pack traceability.
5. **Run persisted QA:** block all `ERROR` items; review warnings and duplicate risk.
6. **Admin editorial review:** use a type-specific checklist, confirm answer membership, explanation quality, level, bias, copyright/originality, and Vietnamese learner-facing copy.
7. **Admin preview:** verify the actual modular renderer, including passage/audio/metadata-dependent content; preview must not save a submission.
8. **Publish a bounded batch:** publish only reviewed problems and keep diagnostic eligibility separate.
9. **Post-publication sampling:** inspect learner reports and aggregate performance after a minimum sample; archive or revise through controlled small PRs/import batches.
10. **Regression gate:** focused tests, full tests, typecheck, lint, build, `npm audit --omit=dev`, and repository audit.

## First representative batch: 21 problems / 84 questions

The first new/rewritten batch should use four questions per problem so review scope is predictable. It is a proposed editorial batch, not an assertion that these rows exist.

| Area / skill | Type | Problems | B2 | C1 | C2 | CHUYEN | HSG | Total questions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reading | READING_MCQ | 3 | 4 | 4 | 4 | 0 | 0 | 12 |
| Writing | WRITING_PROMPT | 2 | 0 | 4 | 0 | 4 | 0 | 8 |
| Listening | LISTENING_MCQ + LISTENING_SHORT_ANSWER | 2 | 4 | 4 | 0 | 0 | 0 | 8 |
| Pronunciation | PRONUNCIATION_ODD_ONE_OUT | 1 | 4 | 0 | 0 | 0 | 0 | 4 |
| Multiple Choice | MCQ | 1 | 4 | 0 | 0 | 0 | 0 | 4 |
| Guided Cloze | GUIDED_CLOZE | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Open Cloze | OPEN_CLOZE | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Word Formation | WORD_FORMATION | 2 | 0 | 4 | 4 | 0 | 0 | 8 |
| Sentence Transformation | SENTENCE_TRANSFORMATION | 2 | 0 | 4 | 4 | 0 | 0 | 8 |
| Error Identification | ERROR_IDENTIFICATION | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Trios / Gapped Sentences | TRIOS_GAPPED_SENTENCES | 1 | 0 | 0 | 4 | 0 | 0 | 4 |
| Collocations | MCQ under dedicated COLLOCATIONS skill | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Phrasal Verbs | MCQ | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Transitions | MCQ | 1 | 0 | 4 | 0 | 0 | 0 | 4 |
| Grammar Focus | MCQ | 1 | 0 | 0 | 0 | 4 | 0 | 4 |
| **Total** |  | **21** | **16** | **44** | **16** | **8** | **0** | **84** |

- HSG is intentionally excluded from the first validation batch.
- The 44 C1 questions are deliberate because C1 is the bridge between B2 anchors and C2/CHUYEN application, and it spans the largest number of advanced core formats in this proposal. This is a review-coverage rationale, not evidence that C1 is already calibrated.
- The difficulty rubric must first be calibrated with B2–CHUYEN examples and independent review.
- HSG content begins only in a later bounded batch after answer uniqueness, distractor quality, and difficulty judgments are stable.
- The two planned Listening problems keep `LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` separate: the former uses options plus `correctOptionId`, while the latter uses accepted short answers. They are reserved in the 21/84 arithmetic but cannot enter a validation batch or be published until the transcript/audio/import/rendering contract is explicitly confirmed or implemented. The current schema has no generic `transcript` field, so this audit does not invent one.
- Writing remains non-auto-scored.
- None of these questions becomes diagnostic-eligible until calibration succeeds.

Calibration succeeds only when independent reviewers agree that:

- **B2** anchors use common language, have one stable answer, and discriminate foundational control without hidden C1 demand;
- **C1** items require precise context, register, collocation, or discourse control, with one defensible answer and documented treatment of the strongest distractor;
- **C2** items test genuine nuance or multi-step inference rather than obscurity, with decisive evidence recorded;
- **CHUYEN** items demonstrate both the intended exam-format purpose and defensible B2–C1 linguistic demand;
- every included item passes the real normalizer, type-specific renderer preview, answer-uniqueness and explanation review, followed by bounded performance review when learner samples exist.

HSG stays deferred until these B2–CHUYEN judgments are stable. Diagnostic eligibility remains prohibited before that gate succeeds.

Acceptance criteria for this batch:

- every problem has clear Vietnamese instructions and exactly four renderable questions;
- every objective answer belongs to the normalized option/answer structure;
- every explanation is useful on substance; short text is reviewed, not rejected solely by length;
- answer positions are intentionally balanced within each option-based subset;
- Reading passages, Word Formation roots, Pronunciation targets, and Trios sentences render in admin preview;
- no Listening item enters validation or publication until the separate audio/transcript/import/rendering prerequisite is confirmed;
- no substantive exact/high-similarity duplicate survives review;
- skill and difficulty labels are justified by the rubric;
- content defaults to `NEEDS_REVIEW`, passes QA, and is published only through the existing admin path.

## Practical small-PR sequence

1. **PR 1 — audit baseline (this PR):** pure repository audit, CLI, tests, documentation; no behavior or database change.
2. **PR 2 — renderer correctness:** Trios sentences and pronunciation target contract with learner/admin preview tests.
3. **PR 3 — completion-gated review design:** correct misleading copy first, then introduce a reviewed DTO contract that cannot expose active contest/diagnostic answers.
4. **PR 4 — QA extensions:** answer-position, explanation heuristic, duplicate groups, renderer metadata, and difficulty coverage.
5. **PR 5 — contest count consistency:** one shared count definition across list/detail/start/result/admin.
6. **PR 6 — admin copy cleanup:** mojibake and remaining English/mixed editorial labels, with no workflow change.
7. **PR 7 — type-aware editors:** start with option questions and Trios/Pronunciation; retain JSON validation.
8. **PR 8 — representative content batch A:** first reviewed subset of the 21/84 plan, balanced B2/C1 anchors.
9. **PR 9 — representative content batch B:** remaining B2–CHUYEN levels/skills, including Listening assets; no HSG content yet.
10. **PR 10 — diagnostic calibration:** enable only reviewed published items and verify deterministic weighting/confidence.
11. **PR 11 — bounded HSG pilot:** begin only after answer uniqueness, distractor quality, and B2–CHUYEN difficulty judgments are stable.
12. **PR 12 — Wiki/Writing source decision:** unify each split or document/retire the unused path.
13. **PR 13 — adaptive/random improvements:** passage-aware random selection, wrong-question option, and explainable within-session adaptation.

Each PR should preserve the Phase 1D-A learner-safe DTO, avoid schema/data operations unless separately approved, and classify repository, Preview, and Production evidence independently.
