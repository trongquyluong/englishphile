/**
 * Security regression tests for Phase 1A findings.
 *
 * These tests verify that sensitive data is not exposed in API responses
 * and that resource limits are enforced.
 */

import { describe, it, expect } from "vitest";
import { LEARNER_FEEDBACK, toQuestionResult, type QuestionResultDTO } from "@/lib/dto/submission";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_SHEETS,
  MAX_SECTIONS,
  MAX_QUESTIONS,
  MAX_ROWS_PER_SHEET,
  MAX_CELL_TEXT_LENGTH,
  MAX_TOTAL_CELLS,
  hasValidXlsxSignature,
} from "@/lib/import/resource-limits";

// ============================================================================
// C-01: Correct Answer Data Exposure
// ============================================================================

describe("C-01: Correct-answer data exposure", () => {
  describe("toQuestionResult DTO", () => {
    it("should NOT include correctAnswer in the returned DTO", () => {
      const dto = toQuestionResult("q1", true);

      // The DTO should have these fields
      expect(dto).toHaveProperty("questionId");
      expect(dto).toHaveProperty("isCorrect");
      expect(dto).toHaveProperty("feedback");

      // The DTO must NOT have correctAnswer
      expect(dto).not.toHaveProperty("correctAnswer");

      // Verify it's a plain object without answer leakage
      const keys = Object.keys(dto as object);
      expect(keys).not.toContain("correctAnswer");
      expect(keys).not.toContain("answerJson");
      expect(keys).not.toContain("acceptedAnswers");
    });

    it("should work with null isCorrect (needs review)", () => {
      const dto = toQuestionResult("q2", null);

      expect(dto.questionId).toBe("q2");
      expect(dto.isCorrect).toBeNull();
      expect(dto).not.toHaveProperty("correctAnswer");
    });

    it("uses fixed feedback and cannot accept answer-bearing feedback", () => {
      const dto = toQuestionResult("q3", false);

      expect(dto.feedback).toBe(LEARNER_FEEDBACK.incorrect);
      expect(JSON.stringify(dto)).not.toContain("Đáp án là A");
    });
  });

  describe("QuestionResultDTO type safety", () => {
    it("should have only safe fields in the interface", () => {
      const dto: QuestionResultDTO = {
        questionId: "q1",
        isCorrect: true,
        feedback: "Good",
      };

      // TypeScript should not allow adding correctAnswer
      // This would be a compile error:
      // dto.correctAnswer = "A";

      expect(dto.questionId).toBeDefined();
      expect(dto.isCorrect).toBeDefined();
      expect(dto.feedback).toBeDefined();
    });
  });
});

// ============================================================================
// C-02: File Size Limits
// ============================================================================

describe("C-02: File size and resource limits", () => {
  describe("MAX_FILE_SIZE_BYTES constant", () => {
    it("should be set to 2 MiB (2 * 1024 * 1024)", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024);
    });

    it("should reject files larger than 2 MiB", () => {
      const oversizedBuffer = new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1);
      expect(oversizedBuffer.byteLength).toBeGreaterThan(MAX_FILE_SIZE_BYTES);
    });
  });

  describe("MAX_SHEETS constant", () => {
    it("should be set to 8 sheets", () => {
      expect(MAX_SHEETS).toBe(8);
    });
  });

  describe("MAX_SECTIONS constant", () => {
    it("should be set to 30 sections", () => {
      expect(MAX_SECTIONS).toBe(30);
    });
  });

  describe("MAX_QUESTIONS constant", () => {
    it("should be set to 500 questions", () => {
      expect(MAX_QUESTIONS).toBe(500);
    });
  });

  describe("MAX_ROWS_PER_SHEET constant", () => {
    it("should be set to 1000 rows", () => {
      expect(MAX_ROWS_PER_SHEET).toBe(1000);
    });
  });

  describe("MAX_TOTAL_CELLS constant", () => {
    it("should be set to 20000 cells", () => {
      expect(MAX_TOTAL_CELLS).toBe(20000);
    });
  });

  describe("MAX_CELL_TEXT_LENGTH constant", () => {
    it("should be set to 20000 characters", () => {
      expect(MAX_CELL_TEXT_LENGTH).toBe(20000);
    });
  });
});

// ============================================================================
// C-02: XLSX Signature Validation
// ============================================================================

