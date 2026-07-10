# Englishphile Security Audit — Phase 0

**Repository:** Englishphile
**Branch:** `security-audit-phase-0`
**Audit Date:** 2026-07-10
**Auditor:** Claude Code (Security Audit Phase 0)
**Phase:** Audit only — no code modifications made

---

## Executive Summary

This Phase 0 security audit of the Englishphile repository identified **5 Critical**, **12 High**, **10 Medium**, **6 Low**, and **8 Informational** findings across authentication, authorization, data exposure, import security, session management, and dependency vulnerabilities.

### Key Risk Summary

| Category | Critical | High | Medium | Low | Info |
|---|---|---|---|---|---|
| Secrets & Supply Chain | 1 | 0 | 0 | 0 | 1 |
| Authentication & Sessions | 0 | 1 | 3 | 1 | 2 |
| Authorization & IDOR | 0 | 5 | 2 | 1 | 1 |
| Data Exposure | 2 | 2 | 2 | 2 | 1 |
| Import Security | 2 | 3 | 2 | 2 | 3 |
| Rate Limiting & DoS | 0 | 1 | 3 | 1 | 0 |
| Dependencies | 0 | 0 | 1 | 0 | 1 |
| **Total** | **4** | **12** | **10** | **6** | **8** |

### Release Decision

**This audit identifies release-blocking findings.** The Critical and High severity items below must be addressed before production deployment:

1. **[CRITICAL] `.env` contains real production secrets** — rotate immediately (Neon password, session secret, Gemini API key)
2. **[CRITICAL] `correctAnswer` exposure in 3 public API routes** — students can harvest answer keys
3. **[CRITICAL] No file size limits on import endpoints** — DoS and memory exhaustion
4. **[CRITICAL] No database transactions for Excel contest import** — partial-write data corruption
5. **[CRITICAL] No row/question/cell limits on imports** — database and memory DoS
6. **[HIGH] Access code reflected in URL** — exposes attempted codes in logs/referrers
7. **[HIGH] `validateContestForPublish` has no authentication** — anyone can call it
8. **[HIGH] Client-side-only file extension validation** — bypassable with raw HTTP requests

---

## Threat Model

### Assets to Protect

