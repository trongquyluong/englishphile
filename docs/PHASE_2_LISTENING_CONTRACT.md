# Englishphile Phase 2 — Listening contract design

## 1. Executive decision summary

This is the design authority for future problem-bank Listening work. It does
not implement a contract, create content, add media, or change runtime
behavior. The older
[`LISTENING_AND_CONTEST_ADMIN_PLAN.md`](LISTENING_AND_CONTEST_ADMIN_PLAN.md)
remains evidence about the separate contest-builder scaffold; its example URLs,
provider list, and future ideas are not evidence that an asset or provider
workflow exists.

| Status | Decision | Rationale and tradeoff | Validation owner | Learner impact and failure behavior | Migration implication |
| --- | --- | --- | --- | --- | --- |
| **CURRENT** | `LISTENING_MCQ` and `LISTENING_SHORT_ANSWER` are separate Prisma question types. | They already have different answer shapes and controls. | Importer, scorer, renderer. | MCQ selects an option ID; short answer submits text. | Preserve both types. Never collapse them into a generic Listening type. |
| **IMPLEMENTED** | Keep both types separate and give them one shared `metadata.listening` media descriptor. | Shared media rules avoid duplicated asset logic while separate answer contracts preserve assessment meaning. | The pure Listening contract used by import, QA, publication, and repository audit. | A malformed descriptor blocks the complete Listening problem/section; no guessing controls remain active. | Normalize supported legacy aliases into the descriptor only through reviewed tooling. |
| **PROPOSED** | Use a versioned same-origin asset reference as the pilot default; never author raw provider URLs as the canonical identity. | It fits the current relative-path renderer and minimizes tracking, expiry, CORS, and provider coupling. Committing media to Git increases repository/deployment size. | Future asset workflow plus publication validation. | Stable playback source; unavailable assets fail closed. | `metadata.audioUrl` becomes a deprecated import alias, not publication evidence. |
| **DEFERRED** | Controlled object storage/CDN integration. | It may be better for scale, range requests, replacement, and retention, but provider, cost, access, and lifecycle decisions are not approved. | Project owner, then storage integration PR. | No provider-specific learner behavior may be assumed. | A future resolver maps stable `assetRef` values to delivery URLs without rewriting question identity. |
| **REJECTED** | Arbitrary authored external HTTPS audio URLs and unapproved hotlinking. | They introduce third-party tracking, referrer leakage, expiry, rights, CORS, content-type, and replacement risks. HTTPS alone does not make a source controlled or licensed. | Import/publication contract. | External failure cannot leave an answer form that invites guessing. | Legacy external URLs require manual rights and storage migration; they are not auto-normalized. |
| **PROPOSED** | Require a reviewed transcript for publication but do not show it by default during a Listening attempt. | A transcript supports review and accommodation; always showing it can turn Listening into Reading. | Import/QA for structure; human linguistic and accessibility review for quality. | Practice shows it after submission by default. Assessment hides it during the attempt unless an explicit accommodation path is used. | Never infer a transcript from prompt, explanation, audio name, or provider data. |
| **PROPOSED** | Use native browser audio controls for the first renderer PR, with no autoplay and no security claims about replay/seek restrictions. | Native controls provide a tested semantic baseline. Browser controls vary, and client-side restrictions are bypassable. | Renderer and accessibility review. | Play/pause, seek, volume, loading, and failure states remain understandable by keyboard and screen reader. | Existing `<audio controls>` is replaced only after safe DTO and failure-state contracts exist. |
| **IMPLEMENTED** | Every publication path must call one deterministic, database-free Listening contract; `publish-safe` must re-run it under lock. | Current paths validate answers inconsistently and validate no problem-bank media contract. | Import, persisted QA, individual/edit/bulk publication, transaction recheck. | Invalid content never becomes newly published. Runtime availability is handled separately and cannot be permanently proven at import. | Ordinary `NEEDS_REVIEW` import may retain repairable media defects as warnings; all publication boundaries promote blockers to errors. |
| **PROPOSED** | Add an all-or-nothing learner DTO projection and retain positive Prisma selectors. | Prisma JSON cannot select subfields, so server-only reduction is required to avoid leaking answers, raw metadata, or rights evidence. | Server-only DTO projector. | Ready content receives bounded presentation fields; invalid content receives a fixed unavailable state with no answer controls. | Internal evidence remains server/admin-only; a stronger storage boundary is deferred to a dedicated asset record if approved. |
| **DEFERRED** | Public versus authenticated audio access, transcript visibility during assessment, replay limits, dialect policy, permitted licence categories, retention duration, and deletion policy. | These materially affect cost, assessment validity, access, and rights. | Project-owner approval before implementation. | Until approved, Listening remains blocked from publication and diagnostic eligibility. | No implementation may silently encode defaults for these choices. |

## 2. Evidence boundaries

**CURRENT — repository evidence inspected**

- `README.md`, `handoff.md`,
  [`PHASE_2_PRODUCT_CONTENT_AUDIT.md`](PHASE_2_PRODUCT_CONTENT_AUDIT.md),
  and
  [`PHASE_2_CONTENT_QA_WORKFLOW.md`](PHASE_2_CONTENT_QA_WORKFLOW.md).
- `prisma/schema.prisma`, including `Question`, `SourceCollection`,
  `ContestSection`, `ContestQuestion`, `SkillType`, `QuestionType`, and
  `ContentStatus`.
- JSON/CSV types, templates, parsing, normalization, validation, immediate
  publication validation, duplicate planning, and content-pack selection.
- Both manifests and the complete 17 numbered split files selected in
  `content-packs/`; `00-all-in-one` mirrors were not counted.
- Learner renderers, learner DTOs, positive selectors, admin preview mapper and
  page, diagnostic page, both contest rendering paths, answer checking, and
  every production caller of `checkQuestionAnswer`.
- Persisted QA, individual publish, edit-to-publish, ordinary bulk status,
  content-pack and content-QA `publish-safe`, and transaction-locked rechecks.
- Relevant repository tests and documentation for content rights, review
  evidence, media/storage ideas, privacy/retention debt, and accessibility
  review.

**CURRENT — evidence not inspected**

- No database, environment value, secret, cookie, connection string, deployed
  endpoint, Preview, Production, provider, runtime log, or GitHub state.
- No real audio URL was dereferenced, fetched, streamed, downloaded, probed, or
  validated.
- No provider configuration, bucket, CDN, upload, licence document, rights
  holder response, transcript, or real media asset is claimed.
- Repository fields prove capability only. They do not prove that any matching
  database row exists or is published.

**PROPOSED — design evidence**

All field names, limits, severities, DTOs, workflows, and implementation PRs
below are design decisions. They do not describe implemented behavior unless
the row is explicitly marked **CURRENT**.

## 3. Current repository inventory

### 3.1 Independently recomputed arithmetic

The direct split-file parse and manifest totals agree:
`55 + 46 = 101` problems and `275 + 220 = 495` questions.

| Current repository scope | Files | Problems | Questions |
| --- | ---: | ---: | ---: |
| Content Pack 002 | 7 | 55 | 275 |
| Pilot Pack 001 | 10 | 46 | 220 |
| **Total** | **17** | **101** | **495** |
| **Listening** | **0** | **0** | **0** |

