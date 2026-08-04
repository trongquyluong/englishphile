# Phase 2 PR 17 — Pronunciation blocker replacement pilot 001

## 1. Repository identity and bounded scope

- Repository: `C:\Dev\englishphile`
- Branch: `phase2/17-pronunciation-blocker-replacement-pilot-001`
- `HEAD`, canonical base, and merge-base with `origin/main`:
  `970259358a94ef68e51810bcb4854097297c2518`
- `main` and `origin/main` at recovery time:
  `970259358a94ef68e51810bcb4854097297c2518`
- Content file:
  `content-packs/pilot-pack-001/01-pronunciation-pack-001.json`

This PR replaces only the ten Pronunciation rows that PR 16 left blocked and
adds regression/documentation evidence. It preserves the six-problem,
five-question structure, global Q1–Q30 order, problem IDs/slugs, collection,
topic, difficulty, skill, question type, prompt/instruction, question order,
and `questionNumber`. The historical PR 16 record is not changed.

All 30 questions remain repository content for the `NEEDS_REVIEW` lifecycle.
Every replacement remains `PENDING_HUMAN_SIGN_OFF`. Nothing in this record is
linguistic, dialect, naturalness, difficulty, calibration, accessibility, or
publication approval.

## 2. Historical PR 16 blockers

PR 16 left these complete question objects canonical-base-identical and
fail-closed:

- `BLOCKED_DIALECT_AMBIGUITY`: Q2, Q10, Q29.
- `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`: Q3, Q11, Q14, Q17, Q21.
- `BLOCKED_UNCLEAR_UNDERLINE`: Q7, Q20.

PR 17 does not claim that those historical objects became valid. It replaces
them with newly authored structural candidates in the same positions.

## 3. Review method and reference policy

General British is the primary keying variety. General American and accepted
mainstream alternatives were checked where they could affect grouping. Spans
are zero-based, half-open Unicode-code-point intervals and were validated with
the production contract/slicing path, not UTF-16 `String.slice` alone.

