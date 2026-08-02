# Phase 2 Error Identification Repair — Pack 002

## Scope and evidence boundary

- Repository: `C:\Dev\englishphile`
- Branch: `phase2/12-error-identification-repair-pack-002`
- Canonical `HEAD`, `main`, `origin/main`, and merge-base before editing: `2258de3815bc9ac5ddf23f0ad034ba2e6104326e`
- Sole content target: `content-packs/content-pack-002/07-error-identification-pack-002.json`
- The target contains 6 problems and exactly 30 `ERROR_IDENTIFICATION` questions, numbered 1–30 in `metadata.questionNumber` order. They are the 30 remaining questions outside `pilot-pack-001`.
- All content remains `NEEDS_REVIEW`. No item was imported or published. No database, Preview, Production, provider, browser-E2E, migration, seed, or deployment evidence is claimed.
- Structural validity does not establish linguistic, difficulty, calibration, or publication approval. Human linguistic sign-off remains required for every repaired row.

## Exact before state

| Intended file | Before-edit SHA-256 |
| --- | --- |
| `content-packs/content-pack-002/07-error-identification-pack-002.json` | `1d75708edefc930ba4f5a1cdccc88fb0a3775b99e82f2ddc464ff6e1b8aacdec` |
| `docs/PHASE_2_CONTENT_QA_WORKFLOW.md` | `4ed9fb302a4ca7d0629d2c7631e2629d1ce05720ce8e5a7408358791ee9b93f1` |
| `handoff.md` | `f9a3246c56f1ee121695a5daf03db476cae74e7d4f765c990b8e4ca841d0f615` |
| `src/lib/content-audit.test.ts` | `fd328c842fb8ba69128c80292c5dfd6a7f69e346a014157f3338c8f1c71da02c` |
| `docs/PHASE_2_ERROR_IDENTIFICATION_REPAIR_PACK_002.md` | Absent |

Before editing, every target row had `options: null` and an answer containing the legacy `errorPart`, `correction`, `accepted`, and `display` fields. The answer aliases were A for Q1, Q3, Q5–Q7, Q10–Q12, Q14, Q18–Q23, and Q25–Q29; B for Q2, Q4, Q8, Q9, Q13, Q15–Q17, Q24, and Q30. The repository audit reported:

| Signal | Before |
| --- | ---: |
| `rendererIncompatibleOptions` | 31 |
| `normalizerWarnings` | 152 |
| `pronunciationWithoutValidTargetSpans` | 30 |
| `hasInventoryErrors` | `false` |

The 31 renderer findings were exactly all 30 rows in this target plus `pilot-pack-001` Q25. Inventory was 2 packs, 17 selected split files, 101 problems, and 495 questions.

## Editorial method

All 30 prompts were reviewed individually before the target JSON was rewritten. In the segmentation matrix below, `␠` denotes exactly one authored U+0020 space at an option boundary; it is not a character stored in JSON. Concatenating the displayed A+B+C+D strings after replacing `␠` with U+0020 reproduces the original prompt byte-for-byte at the Unicode-string level. For a repaired row, replacing only the marked option text with any slash-delimited correction variant produces the corrected sentence shown. Candidate segmentations on blocked rows are review aids only and are not applied.

## Full 30-row segmentation and correction matrix