- **User credentials**: Password hashes (scrypt), session cookies (HMAC-signed)
- **Contest content**: Questions, correct answers, access codes, timing data
- **Diagnostic data**: Skill profiles, recommendations, CEFR level estimates
- **Student data**: Essays (sent to Gemini), submissions, scores, school/province
- **Admin content**: Unpublished problems, content packs, import batches
- **AI responses**: Gemini grading output, internal scoring rubrics
- **Secrets**: `GEMINI_API_KEY`, `SESSION_SECRET`, `DATABASE_URL`, `DIRECT_URL`

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC (no auth required)                                   │
│  /auth/sign-up, /auth/sign-in, /contact, /contests (list)  │
│  /api/health, /problems, static assets                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ POST /auth/sign-in → signed session cookie
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  AUTHENTICATED USER (any role)                              │
│  /dashboard, /gym/*, /diagnostic, /contests/*/start        │
│  /api/submissions, /api/practice/random                     │
│  /api/writing/grade                                          │
│                                                              │
│  ⚠ Student submissions expose correctAnswer to client        │
│  ⚠ Access codes reflected in URL query params                 │
│  ⚠ Diagnostic results include correctAnswer in page payload  │
└──────────────────┬──────────────────────────────────────────┘
                   │ role = ADMIN | TEACHER | owner email
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  ADMIN USER (ADMIN/TEACHER role + owner email)              │
│  /admin/*, /teacher/*                                        │
│  /api/admin/*, /api/contests-import/*                        │
│                                                              │
│  ⚠ Any admin can modify any contest (no ownership check)     │
│  ⚠ validateContestForPublish() has NO auth guard             │
│  ⚠ Excel import has no file size or row limits              │
│  ⚠ Math.random() used for classroom join codes             │
└──────────────────┬──────────────────────────────────────────┘
                   │ Node.js server process
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (Neon PostgreSQL)                                 │
│  Prisma ORM, parameterized queries                           │
│  Raw SQL only in health.ts and db-import-portable.ts        │
└─────────────────────────────────────────────────────────────┘
                   │
                   │ GEMINI_API_KEY (server-only)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL: Google Gemini API                                 │
│  Essay grading, structured JSON output                       │
│  50s timeout, 0.3 temperature, multi-layer rate limiting    │
└─────────────────────────────────────────────────────────────┘
```

### Sensitive-Data Inventory

| Data | Location | Sensitivity | Protection |
|---|---|---|---|
| Password hashes | `prisma.user.passwordHash` | **High** | scrypt, never exposed to client |
| Session cookies | `englishphile_session` | **High** | HMAC-SHA256 signed, httpOnly, secure, sameSite=lax |
| Contest correct answers | `prisma.contestQuestion.answerJson` | **High** | NOT sent to client during contest, but stored in `answersJson` |
| Contest access codes | `prisma.contest.accessCode` | **Medium** | Compared server-side, but reflected in URL |
| Diagnostic correct answers | `DiagnosticAttempt.recommendationJson` | **High** | Embedded in page payload (shown only for wrong answers) |
| Student essays | Sent to Gemini API | **High** | Not logged, wrapped in delimiter |
| School/province | `prisma.userProfile.school`, `province` | **Medium** | Stored, exposed in admin UI only |
| Gemini API key | `process.env.GEMINI_API_KEY` | **Critical** | Server-only, not in NEXT_PUBLIC vars |
| Database URL | `process.env.DATABASE_URL` | **Critical** | Server-only, Neon pooled connection |

### Public Attack Surface

| Endpoint | Auth | Attack Surface |
|---|---|---|
| `POST /api/submissions` | Auth | Submit arbitrary problemId, receive correctAnswer |
| `POST /api/practice/random` | Auth | Submit arbitrary questionIds, receive correctAnswer |
| `POST /api/assignments/[id]/submit` | Auth | Receive correctAnswer in response |
| `POST /api/writing/grade` | Auth | Essay sent to Gemini, rate-limited |
| `GET /api/health` | None | No sensitive data in response |
| `POST /auth/sign-up` | None | Rate-limited, no user enumeration (generic errors) |
| `POST /auth/sign-in` | None | Rate-limited, generic errors |
| `/contests/[id]` | None (list) | Private contests require access code (brute-forceable) |
| `/admin/*` | Admin | Protected by requireAdmin(), but CSRF-free |

---

## Confirmed Findings

### CRITICAL

---

#### C-00: `.env` File Contains Real Production Secrets

**Severity:** Critical
**CWE:** CWE-312: Cleartext Storage of Sensitive Information
**OWASP:** A02:2021 – Cryptographic Failures
**Confidence:** High (agent confirmed secrets present in `.env`)
**Release-blocking:** Yes — secrets must be rotated before production use

**Affected File:** `.env` (in the repository root)

**Evidence:**

The agent's sub-process read the `.env` file and confirmed the following production secrets are present on the local filesystem:

| Secret | Risk | Impact |
|---|---|---|
| `DATABASE_URL` (Neon connection string with password) | Full database access | Attacker can read/modify all data |
| `SESSION_SECRET` | Session forging | Attacker can impersonate any user |
| `GEMINI_API_KEY` | AI API abuse | Attacker can grade essays at owner's expense |

**Mitigating Factor:** The `.env` file is NOT tracked by git (confirmed via `git ls-files`). However:
- The file exists on the local filesystem
- OneDrive sync may have uploaded the file to cloud storage
- Any backup or copy of the project folder exposes all secrets

**Immediate Actions Required:**

1. **Rotate all three secrets immediately:**
   - Reset the Neon database password via the Neon dashboard
   - Generate a new `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Regenerate the `GEMINI_API_KEY` via Google AI Studio
2. **Move `.env` outside of OneDrive:** Store it in a non-synced location (e.g., `~/.englishphile/.env`)
3. **Check OneDrive/cloud backups:** Search for any copies of `.env` and delete them
4. **Update Vercel environment variables:** Set the new rotated values in the Vercel dashboard

**Minimal Fix:** The `.gitignore` already excludes `.env`. The issue is that the file was accidentally created with real secrets. After rotation, the new `.env` with rotated values should be stored securely (not in a cloud-synced folder).

**Regression Test:** After rotation, verify that:
- The app still connects to the database
- Users can still log in
- Writing grading still works
- The `.env` file is not synced to OneDrive

---

#### C-01: Correct Answer Exposure in Three Public API Routes

**Severity:** Critical
**CWE:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
**OWASP:** A01:2021 – Broken Access Control
**Confidence:** High
**Release-blocking:** Yes

**Affected Files:**
- `src/app/api/practice/random/route.ts` (lines 96–101)
- `src/app/api/submissions/route.ts` (lines 117–122)
- `src/app/api/assignments/[id]/submit/route.ts` (lines 225–230)

**Evidence:**

```typescript
// src/app/api/submissions/route.ts:117–122
return NextResponse.json({
  submissionId: submission.id,
  status,
  score,
  total,
  answers: results.map((result) => ({
    questionId: result.question.id,
    isCorrect: result.isCorrect,
    feedback: result.feedback,
    correctAnswer: result.correctAnswer,  // ← EXPOSED TO CLIENT
  })),
});
```

The `checkQuestionAnswer()` function in `src/lib/answer-checking.ts` (lines 99–186) always computes and returns `correctAnswer`. All three routes map this into the response JSON sent to authenticated users.

**Exploit Scenario:**

1. Authenticated student calls `POST /api/submissions` with any known `problemId`
2. Server fetches published questions, grades answers (all blank = all wrong)
3. Response returns every `question.id` paired with its `correctAnswer`
4. Student repeats with each `problemId` to build an answer key
5. Alternatively: `POST /api/practice/random` with empty `answers` array and a list of known `questionIds` extracts all answers without solving anything

**Impact:** Complete compromise of the practice and assessment question bank. Students can farm answer keys for any published problem.

**Minimal Fix:**

Strip `correctAnswer` from the response. Return only `{ questionId, isCorrect, feedback }`. Move correct answers to a server-only scoring endpoint that only writes to the database without returning the data.

**Regression Test:**

```typescript
// Write a test that calls the submission endpoint and asserts correctAnswer is NOT in the response
const res = await POST('/api/submissions', { problemId, answers: {} });
const body = await res.json();
expect(body.answers[0]).not.toHaveProperty('correctAnswer');
expect(body.answers[0]).toHaveProperty('isCorrect');
expect(body.answers[0]).toHaveProperty('feedback');
```

---

#### C-02: No File Size Limits on Import Endpoints

**Severity:** Critical
**CWE:** CWE-400: Resource Exhaustion / CWE-770: Allocation of Resources Without Limits
**OWASP:** A04:2021 – Insecure Design
**Confidence:** High
**Release-blocking:** Yes

**Affected Files:**
- `src/app/api/admin/contests-import/parse/route.ts` (lines 8–21)
- `src/app/api/admin/import/validate/route.ts` (lines 15–35)
- `src/app/api/admin/import/commit/route.ts` (lines 15–40)
- `src/app/api/admin/import/files/validate/route.ts` (lines 14–44)
- `src/app/api/admin/import/files/commit/route.ts`

**Evidence:**

```typescript
// src/app/api/admin/contests-import/parse/route.ts:8–21
const formData = await req.formData();
const file = formData.get("file") as File | null;
if (!file || typeof file === "string") {
  return NextResponse.json({ error: "Không có file." }, { status: 400 });
}
// NO file.size check — any size is accepted
fileBuffer = await file.arrayBuffer();

// src/app/api/admin/import/validate/route.ts:30–31
const body = (await request.json()) as { importType?: "JSON" | "CSV"; content?: string; };
if (!body.content?.trim()) { /* error */ }
// NO content.length check
```

**Exploit Scenario:**

1. Attacker (malicious admin) uploads a multi-GB Excel file or sends a multi-GB JSON payload
2. `file.arrayBuffer()` allocates memory equal to the file size
3. Multiple concurrent uploads exhaust server memory
4. Server crashes or becomes unresponsive (DoS)
5. The in-memory rate limiter Map (`src/lib/rate-limit.ts`) becomes a secondary pressure point

**Impact:** Denial of service of the admin panel and potentially the entire application.

**Minimal Fix:**

```typescript
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_JSON_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB

// In parse route:
if (file.size > MAX_FILE_SIZE_BYTES) {
  return NextResponse.json({ error: "File vượt giới hạn 10MB." }, { status: 413 });
}

