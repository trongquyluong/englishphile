# Phase 2 PR16 — Pronunciation Repair Pilot 001

## Repository identity and evidence boundary

- Branch: `phase2/16-pronunciation-repair-pilot-001`.
- Canonical base, initial `HEAD`, `main`, `origin/main`, and merge-base: `e247e0950c8e1ae0a02bab2043113d7b388d6dcf`.
- Authorized source: `content-packs/pilot-pack-001/01-pronunciation-pack-001.json` only. The all-in-one mirror, manifests, other packs, production contract, DTOs, renderers, scorer, importer, QA, publication code, schema, migrations, packages, and lockfiles are unchanged.
- Evidence is repository/local and dictionary-reference evidence only. It is not a real database, import, publication, Preview, Production, browser-E2E, screen-reader, provider, migration, seed, deployment, or GitHub action.
- No row in this record is linguistically approved. The 20 structurally repaired rows remain `NEEDS_REVIEW` and `PENDING_HUMAN_SIGN_OFF`; the other 10 rows remain fail-closed blockers.

## Reference pronunciation variety and dictionary policy

The primary keying variety for this bounded review is **General British**, appropriate to the Vietnamese specialised-English examination context. “Standard pronunciation” is not treated as universal. Common General American or other established variants are recorded when they affect uniqueness.