| Q / location | Original prompt | Intended complete sentence(s) | Exact reviewed A–D segmentation | Part / correction variants | Reconstruction, overlap, omission, and repetition check |
| --- | --- | --- | --- | --- | --- |
| 1 — `problems[0].questions[0]` | Despite of his careful preparation, he still felt nervous before the interview. | Despite his careful preparation, he still felt nervous before the interview. | A=`Despite of`; B=`␠his careful preparation,`; C=`␠he still felt nervous`; D=`␠before the interview.` | A / `Despite` | A+B+C+D exactly equals the prompt; replacing A changes only the complex preposition. No overlap, omission, duplicate word, or punctuation movement. |
| 2 — `problems[0].questions[1]` | The number of students taking advanced English have increased steadily. | The number of students taking advanced English has increased steadily. | A=`The number of students␠`; B=`taking advanced English␠`; C=`have increased`; D=`␠steadily.` | C / `has increased` | Exact reconstruction; C is a self-contained finite verb phrase. The replacement leaves both surrounding spaces outside C and introduces no repeated material. |
| 3 — `problems[0].questions[2]` | Hardly the teacher had entered the room when the students became silent. | Hardly had the teacher entered the room when the students became silent. | A=`Hardly␠`; B=`the teacher had entered`; C=`␠the room when`; D=`␠the students became silent.` | B / `had the teacher entered` | Exact reconstruction; B alone contains the subject–auxiliary order. The corrected order joins cleanly to A and C without silently changing `when`. |
| 4 — `problems[0].questions[3]` | She suggested me to rewrite the introduction more clearly. | She suggested that I rewrite the introduction more clearly. / She suggested rewriting the introduction more clearly. | A=`She␠`; B=`suggested me to rewrite`; C=`␠the introduction`; D=`␠more clearly.` | B / `suggested that I rewrite` / `suggested rewriting` | Exact reconstruction. Each variant replaces all and only B and independently yields a complete sentence; neither relies on changing C. No object or infinitive is duplicated. |
| 5 — `problems[0].questions[4]` | The essay was too much vague to convince the examiner. | The essay was too vague to convince the examiner. | A=`The essay was␠`; B=`too much vague`; C=`␠to convince`; D=`␠the examiner.` | B / `too vague` | Exact reconstruction. B owns the full malformed degree phrase, so deleting `much` does not alter the infinitival purpose clause. |
| 6 — `problems[1].questions[0]` | Not only he solved the problem, but he also explained it beautifully. | Not only did he solve the problem, but he also explained it beautifully. | A=`Not only␠`; B=`he solved`; C=`␠the problem,`; D=`␠but he also explained it beautifully.` | B / `did he solve` | Exact reconstruction; the replacement performs inversion and do-support within B. The correlative second clause is untouched and not repeated. |
| 7 — `problems[1].questions[1]` | The data shows that students who read widely tend to write better essays. | Original is already grammatical when `data` is construed as a singular mass noun; formal plural alternative: The data show that students who read widely tend to write better essays. | Candidate only: A=`The data␠`; B=`shows`; C=`␠that students who read widely␠`; D=`tend to write better essays.` | No final part or correction; candidate B / `show` is not applied. | Candidate segmentation reconstructs exactly, but the original has no unique cross-register error. Options and legacy answer remain unchanged and fail closed. |
| 8 — `problems[1].questions[2]` | I look forward to hear from you after the interview. | I look forward to hearing from you after the interview. | A=`I look forward to␠`; B=`hear`; C=`␠from you after`; D=`␠the interview.` | B / `hearing` | Exact reconstruction. B is only the complement head; replacing it does not duplicate `to` or move the following prepositional phrase. |
| 9 — `problems[1].questions[3]` | The principal insisted that every student wears the school badge. | Directive readings: The principal insisted that every student wear the school badge. / The principal insisted that every student should wear the school badge. The original remains possible when `insisted` means asserted. | Candidate only: A=`The principal insisted that␠`; B=`every student␠`; C=`wears`; D=`␠the school badge.` | No final part or correction; candidate C / `wear` / `should wear` is not applied. | Candidate segmentation reconstructs exactly and both proposed directive variants are grammatical, but neither invalidates the assertive indicative reading. The row remains structurally fail-closed. |
| 10 — `problems[1].questions[4]` | There is little evidences to support such a strong conclusion. | There is little evidence to support such a strong conclusion. | A=`There is␠`; B=`little evidences`; C=`␠to support such`; D=`␠a strong conclusion.` | B / `little evidence` | Exact reconstruction. The determiner and noun are repaired together, avoiding a correction that would depend on a neighboring option. |
| 11 — `problems[2].questions[0]` | The report was consisted of three sections and an appendix. | The report consisted of three sections and an appendix. | A=`The report␠`; B=`was consisted of`; C=`␠three sections`; D=`␠and an appendix.` | B / `consisted of` | Exact reconstruction; B contains the entire invalid passive form. The replacement neither drops `of` nor repeats it in C. |
| 12 — `problems[2].questions[1]` | The committee discussed about the proposal for nearly two hours. | The committee discussed the proposal for nearly two hours. | A=`The committee␠`; B=`discussed about`; C=`␠the proposal for`; D=`␠nearly two hours.` | B / `discussed` | Exact reconstruction. Removing `about` inside B leaves the direct object in C and does not rewrite its determiner. |
| 13 — `problems[2].questions[2]` | He is one of the students who has submitted the assignment early. | Formal plural-antecedent reading: He is one of the students who have submitted the assignment early. | A=`He is one of␠`; B=`the students who␠`; C=`has submitted`; D=`␠the assignment early.` | C / `have submitted` | Exact reconstruction. The formal correction changes only agreement in C. No other segment is grammatically defective, but singular attraction/`one`-antecedent construal is recorded below. |
| 14 — `problems[2].questions[3]` | No sooner the test began than the fire alarm went off. | No sooner had the test begun than the fire alarm went off. / No sooner did the test begin than the fire alarm went off. | A=`No sooner␠`; B=`the test began`; C=`␠than the fire alarm`; D=`␠went off.` | B / `had the test begun` / `did the test begin` | Exact reconstruction. Each B replacement independently supplies inversion; both retain the authored `than` in C and require no tense change elsewhere. |
| 15 — `problems[2].questions[4]` | The teacher made us to revise the paragraph again. | The teacher made us revise the paragraph again. | A=`The teacher␠`; B=`made us␠`; C=`to revise`; D=`␠the paragraph again.` | C / `revise` | Exact reconstruction. C is the infinitival complement; deletion of `to` neither changes the object in B nor the noun phrase in D. |
| 16 — `problems[3].questions[0]` | The reason why he failed was because he ignored the instructions. | Formal edited version: The reason why he failed was that he ignored the instructions. | A=`The reason why he failed␠`; B=`was because`; C=`␠he ignored`; D=`␠the instructions.` | B / `was that` | Exact reconstruction. B contains the full formal-editing target; its replacement does not duplicate `he ignored`. The original remains established descriptive usage and is not labelled universally ungrammatical. |
| 17 — `problems[3].questions[1]` | This is a highly recommended course for students who are interested to academic writing. | This is a highly recommended course for students who are interested in academic writing. | A=`This is a highly recommended course␠`; B=`for students who are␠`; C=`interested to`; D=`␠academic writing.` | C / `interested in` | Exact reconstruction. C owns adjective plus complement preposition; replacing it leaves the following noun phrase unchanged. |
| 18 — `problems[3].questions[2]` | Each of the candidates were asked to prepare a short speech. | Each of the candidates was asked to prepare a short speech. | A=`Each of␠`; B=`the candidates␠`; C=`were asked`; D=`␠to prepare a short speech.` | C / `was asked` | Exact reconstruction. C alone carries number agreement; the plural noun inside the `of` phrase remains intact. |
| 19 — `problems[3].questions[3]` | The article provides many useful informations about exam strategies. | The article provides much useful information about exam strategies. / The article provides many useful pieces of information about exam strategies. | A=`The article provides␠`; B=`many useful informations`; C=`␠about exam`; D=`␠strategies.` | B / `much useful information` / `many useful pieces of information` | Exact reconstruction. Both variants replace the determiner–noun phrase as one bounded unit and independently join to C without duplicated `information`. |
| 20 — `problems[3].questions[4]` | Only after reading the passage carefully I understood the writer's attitude. | Only after reading the passage carefully did I understand the writer's attitude. | A=`Only after reading the passage carefully␠`; B=`I understood`; C=`␠the writer's`; D=`␠attitude.` | B / `did I understand` | Exact reconstruction and authored straight apostrophe preserved. Inversion and do-support remain inside B; no neighboring word changes. |
| 21 — `problems[4].questions[0]` | She is used to work under pressure because she has joined many competitions. | She is used to working under pressure because she has joined many competitions. | A=`She is␠`; B=`used to work`; C=`␠under pressure because she has joined`; D=`␠many competitions.` | B / `used to working` | Exact reconstruction. B contains the fixed `be used to` complement; the causal clause is grammatically independent and untouched. |
| 22 — `problems[4].questions[1]` | The school provided students with a large amount of opportunities to practise speaking. | Formal edited version: The school provided students with a large number of opportunities to practise speaking. | A=`The school provided students with␠`; B=`a large amount of opportunities`; C=`␠to practise`; D=`␠speaking.` | B / `a large number of opportunities` | Exact reconstruction. B contains quantifier and plural count noun, so the formal correction is local. British `practise` is preserved. |
| 23 — `problems[4].questions[2]` | The novel was so bored that I stopped reading after two chapters. | The novel was so boring that I stopped reading after two chapters. | A=`The novel was␠`; B=`so bored`; C=`␠that I stopped reading`; D=`␠after two chapters.` | B / `so boring` | Exact reconstruction. The participial adjective in B is the only change; the `so … that` frame remains complete. |
| 24 — `problems[4].questions[3]` | Had he listened to the advice, he will not have made that mistake. | Had he listened to the advice, he would not have made that mistake. | A=`Had he listened to the advice, he␠`; B=`will not have made`; C=`␠that`; D=`␠mistake.` | B / `would not have made` | Exact reconstruction. The subject and following object stay outside B; the modal correction does not alter the protasis. |
| 25 — `problems[4].questions[4]` | The students were made rewrite their essays after receiving feedback. | The students were made to rewrite their essays after receiving feedback. | A=`The students were␠`; B=`made rewrite`; C=`␠their essays after receiving`; D=`␠feedback.` | B / `made to rewrite` | Exact reconstruction. B contains the passive causative complement, and adding `to` does not duplicate the following object. |
| 26 — `problems[5].questions[0]` | She denied to have copied the paragraph from the website. | She denied having copied the paragraph from the website. / She denied copying the paragraph from the website. | A=`She␠`; B=`denied to have copied`; C=`␠the paragraph from`; D=`␠the website.` | B / `denied having copied` / `denied copying` | Exact reconstruction. Each B variant is independently grammatical; the perfect variant preserves anterior emphasis, while the simple gerund is neutral. Neither changes C. |
| 27 — `problems[5].questions[1]` | The passage raises an important question of whether success should be measured by wealth. | The original sentence is already grammatical. `raises the question of whether`, `raises the question whether`, and `raises the question as to whether` are all established patterns. | Candidate only: A=`The passage raises␠`; B=`an important question␠`; C=`of whether success should be measured␠`; D=`by wealth.` | No final part or correction; legacy candidate A / `question as to whether` / `question whether` is not applied. | Candidate segmentation reconstructs exactly, but replacing legacy A as configured would not be a bounded replacement and the prompt contains no unique error. The row remains unchanged and fail-closed. |
| 28 — `problems[5].questions[2]` | Under no circumstances students should leave the room during the test. | Under no circumstances should students leave the room during the test. | A=`Under no circumstances␠`; B=`students should leave`; C=`␠the room during`; D=`␠the test.` | B / `should students leave` | Exact reconstruction. B contains subject, modal, and verb, allowing inversion without changing the negative adjunct or object. |
| 29 — `problems[5].questions[3]` | The more you practise, your answers become more accurate. | The more you practise, the more accurate your answers become. | A=`The more`; B=`␠you`; C=`␠practise,␠`; D=`your answers become more accurate.` | D / `the more accurate your answers become.` | Exact reconstruction. D must include the terminal period because the entire second clause is replaced; the punctuated correction is therefore documented and local. No words survive from the malformed second clause to overlap the replacement. |
| 30 — `problems[5].questions[4]` | The teacher advised that the essay was rewritten before submission. | Recommendation readings: The teacher advised that the essay be rewritten before submission. / The teacher advised that the essay should be rewritten before submission. The original can report information that the rewrite occurred. | Candidate only: A=`The teacher advised that␠`; B=`the essay␠`; C=`was rewritten`; D=`␠before submission.` | No final part or correction; candidate C / `be rewritten` / `should be rewritten` is not applied. | Candidate segmentation reconstructs exactly and both recommendation variants are grammatical, but the assertive/informational reading makes the original defensible. The row remains structurally fail-closed. |