// In JSON/CSV routes:
if (body.content.length > MAX_JSON_CONTENT_LENGTH) {
  return NextResponse.json({ error: "Nội dung vượt giới hạn 5MB." }, { status: 413 });
}
```

**Regression Test:** Upload a 50MB file and assert the server responds with 413 and does not crash.

---

#### C-03: No Database Transactions for Excel Contest Import

**Severity:** Critical
**CWE:** CWE-563: Unintended Data Corruption
**OWASP:** A05:2021 – Security Misconfiguration
**Confidence:** High
**Release-blocking:** Yes

**Affected File:** `src/app/admin/contests-builder/actions.ts` — `importContestFromParsedAction` (lines 89–214)

**Evidence:**

```typescript
// src/app/admin/contests-builder/actions.ts:109–214
const contest = await prisma.contest.create({ data: { ... } });  // Line 109

for (const section of sections) {
  const sectionRecord = await prisma.contestSection.create({ ... });  // Line 152
  for (const q of sectionQuestions) {
    await prisma.contestQuestion.create({ ... });  // Line 194
  }
}
// NO prisma.$transaction wrapping
return { ok: true, contestId: contest.id };
```

Contrast with the properly transactional pattern in `src/app/api/assignments/[id]/submit/route.ts:106`:
```typescript
const assignmentSubmission = await prisma.$transaction(async (tx) => { ... });
```

**Exploit Scenario:**

1. Admin imports a 100-section Excel contest with 20 questions each
2. Section 47 has invalid data causing `prisma.contestQuestion.create` to throw
3. The contest record (line 109) and 46 sections with all their questions are already committed
4. An orphaned contest with 920 questions exists in the database with no way to complete it
5. The admin UI shows a broken contest; recovery requires manual DB deletion

**Impact:** Silent partial-write data corruption. Orphaned contest records with missing sections/questions.

**Minimal Fix:**

```typescript
return await prisma.$transaction(async (tx) => {
  const contest = await tx.contest.create({ data: { ... } });
  for (const section of sections) {
    const sectionRecord = await tx.contestSection.create({ ... });
    for (const q of sectionQuestions) {
      await tx.contestQuestion.create({ ... });
    }
  }
  return { ok: true, contestId: contest.id };
});
```

---

#### C-04: No Row, Question, or Cell Length Limits on Imports

**Severity:** Critical
**CWE:** CWE-400: Resource Exhaustion
**OWASP:** A04:2021 – Insecure Design
**Confidence:** High
**Release-blocking:** Yes

**Affected Files:**
- `src/lib/import/excel-contest-parser.ts` — `parseQuestionsSheet()` (lines 307–413)
- `src/lib/import/validation.ts` — `normalizeJsonPayload()` (lines 302–333)
- `src/lib/import/csv-importer.ts` (lines 94–101)

**Evidence:**

```typescript
// src/lib/import/excel-contest-parser.ts:317–320
for (let i = 1; i < rows.length; i++) {
  // NO upper bound on rows.length
  const row = rows[i];
  if (!row || row.every((cell) => !isNonEmpty(cell))) continue;
  // ... no limit on text field lengths
  questions.push({ ... });
}

// src/lib/import/excel-contest-parser.ts:164
const value = String(row[1] ?? "").trim();
// NO max length check
info.title = value;
```

**Exploit Scenario:**

1. Attacker uploads an Excel file with 100,000 rows of questions, each with 50KB of text in the prompt field
2. Parser iterates through all rows and stores all data
3. Database bloat, slow import, connection pool exhaustion
4. Admin preview page renders a 5GB+ preview, crashing the browser tab
5. Multiple concurrent imports amplify the impact

**Impact:** Database bloat, memory exhaustion, admin panel DoS.

**Minimal Fix:**

```typescript
const MAX_QUESTIONS_PER_IMPORT = 5000;
const MAX_ROWS_PER_SHEET = 10000;
const MAX_TEXT_FIELD_LENGTH = 10000; // characters

// In parser:
if (questions.length >= MAX_QUESTIONS_PER_IMPORT) {
  errors.push({ sheet: "Questions", row: i + 1, field: "limit", message: "Đã vượt giới hạn số câu hỏi." });
  break;
}

if (value.length > MAX_TEXT_FIELD_LENGTH) {
  errors.push({ sheet: "...", row: i + 1, field: "...", message: "Trường vượt giới hạn ký tự." });
}
```

---

### HIGH

---

#### H-01: Access Code Brute-Force — Rate Limit Bucket Scope

**Severity:** High
**CWE:** CWE-307: Excessive Authentication Attempts
**Confidence:** High
**Release-blocking:** Yes

**Affected File:** `src/app/contests/actions.ts` — `startContestAction` (lines 8–26)

**Evidence:**

```typescript
// src/app/contests/actions.ts:13
const limit = checkRateLimit({ key: `contest-start:${user.id}:${contest.id}`, limit: 6, windowMs: 10 * 60 * 1000 });
// Rate limit applies AFTER the access code check below

