# Listening & Contest Admin Builder — Phase 2 Implementation Notes

## What was built

Phase 2 introduces:
1. **Listening support** — audio playback in contest sections via `<audio>` tag
2. **Admin Contest Builder MVP** — admin-editable contest structure with standalone sections and questions

---

## Audio Storage Strategy

### What is stored in PostgreSQL

- `ContestSection.audioUrl` — URL/path to the audio file
- `ContestSection.transcript` — full transcript (admin-only, not shown to learners)
- Metadata in `ContestSection.metadata` JSON if needed

### What is NOT stored in PostgreSQL

- Never store raw audio bytes in the database.
- Do not use `BYTEA` or `TEXT` with base64-encoded audio.

### Beta / MVP approach (current)

Audio files live in the Next.js `public/` directory or reference external URLs:

```
/audio/listening/test-01.mp3          ← local file in public/
https://example.com/audio/test-01.mp3 ← external URL
```

**Rules for beta:**
- Small audio clips (< 5 MB) can be committed to the repo under `public/audio/`.
- For larger files or production, use object storage.
- Do NOT commit large audio files long-term to the git repository.

**How it works:**
- Admin enters `audioUrl` manually in the contest builder form.
- Learner sees `<audio controls src={audioUrl}>` in the contest start page.
- Transcript is saved but **not shown to learners** during the attempt or result.

---

## Future: Object Storage Integration

### Recommended options (no preference order)

| Provider | Product | Notes |
|---|---|---|
| Vercel | Vercel Blob | Native Vercel integration, serverless |
| Supabase | Storage | S3-compatible, generous free tier |
| Cloudflare | R2 | S3-compatible, no egress fees |
| AWS | S3 | Industry standard, most mature |
| Google Cloud | Cloud Storage | GCS with Firebase/Cloud Run |

### Upload flow (future phase)

```
Admin uploads file
  → API route receives multipart form data
  → Upload to object storage (e.g., Vercel Blob)
  → Receive public URL (e.g., https://cdn.example.com/audio/contest-01.mp3)
  → Save URL to ContestSection.audioUrl
  → Optionally store file size/mime type in metadata
```

### Considerations

- **CORS headers**: configure storage bucket for cross-origin access from your domain.
- **Signed URLs**: for private contests, consider time-limited signed URLs instead of public URLs.
- **Audio format**: prefer MP3 (most compatible) or AAC/OGG as fallback.
- **Transcript management**: store `transcript` in DB, consider a rich text editor for longer transcripts.

---

## Future Phases

### Phase 3 — File Upload UI

- [ ] Drag-and-drop file upload in contest builder
- [ ] Progress indicator during upload
- [ ] File validation (type: audio/mpeg, audio/mp4, audio/wav; max size: 50 MB)
- [ ] Replace audio preview in admin UI

### Phase 4 — Transcript Management

- [ ] Rich text editor for transcripts
- [ ] Optional: show transcript on result/review page for self-study contests
- [ ] Speaker timestamps (JSON metadata format)

### Phase 5 — Listening Review Mode

- [ ] Learner can replay audio during review
- [ ] Show transcript alongside questions on result page
- [ ] "Show transcript" toggle for self-study contests

### Phase 6 — Writing in Contests

- [ ] Writing sections with rich text editor
- [ ] Manual grading workflow for contest writing submissions
- [ ] Writing rubric and scoring

### Phase 7 — Contest Analytics

- [ ] Per-section completion rates
- [ ] Audio listen frequency (for Listening sections)
- [ ] Time-spent breakdown per section
- [ ] Export contest results to CSV

---

## Data Model Summary

### ContestSection

| Field | Type | Notes |
|---|---|---|
| id | String | PK |
| contestId | String | FK → Contest |
| title | String | Section name |
| skillType | SkillType | USE_OF_ENGLISH, READING, WRITING, LISTENING, ... |
| orderIndex | Int | Display order |
| instructions | String? | Shown to learner |
| points | Float? | Optional per-section points |
| audioUrl | String? | Audio URL/path for LISTENING |
| transcript | String? | Full transcript (admin-only) |
| passageText | String? | Reading passage text |
| metadata | Json? | Future extension |

### ContestQuestion

| Field | Type | Notes |
|---|---|---|
| id | String | PK |
| sectionId | String | FK → ContestSection |
| orderIndex | Int | Display order |
| type | QuestionType | MCQ, SHORT_ANSWER, WORD_FORMATION, LISTENING_SHORT_ANSWER, ... |
| prompt | String? | Question text |
| optionsJson | Json? | MCQ options: [{id, text}, ...] |
| answerJson | Json? | Answer key: {correctOptionId} or {acceptedAnswers: [...]} |
| points | Float? | Points for this question |
| explanation | String? | Shown after submission |
| rootWord | String? | Word Formation root word |

### Changes to existing models

- `Contest` now includes `sections ContestSection[]`
- `SkillType` enum added `USE_OF_ENGLISH`
- `ContestProblem` (existing) still works alongside new `ContestSection`+`ContestQuestion`

---

## Routes Added

| Route | Purpose |
|---|---|
| GET /admin/contests-builder | List all contests |
| GET /admin/contests-builder/new | Create new contest |
| GET /admin/contests-builder/[id]/edit | Edit contest with section/question builder |

---

## Validation Rules

A contest cannot be published (via "Xuất bản" button) if:
- Title is empty
- No sections exist
- A Listening section has no `audioUrl`
- Any non-Writing section has zero questions
- A question is missing a prompt
- An MCQ-type question has no `optionsJson`
- An auto-gradable question has no `answerJson`