## Full 30-row linguistic assessment matrix

| Q | Tested rule | Dialect considerations | Formal/prescriptive vs descriptive usage | Register considerations | More than one segment arguably wrong? | Ambiguity classification and question-specific reason | Final editorial status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `despite + noun phrase`, never `despite of` | No material BrE/AmE split. | Standard descriptive and formal grammars agree. | Neutral through formal. | No; only A contains the malformed preposition. | Minimal ambiguity: `in spite of` would be valid, but authored `despite of` is not a competing standard construction. | `PENDING_HUMAN_SIGN_OFF` |
| 2 | Agreement with singular head `the number` | No relevant dialect difference. | Formal and ordinary standard usage select singular agreement. | Academic context reinforces, but does not create, the rule. | No; the participial modifier does not change the head. | Strongly localized: `students` is embedded in an `of` phrase and does not control `have`. | `PENDING_HUMAN_SIGN_OFF` |
| 3 | Inversion after fronted negative/restrictive `hardly` | Shared across major standard varieties. | Both prescriptive and descriptive accounts require subject–auxiliary inversion here. | Formal narrative construction, but not register-dependent once chosen. | No; `when` is the correct correlative and remains untouched. | The only defensible repair is word order in B; tense and correlative are already coherent. | `PENDING_HUMAN_SIGN_OFF` |
| 4 | `suggest` does not license object + `to`-infinitive | No material dialect split for this complement pattern. | Both proposed complements are standard; the finite variant uses a mandative form without making it the only variant. | `suggest rewriting` is neutral; `suggest that I rewrite` is slightly more explicit/formal. | No; C and D work with both replacements. | Two repairs differ in syntax but not grammaticality, and both are independently complete rather than partial aliases. | `PENDING_HUMAN_SIGN_OFF` |
| 5 | `too + adjective`, not `too much + adjective` | No relevant variety difference. | Standard descriptions agree for scalar adjective `vague`. | Neutral. | No; the `to convince` complement is well formed. | `much` cannot function as the modifier in this exact adjective phrase, so the target is confined to B. | `PENDING_HUMAN_SIGN_OFF` |
| 6 | Inversion/do-support after clause-initial `not only` | Standard BrE and AmE align. | Required in careful and ordinary standard syntax when `not only` fronts the clause. | The correlative is formal, but the inversion is not optional within it. | No; the second `but ... also` clause is grammatical. | The comma does not create a second defect; B alone repairs the first clause. | `PENDING_HUMAN_SIGN_OFF` |
| 7 | Agreement of `data` | Both singular mass-noun and plural count-noun treatments occur across BrE/AmE; field conventions matter more than geography. | Traditional scientific style prefers plural `data`; contemporary descriptive usage widely accepts singular `data`. | Discipline-specific academic house style could decide, but the prompt supplies none. | No mechanical second error, but there is also no unique first error. | `shows` is grammatical under an established singular construal, so changing it would manufacture a universal error from a style choice. | `BLOCKED_REGISTER_AMBIGUITY` |
| 8 | `look forward to + gerund` | Shared standard pattern. | Descriptive and prescriptive accounts agree that `to` is a preposition here. | Neutral correspondence language. | No; `from you after the interview` attaches normally. | The infinitive/gerund contrast is decisive because `to` already belongs to the fixed expression. | `PENDING_HUMAN_SIGN_OFF` |
| 9 | Mandative complement after `insist` versus assertive `insist` | Bare subjunctive is especially common in AmE; `should wear` is a normal BrE directive form. | Indicative `wears` is grammatical when `insisted` means maintained as fact rather than demanded. | Institutional context suggests a rule but does not force the directive sense. | No second surface defect; the blocker is lexical meaning. | Without context, the same sentence can assert habitual badge-wearing, so C is not uniquely erroneous. | `BLOCKED_MANDATIVE_AMBIGUITY` |
| 10 | Uncountable `evidence` with `little` | No relevant dialect split in this sense. | Standard usage rejects plural `evidences` for supporting information here. | Formal argumentative context is fully compatible with the mass noun. | No; `such a strong conclusion` is idiomatic. | The legal sense of plural `evidences` does not fit this construction, leaving one clear target. | `PENDING_HUMAN_SIGN_OFF` |
| 11 | Intransitive `consist of` cannot be passivized | Shared across standard varieties. | Formal and descriptive grammars agree. | Academic report register is neutral for `consisted of`. | No; the complement list is grammatical. | Removing auxiliary `was` resolves the only valency error without changing tense. | `PENDING_HUMAN_SIGN_OFF` |
| 12 | Transitive `discuss` takes a direct object | No material BrE/AmE difference. | Standard usage treats `discuss about` as nonstandard in this transitive sense. | Neutral/formal meeting context. | No; duration phrase is well attached. | B can be replaced by one verb and C supplies its direct object exactly once. | `PENDING_HUMAN_SIGN_OFF` |
| 13 | Agreement in `one of the students who ...` | Variation is not cleanly national; singular attraction appears broadly. | Formal test convention takes plural `students` as antecedent; descriptive accounts and usage allow or record singular `one` construal/attraction. | The assignment context is neutral; only the pack's advanced formal-exam convention supports treating plural as expected. | No other segment is defective. | Moderate agreement ambiguity: `have` is the defensible formal key, but structural repair does not prove the singular reading impossible. | `PENDING_HUMAN_SIGN_OFF` |
| 14 | Inversion after `no sooner`; `no sooner ... than` | Both perfect and do-supported past variants occur in standard BrE/AmE. | Prescriptive sources often teach past perfect, but `No sooner did ... than` is also grammatical. | Formal narrative register favors the perfect without excluding the second variant. | No; `than` is correct. | Retaining both independently valid variants avoids falsely presenting past perfect as the sole possible repair. | `PENDING_HUMAN_SIGN_OFF` |
| 15 | Active causative `make + object + bare infinitive` | Shared standard pattern. | Formal and descriptive usage agree. | Neutral classroom context. | No; `again` is stylistic but grammatical. | `to` is the only ill-licensed element, and C isolates it with the verb. | `PENDING_HUMAN_SIGN_OFF` |
| 16 | Formal editing preference `the reason ... was that` | No useful national split. | `the reason ... was because` is established descriptively; some formal style guidance treats it as redundant. | Defensible only as an explicitly formal/prescriptive editing item, not as a universal grammar ban. | No separate error; the issue is stylistic status of B. | Moderate register ambiguity is retained in the explanation; repair is a formal-exam key pending human acceptance of that convention. | `PENDING_HUMAN_SIGN_OFF` |
| 17 | Adjective complement `interested in` | Shared across major standard varieties. | Standard usage agrees; `interested to hear/know` exists but does not license `interested to academic writing`. | Academic course description is neutral. | No; `highly recommended` and relative clause are grammatical. | The valid `interested to + verb` pattern cannot rescue the noun complement used here. | `PENDING_HUMAN_SIGN_OFF` |
| 18 | Singular agreement with distributive `each` | Shared formal standard; plural attraction occurs informally but is not the expected finite agreement. | Prescriptive and mainstream descriptive analyses use singular `was`. | Formal test context reinforces the singular form. | No; plural `candidates` is correctly embedded in the `of` phrase. | The distributive head is overt and immediately identifiable, making C a defensible single target despite attraction in speech. | `PENDING_HUMAN_SIGN_OFF` |
| 19 | Mass noun `information`; compatible quantifiers | No dialect difference relevant here. | Both correction variants are standard; the second preserves plural quantification semantically. | `much useful information` is somewhat formal, while `many useful pieces` is neutral and explicit. | No; the following `about` phrase works with both. | The variants repair the same bounded noun phrase and do not introduce competing error locations. | `PENDING_HUMAN_SIGN_OFF` |
| 20 | Inversion after fronted `only after` adjunct | Shared standard syntax. | Formal and descriptive accounts agree for this fronting pattern. | The structure is formal, but once fronted the inversion is required. | No; possessive punctuation and noun phrase are correct. | B contains exactly the missing do-support and inverted subject order; the straight apostrophe is preserved. | `PENDING_HUMAN_SIGN_OFF` |
| 21 | `be used to + gerund/noun` versus past-habit `used to + infinitive` | Shared across BrE/AmE. | Standard descriptions distinguish the two constructions. | Neutral autobiographical statement. | The causal claim is semantically weak but grammatically possible, so it is not a second error. | Presence of finite `is` fixes the habituation reading and makes `working` the localized repair. | `PENDING_HUMAN_SIGN_OFF` |
| 22 | Formal `number of` with plural count nouns versus `amount of` with mass nouns | Both varieties show informal plural uses of `amount`; no forced American-only answer. | Formal edited English maintains the count/mass distinction, while descriptive usage records informal erosion. | The educational setting supports the formal convention but requires the caveat now added to the explanation. | No; British verb spelling `practise` is correct and preserved. | Moderate register variation, but `number of opportunities` is a defensible formal key rather than a dialect correction. | `PENDING_HUMAN_SIGN_OFF` |
| 23 | Stimulus adjective `boring` versus experiencer adjective `bored` | Shared lexical distinction. | Standard usage agrees. | Neutral literary reaction. | No; `so ... that` is correctly formed. | The inanimate novel is the stimulus, so B has a clear semantic-role mismatch. | `PENDING_HUMAN_SIGN_OFF` |
| 24 | Modal perfect in an inverted third conditional | Shared across standard varieties. | Standard counterfactual sequence requires `would ... have` in the result clause. | Neutral hypothetical register. | No; the inverted protasis is already grammatical. | A future-perfect reading with `will` is incompatible with the past counterfactual established by `Had he listened`. | `PENDING_HUMAN_SIGN_OFF` |
| 25 | Passive causative `be made to + infinitive` | Shared standard pattern. | Formal and descriptive accounts agree. | Neutral classroom context. | No; receiving feedback is a grammatical adjunct. | The active bare-infinitive rule does not carry into the passive, so B needs exactly one `to`. | `PENDING_HUMAN_SIGN_OFF` |
| 26 | `deny + gerund/perfect gerund`, not `to`-infinitive | Shared standard complementation. | Both proposed variants are grammatical; they differ only in aspect emphasis. | `denied having copied` is more explicit/formal; `denied copying` is neutral. | No; source prepositional phrase is grammatical. | Providing both complete B replacements preserves the available aspect choice without touching a neighbor. | `PENDING_HUMAN_SIGN_OFF` |
| 27 | Complement patterns after `question` | `question of whether` is established in both BrE and AmE. | Formal and descriptive sources accept the authored construction; alternatives are stylistic, not corrections. | All three patterns fit academic prose. | No segment is wrong. | The legacy correction would merely exchange one grammatical complement for another and is not bounded to its configured A alias. | `BLOCKED_NO_ERROR_ITEM` |
| 28 | Subject–auxiliary inversion after fronted negative phrase | Shared standard rule. | Formal and descriptive syntax agree. | Formal prohibition wording naturally uses this construction. | No; modal choice `should` and test adjunct are sound. | B contains the exact ordering defect; no alternate non-inverted standard reading exists in this clause. | `PENDING_HUMAN_SIGN_OFF` |
| 29 | Comparative correlative `the more ..., the more ...` | Shared across standard varieties. | Standard descriptions require a matching comparative phrase in the second clause. | Neutral instructional statement. | No independent error, though four-part segmentation makes the first clause granular. | D must be replaced wholesale to avoid duplicated `more accurate`; this is structurally valid but deserves renderer/human usability review. | `PENDING_HUMAN_SIGN_OFF` |
| 30 | Mandative `advise` versus informational/assertive `advise` | Bare subjunctive is common in AmE; `should be rewritten` is a standard BrE recommendation form. | Past indicative `was rewritten` can be grammatical if the teacher informed listeners that the rewrite occurred. | School context suggests a recommendation but supplies no recipient or discourse that forces it. | No surface second error; semantic underdetermination blocks the first. | C cannot be uniquely marked until an editor commits to the recommendation meaning or rewrites the prompt to force it. | `BLOCKED_MANDATIVE_AMBIGUITY` |