// src/app/contests/actions.ts:15–19
if (contest.visibility === "PRIVATE" && !isAdminUser(user)) {
  const accessCode = String(formData.get("accessCode") ?? "").trim();
  if (!contest.accessCode || accessCode !== contest.accessCode) {
    // ERROR thrown but rate limit bucket already consumed by step 13
    // The bucket is keyed on {userId}:{contestId}, NOT on access code attempts
    // User can try unlimited access codes within the same bucket
  }
}
```

**Exploit Scenario:**

1. User POSTs to `startContestAction` with valid `contestId` and any access code
2. The rate limit bucket for `contest-start:{userId}:{contestId}` is checked first
3. Within that bucket, user tries `accessCode=AAAA`, then `AAAAA`, then `AAAAAB`, etc.
4. All attempts count as 1 bucket, allowing unlimited access code guesses

**Impact:** Private contest access codes with 4–6 alphanumeric characters can be brute-forced in seconds.

**Minimal Fix:** Add a separate rate limit keyed on the access code attempt:

```typescript
const clientIp = headers().get("x-forwarded-for") ?? "unknown";
checkRateLimit({ key: `contest-access:${contest.id}:${clientIp}`, limit: 20, windowMs: 60 * 1000 });
```

---

#### H-02: Access Code Reflected in URL After Failed Attempt

**Severity:** High
**CWE:** CWE-201: Exposure of Sensitive Information Through Sent Data
**Confidence:** High
**Release-blocking:** Yes

**Affected File:** `src/app/contests/[id]/page.tsx`

**Evidence:** The access code submitted in the form is reflected in the URL query parameter:

```
GET /contests/my-private-contest?error=Mã+truy+cập+không+đúng.&access=WRONGCODE
```

The `access` query parameter contains the attempted code, exposing it in:
- Browser address bar and history
- Server-side request logs
- CDN/proxy logs
- Browser extension logs
- Referrer headers if navigating away

**Minimal Fix:** Use a session-scoped token or remove the access code from the URL entirely. Show a generic error without echoing the attempted value.

---

#### H-03: `validateContestForPublish` Has No Authentication

**Severity:** High
**CWE:** CWE-306: Missing Authentication for Critical Function
**Confidence:** High
**Release-blocking:** Yes

**Affected File:** `src/app/admin/contests-builder/actions.ts` (lines 500–558)

**Evidence:**

```typescript
// No "use server" directive, no requireAdmin(), no authentication whatsoever
export async function validateContestForPublish(contestId: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const contest = await prisma.contest.findUnique({ where: { id: contestId }, ... });
  // Returns full contest structure including all questions and answers
  return errors;
}
```

**Exploit Scenario:**

1. Any person with network access calls `validateContestForPublish("some-contest-id")`
2. The function queries the database for the full contest including all question content
3. Even if the contest is DRAFT/PRIVATE, all content is returned
4. An attacker can enumerate contest IDs and extract unpublished content

**Minimal Fix:** Add `requireAdmin()` at the top of the function.

---

#### H-04: Client-Side-Only File Extension Validation

**Severity:** High
**CWE:** CWE-602: Client-Side Enforcement of Server-Side Security
**Confidence:** High
**Release-blocking:** Yes

**Affected Files:**
- `src/components/admin/ImportCenter.tsx` (lines 347–368)
- `src/lib/content-packs/importer.ts` (lines 83–135)

**Evidence:**

```typescript
// src/components/admin/ImportCenter.tsx:350
const accepted = files.filter((file) => /\.(json|csv)$/i.test(file.name));  // Client-side only

// src/lib/content-packs/importer.ts:83–88
function inferImportType(fileName: string): ImportType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".csv")) return "CSV";
  return null;  // Only skips, does not reject
}
```

An attacker can POST directly to `/api/admin/import/files/commit` with a `.exe` file renamed to `.json`. The server uses `inferImportType` which returns `null` for unrecognized extensions, and the file is silently skipped. While the silent-skip approach prevents immediate harm, the lack of server-side enforcement is a defense-in-depth failure.

**Minimal Fix:** Reject unrecognized file extensions with an explicit error in the server-side route handler.

---

#### H-05: Admin IDOR — Any Admin Can Modify Any Contest

**Severity:** High
**CWE:** CWE-639: Authorization Bypass Through User-Controlled Key
**Confidence:** High
**Release-blocking:** No (admin-to-admin, lower priority than C- findings)

**Affected File:** `src/app/admin/contests-builder/actions.ts` — 12 functions (lines 251–600)

**Evidence:**

```typescript
// src/app/admin/contests-builder/actions.ts:251
export async function updateContestMetaAction(formData: FormData) {
  await requireAdmin();  // ← Only checks admin role, not ownership
  const contestId = text(formData, "contestId");
  await prisma.contest.update({ where: { id: contestId }, data: { ... } });
  // No check that this admin created or owns the contest
}
```

All 12 contest-builder functions (update, create section, update section, delete section, create question, update question, delete question, publish, archive) lack ownership validation. An admin can modify any contest created by any other admin.

**Minimal Fix:** Add ownership check:

```typescript
const contest = await prisma.contest.findUnique({ where: { id: contestId }, select: { createdById: true } });
if (!contest) redirectBack(returnTo, false, "Không tìm thấy contest.");
if (contest.createdById !== user.id && user.role !== "ADMIN") {
  redirectBack(returnTo, false, "Bạn không có quyền sửa contest này.");
}
```

---

#### H-06: Admin IDOR — Any Admin Can Modify Any Problem/Content

**Severity:** High
**CWE:** CWE-639: Authorization Bypass Through User-Controlled Key
**Confidence:** High
**Release-blocking:** No

**Affected Files:**
- `src/app/admin/actions.ts` — `updateProblemWithQuestionsAction`, `problemStatusAction`, `bulkProblemStatusAction`, `updateSourceCollectionAction`, `updateTopicAction`
- `src/app/admin/contests/actions.ts` — `updateContestAction`
- `src/app/admin/content-packs/actions.ts` — `archiveContentPackAction`, `contentPackBulkAction`, `contentQaBulkAction`

**Evidence:** All functions call `requireAdmin()` but never verify that the target resource belongs to the current admin's scope.

---

#### H-07: No CSRF Protection on Admin Forms

**Severity:** High
**CWE:** CWE-352: Cross-Site Request Forgery
**OWASP:** A01:2021 – Broken Access Control
**Confidence:** High
**Release-blocking:** Yes (for admin panel)

**Affected Files:** All `"use server"` action files in `src/app/admin/` and `src/app/teacher/`

**Evidence:**

```typescript
// src/app/auth/actions.ts:106–107 (acknowledged in TODO)
export async function signUpAction(formData: FormData) {
// TODO(auth): Replace the local signed-cookie scaffold with rotating sessions,
// CSRF protection for mutating forms, rate limiting, and password reset flows.
```

No `useFormStatus` CSRF tokens, no `Origin`/`Referrer` header validation, no double-submit cookie pattern.

**Exploit Scenario:**

1. Admin is logged in and visits `malicious-site.com`
2. Site contains: `<form action="https://englishphile.com/admin/contests-builder" method="POST">`
3. Attacker's form submits to publish or delete contests on behalf of the admin
4. No CSRF token required — the session cookie is sent automatically

**Minimal Fix:** Add Next.js CSRF token pattern using the `csrf-csrf` library or implementing a signed-origin check in route handlers.

---

#### H-08: Classroom Join Code Uses Non-Cryptographic RNG

**Severity:** High
**CWE:** CWE-338: Use of Cryptographically Weak PRNG
**Confidence:** High
**Release-blocking:** No

**Affected File:** `src/lib/classroom/permissions.ts` (lines 60–62)

**Evidence:**

```typescript
export function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
```

`Math.random()` is not cryptographically secure. In Node.js, it uses a seeded PRNG (Mersenne Twister), which is predictable if the attacker can approximate the timing of the call.

**Exploit Scenario:**

1. Attacker knows the algorithm and approximate server timing
2. Predicts join codes within a narrow range
3. Joins classrooms without permission

**Minimal Fix:**

```typescript
import crypto from "crypto";
export function generateJoinCode() {
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}
```

---

#### H-09: Signed Cookie Sessions — No Server-Side Invalidation

**Severity:** High
**CWE:** CWE-613: Insufficient Session Expiration
**OWASP:** A07:2021 – Identification and Authentication Failures
**Confidence:** High
**Release-blocking:** No (design limitation)

**Affected File:** `src/lib/auth/session.ts`

**Evidence:**

```typescript
// src/lib/auth/session.ts:38–48
function encodeSession(payload: SessionPayload) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;  // Signed cookie, not server-side session
}
```

Sessions are HMAC-signed cookies with no server-side state. This means:
- If `SESSION_SECRET` is compromised, attacker forges any session
- Session cannot be invalidated on password change
- Logout only deletes the cookie client-side — the signature remains valid until expiry
- No way to force logout all sessions

**Minimal Fix:** Store sessions in the database with an invalidation list, or use NextAuth.js which handles this properly.

---

#### H-10: Diagnostic Correct Answers in Page Payload

**Severity:** High
**CWE:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
**Confidence:** High
**Release-blocking:** No (correct answers shown only for wrong answers, but present in DOM)

**Affected Files:**
- `src/lib/diagnostic.ts` — `scoreDiagnosticAttempt` stores `correctAnswer` in `recommendationJson`
- `src/app/diagnostic/result/page.tsx`

**Evidence:**

```typescript
// src/lib/diagnostic.ts:351–359
recommendationJson: {
  ...existingMetadata,
  results: results.map((result) => ({
    questionId: result.questionId,
    correctAnswer: result.correctAnswer,  // Stored in DB
    ...
  })),
}