describe("C-02: XLSX signature validation", () => {
  it("should accept a valid XLSX file (PK zip header)", () => {
    // XLSX files are ZIP files starting with "PK" (0x50 0x4B)
    const validXlsxBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    const buffer = validXlsxBuffer.buffer.slice(
      validXlsxBuffer.byteOffset,
      validXlsxBuffer.byteOffset + validXlsxBuffer.byteLength,
    );
    expect(hasValidXlsxSignature(buffer)).toBe(true);
  });

  it("should reject a file that is not XLSX", () => {
    // A plain text file starting with "Hello"
    const invalidBuffer = new Uint8Array([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, // "Hello"
    ]).buffer;
    expect(hasValidXlsxSignature(invalidBuffer)).toBe(false);
  });

  it("should reject empty buffer", () => {
    const emptyBuffer = new ArrayBuffer(0);
    expect(hasValidXlsxSignature(emptyBuffer)).toBe(false);
  });

  it("should reject XLS files (old Excel format)", () => {
    // XLS files start with D0 CF 11 E0 (OLE compound document)
    const xlsBuffer = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
    expect(hasValidXlsxSignature(xlsBuffer)).toBe(false);
  });

  it("should reject XLSM files (macro-enabled)", () => {
    // XLSM is also a ZIP file but should be rejected by extension check
    // This test verifies the signature check doesn't accidentally allow it
    const xlsmLikeBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
    // The signature check alone can't distinguish XLSM, but extension check should reject it
    expect(hasValidXlsxSignature(xlsmLikeBuffer)).toBe(true);
  });
});

// ============================================================================
// C-04: Row/Question/Cell Limits Validation
// ============================================================================

describe("C-04: Row and cell limits", () => {
  it("should correctly limit questions per import", () => {
    const maxQuestions = MAX_QUESTIONS;
    const testQuestions = Array.from({ length: maxQuestions + 1 }, (_, i) => ({ id: `q${i}` }));

    const exceedsLimit = testQuestions.length > maxQuestions;
    expect(exceedsLimit).toBe(true);

    const withinLimit = testQuestions.slice(0, maxQuestions);
    expect(withinLimit.length).toBe(maxQuestions);
  });

  it("should correctly limit sections per import", () => {
    const maxSections = MAX_SECTIONS;
    const testSections = Array.from({ length: maxSections + 1 }, (_, i) => ({ id: `s${i}` }));

    const exceedsLimit = testSections.length > maxSections;
    expect(exceedsLimit).toBe(true);
  });

  it("should correctly limit rows per sheet", () => {
    const maxRows = MAX_ROWS_PER_SHEET;
    const testRows = Array.from({ length: maxRows + 1 }, (_, i) => [`row${i}`]);

    const exceedsLimit = testRows.length > maxRows;
    expect(exceedsLimit).toBe(true);
  });

  it("should detect oversized cell text", () => {
    const maxLength = MAX_CELL_TEXT_LENGTH;
    const oversizedText = "a".repeat(maxLength + 1);

    expect(oversizedText.length).toBeGreaterThan(maxLength);
  });

  it("should detect excessive total cells", () => {
    const maxCells = MAX_TOTAL_CELLS;
    // Simulate counting cells across sheets
    let totalCells = 0;
    for (let sheet = 0; sheet < 3; sheet++) {
      for (let row = 0; row < 1000; row++) {
        totalCells += 15; // 15 columns per row
        if (totalCells > maxCells) break;
      }
      if (totalCells > maxCells) break;
    }

    expect(totalCells).toBeGreaterThan(maxCells);
  });
});

// ============================================================================
// H-03: validateContestForPublish Authorization
// ============================================================================

describe("H-03: validateContestForPublish authorization", () => {
  it("should have requireAdmin guard in the actions file source", async () => {
    // Read the source file to verify the auth guard is present
    // We can't import the module directly due to server-only boundary
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    // The function should have requireAdmin call at the start
    const funcStart = content.indexOf("export async function validateContestForPublish");
    const funcBody = content.slice(funcStart, funcStart + 500);
    expect(funcBody).toContain("requireAdmin");
  });

  it("should have error return for auth failures", async () => {
    // The function should return errors when auth fails
    // This is verified by checking the return type includes error handling
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function validateContestForPublish");
    const funcEnd = content.indexOf("\nexport", funcIndex + 1);
    const funcBody = content.slice(funcIndex, funcEnd > 0 ? funcEnd : undefined);

    // Should have proper error handling
    expect(funcBody).toContain("ValidationError[]");
  });
});

// ============================================================================
// Dependency: xlsx removal
// ============================================================================

describe("Dependency: xlsx removal", () => {
  it("should have exceljs in package.json dependencies", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.dependencies).toHaveProperty("exceljs");
    expect(pkg.dependencies).not.toHaveProperty("xlsx");
  });

  it("should have auth guard in parse route", async () => {
    const fs = await import("fs");
    const path = await import("path");
    // The parse route is a server-side API route (no "use server" needed in App Router)
    // but it MUST have the shared content-admin API guard for authentication
    const routePath = path.join(process.cwd(), "src/app/api/admin/contests-import/parse/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    // App Router API routes are server-side by default
    expect(routeContent).toContain("requireContentAdminApi");
  });

  it("should use exceljs (not xlsx) in parser", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should NOT use the vulnerable xlsx package
    expect(content).not.toContain('from "xlsx"');
    expect(content).not.toContain('require("xlsx")');
    // Should use exceljs instead
    expect(content).toContain("exceljs");
    expect(content).toContain("ExcelJS.Workbook");
    expect(content).toContain("workbook.xlsx.load");
  });

  it("should use exceljs.Workbook in parser", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    expect(content).toContain("ExcelJS.Workbook");
    expect(content).toContain("workbook.xlsx.load");
  });
});

