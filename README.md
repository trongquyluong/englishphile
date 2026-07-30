# Englishphile

Englishphile is a personalized English practice platform for students preparing for specialized English exams. The product is diagnostic-first: learners check their level, receive recommended practice, work independently by ability, and track progress through Gym practice, Contests, Wiki notes, analytics, and wrong-question review.

Important: this platform is not organized by “Day”. If uploaded files contain `DAY` in their names, treat that only as source metadata. The core structure is:

`Gym mode → Skill → Topic → Difficulty → Problem / Exercise Set → Question`

## Product Vision

Englishphile helps students identify their current level, understand weak skills/topics, and practice from a curated bank of published exercises. Recommendations are deterministic and explainable, using diagnostic results, wrong answers, weak topics, and not-yet-solved published problems.

Primary navigation:

- Trang chủ
- Gym
- Contests
- Wiki
- Về Englishphile

Gym contains Reading, Writing, Listening, and Use of English. Use of English contains pronunciation, MCQ, cloze, word formation, sentence transformation, error identification, trios, collocations, phrasal verbs, transitions, and grammar focus.

Englishphile is operated by a site owner/admin. Public signup creates normal learner accounts only; users do not choose roles. Classroom and assignment application routes are decommissioned, while their historical database rows remain temporarily.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM with PostgreSQL (Neon or another isolated PostgreSQL service)
- Local signed-cookie auth scaffold
- Zod validation for imports
- Lucide React icons

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
# Optional only for a fresh demo database. Do not run on populated beta data.
# npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL=""
DIRECT_URL=""
SESSION_SECRET="replace-with-a-long-random-secret"
AUTH_SECRET=""
CRON_SECRET=""
OWNER_EMAIL="owner@example.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CONTACT_EMAIL=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_WRITING_MODEL="@cf/meta/llama-3.1-8b-instruct-fast"
WRITING_AI_GLOBAL_DAILY_LIMIT="15"
NODE_ENV="development"
```

Generate a local session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env`. Local development must use a separate PostgreSQL database, such as an independent Neon project, and must never use production `DATABASE_URL` or `DIRECT_URL`. Production must configure `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, and `OWNER_EMAIL`. `AUTH_SECRET` is retained only as a legacy compatibility fallback when `SESSION_SECRET` is absent; new deployments should leave it empty.

Writing AI uses Cloudflare Workers AI directly (without AI Gateway). It is
disabled unless both Cloudflare credentials are present and the exact reviewed
model is configured. The learner policy is 2 successfully persisted grades per
UTC day. A provider attempt still consumes the site-wide UTC-day allowance,
which defaults to a conservative 15 and accepts an explicitly configured value
of at most 100. Recoverable failed grades retain only a bounded, opaque-keyed
draft in same-session browser storage for at most 24 hours. Keep the API token
server-only and give it only the Workers AI permission needed for the account.

The Phase 1D-D1 invalid-response recovery hotfix passes 10 focused files with
101 tests, the complete 57-file suite with 557 passed and 8 opt-in PGlite cases
skipped, Prisma validation/generation, typecheck, lint, the synthetic
Production build, and `npm audit --omit=dev`. Owner-attested Preview
evidence at hotfix commit `02e9ef357ab08b985fdc10abdead1303ca8cbe49`
records one successful real grade with the reviewed Llama model plus the
bounded failure/draft/review checks described in the D1 report. This is not
comprehensive provider/model coverage.

Owner-attested post-merge Production evidence records that merge commit
`f42d80f1c7cfaffdd877c68bab12d2fb2f48d9f7` reached a matching `READY`
Production deployment and passed the selected health, origin/auth, one-grade,
quota, refresh/review, admin/student, regression, and checked-log boundaries.
The D1 Writing invalid-response hotfix is Production-verified within those
boundaries. This is one real Production grade, not a second attempt or
comprehensive provider/model, managed-PostgreSQL, or provider-retention test.
It is not blanket security completion or public-signup release clearance.
Writing retention is unchanged, so H-11 remains **Partially remediated**. See
`docs/SECURITY_PHASE_1D_D1_WRITING_AI_REPORT.md`.

## Test Accounts And Signup

After seeding:

- Student: `student@example.com` / `password123`
- Admin account: `admin@example.com` / `password123`

Public signup asks for email, username, password, full name, school, and province/city, then creates a normal learner account. Site-owner/admin access is managed outside public signup.

## Owner/Admin Setup

Public signup never creates admin accounts. For local beta testing, create or sign up with the email configured in `OWNER_EMAIL`; that account is treated as the site owner for admin route access even if its stored role is still `STUDENT`.

Recommended local flow:

1. Set `OWNER_EMAIL` in `.env`.
2. Sign up with that email through the normal learner signup.
3. Open `/admin`.

Stored `ADMIN` accounts are global content administrators. A current database user whose normalized email matches `OWNER_EMAIL` receives the same content-admin access even when their stored role is `STUDENT`. `OWNER_EMAIL` is not a separate or stronger database role.

## Validation Commands

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
```

Do not run `npm run prisma:seed` on a populated local or production database unless you intentionally want to reset demo/imported data.

## Phase 2 Repository Content Audit

Run the database-free content-pack inventory and quality baseline:

```bash
npm run audit:content-packs
```

For machine-readable output:

```bash
npm run --silent audit:content-packs -- --format=json
```

The command uses the same pure file selector and JSON/CSV normalizers as the
real importer. It audits every file the importer would select, preserves the
split-file preference that ignores `00-all-in-one` mirrors when numbered split
files are present, and supports packs without a manifest. When a manifest is
present, its entries must match the complete importer-selected set in both
directions. Import-normalizer errors and manifest/inventory inconsistencies
produce a non-zero exit; normalizer warnings and quality heuristics such as
short explanations remain review signals. The command never connects to Prisma
or a database.

See [`docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md`](docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md)
for the canonical repository evidence boundary, learner/admin journey audit,
parsed inventory, controlled-beta backlog, difficulty rubric, curriculum
proposal, and first representative 21-problem/84-question batch.

See
[`docs/PHASE_2_CONTENT_QA_WORKFLOW.md`](docs/PHASE_2_CONTENT_QA_WORKFLOW.md)
for the pre-authoring lifecycle, operational rubric, difficulty calibration,
repository-backed contracts for all pilot types, the 21/84 acceptance
specification, and implemented-versus-manual admin workflow. Copy
[`content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md`](content-packs/CONTENT_PACK_REVIEW_TEMPLATE.md)
for one pack's review evidence.

See
[`docs/PHASE_2_LISTENING_CONTRACT.md`](docs/PHASE_2_LISTENING_CONTRACT.md)
for the documentation-only Listening inventory and proposed media, transcript,
rights, playback, publication, learner-DTO, migration, and small-PR contract.
Listening implementation and real content remain blocked until the documented
project-owner decisions are approved.

## Database Schema Overview

Main models:

- `User`, `UserProfile`
- `SourceCollection`
- `Topic`, `ProblemTopic`
- `Problem`, `Question`
- `TheoryNote`
- `Submission`, `SubmissionAnswer`
- `UserProblemStatus`
- `ImportBatch`
- `Classroom`, `ClassroomMember`
- `Assignment`, `AssignmentProblem`
- `AssignmentSubmission`, `AssignmentProblemSubmission`
- `ManualGrade`
- `ContentPack`
- `DiagnosticAttempt`
- `UserSkillProfile`, `UserTopicProfile`
- `LearningRecommendation`
- `Contest`, `ContestProblem`, `ContestAttempt`

Main enums:

- `Role`
- `SkillType`
- `QuestionType`
- `Difficulty`
- `SubmissionMode`
- `SubmissionStatus`
- `ProblemStatus`
- `SourceType`
- `ImportType`
- `ImportStatus`
- `ClassroomRole`
- `AssignmentType`
- `AssignmentStatus`
- `AssignmentSubmissionStatus`
- `ManualGradeCorrectness`
- `ContentStatus`
- `ContentPackStatus`
- `DiagnosticAttemptStatus`
- `RecommendationType`
- `RecommendationStatus`
- `ContestType`
- `ContestStatus`
- `ContestVisibility`
- `ContestAttemptStatus`

## Phase 2 Import System

Route: `/admin/import`

Admin users can upload JSON/CSV files or use the advanced manual paste workflow, run dry-run validation, inspect previews, review Vietnamese errors/warnings, and then import valid data into the database.

The import pipeline:

1. Parse JSON or CSV.
2. Validate enums, required fields, options, answers, and question-type-specific rules.
3. Detect duplicates.
4. Show dry-run summary.
5. Create or reuse source collections and topics.
6. Create new problems/questions.
7. Save an `ImportBatch` history record.

Real PDFs are not parsed yet. Convert PDF/DOCX content into approved JSON/CSV first. Admin should review imported questions before using them in real practice. Do not import copyrighted material unless you have the right to use it.

## JSON Import Format

```json
{
  "sourceCollection": {
    "name": "Admin JSON Source",
    "description": "Short source description",
    "originalFileName": "source-file.json",
    "sourceType": "JSON",
    "copyrightNote": "Original or licensed content only."
  },
  "problems": [
    {
      "title": "Word formation set",
      "slug": "word-formation-set",
      "skillType": "WORD_FORMATION",
      "questionType": "WORD_FORMATION",
      "difficulty": "CHUYEN",
      "statement": "Điền dạng đúng của từ trong ngoặc.",
      "instructions": "Xác định loại từ trước.",
      "estimatedMinutes": 10,
      "topics": ["Word Class", "Suffixes"],
      "questions": [
        {
          "type": "WORD_FORMATION",
          "skillType": "WORD_FORMATION",
          "difficulty": "CHUYEN",
          "prompt": "The answer showed real ____. (PRECISE)",
          "passage": null,
          "options": null,
          "answer": {
            "accepted": ["precision"],
            "display": "precision"
          },
          "explanation": "Sau real cần danh từ.",
          "rootWord": "PRECISE",
          "keyword": null,
          "targetSentence": null,
          "lineNumber": null,
          "metadata": {
            "wordClass": "noun",
            "note": "precise -> precision"
          }
        }
      ]
    }
  ]
}
```

### JSON Examples By Question Type

The `/admin/import` Templates tab contains copyable JSON examples for:

- Multiple Choice JSON
- Pronunciation JSON
- Word Formation JSON
- Sentence Transformation JSON
- Guided Cloze JSON
- Open Cloze JSON
- Error Identification JSON
- Trios / Gapped Sentences JSON
- Reading MCQ JSON
- Writing Prompt JSON

Repo example:

- `examples/import/word-formation-sample.json`

## CSV Import Format

Flat CSV format: each row is one question. Rows are grouped into problems by `problemSlug`, or by generated slug from `problemTitle` when `problemSlug` is empty.

Required columns:

```text
sourceName,problemTitle,problemSlug,skillType,questionType,difficulty,topicTags,statement,instructions,prompt,passage,optionsJson,answerJson,explanation,rootWord,keyword,targetSentence,metadataJson
```

Rules:

- `topicTags` can be comma-separated; quote the cell if it contains commas.
- `optionsJson`, `answerJson`, and `metadataJson` must be valid JSON strings when present.
- Empty optional fields are allowed.
- MCQ-like questions require `optionsJson` and `answerJson.correctOptionId`.
- Text-answer questions use `answerJson.accepted` or `answerJson.acceptedAnswers`.

Repo example:

- `examples/import/mcq-sample.csv`

## Duplicate Behavior

- Existing topics are reused by name or slug.
- Existing source collections are reused by matching `name`.
- Existing problem slugs are skipped.
- Duplicate questions inside the same imported problem are skipped when prompt + answer match.
- Exact duplicate database questions are skipped.
- High-similarity duplicate questions (`>= 0.90`) are skipped automatically.
- Possible duplicate questions (`0.75-0.89`) are imported as `NEEDS_REVIEW` and blocked by QA until reviewed.
- Phase 2 does not support overwrite.

## Phase 3 Content Lifecycle

Englishphile separates admin content lifecycle from learner progress.

`contentStatus` is an editorial/admin state:

- `DRAFT` = Bản nháp
- `NEEDS_REVIEW` = Cần duyệt
- `PUBLISHED` = Đã xuất bản
- `ARCHIVED` = Đã lưu trữ

`UserProblemStatus` is a learner progress state:

- `NOT_ATTEMPTED`
- `ATTEMPTED`
- `SOLVED`
- `WRONG`
- `NEEDS_REVIEW`

Do not confuse these two concepts. A problem can be `PUBLISHED` while a student has `WRONG`, or a problem can be `ARCHIVED` while historical wrong-answer records remain visible.

### Review Workflow

Imported JSON/CSV content defaults to `NEEDS_REVIEW`. In `/admin/import`, admin users can check “Publish ngay sau khi import” only when the content has already been reviewed.

Admin workflow:

1. Import JSON/CSV from `/admin/import`.
2. Open `/admin/review` to see draft or needs-review problems.
3. Use “Chỉnh sửa” to fix metadata, JSON answer fields, topics, source, and question content.
4. Use `/admin/problems/[id]/preview` to render the problem as a student without saving submissions.
5. Publish only when all questions have valid answers/options.
6. Archive content that should not appear in the student problem bank.

Student-facing `/problems`, Gym pages, random practice, skill counts, and dashboard recommendations show only `PUBLISHED` problems by default. Admin-compatible accounts can toggle draft/review visibility in the problem bank.

### Admin Management

Phase 3 admin routes:

- `/admin/review` - review queue for `DRAFT` and `NEEDS_REVIEW`
- `/admin/problems` - filter, bulk publish/archive/needs-review/draft
- `/admin/problems/[id]` - admin detail with answers and lifecycle actions
- `/admin/problems/[id]/edit` - edit problem and question JSON fields
- `/admin/problems/[id]/preview` - admin preview, no saved submission
- `/admin/sources` and `/admin/sources/[id]` - source counts, lifecycle distribution, metadata edits
- `/admin/topics` and `/admin/topics/[id]` - topic counts, parent topic, related problems

## Retired Classroom And Assignment Data

Phase 1C-A decommissions all classroom, assignment, join-code, teacher-dashboard, assignment-submission, and manual-grading application surfaces. Direct page requests resolve as not found, legacy mutation actions cannot reach Prisma, and the retired assignment API returns a generic JSON 404.

This does not retire independent practice. `POST /api/submissions` remains the single-problem practice submission endpoint and continues to persist submission answers, learner progress, and recommendation completion. Contest, diagnostic, random-practice, and Writing persistence remain active. The seed no longer creates classroom or assignment fixtures.

The `Classroom`, `ClassroomMember`, `Assignment`, `AssignmentProblem`, `AssignmentSubmission`, `AssignmentProblemSubmission`, and `ManualGrade` tables remain in the schema temporarily. This pass does not delete historical rows, foreign keys, or audit attribution. These retained models are not active product features.

## Learner Analytics

Learner analytics use independent-practice submissions, diagnostic results, skill/topic performance, wrong answers, and deterministic recommendations.

Student routes:

- `/analytics` - overall progress, skill/topic breakdowns, recent wrong answers, trends, and recommended practice.
- `/analytics/skills/[skillType]` - detail view for one skill with related topics, wrong questions, recommendations, and recent submissions.