| Listening type | Problems | Questions |
| --- | ---: | ---: |
| `LISTENING_MCQ` | 0 | 0 |
| `LISTENING_SHORT_ANSWER` | 0 | 0 |
| **Total** | **0** | **0** |

| Difficulty | Listening problems | Listening questions |
| --- | ---: | ---: |
| `B2` | 0 | 0 |
| `C1` | 0 | 0 |
| `C2` | 0 | 0 |
| `CHUYEN` | 0 | 0 |
| `HSG` | 0 | 0 |

**CURRENT:** the 21/84 pilot specification reserves two future Listening
problems and eight questions. Those are planning arithmetic, not repository
content.

### 3.2 Current field and alias mapping

| Concern | Canonical/current storage | Accepted current aliases or fallback | Current consumer | Current limitation |
| --- | --- | --- | --- | --- |
| Prompt | `Question.prompt`; JSON `questions[].prompt`; CSV `prompt` | No prompt alias | All learner/admin renderers | Import permits an empty prompt only when `passage` is non-empty, while minimal publish requires a non-empty prompt. |
| MCQ options | `Question.options`; JSON `options`; CSV `optionsJson` | Import converts string `label` to `id`; learner option projection requires `id` and `text` | `MultipleChoiceQuestion`, diagnostic/contest local option mappers | Listening has no type-specific count, ID uniqueness, non-empty text, or answer-membership publication contract. |
| MCQ answer | `answer.correctOptionId` | Import promotes string `correctOption`; `display` is non-authoritative at scoring | `checkMCQ` | Current minimal publish checks only non-empty answer JSON. A missing expected ID can make blank learner input compare equal to blank expected input. |
| Short accepted answers | `answer.acceptedAnswers` | `accepted`; scorer also accepts either alias as a string; importer may treat `display` as a fallback | `checkTextAnswer` | Scorer does not use `display`; a display-only imported answer can pass normalization yet always score false. No bounds, uniqueness, or linguistic-variant rule exists. |
| Audio | `Question.metadata.audioUrl` for problem-bank Listening | None | Learner DTO and admin preview copy any non-blank string; `ListeningQuestion` passes it to `<audio>` | No URL, origin, MIME, duration, size, rights, or availability validation. |
| Section label | `Question.metadata.sectionType` | None | Learner DTO/admin preview and `ListeningQuestion` display it as text | It is unvalidated and duplicates type-like meaning without being authoritative. |
| Generic transcript | No `Question` field; arbitrary JSON could contain a key but no contract consumes it | None | Learner DTO deliberately drops raw transcript-like metadata | No authored, validated, or reviewable problem-bank transcript contract. |
| Contest media | `ContestSection.audioUrl`, `ContestSection.transcript` | Excel columns `audio_url`, `transcript_admin_only` | Contest builder and section-based contest start | Separate schema and workflow; presence of fields does not establish assets, rights, MIME, duration, retention, or problem-bank compatibility. |
| Source rights note | `SourceCollection.copyrightNote` | JSON optional; CSV currently creates a generic approval sentence | Admin/source workflow | Optional, source-level, not asset-level, and not proof of permission. |

### 3.3 Presence and absence

| Repository check | Count/result | Evidence classification |
| --- | ---: | --- |
| Selected pack questions with `metadata.audioUrl` | 0 | **CURRENT** repository evidence |
| Selected pack questions with `metadata.sectionType` | 0 | **CURRENT** repository evidence |
| Selected pack questions with `metadata.transcript` | 0 | **CURRENT** repository evidence |
| Local audio files under `public`, `content-packs`, `examples`, or `src` for common audio extensions | 0 | **CURRENT** repository evidence |
| Dedicated problem-bank Listening JSON template | None | **CURRENT** repository evidence |
| Dedicated problem-bank Listening CSV row/example | None | **CURRENT** repository evidence |
| Contest import columns for audio/transcript | Present | **CURRENT** scaffold evidence, not content/asset evidence |
| Repository audit treatment | Counts both Listening types and treats `LISTENING_MCQ` as option-based; has no audio/transcript/rights finding | **CURRENT** repository evidence |
| Dedicated Listening renderer/scorer/publication contract test | None | **CURRENT** repository evidence; generic DTO/input tests are not a complete Listening contract |
| Configured storage/CDN provider | Not proven | **CURRENT** evidence boundary |
| Real transcript, attribution, licence, rights evidence, duration, MIME, captions, replay policy, fallback policy, or accommodation record | Not proven | **CURRENT** evidence boundary |

Strings in documentation and synthetic tests, including a relative MP3 path,
are examples only. They are not assets, live URLs, or publication evidence.

### 3.4 Requested capability-field check

| Capability | Generic `Question` / problem-bank status | Separate contest-section status |
| --- | --- | --- |
| Audio URL/reference | `metadata.audioUrl` is an untyped convention consumed by DTO/renderer; no schema field or validator | `ContestSection.audioUrl` exists |
| Section/type discriminator | `Question.type` is authoritative; untyped `metadata.sectionType` is displayed but not validated | `ContestSection.skillType` and imported `section_type` exist |
| Transcript | No canonical field/contract; raw metadata is not learner-projected | `ContestSection.transcript` exists and is currently admin-only in rendering |
| Visible attribution | No field/contract | No asset-specific field/contract |
| Rights/licence classification | No field/contract; only optional source-level `copyrightNote` and human review record | No asset-specific field/contract |
| Internal rights evidence | No field/contract; review template has a manual evidence-reference line | No asset-specific field/contract |
| Duration | No audio-duration field/contract | Contest duration exists, but it is exam duration, not audio duration |
| MIME/content type | No field/contract | No implemented field/contract |
| Captions/timed text | No field/contract | No implemented field/contract |
| Replay/seek/speed policy | No field/contract | No implemented policy field; native controls are unrestricted by application code |
| Fallback/unavailable policy | No field/contract | No implemented structured policy |
| Accommodation mode | No field/contract | No implemented field/contract |

## 4. Current learner/admin/scoring journeys

### 4.1 Presentation journeys

| Journey | What data is selected/projected | What currently renders | Current failure behavior |
| --- | --- | --- | --- |
| Published problem detail | Positive Prisma selector loads presentation fields, including full `metadata` server-side; DTO emits only `audioUrl` and `sectionType` from Listening metadata, plus safe options | `ListeningQuestion` renders a native `<audio controls>`, prompt/options for MCQ, or one text input for short answer | Missing audio shows a placeholder but still renders answer controls, inviting guessing. Any non-blank URL string reaches the browser. |
| Random practice | Same positive selector and learner DTO | Same `QuestionRenderer` and `ListeningQuestion` | Same fail-open media behavior. |
| Diagnostic | Positive presentation selector and learner DTO include `audioUrl`/`sectionType` | The diagnostic page has its own generic option/text renderer and never renders audio | A selected Listening question can display answer controls without any audio. Readiness validates only Word Formation root data. |
| Legacy problem-backed contest | Contest query renders problem questions with a local option/text renderer | It does not read or render problem-question Listening metadata/audio | Listening answer controls can appear without audio. |
| Section-based contest builder | `ContestSection.audioUrl` is included; transcript is not rendered to learners | One native section-level `<audio controls>` plus standalone question controls | No fixed learner fallback if a Listening section reaches runtime without playable media; publication currently requires only a non-blank URL. |
| Gym Listening index | Queries published Listening problems | Repository content produces the empty state | UI copy claims a transcript structure is ready, but the generic problem-bank contract does not exist. |
| Admin problem preview | `requireAdmin`; server-only mapper retains raw answer, explanation, metadata, and raw options while projecting `audioUrl`/`sectionType` | Production `QuestionRenderer` in preview mode | Admin can see raw repair data, but preview has no MIME/duration/rights/transcript evidence and missing audio still leaves answer controls. |