Pronunciations were cross-checked against [Cambridge Dictionary](https://dictionary.cambridge.org/pronunciation/)
and [Collins English Dictionary](https://www.collinsdictionary.com/dictionary/english).
The links below identify the word-level evidence; IPA is summarized rather
than copied as dictionary prose.

## 4. Exact final replacement matrix

In renderer slices, vertical bars delimit the highlighted target. Every row
has one unique General British answer and remains `PENDING_HUMAN_SIGN_OFF`.

### Q2 — set 01, local question 2 (`problems[0].questions[1]`)

- Historical reason: `BLOCKED_DIALECT_AMBIGUITY`.
- A `what` `[0,2)` → `|wh|at`; B `when` `[0,2)` → `|wh|en`;
  C `where` `[0,2)` → `|wh|ere`; D `whole` `[0,2)` → `|wh|ole`.
- Evidence: GB approximately `/wɒt, wɛn, wɛə, həʊl/`; answer **D**. The
  decisive target contrast is initial `/h/` against the usual GB `/w/`.
- Sources: Cambridge [what](https://dictionary.cambridge.org/dictionary/english/what)
  and [whole](https://dictionary.cambridge.org/pronunciation/english/whole);
  Collins [when](https://www.collinsdictionary.com/dictionary/english/when)
  and [where](https://www.collinsdictionary.com/dictionary/english/where).
- Alternatives: accepted North American `/hw/` in `what`, `when`, or `where`
  still contrasts with `whole` `/h/`; it does not change the key. No
  heteronym, stress, noun/verb, reduced-form, or loanword reading changes the
  target grouping. Ambiguity assessment: structurally decisive, pending human
  review.

### Q3 — set 01, local question 3 (`problems[0].questions[2]`)

- Historical reason: `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`.
- A `gem` `[0,1)` → `|g|em`; B `gentle` `[0,1)` → `|g|entle`;
  C `give` `[0,1)` → `|g|ive`; D `giant` `[0,1)` → `|g|iant`.
- Evidence: `/dʒem, ˈdʒentəl, ɡɪv, ˈdʒaɪənt/`; answer **C**. The decisive
  target contrast is hard `/ɡ/` against `/dʒ/`.
- Sources: Collins [gem](https://www.collinsdictionary.com/dictionary/english/gem),
  [gentle](https://www.collinsdictionary.com/dictionary/english/gentle),
  [give](https://www.collinsdictionary.com/dictionary/english/give), and
  [giant](https://www.collinsdictionary.com/dictionary/english/giant), with
  Cambridge used as the independent dictionary family.
- Alternatives: GB/GA grouping is stable; ordinary stress and inflection do
  not change initial `g`. No relevant heteronym or loanword alternative was
  found. Ambiguity assessment: structurally decisive, pending human review.

### Q7 — set 02, local question 2 (`problems[1].questions[1]`)

- Historical reason: `BLOCKED_UNCLEAR_UNDERLINE`.
- A `chrome` `[0,2)` → `|ch|rome`; B `church` `[0,2)` → `|ch|urch`;
  C `chemist` `[0,2)` → `|ch|emist`; D `school` `[1,3)` → `s|ch|ool`.
- Evidence: `/krəʊm, tʃɜːtʃ, ˈkemɪst, skuːl/`; answer **B**. The decisive
  target contrast is `/tʃ/` against `/k/`.
- Sources: Collins [chrome](https://www.collinsdictionary.com/dictionary/english/chrome),
  [church](https://www.collinsdictionary.com/dictionary/english/church),
  [chemist](https://www.collinsdictionary.com/dictionary/english/chemist), and
  [school](https://www.collinsdictionary.com/dictionary/english/school), with
  Cambridge used as the independent dictionary family.
- Alternatives: GB/GA grouping is stable. The `school` span deliberately
  starts at code-point index 1; `[0,2)` would be the wrong slice. No relevant
  heteronym, stress, or loanword variant changes the key. Ambiguity assessment:
  structurally decisive, pending human review.

### Q10 — set 02, local question 5 (`problems[1].questions[4]`)

- Historical reason: `BLOCKED_DIALECT_AMBIGUITY`.
- A `action` `[2,6)` → `ac|tion|`; B `question` `[4,8)` → `ques|tion|`;
  C `motion` `[2,6)` → `mo|tion|`; D `nation` `[2,6)` → `na|tion|`.
- Evidence: `/ˈækʃən, ˈkwestʃən, ˈməʊʃən, ˈneɪʃən/`; answer **B**. The
  target contrast is `/tʃən/` against `/ʃən/`.
- Sources: Cambridge [action](https://dictionary.cambridge.org/pronunciation/english/action),
  [question](https://dictionary.cambridge.org/pronunciation/american-english/question),
  and [nation](https://dictionary.cambridge.org/pronunciation/english/nation);
  Collins [motion](https://www.collinsdictionary.com/dictionary/english/motion).
- Alternatives: GB/GA grouping is stable. Stress and ordinary reduced schwa do
  not collapse `/tʃ/` into `/ʃ/`. All four spans cover the exact four-letter
  `tion`, not a suffix guessed from one shared offset. Ambiguity assessment:
  structurally decisive, pending human review.

### Q11 — set 03, local question 1 (`problems[2].questions[0]`)

- Historical reason: `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`.
- A `knife` `[0,1)` → `|k|nife`; B `kite` `[0,1)` → `|k|ite`;
  C `knee` `[0,1)` → `|k|nee`; D `knob` `[0,1)` → `|k|nob`.
- Evidence: `/naɪf, kaɪt, niː, nɒb/`; answer **B**. The initial target is
  pronounced `/k/` only in `kite` and silent in the three `kn-` words.
- Sources: Cambridge [knife](https://dictionary.cambridge.org/pronunciation/english/knife)
  and [kite](https://dictionary.cambridge.org/pronunciation/english/kite);
  Collins [knee](https://www.collinsdictionary.com/dictionary/english/knee)
  and [knob](https://www.collinsdictionary.com/dictionary/english/knob).
- Alternatives: GB/GA grouping is stable; no mainstream alternative restores
  initial `/k/` in the three `kn-` words. No relevant heteronym or
  stress-dependent reading changes the key. Ambiguity assessment: structurally
  decisive, pending human review.

### Q14 — set 03, local question 4 (`problems[2].questions[3]`)

- Historical reason: `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`.
- A `think` `[0,2)` → `|th|ink`; B `thank` `[0,2)` → `|th|ank`;
  C `this` `[0,2)` → `|th|is`; D `three` `[0,2)` → `|th|ree`.
- Evidence: `/θɪŋk, θæŋk, ðɪs, θriː/`; answer **C**. The decisive target
  contrast is voiced `/ð/` against voiceless `/θ/`.
- Sources: Collins [think](https://www.collinsdictionary.com/dictionary/english/think),
  [thank](https://www.collinsdictionary.com/dictionary/english/thank),
  [this](https://www.collinsdictionary.com/dictionary/english/this), and
  [three](https://www.collinsdictionary.com/dictionary/english/three), with
  Cambridge used as the independent dictionary family.
- Alternatives: mainstream GB/GA grouping is stable. Dialectal th-fronting or
  th-stopping is outside the declared keying varieties and is a later human
  suitability consideration, not a second standard key. Ambiguity assessment:
  structurally decisive, pending human review.

### Q17 — set 04, local question 2 (`problems[3].questions[1]`)

- Historical reason: `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`.
- A `long` `[2,4)` → `lo|ng|`; B `ring` `[2,4)` → `ri|ng|`;
  C `singe` `[2,4)` → `si|ng|e`; D `sing` `[2,4)` → `si|ng|`.
- Evidence: `/lɒŋ, rɪŋ, sɪndʒ, sɪŋ/`; answer **C**. The decisive target
  contrast is `/ndʒ/` against `/ŋ/`.
- Sources: Cambridge [long](https://dictionary.cambridge.org/pronunciation/english/long),
  [sing](https://dictionary.cambridge.org/pronunciation/english/sing), and
  [singe](https://dictionary.cambridge.org/us/pronunciation/english/singe);
  Collins [ring](https://www.collinsdictionary.com/dictionary/english/ring).
- Alternatives: some regional varieties may add `/ɡ/` after `/ŋ/`; that does
  not create `singe`'s `/ndʒ/` and does not change the key. The verb `singe` is
  not the noun/verb `sing`; ordinary inflections and stress do not create a
  competing standard grouping. Ambiguity assessment: structurally decisive,
  pending human review.

### Q20 — set 04, local question 5 (`problems[3].questions[4]`)

- Historical reason: `BLOCKED_UNCLEAR_UNDERLINE`.
- A `center` `[0,1)` → `|c|enter`; B `cat` `[0,1)` → `|c|at`;
  C `cinema` `[0,1)` → `|c|inema`; D `circle` `[0,1)` → `|c|ircle`.
- Evidence: `/ˈsentə, kæt, ˈsɪnəmə, ˈsɜːkəl/`; answer **B**. The decisive
  initial target contrast is `/k/` against `/s/`.
- Sources: Collins [center](https://www.collinsdictionary.com/dictionary/english/center),
  [cat](https://www.collinsdictionary.com/dictionary/english/cat),
  [cinema](https://www.collinsdictionary.com/dictionary/english/cinema), and
  [circle](https://www.collinsdictionary.com/dictionary/english/circle);
  Cambridge [cinema](https://dictionary.cambridge.org/pronunciation/english/cinema)
  and [circle](https://dictionary.cambridge.org/us/pronunciation/english/circle).
- Alternatives: GB/GA grouping is stable. `center` is the American spelling
  of `centre`, but authoritative dictionaries record the same initial `/s/`;
  its spelling/register suitability remains for human review. No heteronym,
  stress, or loanword variant changes the key. Ambiguity assessment:
  structurally decisive, pending human review.

### Q21 — set 05, local question 1 (`problems[4].questions[0]`)

- Historical reason: `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`.
- A `word` `[1,3)` → `w|or|d`; B `story` `[2,4)` → `st|or|y`;
  C `work` `[1,3)` → `w|or|k`; D `world` `[1,3)` → `w|or|ld`.
- Evidence: GB `/wɜːd, ˈstɔːri, wɜːk, wɜːld/`; answer **B**. The decisive
  vowel contrast is `/ɔː/` against `/ɜː/`.
- Sources: Cambridge [story](https://dictionary.cambridge.org/pronunciation/english/story),
  [work](https://dictionary.cambridge.org/pronunciation/english/work), and
  [world](https://dictionary.cambridge.org/us/pronunciation/english/world);
  Collins [word](https://www.collinsdictionary.com/dictionary/english/word).
- Alternatives: General American is rhotic, approximately `/wɝd, ˈstɔri,
  wɝk, wɝld/`, but preserves the vowel grouping and the **B** key. The `story`
  target starts at code-point index 2. No relevant heteronym or stress change
  creates a second standard key. Ambiguity assessment: structurally decisive,
  pending human review.

### Q29 — set 06, local question 4 (`problems[5].questions[3]`)

- Historical reason: `BLOCKED_DIALECT_AMBIGUITY`.
- A `wrap` `[0,1)` → `|w|rap`; B `wrath` `[0,1)` → `|w|rath`;
  C `wave` `[0,1)` → `|w|ave`; D `wreck` `[0,1)` → `|w|reck`.
- Evidence: GB approximately `/ræp, rɒθ, weɪv, rek/`; answer **C**. The
  decisive target contrast is pronounced `/w/` against silent `w` in `wr-`.
- Sources: Cambridge [wrap](https://dictionary.cambridge.org/pronunciation/english/wrap),
  [wrath](https://dictionary.cambridge.org/us/pronunciation/english/wrath),
  [wave](https://dictionary.cambridge.org/uk/pronunciation/english/wave), and
  [wreck](https://dictionary.cambridge.org/pronunciation/english/wreck), with
  Collins used as the independent dictionary family.
- Alternatives: accepted GB/GA vowel variants for `wrath` do not pronounce
  its initial `w`; the target grouping and **C** key remain stable. No relevant
  heteronym, stress, noun/verb, reduced-form, or loanword variant changes it.
  Ambiguity assessment: structurally decisive, pending human review.

## 5. Canonical preservation proof

The retained rows are Q1, Q4, Q5, Q6, Q8, Q9, Q12, Q13, Q15, Q16, Q18, Q19,
Q22, Q23, Q24, Q25, Q26, Q27, Q28, and Q30. A local read-only comparison loaded
the split JSON at canonical base `970259358a94ef68e51810bcb4854097297c2518`
and compared each complete question value with the working-tree value; all 20
matched and the mismatch count was zero. The production test independently
checks each retained `JSON.stringify` value against a fixed SHA-256 digest. It
does not invoke Git, use the network, or depend on the branch/working tree.

## 6. Answer-position reconciliation

| Population | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| Canonical-base full 30 | 11 | 5 | 7 | 7 |
| Historical ten blockers | 3 | 2 | 4 | 1 |
| Retained 20 | 8 | 3 | 3 | 6 |
| Final ten replacements | 0 | 5 | 4 | 1 |
| Final full 30 | 8 | 8 | 7 | 7 |

No answer was moved to manufacture balance. Linguistic grouping determined
each key.

## 7. Changed-field reconciliation

For Q2, Q3, Q7, Q10, Q11, Q14, Q17, Q20, Q21, and Q29, PR 17 replaces the
four options, canonical answer, and explanation. Their pronunciation-focus
metadata did not need another field change. All position/identity/instruction
fields listed in section 1 are preserved. During takeover review, only the Q2,
Q17, Q21, and Q29 explanations needed correction: they now acknowledge
North-American `/hw/`, regional post-velar `/ɡ/`, rhotic GA vowels, and
`wrath` vowel variation respectively. No answer or span changed in that pass.

The other 20 complete question objects are value-identical to the canonical
base. The pack remains exactly 6 problems, 30 questions, and 120 options.

## 8. Contract and runtime evidence

Repository tests exercise the real split JSON and production exports. They
verify 30 valid contracts; exactly four own canonical A-D options per row;
integer, in-range, non-empty Unicode-code-point spans and all 120 exact slices;
no whole-word spans or legacy aliases; canonical member answers; learner DTO
non-disclosure; bounded admin repair evidence; four rendered choices and
highlights; strict scoring; persisted QA and publication gates; zero import
span warnings; and input/caller-object non-mutation.

The publication evidence is test-only and covers immediate JSON/CSV,
individual/edit, ordinary bulk, and publish-safe paths. It is not evidence of
a real import or publication.

The takeover's first executable check passed the real Pronunciation content
suite (1 file, 10 tests). The final focused contract/import/DTO/renderer/
scorer/QA/publication/audit matrix passed 15 files and 474 tests. The final full
suite passed 83 files and 1,274 tests, with 8 pre-existing skips in a total of
1,282. `npm.cmd run typecheck`, `npm.cmd run lint`, the production build, and
`git diff --check` also passed. The isolated production build attempted two
Prisma reads against deliberately unreachable synthetic loopback database
URLs; both failed closed. No real database was reached, read, or mutated.

## 9. Repository audit reconciliation

| Signal | PR 16 | PR 17 | Reconciliation |
| --- | ---: | ---: | --- |
| `rendererIncompatibleOptions` | 5 | 5 | Unchanged Error Identification debt |
| `normalizerWarnings` | 46 | 6 | Four missing-span warnings removed for each of ten replacements |
| `pronunciationWithoutValidTargetSpans` | 10 | 0 | All ten replacement rows now pass the contract |
| `shortExplanations` | 419 | 410 | Nine historical blocker explanations were below the 45-unit heuristic; Q11 was exactly 45 |
| `duplicatePromptGroups` | 3 | 3 | Unchanged |
| `hasInventoryErrors` | false | false | Unchanged |

The aggregate answer-position audit changes from `A=156, B=44, C=18, D=12`
to `A=153, B=47, C=18, D=12`; this is exactly the historical-ten versus
replacement-ten reconciliation above.

Two independent process executions of
`npm.cmd run --silent audit:content-packs -- --format=json` exited 0, parsed
directly as JSON, wrote 147,665 stdout bytes, wrote 0 stderr/banner bytes, and
produced the same SHA-256:
`5612f104e402e93a5c1cd9b354861affbf139c12d123680aa75cf85ef7d4b27d`.
The results were byte-identical. `selectedAnswer` was removed from
renderer-incompatible findings, and a bounded scan confirmed that no canonical
or legacy answer values, answer-bearing keys, raw answer objects, review
evidence, credentials, provider data, or user data were serialized. Both
reports were held outside the repository working tree.

## 10. Evidence limitations

This is repository, local-test, local-audit, and dictionary-reference evidence.
It does not establish linguistic approval, dialect approval, task naturalness,
difficulty, calibration, accessibility certification, or publication approval.
All rows remain `NEEDS_REVIEW` and `PENDING_HUMAN_SIGN_OFF`.

No real database, import, publication, deployed admin Preview, Production,
provider, browser E2E, migration, seed, deployment, or GitHub action occurred.
The five Error Identification renderer findings remain separate debt.
Listening remains unavailable pending delivery implementation. Structural
validity for Pronunciation does not make all platform modes complete.