## Blocked rows

- Q7 — `BLOCKED_REGISTER_AMBIGUITY`: singular mass-noun `data` makes the original grammatical; no discipline or house style is specified.
- Q9 — `BLOCKED_MANDATIVE_AMBIGUITY`: directive `wear`/`should wear` competes with a grammatical assertive indicative reading.
- Q27 — `BLOCKED_NO_ERROR_ITEM`: `raises an important question of whether` is already grammatical.
- Q30 — `BLOCKED_MANDATIVE_AMBIGUITY`: recommendation forms compete with a grammatical informational reading of `advised`.

These four rows remain byte-for-byte unchanged within their JSON object content, retain legacy aliases, have no canonical A–D options, and must remain fail-closed. No error was manufactured to lower the audit count.

## Distribution and punctuation observations

- Planned repaired-row answer distribution: A = 1, B = 19, C = 5, D = 1 (26 rows). The skew follows the reviewed constituent boundaries and is a future calibration concern; positions were not moved merely to balance the key.
- Q29 is the only planned correction containing terminal punctuation. Its marked D segment includes the complete sentence-final clause and period, so the period is genuinely part of the replaceable segment. This is documented rather than silently shifted across an option boundary.
- All other corrections exclude trailing punctuation. Authored commas and the straight apostrophe in Q20 remain in their original option strings.
- Q14 intentionally has two tense/inversion variants; Q4, Q19, and Q26 also retain multiple independently grammatical variants. No variant requires a neighboring rewrite.