**CURRENT:** learner problem DTOs do not expose canonical answers, accepted
variants, explanations, or raw metadata. Admin preview is intentionally
answer-complete and server-only. This separation must be preserved.

### 4.2 Current scoring

All production scoring callers use `checkQuestionAnswer`: individual practice,
random practice, diagnostic, legacy problem-backed contests, and standalone
section-based contests.

| Type | Learner input | Current expected answer | Current comparison | Current result/caller effect |
| --- | --- | --- | --- | --- |
| `LISTENING_MCQ` | String option ID | `answer.correctOptionId` | Trim and uppercase equality | Boolean correctness. Practice/contest totals include it; diagnostic includes it in deterministic weighted scoring when selected. |
| `LISTENING_SHORT_ANSWER` | String | `acceptedAnswers` or `accepted` | Existing NFKD/diacritic removal, lowercase, punctuation removal, whitespace collapse, then exact match against any variant | Boolean correctness. Practice/contest totals and diagnostic scoring treat it as auto-markable. |

**CURRENT gaps:**

- MCQ scoring does not independently validate a non-blank configured answer,
  rendered option membership, or a complete media descriptor.
- Short-answer scoring with no accepted variants returns false, but current
  import normalization may accept `display` even though runtime scoring ignores
  it.
- Neither scorer checks that audio was playable or heard. Playback state is not
  an answer-scoring authority.
- Diagnostic marks Listening as optional and scored. It excludes Listening only
  when no items are selected, not when selected items lack playable media.

## 5. Current gaps and risks

| Status | Gap/risk | Present behavior | Required future failure behavior |
| --- | --- | --- | --- |
| **CURRENT** | No problem-bank media contract | Arbitrary `metadata` strings pass through server projection. | **PROPOSED:** all-or-nothing pure descriptor validation. |
| **CURRENT** | Normal `NEEDS_REVIEW` JSON/CSV import has no Listening media warning | Structurally answer-valid Listening drafts import without audio/transcript/rights fields. | **PROPOSED:** retain repairable drafts but issue deterministic media, transcript, attribution, and rights warnings. |
| **CURRENT** | Immediate import-publish validates no Listening media | Only existing type-general answer/options rules apply. | **PROPOSED:** promote every publication blocker to error before write. |
| **CURRENT** | Persisted QA validates only generic answer/options for Listening | No audio, transcript, rights, MIME, duration, size, or fallback issue. | **PROPOSED:** `ERROR`, `canPublish=false`. |
| **CURRENT** | Individual, edit-to-publish, and ordinary bulk publish use minimal answer/options validation | Non-empty JSON can pass without canonical answer membership or media. | **PROPOSED:** call the same pure contract under the locked snapshot. |
| **CURRENT** | `publish-safe` rechecks current QA under lock, but QA lacks Listening media rules | “Safe” does not mean media-safe for Listening. | **PROPOSED:** re-run answer, media, rights, transcript, and presentation contract under lock. |
| **CURRENT** | Runtime player accepts arbitrary URLs | Potential tracking/referrer leakage, expiry, CORS/range failure, wrong content type, and unapproved replacement. | **PROPOSED:** same-origin resolved source by default; controlled allowlist only if owner approves storage. |
| **CURRENT** | Missing audio can coexist with answer controls | Learners can guess and receive a misleading score. | **PROPOSED:** block the complete Listening problem/section and disable submission for its questions. |
| **CURRENT** | Transcript/accessibility has no policy | Transcript is absent in problem-bank flow and admin-only in contest scaffold. | **PROPOSED:** reviewed transcript required for publication, context-aware visibility, explicit accommodation effect. |
| **CURRENT** | Rights are not asset-specific | Optional source note and human checklist are the only relevant evidence. | **PROPOSED:** required classification, visible attribution, and opaque internal evidence reference. |
| **CURRENT** | Storage lifecycle is undefined | No provider, retention, replacement, or deletion workflow is proven. | **DEFERRED:** owner-approved lifecycle. Listening must not be represented as closing H-11. |
| **CURRENT** | Renderer accessibility is incomplete | Native audio exists, but no explicit label, coordinated error status, active-player rule, or tested screen-reader flow. | **PROPOSED:** semantic labels, status announcements, keyboard review, and manual assistive-technology review; no claim of full compliance. |

## 6. Canonical proposed data contract

### 6.1 Storage shape

**PROPOSED:** author one versioned descriptor in existing
`Question.metadata.listening`. Do not store binary audio, base64, cookies,
credentials, signed provider responses, personal data, or raw rights documents
inside Prisma JSON.

Synthetic example only; it does not identify an existing asset:

```json
{
  "listening": {
    "version": 1,
    "partLabel": "Phần 1",
    "audio": {
      "assetRef": "/media/listening/pilot-001/dialogue-01-v1.mp3",
      "mimeType": "audio/mpeg",
      "byteLength": 2457600,
      "durationMs": 92000
    },
    "transcript": {
      "text": "Speaker A: ...\nSpeaker B: ...",
      "languageTag": "en",
      "availabilityPolicy": "AFTER_SUBMISSION"
    },
    "attribution": {
      "displayText": "Bản ghi âm do Englishphile sản xuất."
    },
    "rights": {
      "classification": "OWNED",
      "evidenceRef": "rights:listening/pilot-001/dialogue-01/v1"
    },
    "unavailableBehavior": "BLOCK_PROBLEM"
  }
}
```

### 6.2 Exact descriptor fields

Bounds count Unicode code points unless stated otherwise.