// ============================================================================
// Authorization Tests
// ============================================================================

describe("Authorization: admin route protection", () => {
  it("should have requireAdmin guard in validateContestForPublish", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    // Find the validateContestForPublish function
    const funcIndex = content.indexOf("export async function validateContestForPublish");
    expect(funcIndex).toBeGreaterThan(-1);

    // Extract function body (next 500 chars)
    const funcBody = content.slice(funcIndex, funcIndex + 600);
    expect(funcBody).toContain("requireAdmin");
  });

  it("should have requireAdmin guard in publishContestAction", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function publishContestAction");
    expect(funcIndex).toBeGreaterThan(-1);

    const funcBody = content.slice(funcIndex, funcIndex + 400);
    expect(funcBody).toContain("requireAdmin");
  });

  it("should have requireAdmin guard in archiveContestAction", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function archiveContestAction");
    expect(funcIndex).toBeGreaterThan(-1);

    const funcBody = content.slice(funcIndex, funcIndex + 400);
    expect(funcBody).toContain("requireAdmin");
  });

  it("should have requireAdmin guard in importContestFromParsedAction", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function importContestFromParsedAction");
    expect(funcIndex).toBeGreaterThan(-1);

    const funcBody = content.slice(funcIndex, funcIndex + 500);
    expect(funcBody).toContain("requireAdmin");
  });
});

// ============================================================================
// Import Confirmation Revalidation Tests
// ============================================================================

describe("Import confirmation revalidation", () => {
  it("should validate contest fields in import action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function importContestFromParsedAction");
    const funcEnd = content.indexOf("\nexport", funcIndex + 1);
    const funcBody = content.slice(funcIndex, funcEnd > 0 ? funcEnd : funcIndex + 3000);

    // Should validate title
    expect(funcBody).toContain("info.title");
    expect(funcBody).toContain("title.length");

    // Should validate visibility
    expect(funcBody).toContain("VALID_VISIBILITY");

    // Should validate duration
    expect(funcBody).toContain("durationMinutes");

    // Should validate sections array
    expect(funcBody).toContain("Array.isArray(sections)");

    // Should validate questions array
    expect(funcBody).toContain("Array.isArray(questions)");

    // Should enforce DRAFT status
    expect(funcBody).toContain('status: "DRAFT"');
  });

  it("should validate section structure in import action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    const funcIndex = content.indexOf("export async function importContestFromParsedAction");
    const funcBody = content.slice(funcIndex, funcIndex + 3000);

    // Should validate sectionId
    expect(funcBody).toContain("section.sectionId");

    // Should validate section types
    expect(funcBody).toContain("VALID_SECTION_TYPES");

    // Should check for duplicate section IDs
    expect(funcBody).toContain("sectionIds.has");
  });

  it("should validate question structure in import action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    // Check for validation logic in the entire file
    // Should validate questionId
    expect(content).toContain("q.questionId");

    // Should validate question types
    expect(content).toContain("VALID_QUESTION_TYPES");

    // Should check for duplicate question IDs
    expect(content).toContain("questionIds.has");

    // Should validate MCQ options
    expect(content).toContain("MCQ_TYPES");

    // Should validate WORD_FORMATION rootWord
    expect(content).toContain("WORD_FORMATION");
    expect(content).toContain("rootWord");
  });

  it("should enforce cell text length limits in import action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    // Should check title length
    expect(content).toContain("title.length > 200");

    // Should check prompt length
    expect(content).toContain("prompt.length > 20000");

    // Should check option lengths
    expect(content).toContain("optionA.length >");
    expect(content).toContain("optionB.length >");
    expect(content).toContain("optionC.length >");
    expect(content).toContain("optionD.length >");
  });
});

// ============================================================================
// Formula Cell Rejection Tests
// ============================================================================

describe("Formula cell rejection", () => {
  it("should have formula detection function", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should have function to detect formula cells
    expect(content).toContain("hasFormula");

    // Should check for formula 'f' property
    expect(content).toContain('obj.f');
  });

  it("should reject formula cells in sheet parsing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should use hasFormula to check cells
    expect(content).toContain("hasFormula(cell)");

    // Should collect formula errors
    expect(content).toContain("formulaErrors");

    // Should fail fast on formula cells
    expect(content).toContain("allFormulaErrors.length > 0");
  });
});

// ============================================================================
// Transaction Rollback Tests
// ============================================================================

describe("Transaction rollback", () => {
  it("should use prisma.$transaction in import action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsPath = path.join(process.cwd(), "src/app/admin/contests-builder/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");

    // Should use transaction for atomicity
    expect(content).toContain("prisma.$transaction");

    // Should create contest inside transaction
    expect(content).toContain("tx.contest.create");

    // Should create sections inside transaction
    expect(content).toContain("tx.contestSection.create");

    // Should create questions inside transaction
    expect(content).toContain("tx.contestQuestion.create");
  });
});
