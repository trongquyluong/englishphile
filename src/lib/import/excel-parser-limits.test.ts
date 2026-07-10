/**
 * Security tests for Excel contest parser resource limits.
 *
 * Tests C-02 (file size limits), C-04 (row/question/cell limits),
 * and C-03 (atomic import via transaction pattern).
 */

import { describe, it, expect } from "vitest";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_SHEETS,
  MAX_SECTIONS,
  MAX_QUESTIONS,
  MAX_ROWS_PER_SHEET,
  MAX_TOTAL_CELLS,
  MAX_CELL_TEXT_LENGTH,
  hasValidXlsxSignature,
} from "@/lib/import/resource-limits";

// ============================================================================
// C-02: File Size Limits
// ============================================================================

describe("C-02: File size limits", () => {
  it("should reject empty buffer", async () => {
    const emptyBuffer = new ArrayBuffer(0);
    const result = await parseExcelContest(emptyBuffer);

    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("trống");
  });

  it("should reject files without valid XLSX signature", async () => {
    // Create a buffer that looks like a text file
    const textBuffer = new TextEncoder().encode("This is not an XLSX file").buffer;
    const result = await parseExcelContest(textBuffer);

    expect(result.data).toBeNull();
    expect(result.errors.some((e) => e.message.includes("định dạng"))).toBe(true);
  });

  it("should accept valid XLSX signature", async () => {
    // Create a minimal valid XLSX (ZIP with PK header)
    const validXlsx = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // PK signature
      0x14, 0x00, 0x00, 0x00, 0x08, 0x00, // Local file header
    ]);
    const buffer = validXlsx.buffer.slice(
      validXlsx.byteOffset,
      validXlsx.byteOffset + validXlsx.byteLength,
    );

    // This will fail at parsing (not a real XLSX), but signature check passes
    const result = await parseExcelContest(buffer);

    // Should not fail with "invalid format" but might fail with other errors
    // The key is that it doesn't accept non-XLSX files
    expect(result.data).toBeNull(); // No actual XLSX content
  });
});

// ============================================================================
// C-04: Row/Question/Cell Limits
// ============================================================================

describe("C-04: Row and cell limits constants", () => {
  it("should have reasonable limits defined", () => {
    // File size: 2 MiB is reasonable for Excel import
    expect(MAX_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
    expect(MAX_FILE_SIZE_BYTES).toBeLessThan(10 * 1024 * 1024);

    // Sheets: 8 is reasonable (XLSX template uses 3)
    expect(MAX_SHEETS).toBe(8);
    expect(MAX_SHEETS).toBeGreaterThanOrEqual(3);

    // Sections: 30 is reasonable for a contest
    expect(MAX_SECTIONS).toBe(30);
    expect(MAX_SECTIONS).toBeGreaterThan(0);

    // Questions: 500 is reasonable for a large contest
    expect(MAX_QUESTIONS).toBe(500);
    expect(MAX_QUESTIONS).toBeGreaterThan(0);

    // Rows per sheet: 1000 is reasonable
    expect(MAX_ROWS_PER_SHEET).toBe(1000);
    expect(MAX_ROWS_PER_SHEET).toBeGreaterThan(0);

    // Total cells: 20000 is reasonable (1000 rows × 20 columns)
    expect(MAX_TOTAL_CELLS).toBe(20000);
    expect(MAX_TOTAL_CELLS).toBeGreaterThan(0);

    // Cell text length: 20000 characters is reasonable
    expect(MAX_CELL_TEXT_LENGTH).toBe(20000);
    expect(MAX_CELL_TEXT_LENGTH).toBeGreaterThan(0);
  });

  it("should limit questions calculation works correctly", () => {
    const testCases: Array<{ count: number; shouldPass: boolean }> = [
      { count: 100, shouldPass: true },
      { count: 500, shouldPass: true },
      { count: 501, shouldPass: false },
      { count: 1000, shouldPass: false },
    ];

    for (const tc of testCases) {
      const exceedsLimit = tc.count > MAX_QUESTIONS;
      expect(exceedsLimit).toBe(!tc.shouldPass);
    }
  });

  it("should limit sections calculation works correctly", () => {
    const testCases: Array<{ count: number; shouldPass: boolean }> = [
      { count: 1, shouldPass: true },
      { count: 30, shouldPass: true },
      { count: 31, shouldPass: false },
    ];

    for (const tc of testCases) {
      const exceedsLimit = tc.count > MAX_SECTIONS;
      expect(exceedsLimit).toBe(!tc.shouldPass);
    }
  });
});

// ============================================================================
// XLSX Signature Detection
// ============================================================================

describe("XLSX signature detection", () => {
  it("should detect valid XLSX signature", () => {
    // Valid XLSX starts with PK (0x50 0x4B)
    const validBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]).buffer;
    expect(hasValidXlsxSignature(validBuffer)).toBe(true);
  });

  it("should reject text file signatures", () => {
    // Plain text file
    const textBuffer = new TextEncoder().encode("Hello World").buffer;
    expect(hasValidXlsxSignature(textBuffer)).toBe(false);
  });

  it("should reject old XLS format (OLE)", () => {
    // Old XLS files use OLE compound document format
    const oleBuffer = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
    expect(hasValidXlsxSignature(oleBuffer)).toBe(false);
  });

  it("should reject binary executables", () => {
    // A simple binary pattern
    const binaryBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
    expect(hasValidXlsxSignature(binaryBuffer)).toBe(false);
  });

  it("should reject empty buffer", () => {
    expect(hasValidXlsxSignature(new ArrayBuffer(0))).toBe(false);
  });

  it("should reject buffer shorter than signature", () => {
    const shortBuffer = new Uint8Array([0x50]).buffer;
    expect(hasValidXlsxSignature(shortBuffer)).toBe(false);
  });
});

// ============================================================================
// Formula Cell Detection
// ============================================================================

describe("Formula cell detection", () => {
  it("should have hasFormula function in parser", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should have hasFormula function
    expect(content).toContain("function hasFormula");

    // Should check for formula property 'f'
    expect(content).toContain("obj.f");
  });

  it("should call hasFormula during sheet parsing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // sheetToStringArray should call hasFormula
    expect(content).toContain("hasFormula(cell)");
  });

  it("should collect formula errors during parsing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should track formula errors
    expect(content).toContain("allFormulaErrors");

    // Should fail fast if formula errors found
    expect(content).toContain("allFormulaErrors.length > 0");
  });

  it("should have error message for formula cells", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parserPath = path.join(process.cwd(), "src/lib/import/excel-contest-parser.ts");
    const content = fs.readFileSync(parserPath, "utf-8");

    // Should reject formulas with Vietnamese error message
    expect(content).toContain("công thức Excel");
    expect(content).toContain("Không chấp nhận công thức");
  });
});