| Status | Field | Type | Required | Exact proposed rule | Visibility | Validation owner |
| --- | --- | --- | --- | --- | --- | --- |
| **PROPOSED** | `listening` | object | Yes for both Listening types | Plain JSON object; no arrays/accessors/unknown version fallback | Import/admin source; reduced server-side | Pure contract |
| **PROPOSED** | `listening.version` | integer | Yes | Exactly `1` | Admin/import; learner DTO need not expose | Pure contract |
| **PROPOSED** | `listening.partLabel` | string | No | Trimmed, 1–80; display only | Learner-visible | Pure contract + Vietnamese copy review |
| **PROPOSED** | `listening.audio` | object | Yes | Complete object; partial object invalid | Server/admin source | Pure contract |
| **PROPOSED** | `listening.audio.assetRef` | string | Yes | 1–240; same-origin path beginning `/media/listening/`; no query, fragment, backslash, `..`, control character, scheme, or credential syntax | Import/admin; learner receives a separately reduced `src` | Pure contract; future asset workflow confirms identity |
| **PROPOSED** | `listening.audio.mimeType` | enum string | Yes | Pilot allows only `audio/mpeg` | Learner-visible presentation | Pure contract; storage workflow confirms actual content type |
| **PROPOSED** | `listening.audio.byteLength` | integer | Yes | 1–15,728,640 bytes (15 MiB) | Admin/import; not required in learner DTO | Pure contract; storage workflow confirms actual bytes |
| **PROPOSED** | `listening.audio.durationMs` | integer | Yes | 5,000–900,000 ms | Learner-visible duration | Pure contract; technical normalization verifies file metadata without network import calls |
| **PROPOSED** | `listening.transcript` | object | Yes for publication | Complete object | Reduced by visibility policy | Pure contract + human transcript review |
| **PROPOSED** | `listening.transcript.text` | string | Yes | Trim outer whitespace; normalize CRLF to LF; 1–20,000; reject NUL and disallowed control characters; preserve paragraph breaks | Learner-visible only when policy/context permits | Pure contract + linguistic review |
| **PROPOSED** | `listening.transcript.languageTag` | string | Yes | Lower/standard BCP-47-like tag, 2–35; pilot recommendation `en`; dialect-specific policy requires owner approval | Learner/admin | Pure contract + linguistic review |
| **PROPOSED** | `listening.transcript.availabilityPolicy` | enum string | Yes | V1 value `AFTER_SUBMISSION`; assessment context may be stricter; accommodation is a separate authorized mode | Learner receives policy but transcript text only when released | Pure contract + server context |
| **PROPOSED** | `listening.attribution` | object | Yes | Complete object | Server/admin source | Pure contract |
| **PROPOSED** | `listening.attribution.displayText` | string | Yes | Trimmed, 1–240; truthful, learner-readable, no HTML | Learner-visible near player/transcript | Pure contract + rights review |
| **PROPOSED** | `listening.rights` | object | Yes | Complete object | Server/admin only except visible attribution | Pure contract + rights reviewer |
| **PROPOSED** | `listening.rights.classification` | enum string | Yes | Recommended candidates: `OWNED`, `COMMISSIONED`, `DIRECT_PERMISSION`, `CC_BY_4_0`, `CC_BY_SA_4_0`, `PUBLIC_DOMAIN`; publication subset requires owner approval | Server/admin only | Pure contract + rights reviewer |
| **PROPOSED** | `listening.rights.evidenceRef` | string | Yes | Opaque internal reference, 1–200; no URL query/fragment, secret, personal data, or raw document | Server/admin only | Pure contract + rights reviewer |
| **PROPOSED** | `listening.unavailableBehavior` | enum string | Yes | Exactly `BLOCK_PROBLEM` in v1 | Learner behavior, not raw authored copy | Pure contract + renderer |
| **REJECTED** | `listening.sectionType` as a second discriminator | — | — | `Question.type` remains authoritative. `partLabel` is presentation only. | — | — |

The proposed byte/duration limits are pilot defaults, not evidence about current
files. Any increase requires a separate cost, performance, and interaction
review.

### 6.3 Separate answer contracts

| Status | Type | Authoring model | Learner input | Scoring | Publication requirement |
| --- | --- | --- | --- | --- | --- |
| **PROPOSED** | `LISTENING_MCQ` | `options`: exactly 3 or 4 objects with unique canonical IDs `A`–`D`, each `text` 1–500; `answer.correctOptionId`: one member ID | One native radio selection, submitted as a string ID | Trim/uppercase exact ID; malformed configuration or blank input is false, never blank-equals-blank true | Complete media descriptor; one defensible answer; options, ID membership, distractors, transcript, rights, rendering, and human linguistic review |
| **PROPOSED** | `LISTENING_SHORT_ANSWER` | `answer.acceptedAnswers`: 1–8 unique non-blank strings, each 1–120; `display` never authorizes scoring | One labelled text input, maximum 120 code points | Existing deterministic text normalization and exact match against the reviewed set; no fuzzy/AI scoring | Complete media descriptor; bounded variants; spelling, contraction, numeral, dialect, and ambiguity review |

**PROPOSED alias policy:** `correctOption` and `accepted` remain import-only
deprecated aliases for backward compatibility and normalize to canonical
fields. A display-only answer is a fatal answer defect. Runtime scoring reads
canonical fields and independently fails closed.

### 6.4 Data-boundary classification

| Status | Data class | Proposed fields/examples | Boundary |
| --- | --- | --- | --- |
| **PROPOSED** | Learner-visible presentation | Resolved same-origin `src`, MIME, duration, allowed transcript policy/text, `partLabel`, attribution, safe options/input configuration | Positive DTO only |
| **PROPOSED** | Server/admin-only evidence | Rights classification, `evidenceRef`, raw descriptor, repair issues, canonical answers, accepted variants, explanations before the normal review path | Server-only projector/admin authorization |
| **PROPOSED** | Import-authoring data | Full versioned descriptor, canonical answer, aliases before normalization, source collection references | Dry-run/import/admin only |
| **DEFERRED** | Storage/provider lifecycle data | Provider object key, bucket, checksum, upload response, signed URL, deletion receipt, backup class | Dedicated server-only asset workflow; never learner metadata |

**CURRENT limitation:** Prisma JSON cannot enforce or select nested public and
internal fields independently. The existing learner selector loads full
`metadata` on the server and the mapper drops unapproved keys.

**PROPOSED smallest boundary:** a `server-only` Listening source reader/projector
must immediately reduce the complete JSON to an all-or-nothing DTO, following
the Writing pattern. The common learner DTO must never spread raw metadata.

**DEFERRED stronger boundary:** if object storage or rights operations are
approved, add a dedicated server-only asset record keyed by `assetRef`; move
`rights.evidenceRef` and provider lifecycle data there. This requires a
separately approved schema/migration PR and is not part of this contract PR.

## 7. URL/storage decision matrix

| Status | Option | Fit with current architecture | Benefits | Risks/tradeoffs | Decision |
| --- | --- | --- | --- | --- | --- |
| **PROPOSED** | Same-origin managed/static asset under a versioned `/media/listening/` path | Current renderers accept relative paths and the repo has `public/`; no audio file currently exists | No third-party request/referrer, stable URL, simple CORS, deterministic pilot | Public by default, repository/deployment size, Git history retention, replacement requires versioning | Recommended bounded pilot default, subject to owner approval of public access and repository/deployment cost |
| **DEFERRED** | Controlled object storage/CDN | Architecture can carry a resolved URL, but no provider/asset registry is proven | Better range delivery, scale, replacement, retention, and operational controls | Provider cost, credentials, CORS, signed URL expiry, access policy, deletion and backup lifecycle | Evaluate only in storage integration PR after owner approval |
| **REJECTED** | Arbitrary external HTTPS URL authored per question | Raw `audioUrl` currently permits it | Low initial implementation effort | Tracking, referrer/privacy, hotlink/rights, expiry, content replacement, CORS/range/type failures, no deletion control | Reject for publication; HTTPS is necessary but not sufficient |

### 7.1 Operational rules

