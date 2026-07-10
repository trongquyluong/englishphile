# Englishphile Security Phase 1A Report

**Repository:** Englishphile
**Branch:** `security-phase-1a-release-blockers`
**Remediation Date:** 2026-07-10
**Scope:** Critical and High findings from Phase 0 audit

---

## Executive Summary

Phase 1A remediation addressed all Critical and High findings related to:
1. Correct-answer data exposure in API responses
2. Missing file/parser resource limits
3. Non-atomic contest import
4. Missing authentication on contest validation
5. Vulnerable xlsx dependency

**All 6 targeted findings have been remediated.**

---

## Findings Fixed

### C-01: Correct Answer Data Exposure

**Severity:** Critical
**Status:** ✅ Remediated

**Files Changed:**
- `src/app/api/submissions/route.ts`
- `src/app/api/practice/random/route.ts`
- `src/app/api/assignments/[id]/submit/route.ts`
- `src/lib/dto/submission.ts` (new)

**Changes:**
- Created learner-safe `QuestionResultDTO` and related DTOs in `src/lib/dto/submission.ts`
- Removed `correctAnswer` from API response payloads in all three routes
- All routes now return `{ questionId, isCorrect, feedback }` only
- Correct answers remain server-side only until post-submission review

**Regression Tests:**
- `src/lib/dto/submission.test.ts` verifies DTO does not contain `correctAnswer`

---

### C-02: Missing Upload Size Limits

**Severity:** Critical
**Status:** ✅ Remediated

**Files Changed:**
- `src/app/api/admin/contests-import/parse/route.ts`
- `src/lib/import/resource-limits.ts` (new)

**Changes:**
- Added `MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024` (2 MiB) limit
- Added XLSX ZIP signature validation (`hasValidXlsxSignature`)
- Added `.xlsx` extension enforcement (rejects `.xls`, `.xlsm`)
- Centralized all resource limits in `src/lib/import/resource-limits.ts`
- Returns 413 status for oversized files
- Returns 400 for invalid signatures and wrong extensions

---

### C-03: Contest Excel Import Not Atomic

**Severity:** Critical
**Status:** ✅ Remediated

**Files Changed:**
- `src/app/admin/contests-builder/actions.ts`

**Changes:**
- Wrapped all `prisma.contest.create()`, `prisma.contestSection.create()`, and `prisma.contestQuestion.create()` calls inside `prisma.$transaction()`
- On any error, no partial contest/section/question rows are created
- Imported contests always start as `DRAFT` status

**Transaction Design:**
```typescript
const contest = await prisma.$transaction(async (tx) => {
  const newContest = await tx.contest.create({ ... });
  for (const section of sections) {
    const sectionRecord = await tx.contestSection.create({ ... });
    for (const q of sectionQuestions) {
      await tx.contestQuestion.create({ ... });
    }
  }
  return newContest;
});
```

---

### C-04: Missing Spreadsheet Row/Question/Cell Limits

**Severity:** Critical
**Status:** ✅ Remediated

**Files Changed:**
- `src/lib/import/excel-contest-parser.ts`
- `src/lib/import/resource-limits.ts` (new)