### Accuracy Rules

- Auto-markable answers count only when `SubmissionAnswer.isCorrect` is `true` or `false`.
- Needs-review answers do not enter the accuracy denominator until manually graded.
- Historical `ManualGrade` rows remain readable by learner analytics, but no grading surface can create or update them.
- Sentence transformation exact matches count automatically; non-exact variants remain needs-review.

### Recommendation Logic

Recommendations are deterministic, not AI-based:

- Find weak skills/topics with enough attempts.
- Prefer `PUBLISHED` problems only.
- Prefer problems the student has not solved.
- Include retry links for recent wrong answers.
- Show Vietnamese reasons such as “Bạn đang sai nhiều ở Word Formation.” or “Topic Inversion có độ chính xác thấp.”

## Phase 6 Content Packs And QA

Phase 6 adds a scalable content-pack ingestion workflow for cleaned JSON/CSV database packs prepared outside the app. It does not implement OCR, PDF extraction, DOCX extraction, or AI parsing.

Admin routes:

- `/admin/import` - upload one/multiple `.json`/`.csv` files first; manual paste is available as an advanced/debug path.
- `/admin/content-packs` - list imported packs, status, file counts, problem counts, question counts, and import history.
- `/admin/content-packs/[id]` - manifest summary, related source collections, import batches, imported problems, distributions, QA summary, and bulk actions.
- `/admin/content-qa` - quality report across all content or a selected content pack.

### File Upload Workflow

1. Open `/admin/import` as a content administrator.
2. Use the default “Tải gói dữ liệu lên” workflow.
3. Select one or more `.json`/`.csv` files.
4. Click “Kiểm tra dữ liệu”.
5. Review per-file preview, global summary, warnings, skipped duplicates, and ignored files.
6. Click “Import tất cả file hợp lệ”.
7. Open the generated content pack, run QA, preview/edit content, then bulk publish safe problems.

ZIP upload is intentionally left as a TODO. Use multi-file upload for now; if a pack is zipped, extract it first.

### Manifest Format

Content packs may include `manifest.json`:

```json
{
  "packName": "Englishphile Pilot Database Pack 001",
  "version": "1.0.0",
  "description": "Original pilot content for Englishphile.",
  "createdFor": "Englishphile",
  "files": [
    {
      "fileName": "01-pronunciation-pack-001.json",
      "skillType": "PRONUNCIATION",
      "problemCount": 6,
      "questionCount": 30
    }
  ],
  "totals": {
    "problemCount": 46,
    "questionCount": 220
  }
}
```

The current pilot pack also contains legacy-friendly fields such as `file`, `problems`, and `questions`; the app stores the full manifest JSON for traceability.

### Content Pack Folder Convention

```text
content-packs/
  README.md
  pilot-pack-001/
    manifest.json
    00-all-in-one-pilot-pack-001.json
    01-pronunciation-pack-001.json
    ...
    10-writing-pack-001.json
```

Rules:

- `manifest.json` is optional but recommended.
- Files should already follow the Englishphile JSON/CSV import schema.
- Do not place raw PDF/DOCX files here yet.
- `00-all-in-one` is for one-shot import only.
- If a folder contains both `00-all-in-one` and split `01-10` files, the app and CLI prefer split files and ignore `00-all-in-one` to avoid duplicates.

### CLI Import

Import the pilot pack locally:

```bash
npm run import:pack -- content-packs/pilot-pack-001
```

The script:

- Reads `manifest.json` when present.
- Prefers split files over `00-all-in-one`.
- Reuses the same validation/import logic as `/admin/import`.
- Creates a `ContentPack`.
- Creates `ImportBatch` records per imported file.
- Links imported problems to the content pack.
- Defaults imported content to `NEEDS_REVIEW`.

### Content QA

The QA report checks common publishing risks:

- Missing statement or instructions.
- Problem has no questions, topics, or source collection.
- Duplicate slug in the QA scope.
- Missing estimated time.
- Missing prompt/passage where needed.
- Missing answer JSON for auto-markable questions.
- Missing or invalid options for MCQ-like questions.
- Missing explanation.
- Word Formation missing `rootWord`.
- Sentence Transformation missing model answer.
- Writing Prompt missing rubric metadata.
- Reading problem missing passage.
- Trios missing shared word or not representing three sentences.
- Cloze-style questions missing answer structures.
- Possible duplicate risk from import metadata.

Severity labels:

- `ERROR` = “Lỗi nghiêm trọng”, blocks bulk publish.
- `WARNING` = “Cảnh báo”, allowed but should be reviewed.
- `INFO` = “Gợi ý”.

Bulk publish from `/admin/content-packs/[id]` or `/admin/content-qa` only publishes problems with no QA `ERROR` and still uses the Phase 3 publish validation rules.

## Phase 7 Product Realignment

Phase 7 realigns Englishphile around personalized self-practice.

Student routes:

- `/diagnostic`, `/diagnostic/start`, `/diagnostic/result` - fixed mixed diagnostic test, deterministic scoring, skill/topic profile updates, and recommendations.
- `/recommendations` - recommended published problems with Vietnamese reasons.
- `/practice/adaptive` - choose time/focus/skill and receive a suggested practice set.
- `/gym` - main practice hub.
- `/gym/reading`, `/gym/writing`, `/gym/listening`, `/gym/use-of-english` - Gym skill areas.
- `/contests` - old exam practice and timed contests.
- `/wiki` - renamed theory area for future knowledge notes.
- `/about` - student/parent explanation of diagnostic, recommendations, skills, and content review.

Important rules:

- Do not describe Englishphile using old coding-practice comparisons.
- Main student navigation is Trang chủ, Gym, Contests, Wiki, and Về Englishphile.
- Reading, Writing, Listening, and Use of English live inside Gym, not top-level navigation.
- Student dashboard centers diagnostic, recommended practice, Gym entry, Contests, progress, analytics, and wrong questions.
- Classroom and assignment application routes are retired and cannot mutate retained historical data.
- Recommendations only use `PUBLISHED` problems.
- Upload-first import is the preferred admin workflow.
- Manual paste import is advanced/debug only.
- Imported content goes through exact and near-duplicate detection before review/publish.

## Phase 7.5 Gym, Contests, Profile, And UI Cleanup

Phase 7.5 clarifies the product model:

- Public users are learners. Signup creates `STUDENT` accounts only and asks for email, username, password, full name, school, and province/city.
- The site owner/admin manages content, imports, QA, contests, wiki content, and review/publish workflows.
- The only user roles are `STUDENT` and `ADMIN`; the Phase 1C-A migration downgraded every legacy teacher-role user to `STUDENT` before removing that enum value. Owner-attested evidence dated 2026-07-14 records that it is applied in both isolated Preview and Production and is now immutable.
- The Phase 1C-A enum migration is explicitly transactional. Any future SQL correction must use a new additive migration; the applied migration must never be edited.
- Portable import/export is operator-level tooling: `STUDENT` and explicit `ADMIN` are preserved, legacy `TEACHER` is downgraded to `STUDENT`, and unknown roles are rejected. An explicit `ADMIN` bundle value can assign `ADMIN` only when an authorized operator runs the importer. The importer now resolves its fixed internal filenames from the selected input directory.
- Gym is the primary practice hub. It contains Reading, Writing, Listening, and Use of English.
- Contests are for past exam practice and occasional timed English contests created by the admin.
- Wiki replaces Theory as the knowledge area. `/theory` redirects to `/wiki`.
- Topic tags should be subtle metadata or deliberate filters. Avoid large chip-only sections like “Topic Reading” that make the UI feel generated or noisy.
- Student-facing pages should prioritize title, skill/mode, difficulty, short description, reason for recommendation, and the next action.