| Status | Area | Proposed rule |
| --- | --- | --- |
| **PROPOSED** | HTTPS/origin | Learner `src` is same-origin. If a controlled CDN is later approved, allow only an exact configured origin resolved server-side; never accept arbitrary authored origins. |
| **PROPOSED** | Privacy/referrer | Avoid third-party playback requests by default. A future CDN review must cover request logs, IP/user-agent handling, referrer policy, cookies, and data-processing terms. |
| **PROPOSED** | Stable identity | `assetRef` is the authored identity. Raw provider URLs, signed URLs, upload responses, and credentials are not authored content. |
| **PROPOSED** | URL expiry | Canonical content must not contain expiring URLs. A server resolver may mint a delivery URL at request time only if authenticated delivery is approved. |
| **PROPOSED** | CORS/range | Same-origin is the pilot baseline. A future CDN must support expected `Content-Type`, byte ranges, caching, and allowed origins before learner use. |
| **PROPOSED** | MIME/type | Authoring says `audio/mpeg`; technical normalization verifies the file signature/metadata and served `Content-Type` within the managed asset workflow. File extension alone is insufficient. |
| **PROPOSED** | Size/duration | Publication requires the declared values within 15 MiB and 5–900 seconds and a managed-workflow verification match. Import does not make a live request. |
| **PROPOSED** | Replacement | Never replace bytes silently at the same `assetRef`. Create a versioned reference, re-run transcript/answer/rendering/rights review, then repoint content through controlled review. |
| **DEFERRED** | Retention/deletion | Owner must approve active-asset retention, superseded-version retention, backup retention, legal hold, deletion evidence, and orphan cleanup. |
| **DEFERRED** | Provider lifecycle | Provider selection, access keys, bucket policy, upload, observability, outage handling, backup, export, and deletion are separate from question import. |
| **CURRENT** | H-11 | General at-rest, retention, deletion, and provider lifecycle debt remains partially remediated elsewhere. A Listening asset workflow adds scope; this design does not close H-11. |

## 8. Transcript/accessibility decision

### 8.1 Canonical transcript

| Status | Decision | Rationale/tradeoff | Failure behavior |
| --- | --- | --- | --- |
| **PROPOSED** | Plain Unicode text with LF paragraph breaks, not HTML, rich text, captions JSON, or timestamps in v1 | Deterministic, safe to project, easy to review; speaker timing is deferred | Missing/malformed transcript is a warning in ordinary `NEEDS_REVIEW` import and a publication blocker everywhere else |
| **PROPOSED** | `languageTag` is required | Supports pronunciation/dialect review and assistive presentation | Invalid/missing tag blocks publication |
| **PROPOSED** | Transcript is linguistically reviewed against the normalized audio | Structural length checks cannot prove accuracy | Any unresolved mismatch blocks publication |
| **REJECTED** | Inferring transcript, attribution, or rights from audio, filenames, prompt, explanation, AI, or provider metadata | Such inference can be false and unreviewed | Require authored human-reviewed evidence |

### 8.2 Visibility by mode

| Status | Mode/state | Recommended visibility | Assessment effect |
| --- | --- | --- | --- |
| **PROPOSED** | Gym practice before/during attempt | Hidden by default | Listening remains the measured skill |
| **PROPOSED** | Gym practice after submission | Available below the player and attribution | Does not change stored correctness; it supports review |
| **PROPOSED** | Diagnostic during ordinary attempt | Hidden | Listening may contribute only when media contract and calibration gates pass |
| **PROPOSED** | Contest during ordinary attempt | Hidden | Contest validity is preserved |
| **PROPOSED** | Diagnostic/contest after finalization | Release only when the assessment/review window permits; owner approval required | Never expose active answer-bearing explanations through transcript timing or annotations |
| **PROPOSED** | Explicit accommodation mode during attempt | Available on request with a clear notice | Do not silently treat the result as equivalent Listening evidence. Recommended: exclude Listening from diagnostic level/calibration; contest ranking treatment requires owner approval |

Always-visible transcripts improve access but can convert a Listening item into a
Reading item. Englishphile must expose this tradeoff, not claim that one mode
simultaneously provides identical access and identical Listening validity.

**PROPOSED:** transcript visibility itself does not rewrite an answer or change
the deterministic scorer. The surrounding attempt policy decides whether that
Listening score is included in diagnostic/calibration/ranking.

**CURRENT/PROPOSED limitation:** this contract does not claim WCAG or full
accessibility compliance. Human keyboard, screen-reader, transcript, language,
contrast, reflow, and accommodation review remains mandatory.

## 9. Playback UX contract

| Status | Concern | Proposed behavior | Rationale/failure |
| --- | --- | --- | --- |
| **PROPOSED** | Player | Native `<audio controls preload="metadata">` for v1; explicit Vietnamese accessible name includes problem/part label | Semantic baseline; exact browser control surface varies |
| **PROPOSED** | Autoplay | Never autoplay | Avoid surprise audio and accessibility/privacy problems |
| **PROPOSED** | Play/pause | Required | Keyboard and pointer operable; state announced by native control where supported |
| **DEFERRED** | Seek | Recommended allowed for practice; diagnostic/contest policy needs owner approval | Native controls cannot reliably enforce a secure restriction |
| **DEFERRED** | Replay | Recommended unlimited for practice; assessment limit needs owner approval | Client-side counts are bypassable and must not be marketed as secure |
| **DEFERRED** | Speed | Recommended learner-controlled in practice and standard speed in assessment; owner approval required | Browser-native speed availability varies; restrictions are not strong security |
| **PROPOSED** | Volume | Native volume/mute control; never force volume | Respects user/device settings |
| **PROPOSED** | Loading/buffering | Show fixed Vietnamese loading/status text; keep answer controls unavailable until the media element reaches a usable state | Prevent silent guessing during an unresolved load |
| **PROPOSED** | Network failure | Announce “Không thể tải audio. Bài nghe tạm thời chưa khả dụng.” and block the complete Listening problem/section | No score or submission for affected Listening questions |
| **PROPOSED** | Unsupported media | Same unavailable state; include no fallback URL to an uncontrolled origin | Fail closed |
| **PROPOSED** | Keyboard/screen reader | Label player, transcript toggle, retry action, status region, and answer group with question-specific IDs; verify tab order and visible focus manually | Icons alone are insufficient |
| **PROPOSED** | Reduced motion | Do not animate progress/waveforms; native control remains usable. Any future custom visualization respects `prefers-reduced-motion` | Audio itself is not motion, but decorative playback animation can be |
| **PROPOSED** | Multiple players | At most one active player per page; starting another pauses the first. Do not auto-start it | Reduces overlapping speech and cognitive load |
| **PROPOSED** | State preservation | Preserve answer and current playback position during ordinary in-page rerender; do not persist playback history across sessions by default | Cross-session persistence adds privacy and stale-state complexity |
| **PROPOSED** | Submitted/review state | Disable answer controls after submission; practice may replay and reveal transcript/attribution; assessment follows its release policy | Review does not resubmit |
| **PROPOSED** | Placement | Player before the associated prompt group; attribution immediately below; transcript after attribution when released | Clear relationship and reading order |
| **REJECTED** | False anti-cheating claims | Do not state that browser controls securely prevent seeking, replaying, downloading, recording, or devtools access | Normal browser clients cannot guarantee those restrictions |

## 10. Import/publication severity matrix

### 10.1 Proposed issue-code families

All codes are deterministic and carry an exact question path. They are design
names, not implemented output.

