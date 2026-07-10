/**
 * Centralized resource limits for file imports.
 *
 * These limits protect against DoS attacks through oversized files,
 * excessive rows, or malformed spreadsheets.
 *
 * @module lib/import/resource-limits
 */

/** Maximum upload file size: 2 MiB */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/** Maximum number of sheets accepted per workbook */
export const MAX_SHEETS = 8;

/** Maximum number of sections in an imported contest */
export const MAX_SECTIONS = 30;

/** Maximum number of questions in an imported contest */
export const MAX_QUESTIONS = 500;

/** Maximum rows per imported sheet */
export const MAX_ROWS_PER_SHEET = 1000;

/** Maximum total cells across all sheets (approximate guard) */
export const MAX_TOTAL_CELLS = 20000;

/** Maximum text length per cell */
export const MAX_CELL_TEXT_LENGTH = 20000;

/** Expected sheet names for contest import */
export const REQUIRED_SHEET_NAMES = ["Contest_Info", "Sections", "Questions"] as const;

/** ZIP/XLSX magic bytes (PK = 0x50 0x4B) */
export const XLSX_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/**
 * Validates that a file buffer starts with the ZIP/XLSX signature.
 * Returns true if valid, false otherwise.
 */
export function hasValidXlsxSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, XLSX_SIGNATURE.length));
  for (let i = 0; i < XLSX_SIGNATURE.length; i++) {
    if (bytes[i] !== XLSX_SIGNATURE[i]) return false;
  }
  return true;
}