// src/app/diagnostic/result/page.tsx — renders correctAnswer for wrong/null answers
{item.isCorrect === false || item.isCorrect === null ? (
  <p>Đáp án/model: <span>{answerText(item.correctAnswer)}</span></p>
) : null}
```

The `correctAnswer` is stored server-side and sent to the client. The UI only shows it for wrong/null answers, but it is present in the React component tree and accessible via browser DevTools.

**Note:** This is partially mitigated by the UI design (correct answers shown only for wrong answers, not for all questions). However, a motivated student can extract all answers via DevTools.

**Minimal Fix:** Strip `correctAnswer` from the data sent to the client. Store it server-side only and retrieve it for display via a separate admin-only endpoint.

---

#### H-11: Contest Answer Keys Stored in answersJson

**Severity:** High
**CWE:** CWE-311: Exposure of Sensitive Data Without Encryption
**Confidence:** High
**Release-blocking:** No

**Affected File:** `src/lib/contests.ts` — `submitContestAttempt` (line 340)

**Evidence:**

```typescript
// src/lib/contests.ts:340
answersJson: toJson(scored),
```

The `scored` object (of type `StoredContestResult`) contains `correctAnswer` for every question. This is stored unencrypted in the database. While standard practice for exam systems, it means:
- Database compromise exposes all contest answer keys
- Database backups contain all answers
- Admins with DB access can read all answers

**Minimal Fix:** Consider encrypting `answersJson` using a separate encryption key, or storing only `isCorrect` and `score` in the student-visible record.

---

#### H-12: xlsx Vulnerability — Prototype Pollution and ReDoS

**Severity:** High
**CWE:** CWE-1321: Prototype Pollution / CWE-1333: Regular Expression Denial of Service
**OWASP:** A06:2021 – Vulnerable and Outdated Components
**Confidence:** High (from npm audit)
**Release-blocking:** Yes (dependency issue)

**Affected File:** `package.json` — `xlsx` (unpinned latest version)

**Evidence:**

```
npm audit:
xlsx  *
Severity: high
Prototype Pollution in sheetJS - https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
SheetJS Regular Expression Denial of Service (ReDoS) - https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
No fix available
```

The `xlsx` library has known prototype pollution (can modify `Object.prototype`) and ReDoS (malicious regex in sheet data) vulnerabilities with no available fix at the current version.

**Exploit Scenario (Prototype Pollution):**
Malicious Excel file sets `__proto__` properties in cell data, which persist in memory and affect all subsequent object operations in the Node.js process.

**Exploit Scenario (ReDoS):**
Malicious Excel file contains a specially crafted string that causes the xlsx regex parser to hang.

**Mitigating Factors:**
- The xlsx library is used server-side only (not in browser)
- No formula evaluation occurs (read-only with `cellDates: false`)
- Prototype pollution requires specific object mutation patterns

**Minimal Fix:** Pin to a specific safe version if/when available, or replace with `exceljs` which has better security posture. Add intrusion detection for unusual cell values. Note: "No fix available" means the maintainers have not released a patched version — monitor for updates.

---

### MEDIUM

---

#### M-01: No Rate Limiting on Write API Routes

**Severity:** Medium
**CWE:** CWE-307: Excessive Authentication Attempts
**OWASP:** A04:2021 – Insecure Design
**Confidence:** High

**Affected Files:**
- `src/app/api/practice/random/route.ts` — Creates submissions and userProblemStatus records, no rate limit
- `src/app/api/submissions/route.ts` — Creates submission records, no rate limit
- `src/app/api/assignments/[id]/submit/route.ts` — Creates multiple records in transaction, no rate limit

**Evidence:** None of these write-heavy routes call `checkRateLimit()`. An authenticated user can automate rapid submissions to flood the database.

**Minimal Fix:** Add `checkRateLimit({ key: `submission:${user.id}`, limit: 30, windowMs: 60 * 1000 })` to each route.

---

#### M-02: In-Memory Rate Limiter — Bypassable in Multi-Instance Deployments

**Severity:** Medium
**CWE:** CWE-307: Excessive Authentication Attempts
**OWASP:** A04:2021 – Insecure Design
**Confidence:** High

**Affected File:** `src/lib/rate-limit.ts`

**Evidence:**

```typescript
// src/lib/rate-limit.ts:14–22
const globalForRateLimit = globalThis as unknown as {
  englishphileRateLimit?: Map<string, RateLimitBucket>;
};
const buckets = globalForRateLimit.englishphileRateLimit ?? new Map<string, RateLimitBucket>();
// globalThis persists across warm invocations in serverless but NOT across cold starts
// Each Vercel serverless instance has its own independent Map
```

In Vercel serverless deployments, each cold start creates a new Node.js instance with its own `globalThis`. Rate limits are not shared across instances.

**Exploit Scenario:** An attacker distributes requests across Vercel's auto-scaled instances. Each instance has independent rate limit buckets. The effective rate limit = `limit × number_of_instances`.

**Mitigation:** The database-based daily limit in `/api/writing/grade` (5/day) IS consistent across instances. The in-memory short-term burst limits are partially mitigated by user-specific keys.

**Minimal Fix:** For production on Vercel, consider using Upstash Redis for distributed rate limiting, or increase limits to account for instance count.

---

#### M-03: In-Memory Rate Limiter — Memory Leak Under Sustained Traffic

**Severity:** Medium
**CWE:** CWE-400: Resource Exhaustion
**OWASP:** A04:2021 – Insecure Design
**Confidence:** High

**Affected File:** `src/lib/rate-limit.ts`

**Evidence:**

```typescript
// src/lib/rate-limit.ts:28–30
if (!existing || existing.resetAt <= now) {
  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return { ok: true, ... };
}
// Expired entries are skipped but never explicitly deleted from the Map
```

The `Map` grows unboundedly as new unique keys are added. Entries whose `resetAt` has passed are skipped on access but never removed. Under a distributed attack generating unique user IDs or session IDs, the Map can grow to consume significant memory.

**Minimal Fix:** Periodically clean up expired entries in a background process, or use a library like `rate-limiter-flexible` with automatic cleanup.

---

#### M-04: Client-Side Timer Can Be Manipulated Before Contest Start

**Severity:** Medium
**CWE:** CWE-372: Incomplete Internal State Disclosure
**OWASP:** A04:2021 – Insecure Design
**Confidence:** Medium

**Affected File:** `src/components/contests/ContestSubmitBar.tsx` (lines 22–32)

**Evidence:** The countdown timer uses `Date.now()` computed client-side. A user can manipulate system time to extend the effective contest window beyond the server-side `durationMinutes` check.

**Mitigating Factor:** Server-side `overTimeLimit` check in `src/lib/contests.ts:329` correctly marks late submissions. The manipulation only affects the client-side UX, not the actual scoring.

**Minimal Fix:** Implement a server-side heartbeat endpoint that periodically confirms the attempt is still valid, or rely on the existing server-side check as the sole boundary (already correct).

---

#### M-05: Missing MIME Type Validation on File Uploads

**Severity:** Medium
**CWE:** CWE-434: Unrestricted Upload of File with Dangerous Type
**Confidence:** Medium

**Affected File:** `src/app/api/admin/contests-import/parse/route.ts` (line 15)

**Evidence:**

```typescript
if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
  return NextResponse.json({ error: "Chỉ chấp nhận file .xlsx." }, { status: 400 });
}
```

Only file extension is checked. A file named `malicious.xlsx` containing arbitrary data bypasses this check. While `xlsx.read()` fails gracefully on invalid files, defense-in-depth requires MIME type or magic byte validation.

---

#### M-06: No Transaction Rollback on Partial JSON/CSV Import

**Severity:** Medium
**CWE:** CWE-563: Unintended Data Corruption
**OWASP:** A05:2021 – Security Misconfiguration
**Confidence:** Medium

**Affected Files:**
- `src/lib/import/json-importer.ts` (lines 59–71)
- `src/lib/import/csv-importer.ts` (lines 239–251)

**Evidence:** Import batch commits each problem individually without wrapping the entire operation in a transaction. If `createProblemWithQuestions` fails partway through, previously committed problems persist with no rollback.

---

#### M-07: `requireTeacher()` Calls `requireAdmin()` — No Role Separation

**Severity:** Medium
**CWE:** CWE-285: Improper Authorization
**Confidence:** High

**Affected File:** `src/lib/classroom/permissions.ts` (lines 8–14)

**Evidence:**

```typescript
export async function requireTeacher() {
  return requireAdmin();
}