## Post-edit audit and validation evidence

The real post-edit audit—not the expected all-30-repaired scenario—reported:

| Signal | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `rendererIncompatibleOptions` | 31 | 5 | -26 |
| `normalizerWarnings` | 152 | 126 | -26 |
| `pronunciationWithoutValidTargetSpans` | 30 | 30 | 0 |
| `shortExplanations` | 440 | 437 | -3 |
| `hasInventoryErrors` | `false` | `false` | unchanged |

The five remaining renderer findings are `pilot-pack-001` Q25 and target Q7,
Q9, Q27, and Q30. The three short-explanation removals are the narrow accuracy
clarifications for Q13, Q16, and Q22; this verified secondary delta was
reconciled before changing the exact audit assertion.

### Target-specific structural/runtime probe

An inline repository-local TypeScript probe loaded the real target file and
the production contract, scorer, and learner DTO helpers. It verified all 26
repaired rows and all four blockers:

- strict `JSON.parse` succeeded;
- a separate recursive duplicate-key parser found zero duplicate keys;
- every repaired row had exactly ordered A, B, C, D IDs, non-empty authored
  text, only `correctPart`/`correction` answer keys, an in-set correct part, and
  a valid `validateErrorIdentificationContract` result;
- A+B+C+D exactly reconstructed every prompt;
- every slash variant replaced only its marked part and produced the exact
  complete sentence recorded above;