| Family | Exact proposed codes |
| --- | --- |
| Answer/prompt fatal defects | `LISTENING_PROMPT_REQUIRED`, `LISTENING_MCQ_OPTIONS_REQUIRED`, `LISTENING_MCQ_OPTION_COUNT_INVALID`, `LISTENING_MCQ_OPTION_ID_INVALID`, `LISTENING_MCQ_OPTION_ID_DUPLICATE`, `LISTENING_MCQ_OPTION_TEXT_INVALID`, `LISTENING_MCQ_CORRECT_OPTION_REQUIRED`, `LISTENING_MCQ_CORRECT_OPTION_NOT_IN_OPTIONS`, `LISTENING_SHORT_ACCEPTED_REQUIRED`, `LISTENING_SHORT_ACCEPTED_INVALID`, `LISTENING_SHORT_ACCEPTED_TOO_MANY`, `LISTENING_SHORT_ACCEPTED_TOO_LONG`, `LISTENING_SHORT_ACCEPTED_DUPLICATE` |
| Descriptor/media | `LISTENING_DESCRIPTOR_REQUIRED`, `LISTENING_VERSION_UNSUPPORTED`, `LISTENING_AUDIO_REQUIRED`, `LISTENING_ASSET_REF_INVALID`, `LISTENING_MIME_UNSUPPORTED`, `LISTENING_BYTE_LENGTH_INVALID`, `LISTENING_DURATION_INVALID`, `LISTENING_UNAVAILABLE_BEHAVIOR_INVALID`, `LISTENING_PART_LABEL_INVALID` |
| Transcript/accessibility | `LISTENING_TRANSCRIPT_REQUIRED`, `LISTENING_TRANSCRIPT_TEXT_INVALID`, `LISTENING_TRANSCRIPT_LANGUAGE_INVALID`, `LISTENING_TRANSCRIPT_POLICY_INVALID`, `LISTENING_TRANSCRIPT_REVIEW_REQUIRED`, `LISTENING_ACCESSIBILITY_REVIEW_REQUIRED` |
| Rights/attribution | `LISTENING_ATTRIBUTION_REQUIRED`, `LISTENING_ATTRIBUTION_INVALID`, `LISTENING_RIGHTS_CLASSIFICATION_REQUIRED`, `LISTENING_RIGHTS_CLASSIFICATION_NOT_PERMITTED`, `LISTENING_RIGHTS_EVIDENCE_REQUIRED`, `LISTENING_RIGHTS_EVIDENCE_INVALID`, `LISTENING_RIGHTS_REVIEW_REQUIRED` |
| Legacy aliases | `LISTENING_LEGACY_AUDIO_URL`, `LISTENING_LEGACY_SECTION_TYPE`, `LISTENING_LEGACY_CORRECT_OPTION`, `LISTENING_LEGACY_ACCEPTED` |
| Managed-asset/runtime | `LISTENING_ASSET_RECORD_MISSING`, `LISTENING_ASSET_METADATA_MISMATCH`, `LISTENING_MEDIA_UNAVAILABLE`, `LISTENING_MEDIA_CONTENT_TYPE_MISMATCH` |

### 10.2 Defect classes

| Status | Class | Ordinary `NEEDS_REVIEW` import | Publication meaning |
| --- | --- | --- | --- |
| **PROPOSED** | Fatal answer defect | `error`; invalid question is not normalized into a scoring-authoritative item | Always blocks |
| **PROPOSED** | Repairable media/descriptor defect | `warning`; retain bounded draft for admin repair | Promote to blocking error |
| **PROPOSED** | Rights/licensing defect | `warning` only when bounded evidence fields are missing/invalid in a review import; never treated as permission | Always blocks until human rights sign-off |
| **PROPOSED** | Transcript/accessibility defect | `warning` for repairable structure/review gaps | Always blocks publication; an owner-approved accommodation policy is also required before assessment use |
| **PROPOSED** | Runtime/network availability | No live request; no permanent pass can be proven at import | Runtime fail-closed state and operational monitoring; managed asset verification may be rechecked before publication |

### 10.3 Boundary matrix

| Boundary | Fatal answer defects | Media descriptor | Rights/transcript/accessibility | Network/provider request | Required proposed result |
| --- | --- | --- | --- | --- | --- |
| Ordinary JSON/CSV import to `NEEDS_REVIEW` | Error | Exact-path warning when repairable | Exact-path warning | Prohibited | Retain only bounded repairable drafts; `isDiagnosticEligible=false` |
| Immediate publication | Error | Error | Error | Prohibited | No published write |
| Persisted QA | `ERROR` | `ERROR` | `ERROR` until evidence/sign-off exists | No permanent network proof | `canPublish=false` |
| Individual publish | Error | Error | Error | No live importer fetch | Reject before status write |
| Edit-to-publish | Error on complete candidate snapshot, including omitted stored questions | Error | Error | No live importer fetch | Atomic reject |
| Ordinary bulk publish | Error on every target | Error | Error | No live importer fetch | All-or-nothing reject |
| Bulk `publish-safe` | QA error | QA error | QA error | No permanent network proof | Select only safe IDs, then recheck |
| Transaction-locked recheck | Reload canonical rows; run same pure contract | Re-run under lock | Re-run under lock | Managed asset registry check only if local/server-owned and bounded; no arbitrary external fetch | No time-of-check/time-of-write bypass |

**PROPOSED:** importer validation must remain database-free and make no live
network request. A later managed-asset workflow may validate bytes, MIME,
duration, and ownership at upload/normalization time and store a verified asset
record. It still cannot prove permanent future availability.

## 11. Learner DTO and admin boundary

### 11.1 Minimal learner DTO

**PROPOSED:** use a discriminated, all-or-nothing common presentation:

```ts
type ListeningPresentationDTO =
  | {
      state: "READY";
      src: string;
      mimeType: "audio/mpeg";
      durationMs: number;
      partLabel: string | null;
      attributionText: string;
      transcriptPolicy: "AFTER_SUBMISSION";
      transcript: { text: string; languageTag: string } | null;
    }
  | {
      state: "UNAVAILABLE";
      messageCode: "LISTENING_MEDIA_UNAVAILABLE";
    };
```

| Type | Additional learner-safe fields | Explicitly absent |
| --- | --- | --- |
| `LISTENING_MCQ` | `options: Array<{id: "A" \| "B" \| "C" \| "D"; text: string}>` with exactly 3 or 4 valid entries | `correctOptionId`, `correctOption`, option repair metadata |
| `LISTENING_SHORT_ANSWER` | `input: {kind: "text"; maxLength: 120; autoComplete: "off"}`; no options | `acceptedAnswers`, `accepted`, `display` |

The DTO never exposes canonical answers, accepted variants, explanations before
the normal review path, raw metadata, internal rights evidence, provider
credentials, provider responses, signed administrative URLs, unpublished
transcript text, or admin repair issues.

**PROPOSED failure behavior:** if media, type-specific answer presentation, or
contextual transcript projection is malformed, return `UNAVAILABLE`; render a
fixed Vietnamese notice and no MCQ or text-answer control. Do not emit a partial
ready DTO. The containing form must refuse submission for that blocked
Listening problem/section.