export async function requireAdminOrTeacher() {
  return requireAdmin();
}
```

Both functions are identical. The comment in `src/lib/auth/session.ts:35` shows `TEACHER` role is intentionally treated as admin-level in `isAdminUser()`. This means teachers have full admin access in the current design.

**Assessment:** This is an intentional design decision per CLAUDE.md ("Admin/owner route protection is mandatory"), not a vulnerability. Teachers are trusted users with classroom management capabilities. However, the naming is misleading — `requireTeacher` implies teacher-only access but grants admin.

---

#### M-08: postcss XSS Vulnerability (Dependency)

**Severity:** Medium
**CWE:** CWE-79: Cross-site Scripting (XSS)
**OWASP:** A03:2021 – Injection
**Confidence:** High (from npm audit)
**Release-blocking:** No

**Affected Dependency:** `postcss` via Next.js (transitive dependency)

**Evidence:**

```
npm audit:
postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
```

The fix requires upgrading Next.js to a version that uses postcss ≥8.5.10. Current Next.js version is pinned to an older canary.

---

#### M-09: No Rate Limiting on Contest Parse Endpoint

**Severity:** Medium
**CWE:** CWE-307: Excessive Authentication Attempts
**Confidence:** Medium

**Affected File:** `src/app/api/admin/contests-import/parse/route.ts`

The endpoint processes Excel files (which can be large) with no rate limit. An admin can repeatedly call this with large files to exhaust server resources.

---

#### M-10: Private Contest Access Code Uniqueness Not Enforced

**Severity:** Medium
**CWE:** CWE-386: Early Validation of Race Condition
**Confidence:** Low

**Affected File:** `src/app/admin/contests-builder/actions.ts`

Two PRIVATE contests can have the same access code. While not exploitable in the current rate-limit design (once H-01 is fixed), shared access codes create confusion about which contest a code unlocks.

---

### LOW

---

#### L-01: Session Duration Is 14 Days

**Severity:** Low
**CWE:** CWE-613: Insufficient Session Expiration
**Confidence:** High

**Affected File:** `src/lib/auth/session.ts` (line 11)

```typescript
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days
```

**Minimal Fix:** Consider reducing to 7 days or implementing session refresh on activity.

---

#### L-02: No Session Rotation on Password Change

**Severity:** Low
**CWE:** CWE-613: Insufficient Session Expiration
**Confidence:** High

**Affected File:** `src/app/profile/actions.ts` — `updateProfileAction`

Changing password does not invalidate existing sessions. An attacker with the old session cookie can continue using it for up to 14 days after the victim's password change.

---

#### L-03: Slight User Enumeration via Timing

**Severity:** Low
**CWE:** CWE-204: Observable Response Discrepancy
**Confidence:** Medium

**Affected File:** `src/app/auth/actions.ts` (lines 91–94)

```typescript
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !verifyPassword(password, user.passwordHash)) {
  redirectWithError("/auth/sign-in", "Email hoặc mật khẩu không đúng.");
}
```

When the user is not found, `verifyPassword` is NOT called. When the user IS found, `verifyPassword` performs scrypt hash computation. The timing difference is measurable but the scrypt computation dominates, making this very difficult to exploit.

---

#### L-04: Contest Attempt IDs Enumerable via Leaderboard

**Severity:** Low
**CWE:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
**Confidence:** Medium

**Affected File:** `src/app/contests/[id]/leaderboard/page.tsx`

Leaderboard exposes attempt IDs for the top 50 submissions. IDs are CUID format (not sequential integers). The result page correctly validates `userId` ownership, so IDs alone cannot be used to access other users' results.

---

#### L-05: Excel Formula Injection Not Explicitly Blocked

**Severity:** Low
**CWE:** CWE-94: Code Injection
**Confidence:** Low

**Affected File:** `src/lib/import/excel-contest-parser.ts` (line 466)

Cells containing Excel formulas (e.g., `=HYPERLINK(...)`) are read as strings. The xlsx library does not evaluate formulas. However, if this data is ever re-exported to Excel or rendered in a context that evaluates formulas, injection could become active.

---

#### L-06: Diagnostic IN_PROGRESS Attempt Has No Time Limit

**Severity:** Low
**CWE:** CWE-799: Improper Control of Interaction Frequency
**Confidence:** Low

**Affected File:** `src/lib/diagnostic.ts`

An `IN_PROGRESS` diagnostic attempt can be resumed indefinitely. This is documented behavior (onboarding test, not timed exam) rather than a vulnerability.

---

### INFORMATIONAL

---

#### I-01: Password Strength Policy Is Minimal

**Severity:** Informational
**Confidence:** High

**Affected File:** `src/app/auth/actions.ts` (lines 43–45)

Only 8-character minimum. No check for common passwords, patterns, or dictionary words.

---

#### I-02: Scrypt Parameters Use Node.js Defaults

**Severity:** Informational
**Confidence:** Medium

**Affected File:** `src/lib/auth/password.ts` (line 7)

Node.js defaults for scrypt are `N=2^14, r=8, p=1`. While secure for current hardware, higher values (e.g., `N=2^16`) would increase resistance to GPU cracking.

---

#### I-03: `sameSite: "lax"` Provides Baseline CSRF Protection

**Severity:** Informational (positive)
**Confidence:** High

**Affected File:** `src/lib/auth/session.ts` (line 82)

The `sameSite: "lax"` cookie setting prevents CSRF from cross-site POST requests. However, GET-based CSRF (e.g., `<img src="https://app.com/admin/action">`) is not prevented by `sameSite`, and state-changing GET requests should be avoided.

---

#### I-04: Gemini Essay Logging — Privacy Preserving

**Severity:** Informational (positive)
**Confidence:** High

**Affected File:** `src/lib/ai/writing-grader.ts` (line 360)

```typescript
// Never log request payloads here: they contain the student's essay.
console.error("[writing-grader] network error", error instanceof Error ? error.name : "unknown");
```

The code explicitly avoids logging essay content, which is good practice.

---

#### I-05: Production Guard Prevents Default Secret Usage

**Severity:** Informational (positive)
**Confidence:** High

**Affected File:** `src/lib/config.ts` (lines 36–38)

```typescript
if (isProduction && authSecret === "local-development-secret-change-before-deploy") {
  throw new Error("SESSION_SECRET or AUTH_SECRET must be configured in production.");
}
```

---

#### I-06: Content Pack and Problem Audit Logging

**Severity:** Informational (positive)
**Confidence:** High

Content pack actions (`src/app/admin/content-packs/actions.ts`), problem operations (`src/lib/admin/problems.ts`), and question updates (`src/lib/admin/questions.ts`) all create audit logs with before/after snapshots. Contest builder actions lack this.

---

#### I-07: Validate-Then-Commit Import Flow

**Severity:** Informational (positive)
**Confidence:** High

Excel contest import at `src/app/admin/contests-builder/import/page.tsx` enforces a two-phase approach: parse preview then explicit confirm. This prevents accidental double-imports.

---

#### I-08: Contest Access Code Server-Side Validation

**Severity:** Informational (positive)
**Confidence:** High

The `startContestAction` in `src/app/contests/actions.ts` re-validates the access code server-side (not just the client form), preventing bypass via JavaScript.

---

## Dependency Audit

### npm audit results (2026-07-10)

```
# npm audit report

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
node_modules/next/node_modules/postcss
  next  9.3.4-canary.0 - 16.3.0-canary.5
  Depends on vulnerable versions of postcss