- correct part plus each correction variant scored true; blank correction and
  `OK` scored false;
- all 26 learner projections emitted exactly four safe `{id,text}` options and
  serialized without `correctPart`, correction, explanation, raw options,
  metadata, `accepted`, or `display`;
- a separate admin-preview probe covered all 26 rows: authorized repair data
  remained available as `answer`/`rawOptions`, the production renderer
  projection remained the safe four-part projection, and blocked rows emitted
  no renderer options.

The first standalone admin-preview probe could not resolve the test-only
`server-only` stub. The probe was rerun with a harmless module-resolution stub,
without changing repository files, and passed all 26 rows. The committed
admin-preview test file also passed in both focused and full Vitest runs.

### Commands and results

| Command / check | Result |
| --- | --- |
| Focused Vitest: contract, import, renderer, learner security, admin preview, submission route, persisted QA, immediate publication, admin publication mutations, content audit | Initial run: 298 passed and 1 exact audit assertion failed because `shortExplanations` was really 437, not 440. After reconciliation: 10 files, 299 passed. |
| `npm.cmd run test` | 79 files passed; 1,111 tests passed and 8 skipped (1,119 total). |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run audit:content-packs` | Human-readable audit exited 0; inventory 2 / 17 / 101 / 495 and current signals matched the table above. |
| `git diff --check` | Passed; Git emitted only line-ending conversion notices. |

### Deterministic machine-readable audit

The underlying direct repository entry point was executed twice, without an
npm banner, into fresh files under
`$env:TEMP\englishphile-pack002-final-audit-a423de06f8664d8f9a41d25a956edb34`:

`node --import tsx -r tsconfig-paths/register scripts/audit-content-packs.ts --format=json`

Both JSON bodies parsed. Each was 199,908 bytes and each had SHA-256
`b36496898931a143007eaf77f6c7d016824f908d03522a2fdd74d31598a3fc8f`;
the byte streams were identical. A recursive audit-schema scan found no raw
`answer` or `correction` object/key and no rights-evidence, transcript,
provider, credential, access-code, secret, learner metadata, `accepted`, or
`display` key. Findings retain only the audit's bounded locations, issue codes,
prompt excerpts, safe option representations, and bounded selected part IDs;
no raw correction text or unrelated sensitive content was emitted.

## Known limitations and retained debt

- Every structurally repaired row still requires human linguistic, ambiguity, renderer, answer, difficulty, and calibration review.
- `pilot-pack-001` Q25 remains `BLOCKED_NO_ERROR_ITEM`.
- `pilot-pack-001` Q7 remains `BLOCKED_DIALECT_AMBIGUITY` at the editorial level even though its A–D structure is valid.
- `pilot-pack-001` Q23 retains the pre-existing smart-apostrophe normalization scoring debt; this repair does not change scorer normalization.
- Structural tests are repository/local evidence only. They are not browser-E2E, real-database, import, publication, Preview, or Production evidence.
- No structural result establishes publication readiness, and no item was imported or published.

Later scorer-resolution note (2026-08-02, Phase 2 PR 13): the historical Q23
debt above is resolved by bounded equivalence among U+0027, U+2018, and U+2019
under the existing punctuation-insensitive scorer policy. Stored content was
not rewritten, and arbitrary Unicode punctuation is not normalized. Pilot Q23
remains `NEEDS_REVIEW` and `PENDING_HUMAN_SIGN_OFF`; scorer equivalence does not
establish linguistic, difficulty, calibration, or publication approval. The
five Error Identification blockers and audit counts remain unchanged: 5
renderer findings, 126 normalizer warnings, 30 Pronunciation target-span
findings, and `hasInventoryErrors=false`.