**PROPOSED selector boundary:** preserve positive Prisma selection. Because
Prisma cannot select JSON subfields, load `metadata` only inside a server-only
path, immediately project it, and pass only the DTO across Client Component,
RSC, API, diagnostic, random-practice, and contest boundaries.

### 11.2 Minimum future admin review evidence

| Status | Evidence | Minimum record |
| --- | --- | --- |
| **PROPOSED** | Asset identity | `assetRef`, version, declared and verified MIME/bytes/duration |
| **PROPOSED** | Playback verification | Browser/viewport, play/pause/seek/volume/buffering/failure result, evidence reference |
| **PROPOSED** | Transcript review | Audio/transcript match, language/dialect note, reviewer initials/role/date |
| **PROPOSED** | Attribution | Exact learner-visible text |
| **PROPOSED** | Rights/licence | Classification, internal evidence reference, permitted-use decision, reviewer initials/role/date |
| **PROPOSED** | Fallback | Unavailable state blocks controls and submission |
| **PROPOSED** | Learner rendering | Problem detail, random practice, diagnostic exclusion/readiness, and relevant contest path |
| **PROPOSED** | Accessibility | Keyboard, focus, screen-reader label/status, transcript policy, reflow/contrast, accommodation decision |
| **PROPOSED** | Answer validation | MCQ membership or bounded short-answer variants plus scorer fixtures |
| **PROPOSED** | Human linguistic review | Audio naturalness, transcript accuracy, prompt, distractors/variants, explanation, bias, dialect |
| **PROPOSED** | Difficulty/calibration | Pre-publication rating and `DRAFT`/`PROVISIONAL`/`STABLE`; diagnostic remains blocked until required status |
| **PROPOSED** | Reviewer attribution | Role/initials and ISO date only; no learner personal data or reviewer email required |

Admin preview remains a narrow problem review surface, not a broad admin
redesign. Raw repair data stays authorized/server-only; the production renderer
must receive the same learner-safe presentation projection.

## 12. Rights/licensing and lifecycle workflow

| Step | Status | Required future action and exit gate |
| ---: | --- | --- |
| 1 | **PROPOSED** | Source or create audio; record the intended task, speakers, dialect, and source identity. |
| 2 | **PROPOSED** | Verify ownership, licence, or direct permission; project owner approves permitted licence categories before implementation. |
| 3 | **PROPOSED** | Store the opaque evidence reference in server/admin data and the actual rights document outside learner-visible DTOs and question JSON where possible. |
| 4 | **PROPOSED** | Create a plain-text transcript; never infer or fabricate it. |
| 5 | **PROPOSED** | Complete independent English linguistic, transcript, dialect, ambiguity, answer, and distractor review. |
| 6 | **PROPOSED** | Normalize technical media to approved MIME/size/duration; assign a stable versioned `assetRef`; verify metadata in the controlled asset workflow. |
| 7 | **PROPOSED** | Author canonical JSON and import as `NEEDS_REVIEW`; never immediate-publish pilot Listening. |
| 8 | **PROPOSED** | Run repository/import audit and disposition every deterministic issue without live network validation. |
| 9 | **PROPOSED** | Use admin preview to inspect safe learner projection plus authorized repair evidence. |
| 10 | **PROPOSED** | Verify all learner render paths and fail-closed behavior. |
| 11 | **PROPOSED** | Complete human playback, keyboard, screen-reader, transcript, attribution, rights, and linguistic QA. |
| 12 | **PROPOSED** | Publish only through controlled `publish-safe` after transaction-locked recheck; keep diagnostic eligibility false. |
| 13 | **PROPOSED** | Calibrate with bounded first-attempt evidence and exclude accommodation-assisted Listening attempts from ordinary Listening calibration. |
| 14 | **DEFERRED** | Replace, retain, archive, and delete according to an owner-approved asset/provider/backup lifecycle; re-review every replacement. |

**REJECTED/prohibited:**

- unlicensed scraped audio;
- hotlinking without explicit permission and controlled-origin approval;
- fabricated attribution, rights evidence, transcript, or permission;
- AI-generated provenance claims;
- personal data, secrets, cookies, signed provider responses, or raw rights
  documents in learner-visible metadata;
- Production import before local/Preview dry-run and review evidence is approved;
- publishing because a URL returned once, a file extension looks correct, or an
  automated structural check passed.

## 13. Existing-content migration classification

### 13.1 Repository items

| Classification | Problems | Questions | Decision |
| --- | ---: | ---: | --- |
| Structurally compatible with the proposed contract | 0 | 0 | **CURRENT:** no Listening pack item exists |
| Repairable legacy Listening content | 0 | 0 | **CURRENT:** none exists in selected pack files |
| Missing required future media fields | 0 | 0 | **CURRENT:** no Listening item to classify |
| Blocked from publication | 0 | 0 | **CURRENT:** no repository Listening item; future drafts remain blocked until implementation |
| Requiring human content review | 0 | 0 | **CURRENT:** no repository Listening item; every future item requires review |

Synthetic tests, enum values, documentation examples, Prisma fields, the local
Excel template, and contest-builder scaffolding are not content items and are
not included in these counts. Unknown database rows are outside the evidence
boundary and must not be inferred.

### 13.2 Legacy normalization policy

| Status | Legacy field | Recommendation | Publication effect |
| --- | --- | --- | --- |
| **PROPOSED** | `metadata.audioUrl` with a valid same-origin `/media/listening/` path | Supported deprecated import alias for `listening.audio.assetRef` only in `NEEDS_REVIEW`; preserve an exact warning and require all other canonical fields | Alias alone never permits publication |
| **REJECTED** | `metadata.audioUrl` containing arbitrary external HTTPS, data, blob, credentialed, query-signed, or relative traversal URL | Do not auto-normalize; manual rights/storage migration required | Block publication |
| **PROPOSED** | `metadata.sectionType` | Supported deprecated display alias to `listening.partLabel` when it is a bounded string; never use it to choose scorer/renderer type | Alias warning; `Question.type` remains authoritative |
| **PROPOSED** | `answer.correctOption` | Supported deprecated import alias to `correctOptionId` | Canonical membership required before publication |
| **PROPOSED** | `answer.accepted` | Supported deprecated import alias to `acceptedAnswers` | Canonical bounded variants required before publication |
| **REJECTED** | Missing transcript, rights, attribution, duration, byte length, MIME, or evidence reference | Never synthesize from legacy fields | Manual migration and human review required |

## 14. Acceptance criteria

This documentation PR is accepted only when:

- the repository inventory reports exactly 0 Listening problems and 0
  Listening questions, with 0 for both types and every difficulty;
- every current-state claim identifies repository evidence and does not imply
  database, asset, provider, licence, transcript, Preview, or Production proof;
- both Listening types remain separate through answer, input, scoring,
  publication, DTO, and migration decisions;
- the descriptor has exact fields, types, bounds, visibility, validation
  ownership, failure behavior, and migration policy;
- storage options, transcript validity, playback, accessibility, DTO, admin
  review, rights lifecycle, and all publication paths have explicit status;
- material owner decisions remain open rather than silently selected;
- no runtime, schema, migration, package, lockfile, test, importer, scorer, DTO,
  renderer, content pack, media, database, provider, or deployment file changes;
- all changes remain unstaged.