The primary learner-dictionary reference is the [Cambridge English Dictionary pronunciation collection](https://dictionary.cambridge.org/pronunciation/). [Collins English Dictionary](https://www.collinsdictionary.com/dictionary/english) is the regular independent check. [Merriam-Webster](https://www.merriam-webster.com/) is used for established North American variants. Dialect-sensitive blockers use at least two sources. IPA below is concise comparison evidence, not a replacement for listening review by a qualified human reviewer.

## Exact baseline and repair result

The canonical split file contained 6 problems, 30 `PRONUNCIATION_ODD_ONE_OUT` questions, 5 questions per problem, and 120 options without `targetSpan`. The repository audit baseline was:

| Signal | Before PR16 | After repair |
| --- | ---: | ---: |
| Packs / selected files / problems / questions | 2 / 17 / 101 / 495 | 2 / 17 / 101 / 495 |
| Option questions | 230 | 230 |
| `pronunciationWithoutValidTargetSpans` | 30 | 10 |
| `normalizerWarnings` | 126 | 46 |
| `rendererIncompatibleOptions` | 5 | 5 |
| `shortExplanations` | 437 | 419 |
| `duplicatePromptGroups` | 3 | 3 |
| `duplicateNormalizedOptionTexts` | 0 | 0 |
| Manifest mismatches / malformed inputs | 0 / 0 | 0 / 0 |
| `hasInventoryErrors` | false | false |

Exactly 20 rows were structurally repaired. The warning reduction is exactly 80: four missing-span warnings removed for each repaired row. Eighteen former short-explanation findings disappeared because all 20 repaired-row explanations were deliberately rewritten in Vietnamese; two of those explanations were already at or above the 45-character heuristic. No unrelated inventory, manifest, option count, question count, answer-position, duplicate, or Error Identification renderer finding changed.

## Span model and notation

- Zero-based, half-open `[start,end)` offsets.
- Measured with `Array.from(text)`, so offsets count Unicode code points, not UTF-16 code units and not inferred grapheme clusters.
- Every authored target is non-empty, in range, and contains a Unicode letter.
- Renderer slices use `prefix|target|suffix`; the middle segment is the only underlined text.
- `—` means no defensible authored span or renderer slice was created. Candidate spans on dialect blockers are review evidence only and remain absent from JSON.

## Complete Q1–Q30 linguistic matrix

### Set 01

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q1 / local 1 | A wreath `ea` `[2,4)` `wr|ea|th`; B breadth `ea` `[2,4)` `br|ea|dth`; C heath `ea` `[1,3)` `h|ea|th`; D seethe `ee` `[1,3)` `s|ee|the` | `/iː, e, iː, iː/`; B → B | The highlighted vowel is /e/ only in *breadth*. *Seethe* has a separate /ð/ outside the target, so whole-word comparison would be invalid. Cambridge entries for [wreath](https://dictionary.cambridge.org/pronunciation/english/wreath), [breadth](https://dictionary.cambridge.org/pronunciation/english/breadth), [heath](https://dictionary.cambridge.org/pronunciation/english/heath), and [seethe](https://dictionary.cambridge.org/pronunciation/english/seethe). `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, four spans, Vietnamese explanation; no option text or answer position changed. |
| Q2 / local 2 | Candidate only: A thorough `ough` `[4,8)` `thor|ough|`; B although `ough` `[4,8)` `alth|ough|`; C dough `ough` `[1,5)` `d|ough|`; D though `ough` `[2,6)` `th|ough|`. No JSON spans authored. | General British `/ə, əʊ, əʊ, əʊ/`; Cambridge also records US *thorough* `/ˈθɝː.oʊ/`; A → A | The stored key works only under one British realization. The learner instruction does not declare the variety, and a documented US variant removes the contrast. [Cambridge](https://dictionary.cambridge.org/pronunciation/english/thorough) and [Collins](https://www.collinsdictionary.com/dictionary/english-pronunciations/thorough). `BLOCKED_DIALECT_AMBIGUITY`. Changed: no; complete object remains base-identical. |
| Q3 / local 3 | A comb; B bomb; C tomb; D debt. Intended underline cannot be recovered uniquely; no spans or renderer slices. | Whole-word vowels are roughly `/əʊ, ɒ, uː, e/`; all four written b letters are silent in the relevant position; C → C | Highlighting the vowel gives more than one different answer; highlighting b gives no odd one out. The explanation names *tomb* but does not establish a three-to-one target. Cambridge entries for [comb](https://dictionary.cambridge.org/pronunciation/english/comb), [bomb](https://dictionary.cambridge.org/pronunciation/english/bomb), [tomb](https://dictionary.cambridge.org/pronunciation/english/tomb), and [debt](https://dictionary.cambridge.org/pronunciation/english/debt). `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`. Changed: no; complete object remains base-identical. |
| Q4 / local 4 | A asked `ed` `[3,5)` `ask|ed|`; B played `ed` `[4,6)` `play|ed|`; C laughed `ed` `[5,7)` `laugh|ed|`; D watched `ed` `[5,7)` `watch|ed|` | `/t, d, t, t/`; B → B | Regular past ending /d/ only after the voiced final phoneme in *play*. Morphological targets are parallel. Cambridge entries for the four words. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q5 / local 5 | A measure `s` `[3,4)` `mea|s|ure`; B pleasure `s` `[4,5)` `plea|s|ure`; C pressure `ss` `[3,5)` `pre|ss|ure`; D leisure `s` `[3,4)` `lei|s|ure` | `/ʒ, ʒ, ʃ, ʒ/`; C → C | The consonant grapheme is /ʃ/ only in *pressure*. The vowel variation in *leisure* does not affect the highlighted consonant. Cambridge [leisure](https://dictionary.cambridge.org/pronunciation/english/leisure) and the corresponding word entries; Collins cross-check. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |

### Set 02

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q6 / local 1 | A choir `ch` `[0,2)` `|ch|oir`; B chemist `ch` `[0,2)` `|ch|emist`; C chaos `ch` `[0,2)` `|ch|aos`; D charity `ch` `[0,2)` `|ch|arity` | `/k, k, k, tʃ/`; D → D | Initial ch is /tʃ/ only in *charity*. Cambridge word entries; Collins cross-check. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q7 / local 2 | A recipe; B archive; C machine; D police. No unique target or slices: possible vowel letters do not form a three-to-one set. | Candidate stressed/medial vowels include `/ɪ, aɪ, iː, iː/`; B → B | *Recipe* is also different from the C/D pair, while choosing final or stressed spellings makes the targets non-parallel. [Cambridge recipe](https://dictionary.cambridge.org/pronunciation/english/recipe), [archive](https://dictionary.cambridge.org/pronunciation/english/archive), [machine](https://dictionary.cambridge.org/pronunciation/english/machine), [police](https://dictionary.cambridge.org/pronunciation/english/police). `BLOCKED_UNCLEAR_UNDERLINE`. Changed: no; complete object remains base-identical. |
| Q8 / local 3 | A sword `w` `[1,2)` `s|w|ord`; B swore `w` `[1,2)` `s|w|ore`; C swarm `w` `[1,2)` `s|w|arm`; D swallow `w` `[1,2)` `s|w|allow` | `/∅, w, w, w/`; A → A | The highlighted w is silent only in *sword*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q9 / local 4 | A island `s` `[1,2)` `i|s|land`; B aisle `s` `[2,3)` `ai|s|le`; C isle `s` `[1,2)` `i|s|le`; D issue `ss` `[1,3)` `i|ss|ue` | `/∅, ∅, ∅, ʃ~s/`; accepted British *issue* variants are `/ˈɪʃ.uː/` and `/ˈɪs.juː/`; D → D | The highlighted consonant is silent in A–C but pronounced in D. In accepted British variants, *issue* realizes it as /ʃ/ or /s/ before /j/; either realization leaves D uniquely different. [Cambridge issue](https://dictionary.cambridge.org/pronunciation/english/issue) and [Collins issue](https://www.collinsdictionary.com/dictionary/english-pronunciations/issue). `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q10 / local 5 | Candidate only: A genre `g` `[0,1)` `|g|enre`; B garage second `g` `[4,5)` `gara|g|e`; C giant `g` `[0,1)` `|g|iant`; D mirage second `g` `[4,5)` `mira|g|e`. No JSON spans authored. | Intended `/ʒ, ʒ, dʒ, ʒ/`; C → C | Cambridge records British *garage* with both /ʒ/ and /dʒ/ realizations; Merriam-Webster also records both families. This can create two /dʒ/ options. [Cambridge garage](https://dictionary.cambridge.org/dictionary/english/garage) and [Merriam-Webster garage](https://www.merriam-webster.com/dictionary/garage). `BLOCKED_DIALECT_AMBIGUITY`. Changed: no; complete object remains base-identical. |

### Set 03

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q11 / local 1 | A colonel; B college; C collar; D colon. No defensible common target or renderer slices. | Initial written o evidence is approximately `/ɜː, ɒ, ɒ, əʊ/`; A → A | *Colonel* is irregular, but *colon* is also distinct from *college/collar*. [Cambridge colonel](https://dictionary.cambridge.org/pronunciation/english/colonel), [Cambridge collar](https://dictionary.cambridge.org/pronunciation/english/collar), and [Collins colon](https://www.collinsdictionary.com/dictionary/english/colon). `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`. Changed: no; complete object remains base-identical. |
| Q12 / local 2 | A subtle `b` `[2,3)` `su|b|tle`; B doubt `b` `[3,4)` `dou|b|t`; C debris `b` `[2,3)` `de|b|ris`; D plumber `b` `[4,5)` `plum|b|er` | `/∅, ∅, b, ∅/`; C → C | Highlighted b is pronounced only in *debris*. Cambridge word entries, including [debt/debris browse context](https://dictionary.cambridge.org/pronunciation/english/debt); Collins cross-check. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, explanation corrected to name the highlighted b contrast. |
| Q13 / local 3 | A height `eigh` `[1,5)` `h|eigh|t`; B weight `eigh` `[1,5)` `w|eigh|t`; C eight `eigh` `[0,4)` `|eigh|t`; D neighbour `eigh` `[1,5)` `n|eigh|bour` | `/aɪ, eɪ, eɪ, eɪ/`; A → A | The shared spelling has /aɪ/ only in *height*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q14 / local 4 | A bury; B busy; C butcher; D butter. Candidate u spans would be `[1,2)` for all four, but no spans are authored. | `/e, ɪ, ʊ, ʌ/`; D → D | All four highlighted-u candidates differ, so D is not a unique odd one out. [Cambridge bury](https://dictionary.cambridge.org/dictionary/english/bury), [Cambridge busy](https://dictionary.cambridge.org/pronunciation/english/busy), [Collins butcher](https://www.collinsdictionary.com/dictionary/english/butcher), and [Collins butter](https://www.collinsdictionary.com/dictionary/english/butter). `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`. Changed: no; complete object remains base-identical. |
| Q15 / local 5 | A cough `gh` `[3,5)` `cou|gh|`; B rough `gh` `[3,5)` `rou|gh|`; C tough `gh` `[3,5)` `tou|gh|`; D though `gh` `[4,6)` `thou|gh|` | `/f, f, f, ∅/`; D → D | The target is gh, not the varying preceding vowel. It is silent only in *though*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, explanation narrowed to the actual target. |

### Set 04

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q16 / local 1 | A sergeant `g` `[3,4)` `ser|g|eant`; B germ `g` `[0,1)` `|g|erm`; C gesture `g` `[0,1)` `|g|esture`; D gear `g` `[0,1)` `|g|ear` | `/dʒ, dʒ, dʒ, ɡ/`; D → D | Highlighted g is /ɡ/ only in *gear*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q17 / local 2 | A vague; B plague; C league; D fatigue. No parallel three-to-one target or renderer slices. | Relevant rimes are `/eɪɡ, eɪɡ, iːɡ, iːɡ/`; C → C | The options form a two-and-two contrast, so *fatigue* defeats the stored C key. [Cambridge vague](https://dictionary.cambridge.org/dictionary/english/vague), [Cambridge plague](https://dictionary.cambridge.org/dictionary/english/plague), [Cambridge fatigue](https://dictionary.cambridge.org/dictionary/english/fatigue), and [Collins league](https://www.collinsdictionary.com/english-language-learning/league). `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`. Changed: no; complete object remains base-identical. |
| Q18 / local 3 | A said `ai` `[1,3)` `s|ai|d`; B paid `ai` `[1,3)` `p|ai|d`; C laid `ai` `[1,3)` `l|ai|d`; D maid `ai` `[1,3)` `m|ai|d` | `/e, eɪ, eɪ, eɪ/`; A → A | Shared ai is /e/ only in *said*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q19 / local 4 | A heir `h` `[0,1)` `|h|eir`; B honest `h` `[0,1)` `|h|onest`; C hour `h` `[0,1)` `|h|our`; D host `h` `[0,1)` `|h|ost` | `/∅, ∅, ∅, h/`; D → D | Initial h is pronounced only in *host* in General British. Non-standard h-dropping is outside the declared keying variety but should be considered in later accessibility/listening review. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q20 / local 5 | A crescent; B scene; C scent; D science. One candidate sc target is A `[3,5)`, B/C/D `[0,2)`, but it is /s/ in all four; vowel targets are non-parallel. No spans authored. | Candidate sc `/s, s, s, s/`; wider vowel evidence gives several differences; B → B | The explanation describes the whole word *scene* without identifying a unique comparable grapheme. [Collins crescent](https://www.collinsdictionary.com/dictionary/english/crescent) plus Cambridge entries for [scene](https://dictionary.cambridge.org/pronunciation/english/scene), [scent](https://dictionary.cambridge.org/pronunciation/english/scent), and [science](https://dictionary.cambridge.org/pronunciation/english/science). `BLOCKED_UNCLEAR_UNDERLINE`. Changed: no; complete object remains base-identical. |

### Set 05

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q21 / local 1 | A quay; B key; C grey; D they. No four pedagogically parallel targets or renderer slices. | General British vowels `/iː, iː, eɪ, eɪ/`; A → A | The set is two-and-two, not an odd-one-out. Collins additionally records established American *quay* variants /keɪ/ and /kweɪ/, making a universal key still less defensible. [Cambridge quay](https://dictionary.cambridge.org/pronunciation/english/quay), [Collins quay](https://www.collinsdictionary.com/dictionary/english/quay), and [Collins grey](https://www.collinsdictionary.com/dictionary/english/grey). `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS`. Changed: no; complete object remains base-identical. |
| Q22 / local 2 | A draught `gh` `[4,6)` `drau|gh|t`; B daughter `gh` `[3,5)` `dau|gh|ter`; C caught `gh` `[3,5)` `cau|gh|t`; D taught `gh` `[3,5)` `tau|gh|t` | `/f, ∅, ∅, ∅/`; A → A | The highlighted gh is /f/ only in *draught*. The British/American vowel variation noted by the old explanation does not affect this consonant target. Cambridge and Collins word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, explanation narrowed to gh. |
| Q23 / local 3 | A mauve `v` `[3,4)` `mau|v|e`; B laugh `gh` `[3,5)` `lau|gh|`; C calf `f` `[3,4)` `cal|f|`; D half `f` `[3,4)` `hal|f|` | `/v, f, f, f/`; A → A | The four targets are pedagogically parallel word-final consonant spellings; none is a whole-word span. Vowel variation in *mauve* is outside the target. Cambridge/Collins word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q24 / local 4 | A ache `ch` `[1,3)` `a|ch|e`; B chorus `ch` `[0,2)` `|ch|orus`; C champagne `ch` `[0,2)` `|ch|ampagne`; D scheme `ch` `[1,3)` `s|ch|eme` | `/k, k, ʃ, k/`; C → C | Highlighted ch is /ʃ/ only in *champagne*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q25 / local 5 | A edged `ed` `[3,5)` `edg|ed|`; B marked `ed` `[4,6)` `mark|ed|`; C washed `ed` `[4,6)` `wash|ed|`; D missed `ed` `[4,6)` `miss|ed|` | `/d, t, t, t/`; A → A | The -ed suffix is /d/ only in *edged*; the preceding /dʒ/ prevents treating the whole ending as /t/. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |

### Set 06

| Q | Options, reviewed targets, exact spans, and renderer slices | Pronunciation evidence; stored → final answer | Rule, ambiguity, source, status, and content change |
| --- | --- | --- | --- |
| Q26 / local 1 | A zealous `z` `[0,1)` `|z|ealous`; B measure `s` `[3,4)` `mea|s|ure`; C treasure `s` `[4,5)` `trea|s|ure`; D vision `s` `[2,3)` `vi|s|ion` | `/z, ʒ, ʒ, ʒ/`; A → A | The targets are single consonant graphemes and the stored explanation identifies their intended comparison; initial z is /z/, while the three highlighted s letters are /ʒ/. Cambridge/Collins entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q27 / local 2 | A quarantine `qu` `[0,2)` `|qu|arantine`; B quilt `qu` `[0,2)` `|qu|ilt`; C queen `qu` `[0,2)` `|qu|een`; D queue `qu` `[0,2)` `|qu|eue` | onsets `/kw, kw, kw, kj/` before the remaining /uː/ realization in *queue*; D → D | Initial qu has /w/ only in A–C. The exact grapheme-to-phone alignment in *queue* is pedagogically delicate and requires human sign-off, but the onset contrast is structurally defensible. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |
| Q28 / local 3 | A debris `b` `[2,3)` `de|b|ris`; B debt `b` `[2,3)` `de|b|t`; C doubt `b` `[3,4)` `dou|b|t`; D dumb `b` `[3,4)` `dum|b|` | `/b, ∅, ∅, ∅/`; A → A | Highlighted b is pronounced only in *debris*. Cambridge word entries; [Cambridge debt](https://dictionary.cambridge.org/pronunciation/english/debt) confirms the silent b comparison. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, explanation corrected to the actual b target. |
| Q29 / local 4 | Candidate only: A ballet `et` `[4,6)` `ball|et|`; B valet `et` `[3,5)` `val|et|`; C wallet `et` `[4,6)` `wall|et|`; D chalet `et` `[4,6)` `chal|et|`. No JSON spans authored. | Intended `/eɪ, eɪ, ɪt, eɪ/`; Collins and Merriam-Webster both record accepted *valet* pronunciations with both /eɪ/ and /ɪt/ families; C → C | With the /ɪt/ variant of *valet*, B and C pattern together, so the stored key is not uniquely robust. [Collins valet](https://www.collinsdictionary.com/dictionary/english/valet) and [Merriam-Webster valet](https://www.merriam-webster.com/dictionary/valet). `BLOCKED_DIALECT_AMBIGUITY`. Changed: no; complete object remains base-identical. |
| Q30 / local 5 | A lose `s` `[2,3)` `lo|s|e`; B loose `s` `[3,4)` `loo|s|e`; C choose `s` `[4,5)` `choo|s|e`; D whose `s` `[3,4)` `who|s|e` | `/z, s, z, z/`; B → B | Highlighted s is /s/ only in *loose*. Cambridge word entries. `PENDING_HUMAN_SIGN_OFF`. Changed: canonical options/answer, spans, Vietnamese explanation. |

## Blocker list

| Question | Status | Blocking reason |
| --- | --- | --- |
| Q2 | `BLOCKED_DIALECT_AMBIGUITY` | US *thorough* /oʊ/ variant removes the intended contrast. |
| Q3 | `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS` | Vowels yield several differences; b is silent throughout. |
| Q7 | `BLOCKED_UNCLEAR_UNDERLINE` | No uniquely reconstructable parallel target; candidate vowels do not yield a unique answer. |
| Q10 | `BLOCKED_DIALECT_AMBIGUITY` | Accepted /dʒ/ pronunciation of *garage* conflicts with the stored C key. |
| Q11 | `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS` | *Colon* is also distinct from *college/collar*. |
| Q14 | `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS` | The written u represents four different vowels. |
| Q17 | `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS` | `/eɪɡ, eɪɡ, iːɡ, iːɡ/` is a two-and-two split. |
| Q20 | `BLOCKED_UNCLEAR_UNDERLINE` | Candidate sc is identical; broader vowels are non-parallel and multiply different. |
| Q21 | `BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS` | General British vowels form a two-and-two split. |
| Q29 | `BLOCKED_DIALECT_AMBIGUITY` | Established *valet* variants create more than one /ɪt/-pattern option. |

## Answer-position distribution for repaired rows

No answer was moved to manufacture balance. No stored correct answer changed.

| A | B | C | D | Total |
| ---: | ---: | ---: | ---: | ---: |
| 8 | 3 | 3 | 6 | 20 |

## Human sign-off, rendering, accessibility, and publication boundary

- The 20 repaired rows are structurally renderable only. They remain `PENDING_HUMAN_SIGN_OFF` and their problems remain intended for `NEEDS_REVIEW` import.
- Structural validity does not establish linguistic approval, dialect approval, naturalness, difficulty, calibration, accessibility certification, or publication approval.
- Runtime tests prove the production contract, learner DTO, admin preview, renderer, scorer, import normalizer, persisted QA, and publication validators behave fail-closed with this file. They are not browser-E2E, screen-reader, audio, or human interaction evidence.
- At least one actual repaired row renders four native radios and four authored underlines. At least one actual blocked row renders only the fixed unavailable notice and no answer controls. This does not certify focus order, pronunciation comprehension, visual contrast, or assistive-technology behavior.
- Blocked rows must not be imported for immediate publication, published individually, changed to `PUBLISHED`, passed through ordinary bulk publication, or admitted by `publish-safe`. No real import or publication occurred.
- Pronunciation mode becomes structurally renderable only for the 20 repaired rows. The 10 blocked rows remain deliberately unavailable. Listening remains separately blocked pending approved delivery work; this PR does not make all modes complete.

## Change inventory

- Options: the original 80 repaired-row option texts are unchanged. Their aliases were canonicalized from `label` to ordered `id`, and each received one reviewed `targetSpan`.
- Answers: all 20 repaired rows retain the stored answer position, canonicalized to the sole field `correctOptionId`. `correctOption`, `accepted`, and `display` were removed only from repaired rows.
- Explanations: all 20 repaired-row explanations were rewritten in Vietnamese to name the exact highlighted contrast. No blocked-row explanation changed.
- Prompts, statements, instructions, metadata, roots, keywords, target sentences, line numbers, problem fields, collection fields, and all 10 blocked question objects are unchanged from the canonical base.
- No whole-word span was used.