Owner-attested operational evidence dated 2026-07-14 records that PR #6 merged at `df89089c89e56abed1feb0ab0569e77656d51598`, the canonical Vercel Production deployment reached READY, all 16 Production migrations are applied, and selected Production authorization, retired-route, independent-practice, contest, diagnostic, and Writing smoke checks passed. Contest/diagnostic/Writing coverage was basic smoke only. Full evidence boundaries and remaining Test debt are documented in `docs/SECURITY_PHASE_1C_REPORT.md`.

Phase 1C-B is also complete at the repository and selected operational-verification boundaries. PR #8 merged at `e17105e6e65d30a009dffd56fe20d29d3ca69bd1`; owner-attested evidence dated 2026-07-17 records that this merge commit reached READY in Production, became the canonical Production deployment, passed health with database connected, enforced the tested anonymous/owner/student admin boundaries, and passed restored low-risk contest/problem mutations plus independent-practice and basic contest/diagnostic/Writing smoke. Isolated Preview evidence at `8f1073a0638b4de24923adc9c537b1e0f348228f` additionally verifies the tested duplicate-pack, case-only filename, unique-pack total, and zero-entry UI behavior. H-05 and H-06 are remediated, merged, deployed, and verified on those selected Production paths; this is not PostgreSQL concurrency, rollback, timeout, exactly-once, hostile-origin, or comprehensive security evidence. Phase 1C-B required no schema change or migration. Authenticated content-pack recovery and real PostgreSQL integration remain outstanding, and normal HTTP retry still creates a new pack.

Phase 1D-A H-10 is remediated in repository code and merged through PR #10 at `ce8c9bfc7b4f2135158960e11ab486dd7fffbb59`. Positive learner DTO allowlists keep canonical answers, answer-bearing explanations, raw metadata/options, and checker feedback server-side; practice responses use fixed generic feedback; diagnostic scoring remains server-side; and newly finalized diagnostic metadata does not duplicate answers or answer-bearing feedback. Diagnostic result reads require current-user ownership, finalized status, and non-null completion. Historical rows were not rewritten, learner selectors ignore legacy sensitive keys, and admin editor/preview access remains separate and answer-complete. No schema change or migration was required.

Owner-attested isolated Preview evidence dated 2026-07-17 records that code commit `e0f1c340a75cbc98c77b267ee1a804c2b1ecd55b` reached READY with database-connected health and passed synthetic-sentinel checks for anonymous problem HTML/RSC, authenticated practice responses, diagnostic start/result HTML/RSC, unavailable foreign/incomplete attempts, authorized admin preview, and ordinary-`STUDENT` denial. Exact synthetic sentinel values are not recorded, and fixture cleanup was not reported. This was operational inspection, not repository testing or claimed browser automation.

Owner-attested selected Production evidence dated 2026-07-17 records that PR #10 is merged and its merge commit became the canonical READY Production deployment. Health returned HTTP 200 with the database connected; missing-Origin and same-origin unauthenticated submissions were separately rejected with 403 and 401; tested learner HTML/RSC and response shapes remained safe; diagnostic results remained aggregate-only; authorized admin preview and ordinary-`STUDENT` denial passed; independent-practice persistence and basic contest/diagnostic/Writing regression smoke passed; and checked runtime logs contained no runtime errors or sensitive values. Production used no synthetic sentinel fixtures: its HTML/RSC evidence was structural forbidden-token inspection and is weaker than the isolated Preview sentinel evidence. PostgreSQL integration and fixture-cleanup confirmation remain pending; H-09, H-11, random-email authentication amplification, four moderate dependency advisories, private-contest Production smoke, PostgreSQL concurrency/rollback/recovery Test debt, and ongoing runtime-log monitoring remain outstanding. See `docs/SECURITY_PHASE_1D_A_REPORT.md`.

Phase 1D-A page-boundary evidence includes a runtime test that imports and invokes the actual diagnostic result page while mocking `requireUser`, result/recommendation selectors, and Next.js redirect control flow. The page scopes requested and latest results only with `requireUser().id`; stored-ADMIN, owner-shaped STUDENT, and ordinary-STUDENT fixtures receive no query-parameter cross-user bypass. This is not an end-to-end cookie/session test, and the owner-shaped fixture does not independently verify `OWNER_EMAIL` configuration resolution; existing content-admin policy tests remain that evidence.

Contest routes:

- `/contests` - public contest list.
- `/contests/[id]` - contest overview, rules, duration, sections, and start/result link.
- `/contests/[id]/start` - contest attempt screen.
- `/contests/[id]/result` - score and answer review.
- `/admin/contests` - admin contest management.
- `/admin/contests/new` - create contest from `PUBLISHED` problems.
- `/admin/contests/[id]` and `/admin/contests/[id]/edit` - manage, edit, publish/schedule/archive.

Only `PUBLISHED` problems should be selected for public contests by default. Writing or other manually reviewed answers may mark a contest attempt as `NEEDS_REVIEW`.

## Phase 8 Diagnostic Calibration

Phase 8 turns diagnostic into a structured placement test instead of a random mixed quiz.

Diagnostic blueprint:

- Use of English Core: MCQ, Word Formation, Sentence Transformation, Cloze, Error Identification.
- Reading: Reading MCQ from published reading problems.
- Writing: optional/manual review, excluded from auto-level until graded.
- Listening: future-ready; excluded from score when no published listening content exists.

Selection rules:

- Diagnostic uses `PUBLISHED` content only.
- It prefers problems with `isDiagnosticEligible = true`.
- If eligible content is incomplete, it falls back to other published problems by skill/question type.
- It never uses `DRAFT`, `NEEDS_REVIEW`, or `ARCHIVED` problems.
- Admin can mark published problems diagnostic-ready at `/admin/diagnostic`.

Scoring model:

- Weighted accuracy maps to levels: `<40% B2`, `40-59% C1`, `60-74% C2`, `75-87% CHUYEN`, `88%+ HSG`.
- Difficulty weights: `B2 1.0`, `C1 1.1`, `C2 1.25`, `CHUYEN 1.4`, `HSG 1.6`.
- Confidence is `Thấp` under 15 auto-markable questions, `Trung bình` from 15-29, and `Cao` at 30+.
- Sentence transformation exact matches can be auto-scored; non-exact answers become needs-review.
- Writing is saved as manual-review content and does not affect auto-level.

Recommendation priority:

1. Wrong-question retry.
2. Weak skill from diagnostic.
3. Weak topic from diagnostic/submissions.
4. Not-yet-attempted problems at the current estimated level.
5. Slightly harder challenge problems.
6. Writing practice if writing data is sparse.
7. Reading practice if reading data is sparse.

Gym personalization:

- `/gym` shows diagnostic status, recommended work, skill status, and adaptive-practice entry.
- `/gym/reading`, `/gym/writing`, `/gym/listening`, and `/gym/use-of-english` show mode-specific status and recommendations.
- `/problems` includes clean personalized filters for level fit, weak skill, weak topic, not attempted, wrong, and challenge.

Important data note: do not run `npm run prisma:seed` on a populated local database unless intentionally resetting demo/imported data.

## Phase 9 Public Beta Hardening

Phase 9 prepares the app for public beta:

- Public signup is learner-only. No role selector is shown.
- Admin pages and admin import APIs use shared owner/admin guards.
- `OWNER_EMAIL` enables the site owner to access `/admin` without exposing admin signup.
- Normal learners who try admin routes see a friendly no-access page.
- Main learner navigation stays Trang chủ, Gym, Contests, Wiki, and Về Englishphile.
- Classroom/assignment routes are decommissioned; retained database tables are historical data only.
- Contests now include filters, availability states, in-progress attempt resume, timed attempt UI, result review, and a leaderboard route.
- Admin contest builder validates that only `PUBLISHED` problems can be selected.
- Global loading, not-found, and error states are present for beta polish.
- Admin dashboard includes beta stats: total users, completed diagnostics, published/review content, active contests, content packs, and duplicate skips when available.