**Resource Limits Added:**
| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_FILE_SIZE_BYTES` | 2 MiB | Upload size |
| `MAX_SHEETS` | 8 | Sheet count |
| `MAX_SECTIONS` | 30 | Contest sections |
| `MAX_QUESTIONS` | 500 | Contest questions |
| `MAX_ROWS_PER_SHEET` | 1000 | Rows per sheet |
| `MAX_TOTAL_CELLS` | 20000 | Total cells |
| `MAX_CELL_TEXT_LENGTH` | 20000 | Characters per cell |

**Validation:**
- Parser rejects files exceeding row/section/question/cell limits
- Parser rejects cells exceeding text length
- Parser rejects workbooks with too many sheets

---

### H-03: validateContestForPublish Lacks Authentication

**Severity:** High
**Status:** ✅ Remediated

**Files Changed:**
- `src/app/admin/contests-builder/actions.ts`

**Changes:**
- Added `requireAdmin()` call at the start of `validateContestForPublish()`
- Unauthenticated callers are redirected to `/unauthorized`
- All callers (`publishContestAction`, edit page) already call `requireAdmin()` first

---

### H-12: xlsx@0.18.5 Vulnerability

**Severity:** High
**Status:** ✅ Remediated

**Files Changed:**
- `package.json` (xlsx removed)
- `package-lock.json` (xlsx removed)
- `src/lib/import/excel-contest-parser.ts` (updated to use exceljs)

**Changes:**
- Removed `xlsx@0.18.5` from production dependencies
- Added `exceljs@4.4.0` as replacement
- Updated `parseExcelContest()` to use `ExcelJS.Workbook.xlsx.load()`
- Removed all `xlsx` imports; uses dynamic `import("exceljs")`
- Formula cells are handled by reading cached values only (`w` or `v` property)

**Note:** exceljs@4.4.0 has a transitive dependency on `uuid@8.3.2` (moderate severity, not critical).

---

## Tests Added

### Unit Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `src/lib/dto/submission.test.ts` | 27 | DTO type safety, correct-answer exclusion |
| `src/lib/import/excel-parser-limits.test.ts` | 12 | Resource limits, XLSX signature |
| **Total** | **39 tests** | All passing |

### Test Commands

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

---

## npm Audit Results

### Production Dependencies (omit=dev)

| Package | Severity | Status |
|---------|----------|--------|
| `xlsx` | **High** | ✅ Removed |
| `exceljs` → `uuid@8.3.2` | Moderate | Acceptable (not critical) |
| `next` → `postcss` | Moderate | Transitive, upgrade path breaks Next.js |

**No High or Critical vulnerabilities remain in production dependencies.**

---

## Files Changed

```
M src/app/admin/contests-builder/actions.ts    (M = Modified)
M src/app/api/admin/contests-import/parse/route.ts
M src/app/api/assignments/[id]/submit/route.ts
M src/app/api/practice/random/route.ts
M src/app/api/submissions/route.ts
M docs/SECURITY_AUDIT.md
A src/lib/dto/submission.ts                  (A = Added)
A src/lib/dto/submission.test.ts
A src/lib/import/excel-parser-limits.test.ts
A src/lib/import/resource-limits.ts
M src/lib/import/excel-contest-parser.ts
A vitest.config.ts
M package.json
M package-lock.json
```

---

## Remaining Release Blockers (Not in Scope)

| Finding | Severity | Reason Not Fixed |
|---------|----------|------------------|
| C-00: Secrets in .env | Critical | Requires manual rotation by owner |
| H-01: Access code rate limit | High | Not in Phase 1A scope |
| H-02: Access code in URL | High | Not in Phase 1A scope |
| H-04: Server-side extension validation | High | ✅ Fixed (see below) |
| H-07: CSRF protection | High | Not in Phase 1A scope |

### H-04: Server-Side Extension Validation

**Status:** ✅ Remediated

**Verification:** The parse route now performs server-side validation:
- `.xlsx` extension check (rejects `.xls`, `.xlsm`)
- XLSX ZIP signature validation (`PK` header check)
- File size check (2 MiB limit)
- Byte-length double-check after upload

---

## Verification Commands Run

```bash
npm run typecheck  # ✅ Pass
npm run lint       # ✅ Pass
npm test           # ✅ 39 tests pass
npm audit          # 4 moderate (not critical)
npm audit --omit=dev # 4 moderate (not critical)
npm ls xlsx        # (empty) ✅ Removed
npm ls exceljs     # exceljs@4.4.0 ✅ Present
```

---

## Confirmation

- ✅ No production database was accessed or modified
- ✅ No `prisma migrate reset` was run
- ✅ No `prisma seed` was run
- ✅ Changes are uncommitted for review
- ✅ No push was performed

---

*Phase 1A remediation completed by Claude Code on branch `security-phase-1a-release-blockers`.*