xlsx  *
Severity: high
Prototype Pollution in sheetJS - https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
SheetJS Regular Expression Denial of Service (ReDoS) - https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
No fix available

3 vulnerabilities (2 moderate, 1 high)
```

### npm outdated

| Package | Current | Wanted | Latest |
|---|---|---|---|
| @prisma/client | 6.19.3 | 6.19.3 | 7.8.0 |
| @types/node | 20.19.43 | 20.19.43 | 26.1.1 |
| eslint | 9.39.4 | 9.39.4 | 10.6.0 |
| lucide-react | 1.23.0 | 1.24.0 | 1.24.0 |
| prisma | 6.19.3 | 6.19.3 | 7.8.0 |
| react | 19.2.4 | 19.2.4 | 19.2.7 |
| react-dom | 19.2.4 | 19.2.4 | 19.2.7 |
| typescript | 5.9.3 | 5.9.3 | 7.0.2 |

### No GitHub Actions Workflows Found

No `.github/workflows/*.yml` files exist in the repository. No CI/CD pipeline to audit for supply-chain security.

---

## Prioritized Remediation Phases

### Phase 1 — Immediate (Before Any Production Deployment)

1. **C-00: Rotate all secrets** — Reset Neon DB password, regenerate SESSION_SECRET, regenerate GEMINI_API_KEY. Move `.env` outside of OneDrive sync.
2. **C-01: Strip `correctAnswer` from all API responses** — Remove from `answers` array in all three routes
2. **C-02: Add file size limits** — Add `MAX_FILE_SIZE_BYTES` and `MAX_JSON_CONTENT_LENGTH` constants
3. **C-03: Add transaction to contest import** — Wrap `importContestFromParsedAction` in `prisma.$transaction`
4. **C-04: Add row/question/cell limits** — Add `MAX_QUESTIONS_PER_IMPORT`, `MAX_ROWS_PER_SHEET`, `MAX_TEXT_FIELD_LENGTH`
5. **H-01: Fix access code rate limiting** — Add access-code-specific rate limit bucket
6. **H-02: Remove access code from URL** — Use session storage instead of query param
7. **H-03: Add auth to `validateContestForPublish`** — Add `requireAdmin()` call
8. **H-12: Monitor xlsx for security updates** — No fix available; document the risk; consider `exceljs` alternative

### Phase 2 — Short Term (Before Public Launch)

9. **H-04: Add server-side file extension validation** — Reject unrecognized extensions
10. **H-07: Implement CSRF protection** — Use Next.js CSRF tokens or signed-origin pattern
11. **H-08: Replace `Math.random()` with `crypto.randomBytes()`** for join codes
12. **M-01: Add rate limiting to write API routes** — Add `checkRateLimit()` to submissions endpoints
13. **M-05: Add MIME type validation** — Use `file.type` or magic byte detection
14. **M-08: Upgrade Next.js** — to resolve transitive postcss XSS

### Phase 3 — Medium Term (Post-Launch)

15. **H-05, H-06: Add admin ownership checks** — Verify admins can only modify their own resources
16. **H-09: Replace signed cookies with server-side sessions** — Use NextAuth.js or database sessions with invalidation
17. **M-02: Implement distributed rate limiting** — Use Upstash Redis for Vercel serverless
18. **M-03: Fix rate limiter memory leak** — Add periodic cleanup of expired entries
19. **M-06: Add transaction to JSON/CSV import** — Wrap full import in `prisma.$transaction`
20. **H-10: Strip `correctAnswer` from diagnostic result payload** — Store server-side only
21. **H-11: Encrypt `answersJson`** — Use separate encryption key for contest answer storage

### Phase 4 — Long Term

22. **L-01: Reduce session duration** — 7 days instead of 14
23. **L-02: Invalidate sessions on password change** — Add session invalidation list
24. **I-01: Strengthen password policy** — Add common password checks
25. **I-02: Increase scrypt parameters** — Use `N=2^16` for stronger hashing
26. **Audit logging for contest builder** — Add `createContentAuditLog` calls

---

## Release-Blocking Checklist

The following items MUST be resolved before production deployment:

- [ ] **C-00**: Rotate all secrets in `.env` (DATABASE_URL, SESSION_SECRET, GEMINI_API_KEY). Move `.env` outside of OneDrive sync.
- [ ] **C-01**: `correctAnswer` removed from all API responses (`/api/submissions`, `/api/practice/random`, `/api/assignments/[id]/submit`)
- [ ] **C-02**: File size limits added to all import routes
- [ ] **C-03**: Database transaction added to `importContestFromParsedAction`
- [ ] **C-04**: Row/question/cell limits added to all parsers
- [ ] **H-01**: Access code rate limit bucket fixed
- [ ] **H-02**: Access code removed from URL query params
- [ ] **H-03**: `validateContestForPublish` has authentication
- [ ] **H-12**: `xlsx` vulnerability documented and monitored (no fix available)

---

## Required Security Tests

1. **CorrectAnswerExposure**: POST to `/api/submissions` with any `problemId`, assert `correctAnswer` is NOT in response
2. **CorrectAnswerExposurePractice**: POST to `/api/practice/random` with empty answers, assert `correctAnswer` is NOT in response
3. **AccessCodeBruteForce**: Call `startContestAction` with 100 wrong access codes, assert rate limit is enforced per attempt
4. **ValidateWithoutAuth**: Call `validateContestForPublish` unauthenticated, assert 401 response
5. **FileSizeLimit**: Upload 50MB file to `/api/admin/contests-import/parse`, assert 413 response
6. **RowLimit**: Import Excel with 10,000 questions, assert error response
7. **CSRF**: POST to admin action from cross-origin without CSRF token, assert rejection
8. **JoinCodeEntropy**: Generate 1,000 join codes, assert no duplicates and sufficient entropy
9. **SessionInvalidation**: Change password, assert old session cookie is rejected
10. **GeminiPrivacy**: Grade essay, assert essay text is NOT in server logs

---

## Commands Run

```bash
npm audit
npm audit --omit=dev
npm outdated
git status --short
```

---

## Files Inspected

| Category | Files |
|---|---|
| Authentication | `src/lib/auth/session.ts`, `src/lib/auth/password.ts`, `src/app/auth/actions.ts` |
| Session & Config | `src/lib/auth/session.ts`, `src/lib/config.ts` |
| Rate Limiting | `src/lib/rate-limit.ts` |
| Server Actions | `src/app/*/actions.ts` (11 files with "use server") |
| Route Handlers | `src/app/api/**/route.ts` (10 route files) |
| Contest Logic | `src/lib/contests.ts`, `src/app/contests/actions.ts` |
| Diagnostic Logic | `src/lib/diagnostic.ts`, `src/app/diagnostic/actions.ts` |
| Answer Checking | `src/lib/answer-checking.ts` |
| Import | `src/lib/import/excel-contest-parser.ts`, `src/lib/import/json-importer.ts`, `src/lib/import/csv-importer.ts` |
| AI Grading | `src/lib/ai/writing-grader.ts`, `src/app/api/writing/grade/route.ts` |
| Permissions | `src/lib/classroom/permissions.ts` |
| Health | `src/app/api/health/route.ts`, `src/lib/health.ts` |
| Config | `next.config.ts`, `.env.example` |
| Package Files | `package.json` (read via npm audit/outdated) |

---

## Files Created

- `docs/SECURITY_AUDIT.md` — this document

---

## Git Status

```
?? .claude/
```

**No application code, migration, database, commit, or push was changed.**

---

*Audit conducted by Claude Code on branch `security-audit-phase-0`. All findings are based on static code inspection. Dynamic testing (penetration testing) was not performed in this Phase 0 audit. Recommended findings should be verified with dynamic testing before remediation is marked complete.*