Future implementation is accepted only after owner approval of the blocking
open questions and after each small PR meets its own criteria below.

## 15. Small-PR implementation sequence

| PR | Status | Scope and acceptance criteria | Must not contain |
| ---: | --- | --- | --- |
| 1 | **PROPOSED** | Pure Listening descriptor and separate answer contracts; JSON/CSV normalization; deterministic issue codes; repository audit; persisted QA; immediate, individual, edit, ordinary bulk, `publish-safe`, and transaction-locked enforcement; synthetic fixtures prove both types and every severity transition | Real audio/transcript/licence data, network requests, schema/migration, DTO/UI, import/publication execution |
| 2 | **IMPLEMENTED** | Server-only source/projector, all-or-nothing learner DTO, positive Prisma selectors, admin-preview projection, non-disclosure/fail-closed tests across problem, random, diagnostic, and contest boundaries | Player UI, storage provider, content repair, schema unless separately approved |
| 3 | **PROPOSED** | Playback renderer and accessibility states: no autoplay, labels/status, one active player, loading/buffering/failure, submitted/review state, transcript/attribution placement, keyboard and structural tests; diagnostic/problem-backed contest must not show silent guessing controls | Provider integration, false replay/seek security, real content, broad admin redesign |
| 4 | **DEFERRED** | Storage/asset workflow if required: owner-approved access/origin/provider, stable resolver, upload normalization, MIME/signature/bytes/duration verification, range/CORS checks, replacement, retention/deletion runbook, synthetic or owned test asset | Arbitrary external URLs, secrets in metadata, unapproved provider cost, Production upload |
| 5 | **PROPOSED** | Human-reviewed repair/migration of any existing database Listening rows discovered through a separately authorized process; classify every item, retain `NEEDS_REVIEW`, attach rights/transcript evidence, verify learner/admin rendering | Silent inference, mass publication, database access without authorization, invented provenance |
| 6 | **PROPOSED** | Small pilot batch only after contract and asset workflow approval; one problem per type, bounded B2/C1 scope, original/licensed audio, independent linguistic/accessibility/rights review, dry-run, Preview evidence, controlled publish, diagnostic eligibility false | HSG, broad batch, immediate publish, Production-first import, calibration or accessibility completion claims |

Dependencies are explicit: PR 2 depends on PR 1; PR 3 depends on PR 2; PR 4 is
required before real assets unless the owner approves the bounded same-origin
static pilot; PR 5 depends on PRs 1–4 as applicable; PR 6 depends on every prior
approved gate.

## 16. Explicit non-goals and deferred decisions

| Status | Item |
| --- | --- |
| **REJECTED** | Merging the two Listening question types |
| **REJECTED** | Binary/base64 audio in Prisma JSON or database text |
| **REJECTED** | Arbitrary external URLs, unlicensed scraping, unapproved hotlinking, fabricated evidence, or live importer network validation |
| **REJECTED** | AI scoring, transcript generation, provenance generation, or answer inference |
| **REJECTED** | Restoring classroom, assignment, teacher, or manual-grading application surfaces |
| **DEFERRED** | Object-storage provider, cost, upload UI, authenticated/signed delivery, asset registry schema, checksum strategy, backups, and provider observability |
| **DEFERRED** | Captions/timed transcript formats, waveform visualization, offline playback, service-worker caching, and playback analytics |
| **DEFERRED** | Secure exam-browser controls; normal browser replay/seek/download restrictions are not a security boundary |
| **DEFERRED** | Dialect taxonomy, permitted licence subset, retention duration, deletion SLA, orphan cleanup, and legal hold |
| **DEFERRED** | Diagnostic/contest transcript accommodation and ranking policy |
| **DEFERRED** | Any content authoring, repair, import, publication, migration, seed, upload, deployment, or provider request |

## 17. Open questions requiring project-owner approval

| Status | Decision requiring approval | Recommended option | Alternatives | Learner/product/security impact | Approval required before |
| --- | --- | --- | --- | --- | --- |
| **DEFERRED** | Storage/provider cost | Bounded same-origin static pilot using versioned paths, then reassess | Controlled object storage/CDN now | Static is simple/private-from-third-parties but public and adds deploy/Git weight; object storage adds cost/credentials/lifecycle | Any asset integration or pilot content |
| **DEFERRED** | Public vs authenticated audio access | Public same-origin only for non-sensitive, fully licensed pilot audio | Authenticated proxy; short-lived signed CDN URL | Public is cacheable/simple but redistributable; authenticated delivery adds cost, expiry, privacy, and outage paths without preventing recording | DTO `src` resolver and deployment |
| **DEFERRED** | Transcript during assessment | Hidden during ordinary attempt; explicit accommodation excludes Listening from diagnostic level/calibration | Always visible; accommodation with equivalent scoring | Visibility improves access but changes measured construct; silent inclusion can invalidate level evidence | Diagnostic/contest Listening |
| **DEFERRED** | Replay limits | Unlimited in Gym; no limit in diagnostic pilot unless a reliable product reason is approved | One/two plays; custom counter | Limits may increase anxiety and are bypassable; unlimited replay changes difficulty but is honest and reliable | Playback renderer policy |
| **DEFERRED** | Seek policy | Allow in Gym; allow in ordinary diagnostic pilot and calibrate accordingly | Disable/custom UI in assessment | Native enforcement is unreliable; restriction can harm keyboard/screen-reader access | Playback renderer policy |
| **DEFERRED** | Playback speed | Learner-controlled in Gym; standard-only assessment UI without security claims | Always controlled; always standard | Speed supports access/practice but changes timing/construct | Playback renderer policy |
| **DEFERRED** | Dialect policy | Record dialect/accent in review evidence; pilot with clearly identified, pedagogically relevant varieties | One reference accent only; broad mix immediately | Affects fairness, accepted answers, difficulty, and curriculum representation | Audio sourcing and linguistic review |
| **DEFERRED** | Permitted licence categories | `OWNED`, `COMMISSIONED`, `DIRECT_PERMISSION`, clearly documented `CC_BY_4_0`, `CC_BY_SA_4_0`, and `PUBLIC_DOMAIN` | Owned/direct permission only; broader open licences | Determines attribution, share-alike obligations, reuse, and legal review burden | Rights validator and content sourcing |
| **DEFERRED** | Retention duration | Keep active version while published; define a bounded superseded/backups window before implementation | Indefinite; immediate delete after supersede | Affects rollback, rights withdrawal, cost, backups, and H-11 debt | Storage workflow |
| **DEFERRED** | Deletion policy | Versioned archive, stop delivery immediately on rights withdrawal, then delete primary/backups under a documented SLA | Manual best-effort; permanent archive | Affects legal/rights response, recovery, evidence, and provider guarantees | Storage/provider contract |
| **DEFERRED** | Assessment accommodation/ranking | Diagnostic excludes accommodation-assisted Listening from level; contest uses a separately approved non-ranked or equivalent-accommodation policy | Include unchanged; disable transcript accommodations | Avoids silently invalid measurement while preserving an access path | Diagnostic or contest publication |

Until these approvals exist, the implementation contract may be developed only
with synthetic fixtures and no real media. Listening content remains
`NEEDS_REVIEW`, unpublished, and diagnostic-ineligible.