Current beta limitations:

- No email verification or password reset yet.
- No external analytics service.
- Contest leaderboard is score/time based and does not expose email.
- Writing and non-exact sentence transformation still require manual review.
- Do not run seed on a populated beta database unless intentionally resetting demo/imported content.

## Phase 10 Beta Launch Readiness

Phase 10 prepares Englishphile for safe public beta deployment and real-user testing. It focuses on configuration, owner/admin setup, backups, status checks, legal/support pages, and safe migration habits instead of adding large learning features.

### Required Environment

Use `.env.example` as the source of truth:

- `DATABASE_URL` - pooled PostgreSQL runtime connection; use an isolated non-production database locally.
- `DIRECT_URL` - direct PostgreSQL connection for migration and administrative workflows; never reuse the production value locally.
- `SESSION_SECRET` - preferred signed-cookie secret.
- `AUTH_SECRET` - compatibility fallback if `SESSION_SECRET` is not set.
- `CRON_SECRET` - server-only bearer credential for Production Vercel Cron; use at least 32 random bytes (the route accepts 16-512 UTF-8 bytes), never use a `NEXT_PUBLIC_` prefix, and never share the Production value with Preview/local testing.
- `OWNER_EMAIL` - site-owner account email; public signup is still learner-only.
- `NEXT_PUBLIC_APP_URL` - optional base URL for metadata and links.
- `NEXT_PUBLIC_CONTACT_EMAIL` - optional support email shown on `/contact`.
- `NODE_ENV` - normally set by the runtime.

Production must not rely on the local development secret fallback. Generate a long secret before deployment.

### Owner/Admin Bootstrap

Public signup never creates admin accounts. To create the owner account locally:

1. Set `OWNER_EMAIL` in `.env`.
2. Sign up normally with that email.
3. Restart the dev server.
4. If you want the stored role to become `ADMIN`, run:

```bash
npm run admin:promote -- owner@example.com
```

The promotion script never creates a password. If the user does not exist, sign up first and rerun the script.

### Database Safety

Run a backup before migrations or large imports:

```bash
npm run db:backup
```

Inspect beta counts:

```bash
npm run db:stats
```

Export important content and safe user metadata without `passwordHash`:

```bash
npm run db:export
```

Exports go under `exports/`. Backups go under `backups/`. Do not commit real user exports or production backups.

### Migration Workflow

Apply the repository's existing migration chain to a newly provisioned empty isolated PostgreSQL database:

```bash
npm run prisma:deploy
```

Only after intentionally changing `prisma/schema.prisma`, create a new local development migration with a descriptive name:

```bash
npm run prisma:migrate -- --name <descriptive_name>
```

Apply reviewed migrations in production with:

```bash
npm run prisma:deploy
```

Never use `prisma migrate dev` or `npm run prisma:migrate` against production. Do not run `npm run prisma:seed` on beta/production data unless you intentionally want a reset.

### Health, Status, And Legal Pages

- `/api/health` returns non-secret JSON with app/database status.
- `/status` shows a public beta status page.
- `/privacy`, `/terms`, and `/contact` provide beta-ready legal/support information.
- `/admin/beta-checklist` shows owner/admin setup, content readiness, diagnostic coverage, backup status, duplicate warnings, contests, and legal-page checks.

### Launch Checklist

Before opening beta:

- Configure `OWNER_EMAIL` and a strong `SESSION_SECRET`.
- Create the owner account through normal signup.
- Run `npm run admin:promote -- owner@example.com` if role-based admin storage is desired.
- Run `npm run db:backup`.
- Confirm `/admin/beta-checklist` has no blocking missing items.
- Confirm enough `PUBLISHED` problems and diagnostic coverage exist.
- Run content QA before publishing imported packs.
- Confirm `/privacy`, `/terms`, `/contact`, and `/status` are visible.

### Phase 6 Warnings

- OCR/PDF/DOCX extraction is not implemented yet.
- Convert content into approved JSON/CSV first.
- Imported content defaults to `NEEDS_REVIEW` unless explicitly published during import.
- Do not publish imported content until QA and preview are complete.
- Do not import copyrighted material unless you have the right to use it.

## Question Bank Structure

Problems are grouped by:

- Skill type
- Topic tags
- Difficulty
- Source collection
- User problem status

Seed data and examples are original sample content only. Do not paste large copyrighted worksheet content into seed files.

Supported MVP renderers:

- Multiple Choice
- Pronunciation
- Word Formation
- Sentence Transformation
- Guided Cloze
- Open Cloze
- Error Identification
- Trios / Gapped Sentences
- Reading MCQ
- Listening MCQ / short answer metadata scaffold
- Writing Prompt

## Future Phases

- PDF/DOCX extraction with admin review.
- Grade audit timeline, richer analytics snapshots, and deeper weak-skill modeling.
- AI-assisted explanations and writing feedback when explicitly requested.

---

## Deploy miễn phí với Vercel + Neon

Englishphile có thể được deploy miễn phí lên Vercel Hobby và sử dụng Neon Free PostgreSQL.

### Giới hạn

- **Vercel Hobby**: chỉ dùng cho mục đích phi thương mại / beta cá nhân / quy mô nhỏ.
- **Neon Free**: giới hạn 0.5 GB storage và 0.1 vCPU. Không dùng cho dữ liệu lớn.

### Các bước deploy

#### 1. Tạo project Neon

1. Đăng ký tài khoản tại [neon.tech](https://neon.tech).
2. Tạo project mới (ví dụ: `englishphile-prod`).
3. Trong **Connection Details**, copy hai connection string:
   - **Pooled connection** → `DATABASE_URL`
   - **Non-pooled (direct) connection** → `DIRECT_URL`

#### 2. Push code lên GitHub

1. Khởi tạo git repo và push lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial Englishphile setup"
   git branch -M main
   git remote add origin https://github.com/<username>/englishphile.git
   git push -u origin main
   ```

#### 3. Import vào Vercel

1. Đăng ký tài khoản tại [vercel.com](https://vercel.com).
2. Import repo GitHub: **Add New → Project → Import Git Repository**.
3. Chọn repo `englishphile`.
4. Framework: **Next.js** (auto-detected).
5. **Build Command**: `npm run build` (đã bao gồm `prisma generate`).
6. **Environment Variables** — thêm các biến sau:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Connection string pooled từ Neon |
   | `DIRECT_URL` | Connection string direct/non-pooled từ Neon |
   | `SESSION_SECRET` | Secret ngẫu nhiên (xem bên dưới) |
   | `CRON_SECRET` | Secret ngẫu nhiên riêng cho Production Vercel Cron |
   | `OWNER_EMAIL` | Email của người quản trị |
   | `NEXT_PUBLIC_APP_URL` | URL Vercel sau khi deploy (ví dụ: `https://englishphile.vercel.app`) |
   | `NODE_ENV` | `production` |

   Generate `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

7. Click **Deploy**.

Vercel sẽ tự động chạy `prisma generate` và `next build` (nhờ script `npm run build`).

#### Security cleanup cron

Repository cấu hình đúng một Vercel Cron hằng ngày cho Production tại `03:17 UTC` (`17 3 * * *`) gọi chính xác `GET /api/cron/security-cleanup`. Vercel gửi `Authorization: Bearer <CRON_SECRET>`; route yêu cầu secret phân biệt hoa/thường dài 16-512 byte UTF-8 và khuyến nghị tạo từ ít nhất 32 byte ngẫu nhiên. Route từ chối với `401` nếu cấu hình hoặc credential không hợp lệ. Không đặt secret trong URL, query string, cookie, request body hoặc `vercel.json`.

Chỉ `GET` đã xác thực mới chạy cleanup. `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` và `OPTIONS` đều được xử lý rõ ràng bằng `405`, `Allow: GET`, `Cache-Control: no-store`, không redirect và không gọi cleanup. Mỗi lần chạy có ba thành phần và năm pha sửa dữ liệu: tối đa 500 rate-limit buckets, 500 contest access grants, cùng ba pha Writing tối đa 500 dòng mỗi pha. Vì vậy 2.500 là số dòng tối đa có thể bị ảnh hưởng, không phải toàn bộ database work; mỗi câu lệnh sửa dữ liệu còn có candidate-selection subquery giới hạn tối đa 500 dòng.

Các thành phần chạy tuần tự; một thành phần lỗi không ngăn các thành phần độc lập còn lại chạy, nhưng toàn bộ request trả `500` và không báo thành công. Delivery có thể bị lỡ, trùng hoặc chồng lấp; các predicate được kiểm tra lại trong câu lệnh sửa dữ liệu nên việc chạy trùng/chồng có thể tạo thêm database work nhưng không bỏ qua điều kiện eligibility. Không có distributed lock.

Theo bằng chứng vận hành do owner xác nhận ngày 2026-07-13 và 2026-07-14, PR #4 đã được merge và deploy lên Production, `CRON_SECRET` đã được cấu hình server-side chỉ cho Production, Cron Job đang enabled, lần gọi thủ công đã xác thực và lần chạy tự động đầu tiên đều trả `200`, và bước kiểm tra log ban đầu đã pass. Đây không phải bằng chứng rằng delivery sẽ luôn thành công hoặc monitoring đã toàn diện.

Vercel không tự động retry cron thất bại, vì vậy owner vẫn phải theo dõi runtime logs/Vercel dashboard liên tục. Daily cleanup có bounded capacity nên backlog vẫn có thể tăng khi abuse tạo nhiều subject mới; cron không khắc phục random-email authentication bucket amplification.

#### 4. Chạy migration trên Neon

Sau khi deploy, chạy migration để tạo schema trên Neon:

```bash
# Trên máy local, kết nối trực tiếp tới Neon
npm run db:import:portable -- --input <export-dir> --url "postgresql://user:password@ep-xxx-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Hoặc dùng prisma migrate deploy nếu chưa có data để migrate
npm run prisma:deploy
```

**Lưu ý**: Chạy `npm run db:export:portable` trên local để export nội dung trước, sau đó import vào Neon.

#### 5. Tạo tài khoản owner

1. Mở app đã deploy (ví dụ: `https://englishphile.vercel.app`).
2. Sign up với email đã đặt trong `OWNER_EMAIL`.
3. Sau đó chạy promotion script nếu muốn lưu role ADMIN vào database:

   ```bash
   # Chạy promotion script với production DATABASE_URL
   npm run admin:promote -- owner@example.com
   ```

#### 6. Import nội dung (nếu có)

1. Chạy portable export trên local:
   ```bash
   npm run db:export:portable
   ```
2. Import vào Neon:
   ```bash
   npm run db:import:portable -- --input exports/englishphile-portable-<timestamp> --url "postgresql://..."
   ```

#### 7. Kiểm tra sau deploy

- `/api/health` — kiểm tra kết nối database.
- `/status` — trang trạng thái public.
- `/admin/beta-checklist` — checklist vận hành.

### Production checklist

Trước khi mở cho người dùng thật, kiểm tra:

- [ ] `DATABASE_URL` trỏ đến Neon PostgreSQL (không phải SQLite).
- [ ] `SESSION_SECRET` là secret ngẫu nhiên thực sự.
- [ ] `CRON_SECRET` là secret Production riêng, server-only và chưa từng commit.
- [ ] `OWNER_EMAIL` được cấu hình.
- [ ] `NEXT_PUBLIC_APP_URL` trỏ đến URL Vercel.
- [ ] Đã chạy migration trên Neon (`npm run prisma:deploy`).
- [ ] Đã import nội dung (nếu cần).
- [ ] `/admin/beta-checklist` không có mục nào ở trạng thái `missing`.
- [ ] Đã chạy QA trên content trước khi publish.
- [ ] Đã xác nhận lần Vercel Cron Production được xác thực đầu tiên và đang theo dõi lỗi runtime.
- [ ] `/privacy`, `/terms`, `/contact` đã có nội dung.

### Cảnh báo

- **Không chạy `prisma seed` trên production** nếu database đã có dữ liệu thật.
- **Luôn backup/export trước migration lớn**: `npm run db:backup` (SQLite) hoặc `npm run db:export:portable`.
- **Không để lộ `passwordHash`** — export script không bao gồm password hash.
- **Import content lớn nên chia thành content pack nhỏ** để tránh timeout.
- **Vercel Hobby không dùng cho traffic cao** — nâng cấp nếu cần.
- **Neon Free có giới hạn** — theo dõi storage và compute để tránh bị giới hạn.

### Local dev với PostgreSQL riêng biệt

Prisma schema dùng PostgreSQL provider. Local development phải dùng một database PostgreSQL riêng, không chứa dữ liệu production:

1. Tạo một Neon project độc lập hoặc một PostgreSQL instance cô lập dành cho local development.
2. Dùng pooled connection cho `DATABASE_URL` và direct connection cho `DIRECT_URL`.
3. Tuyệt đối không sao chép `DATABASE_URL` hoặc `DIRECT_URL` của production vào `.env` local.
4. Áp dụng chuỗi migration hiện có lên database local trống và cô lập:
   ```bash
   npm run prisma:deploy
   ```

Chỉ dùng `npm run prisma:migrate -- --name <descriptive_name>` khi chủ động sửa `prisma/schema.prisma` và cần tạo một migration development mới. Tuyệt đối không dùng migrate-dev đối với production.

### Database scripts

```bash
npm run db:backup              # Backup helper cho dữ liệu SQLite legacy
npm run db:export              # Export an toàn (users không có password hash)
npm run db:export:portable     # Export đầy đủ cho migration Neon
npm run db:import:portable     # Import vào target database
npm run db:stats               # Thống kê nhanh database
npm run prisma:deploy          # Chạy migration trên production
npm run admin:promote          # Promote user thành admin
```

Portable export là định dạng JSON plaintext có dữ liệu nhạy cảm và phải được bảo vệ như một bản sao dữ liệu vận hành. Export mới không chứa `passwordHash` hoặc `Contest.accessCode`, đồng thời JSON chẩn đoán lịch sử được đưa qua allowlist để không sao chép đáp án/feedback cũ. Công cụ không mã hóa file và không thay đổi các hàng lịch sử trong database. Manifest portable bị giới hạn 32 KiB, chỉ giữ version `1.0` (hoặc manifest legacy chưa có version), thời điểm ISO và các count đã biết là số nguyên an toàn từ 0 đến 1.000.000; count lạ bị từ chối, còn note/warning top-level cũ bị bỏ qua và không log. Live import cần xác nhận TTY; khi chạy không tương tác, operator phải chủ động thêm `--yes`. Dry-run chỉ xác thực manifest và in các count do manifest khai báo; nó không kiểm tra các file hoặc row trong bundle và không tạo Prisma client. Không lưu bundle vào source control, log, hoặc thư mục chia sẻ công khai.

Phase 1D-B1 chỉ giảm dữ liệu nhạy cảm trong write/export/audit mới. H-11 vẫn **Partially remediated**: Writing retention, lịch sử contest/submission/audit, contest access code plaintext trong database, account deletion/retention, và mã hóa portable export vẫn chưa được giải quyết.

Owner-attested isolated Preview evidence ngày 2026-07-26 ghi nhận commit `4a869defacd6b932299bc8e0bc8b83897177cf6a` ở trạng thái `READY`, hai check Vercel đều pass và PR #12 vẫn là Draft tại checkpoint Preview lịch sử đó. Manual JSON và upload-first JSON đều `IMPORTED`, mỗi đường tạo 1 problem/1 question với taxonomy còn thiếu; single-problem và random practice giữ response learner-safe, đúng parent/child persistence shape và partition theo problem. Practice checkpoint dùng account owner-equivalent hiện tại trên learner surface của chính account đó; không kiểm tra dữ liệu của user khác, và ordinary-`STUDENT` practice không được rerun trên `4a869def...`. Ordinary-`STUDENT` admin denial tại `e8e3a675...` chỉ là historical admin-boundary evidence; không ghi giá trị `OWNER_EMAIL`. Các marker chỉ xuất hiện trên Neon branch `preview`, không xuất hiện trên parent branch tên `production`; đây chỉ là bằng chứng cô lập branch hẹp, không phải xác minh Production tổng quát. Log postflight mười phút trả về `Fetched 0 logs`. Các HTTP 401 do Vercel Deployment Protection chặn không được tính là bằng chứng 401/403 của ứng dụng.

Lỗi Preview trước đó tại `problem-nested-create` có safe signal `database` / `known-request` / `P2028`. Chuỗi thao tác và lần kiểm tra sau correction hỗ trợ chẩn đoán transaction timeout, nhưng không chứng minh subtype P2028 nội bộ vì raw message/meta không được log. Correction chỉ đặt timeout 15 giây cho transaction import cụ thể, không đổi global timeout, không retry và không đổi query/write/lock/schema/migration.

Owner-attested Production evidence được đối chiếu riêng: PR #12 merge lúc `2026-07-26T16:01:29Z` với merge commit `954783040c02e3d71f68babb8c00e917409408e1`. Canonical deployment target là Production, được tạo sau merge và đạt `READY`; provider không báo commit metadata nên không khẳng định provider-reported SHA match trực tiếp. Health trả 200 với `ok=true` và `database=connected`; missing-Origin submission trả 403, same-origin unauthenticated submission trả 401; owner-equivalent admin access và ordinary-`STUDENT` denial đều pass. Một bounded synthetic manual import tạo đúng 1 source, 1 topic, 1 problem, 1 question với zero dry-run errors. Single-problem learner response chỉ có `submissionId`, `status`, `score`, `total` và các answer gồm `questionId`, `isCorrect`, fixed generic feedback; không có canonical answer, explanation, options, metadata, checker feedback hoặc synthetic explanation sentinel. Cả mười persisted-shape check đều true. Admin preview vẫn có answer access và không phát submission POST. Synthetic problem được archive; anonymous và ordinary `STUDENT` không truy cập được archived learner route, còn owner/admin visibility chỉ là privileged administrative visibility, không phải learner exposure. Contest listing, diagnostic landing, Writing landing, owner-admin access và ordinary-`STUDENT` denial regressions pass; checked Production error logs không có relevant runtime error hoặc sensitive value.

Tại checkpoint Phase 1D-B1 lịch sử này, Production không rerun random-practice persistence hoặc upload-first import; hai bằng chứng đó vẫn chỉ thuộc checkpoint Preview. Không có claim về managed PostgreSQL concurrency, rollback, failover, pooler, duration hoặc timeout testing, và không có historical-data cleanup. H-11 vẫn **Partially remediated**; public-beta release khi đó bị block bởi các dependency finding của Next, PostCSS, Sharp, brace-expansion và chuỗi dependency chưa giải quyết. Production reconciliation này không đổi schema hoặc migration.

Audit read-only ngày 2026-07-26 là snapshot lịch sử trước Phase 1D-C1 và thay thế số liệu sáu finding cũ: full scope có 20 top-level vulnerable-package entries được npm metadata tóm tắt thành 1 Moderate/19 High; production scope có 13 entries được tóm tắt thành 1 Moderate/12 High. Đây là dependency-package entries, không phải 20 hoặc 13 GHSA độc lập; cả hai lệnh exit 1. Next-native advisories khi đó là release-blocking và có patch-level path từ Next 16.2.11; Next 16.2.12 là aggregate Next update được npm đề xuất. PostCSS và Sharp khi đó độc lập release-blocking: ba PostCSS advisory có patched floor riêng lần lượt là 8.5.10, 8.5.12 và 8.5.18, nên aggregate safe floor là `>=8.5.18` và `postcss@8.5.16` vẫn bị ảnh hưởng bởi `GHSA-r28c-9q8g-f849`; Next 16.2.12 vẫn khai báo PostCSS 8.4.31 và Sharp `^0.34.5`, thấp hơn các aggregate patched floor tương ứng `>=8.5.18` và `>=0.35.0`. Snapshot lịch sử này không chạy audit fix và không đổi dependency/manifest/lockfile.

Phase 1D-C1 được implement tại `87b239b3709262d9adf9e00ed439c20f4fc14985`, có PR #14 documentation follow-up tại `d5d8cfd4b402a31f742bdbaec5b7671c1f47801e`, rồi merge qua PR #14 tại `e4483e6e6af0b8b1fad3c70d6ebc017436731cd2` lúc `2026-07-27T01:41:29Z`. Resolution giữ exact `next@16.2.12`, `postcss@8.5.18`, `sharp@0.35.0` và Next-scoped `$postcss`/`$sharp` overrides. Npm tree hợp lệ và deduplicated; các audit object của Next, PostCSS và Sharp đã được loại bỏ. Local verification đã pass Prisma validate/generate, typecheck, lint, focused tests, 459 default-suite tests với 8 PGlite case opt-in bị skip, production build, và synthetic PostCSS/Sharp/Next image-optimizer probes. Không có schema hoặc migration change. Final audit vẫn exit 1: full scope có 17 vulnerable-package entries (1 Moderate/16 High), production scope có 10 entries (1 Moderate/9 High). Brace-expansion, minimatch/glob consumers, ExcelJS/archiver và UUID được chuyển sang Phase 1D-C2; public beta vẫn bị block pending actual Phase 1D-C2 disposition và H-11 vẫn **Partially remediated**.

Phase 1D-C2 bắt đầu tại branch `security-phase-1d-c2-transitive-dependencies`, HEAD `0cae690f1a66ea2089bc7de847bc27ee023bb461`; dependency implementation được ghi nhận tại commit `7e582904c392a743dc8a0e62c5d18f4d494efd19`, sau đó formula-validation UI correction được ghi nhận tại commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5`. Resolution giữ `exceljs@4.4.0`, `archiver@5.3.2` và `zip-stream@4.1.1`, đồng thời dùng override có scope cho `unzipper@0.12.5`, `uuid@11.1.1`, `readdir-glob@3.0.0`, `archiver-utils > glob@13.0.6` và `minimatch@10.2.5 > brace-expansion@5.0.8`. Không có direct dependency nào đổi; `next@16.2.12`, `postcss@8.5.18`, `sharp@0.35.0` và `eslint-config-next@16.2.10` được giữ nguyên. ExcelJS được externalize khỏi server bundle để Turbopack không resolve nhánh S3 optional của Unzipper; route import vẫn chạy trên Node server. Real-workbook tests cũng sửa adapter parser để đọc đúng numeric `row.values` và từ chối formula object của ExcelJS. Final production audit exit 0 với zero vulnerable dependency-package entry; full audit exit 1 chỉ còn một package entry High là `brace-expansion@1.1.15` trên nhánh ESLint development-only, đại diện cho hai GHSA và không có request path trong Production. Dependency gate của C2 không còn block public beta, nhưng đây không phải blanket release clearance cho các gate khác. H-11 vẫn **Partially remediated**. Xem `docs/SECURITY_PHASE_1D_C2_REPORT.md`.

Owner-attested initial C2 Preview evidence ghi nhận hai check Vercel pass; generated valid XLSX đã đi qua actual application contest parser running on Preview và render preview với title `Phase 1D-C2 Preview XLSX Probe`, một section và một question. ExcelJS externalization hoạt động, không xuất hiện optional S3-module resolution failure, không tạo contest draft và checked runtime log window không có log. Trước correction, formula-bearing XLSX POST đến `/api/admin/contests-import/parse` nhận HTTP 200 `application/json`, nhưng trang đi vào generic App Router error UI mà checked server-log window không có lỗi tương ứng. Local reproduction với actual application import-page source xác định parser đã trả đúng `{ data: null, errors: [...], warnings: [] }`; client cũ tạo preview state dù có validation error, rồi JSX dereference `state.data.info` khi `data` là `null`.

Commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5` thêm dedicated validation state, structural response decoding, fixed bounded Vietnamese formula feedback, fail-closed handling cho malformed/unexpected response, giữ formula/shared-formula rejection, ẩn draft action khi validation fail và cho phép valid retry. Tại owner-attested correction Preview, PR #16 head đúng commit này và vẫn OPEN, Draft, MERGEABLE, target `main`; Vercel và Vercel Preview Comments thành công, không có failing hoặc pending check. Formula workbook render alert “File Excel chưa hợp lệ — không thể tạo contest draft.” cùng hướng dẫn chuyển công thức thành giá trị tĩnh; không lộ raw formula, không vào generic error page, không có draft action, upload UI vẫn dùng được. Valid XLSX upload sau đó phục hồi normal preview và nút “Tạo contest draft” xuất hiện lại. Không tạo contest draft; checked Preview runtime errors và sensitive log data đều không có.

Preview evidence trên là owner-attested operational evidence, tách biệt khỏi repository tests; không claim browser automation, ordinary-`STUDENT` C2 retest, persistence, mọi ExcelJS/ZIP/Sharp/platform/cache/provider path hoặc managed PostgreSQL evidence. Formula-correction UI test dùng application-source transition helper và view nhưng không phải fully mounted browser test. Material xác thực/session bị lộ trong quá trình điều tra được xử lý như compromised: old Preview deployment liên quan bị xóa, signing material được rotate, Production dùng material riêng đã rotate, rồi được redeploy và health check pass. Đây là operational containment, không phải application-code test hoặc C2 Production functional verification. Tại checkpoint Preview lịch sử đó, PR #16 chưa merge và Production verification còn pending; trạng thái sau merge được ghi riêng bên dưới.

Owner-attested C2 Production reconciliation ngày 2026-07-28 ghi nhận PR #16 đã merge thành commit `0852c05f9acde31f8bfed0887b2749616edf65f6`. Deployment target là Production, được tạo sau merge và đạt `READY`. Provider không báo commit metadata nên không claim provider-reported metadata match. Health trả HTTP 200 với `ok=true` và `database=connected`. Same-origin anonymous submission trong fresh unauthenticated browser context trả HTTP 401. Current missing-Origin status không được reverify vì PowerShell, Node `fetch`, `HttpClient` và `WebClient` không nhận được HTTP response; vì vậy không ghi status `0` và không claim current HTTP 403. Missing-Origin HTTP 403 của Phase 1D-C1 Production chỉ là historical C1 evidence.

`OWNER_EMAIL`-equivalent owner/admin access pass. Valid XLSX render normal Preview với một section và một question, không tạo contest draft. XLSX có formula tạo bounded in-page validation và hiển thị vị trí formula cell; raw formula content và generic error page đều không xuất hiện, draft action bị ẩn khi file invalid. Retry bằng valid XLSX thành công và phục hồi draft button. Ordinary-`STUDENT` admin denial pass. Home/public navigation, visible images và logo, practice submission, diagnostic, contest và Writing regressions đều pass. Không claim exact image format hoặc comprehensive Sharp/libvips coverage. Checked Production runtime logs trả `No logs found`; không quan sát thấy sensitive data trong checked logs. Operational Git checkpoint là branch `main`, tracked worktree và index clean.

Production facts này là owner-attested operational evidence, tách biệt khỏi repository tests và Preview evidence. Production `npm audit` zero vẫn là evidence tại implementation checkpoint; full audit vẫn giữ development-only `brace-expansion@1.1.15`/ESLint finding đã document. Documentation-only reconciliation không rerun audit, tests, build, lint, typecheck, Prisma hoặc npm install; cũng không access database, endpoint, provider hay PR state. Public-beta production dependency-advisory gate đã clear, nhưng không phải blanket release clearance. H-11 vẫn **Partially remediated**.

Historical owner-attested isolated Preview evidence ngày 2026-07-27 ghi nhận rằng tại checkpoint đó PR #14 vẫn OPEN và Draft, target `main`, source commit `87b239b3709262d9adf9e00ed439c20f4fc14985`, và Preview đạt `READY`. Health/database, home render, `OWNER_EMAIL`-equivalent admin access, ordinary-`STUDENT` admin denial, public pages/App Router navigation, practice submission, diagnostic, contest và Writing regressions đều pass; checked runtime window không có runtime error hoặc sensitive log data. Next image request trả về HTTP 304, và browser báo cached representation có type WebP. HTTP 304 nghĩa là browser đã revalidate thành công rồi dùng lại representation có sẵn trong cache; visible images và logo hiển thị đúng. Đây không phải fresh HTTP 200 image response, không khẳng định response body của 304 chứa image data, và không khẳng định response có header `Content-Type: image/webp` vì supplied evidence chỉ báo `304/webp`. Đây cũng không phải test mọi image format, platform binary hoặc cache state, không phải direct Sharp/libvips execution, và không phải Production evidence.

Owner-attested selected Production evidence ngày 2026-07-27 ghi nhận Production deployment được tạo sau khi PR #14 merge, đạt `READY`, và provider-reported commit metadata khớp merge commit `e4483e6e6af0b8b1fad3c70d6ebc017436731cd2`. Health/database pass; missing-Origin submission trả HTTP 403 và same-origin anonymous submission trả HTTP 401. Home render pass. Một Next image request trả về fresh HTTP GET 200 OK response; visible images và logo hiển thị đúng. Production check không cung cấp browser-reported hoặc response `Content-Type`, nên không claim WebP, AVIF, PNG hay exact format nào. Check này cũng không claim direct Sharp/libvips execution hoặc test mọi image input, output format, platform binary, cache state hay optimizer branch. Successful build, local synthetic optimizer probe, historical Preview cache revalidation và Production GET 200 là bốn evidence riêng biệt.

`OWNER_EMAIL`-equivalent admin access, ordinary-`STUDENT` admin denial, public pages/App Router navigation, practice submission, diagnostic, contest và Writing regressions đều pass; checked Production runtime window không có runtime error hoặc sensitive log data. Operational Git checkpoint là branch `main` với tracked worktree và index clean. Selected checks không bao phủ mọi Production route và không tạo managed PostgreSQL, pooler, failover, concurrency, rollback, migration hoặc data-shaping evidence. Không có import, migration, seed, export, backup, cleanup, historical rewrite hoặc data rewrite cho C1 Production verification; không ghi protected operational identifier hoặc value. Không rerun audit trong documentation pass đó; tại checkpoint C1 lịch sử, public beta vẫn bị block pending Phase 1D-C2. Disposition C2 hiện tại được ghi riêng ở trên, không có blanket release clearance, và H-11 vẫn **Partially remediated**.

