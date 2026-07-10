import type { ContestVisibility, QuestionType, SkillType } from "@prisma/client";
import {
  MAX_SHEETS,
  MAX_SECTIONS,
  MAX_QUESTIONS,
  MAX_ROWS_PER_SHEET,
  MAX_CELL_TEXT_LENGTH,
  MAX_TOTAL_CELLS,
  REQUIRED_SHEET_NAMES,
} from "@/lib/import/resource-limits";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedContestInfo {
  title: string;
  description: string | null;
  visibility: ContestVisibility;
  accessCode: string | null;
  startAt: string | null;
  endAt: string | null;
  durationMinutes: number | null;
}

export interface ParsedSection {
  sectionId: string;
  orderIndex: number;
  sectionType: string;
  title: string;
  instructions: string | null;
  questionCount: number;
  totalPoints: number;
  audioUrl: string | null;
  transcriptAdminOnly: string | null;
  passageText: string | null;
  essayType: string | null;
  targetWordCount: string | null;
  notes: string | null;
}

export interface ParsedQuestion {
  sectionId: string;
  questionId: string;
  orderIndex: number;
  questionType: string;
  prompt: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  acceptedAnswers: string | null;
  rootWord: string | null;
  points: number | null;
  explanation: string | null;
  notes: string | null;
}

export interface ParsedContest {
  info: ParsedContestInfo;
  sections: ParsedSection[];
  questions: ParsedQuestion[];
}

export interface ParseError {
  sheet: string;
  row: number;
  field: string;
  message: string;
}

export interface ParseWarning {
  sheet: string;
  row: number;
  field: string;
  message: string;
}

export interface ParseResult {
  data: ParsedContest | null;
  errors: ParseError[];
  warnings: ParseWarning[];
}

// ---------------------------------------------------------------------------
// Section / question type mapping
// ---------------------------------------------------------------------------

const SECTION_TYPE_MAP: Record<string, SkillType> = {
  UOE_MCQ: "USE_OF_ENGLISH",
  WORD_FORMATION: "WORD_FORMATION",
  OPEN_CLOZE: "OPEN_CLOZE",
  GUIDED_CLOZE: "GUIDED_CLOZE",
  READING: "READING",
  LISTENING: "LISTENING",
  WRITING: "WRITING",
};

const QUESTION_TYPE_MAP: Record<string, QuestionType> = {
  MCQ: "MCQ",
  SHORT_ANSWER: "SHORT_ANSWER",
  WORD_FORMATION: "WORD_FORMATION",
  OPEN_CLOZE: "OPEN_CLOZE",
  GUIDED_CLOZE: "GUIDED_CLOZE",
  LISTENING_SHORT_ANSWER: "LISTENING_SHORT_ANSWER",
  WRITING: "WRITING_PROMPT",
  // These types exist in the template but aren't in the current QuestionType enum
  LISTENING_MCQ: "LISTENING_MCQ",
  READING_MCQ: "READING_MCQ",
};

export function mapSectionType(raw: string): SkillType | null {
  return SECTION_TYPE_MAP[raw.trim().toUpperCase()] ?? null;
}

export function mapQuestionType(raw: string): QuestionType | null {
  return QUESTION_TYPE_MAP[raw.trim().toUpperCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseIntSafe(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseFloatSafe(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Formula cell detection
// ---------------------------------------------------------------------------

interface ExcelCell {
  v?: unknown;  // cached value
  w?: string;   // formatted text
  f?: string;   // formula (present only for formula cells)
}

function hasFormula(cell: unknown): boolean {
  if (typeof cell === "object" && cell !== null) {
    const obj = cell as Record<string, unknown>;
    return typeof obj.f === "string" && obj.f.length > 0;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Contest_Info sheet parser
// ---------------------------------------------------------------------------

function parseContestInfoSheet(rows: string[][]): {
  info: ParsedContestInfo;
  errors: ParseError[];
  warnings: ParseWarning[];
} {
  const info: ParsedContestInfo = {
    title: "",
    description: null,
    visibility: "PUBLIC",
    accessCode: null,
    startAt: null,
    endAt: null,
    durationMinutes: null,
  };
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // rows[0] is the header "field,value,required,notes" — skip it
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const field = String(row[0] ?? "").trim().toLowerCase();
    const value = String(row[1] ?? "").trim();

    switch (field) {
      case "title":
        info.title = value;
        if (!isNonEmpty(value)) errors.push({ sheet: "Contest_Info", row: i + 1, field: "title", message: "Tiêu đề không được để trống." });
        break;
      case "description":
        info.description = isNonEmpty(value) ? value : null;
        break;
      case "visibility":
        if (value === "PUBLIC" || value === "PRIVATE" || value === "UNLISTED") {
          info.visibility = value as ContestVisibility;
        } else {
          errors.push({ sheet: "Contest_Info", row: i + 1, field: "visibility", message: `Giá trị visibility "${value}" không hợp lệ. Chỉ chấp nhận PUBLIC hoặc PRIVATE.` });
        }
        break;
      case "access_code":
        if (isNonEmpty(value)) {
          info.accessCode = value;
        } else if (info.visibility === "PRIVATE") {
          errors.push({ sheet: "Contest_Info", row: i + 1, field: "access_code", message: "Mã truy cập bắt buộc khi visibility = PRIVATE." });
        }
        break;
      case "start_at":
        info.startAt = isNonEmpty(value) ? value : null;
        break;
      case "end_at":
        info.endAt = isNonEmpty(value) ? value : null;
        break;
      case "duration_minutes": {
        const mins = parseIntSafe(value);
        if (mins !== null && [120, 150, 180].includes(mins)) {
          info.durationMinutes = mins;
        } else {
          errors.push({ sheet: "Contest_Info", row: i + 1, field: "duration_minutes", message: `duration_minutes phải là 120, 150 hoặc 180 (nhận: ${value}).` });
        }
        break;
      }
    }
  }

  return { info, errors, warnings };
}

// ---------------------------------------------------------------------------
// Sections sheet parser
// ---------------------------------------------------------------------------

function parseSectionsSheet(rows: string[][]): {
  sections: ParsedSection[];
  errors: ParseError[];
  warnings: ParseWarning[];
} {
  const sections: ParsedSection[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const seenIds = new Set<string>();

  // rows[0] is the header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => !isNonEmpty(cell))) continue;

    const get = (col: number) => (row[col] ?? "").trim();

    const sectionId = get(0);
    const sectionType = get(2);
    const orderIndex = parseIntSafe(get(1));
    const title = get(3);
    const questionCount = parseIntSafe(get(5));
    const totalPoints = parseFloatSafe(get(6));
    const audioUrl = isNonEmpty(get(7)) ? get(7) : null;
    const transcriptAdminOnly = isNonEmpty(get(8)) ? get(8) : null;
    const passageText = isNonEmpty(get(9)) ? get(9) : null;
    const essayType = isNonEmpty(get(10)) ? get(10) : null;
    const targetWordCount = isNonEmpty(get(11)) ? get(11) : null;
    const notes = isNonEmpty(get(12)) ? get(12) : null;

    // Validate required fields
    if (!isNonEmpty(sectionId)) {
      errors.push({ sheet: "Sections", row: i + 1, field: "section_id", message: "section_id bắt buộc." });
      continue;
    }
    if (seenIds.has(sectionId)) {
      errors.push({ sheet: "Sections", row: i + 1, field: "section_id", message: `section_id "${sectionId}" bị trùng.` });
      continue;
    }
    seenIds.add(sectionId);

    if (orderIndex === null) {
      errors.push({ sheet: "Sections", row: i + 1, field: "order_index", message: "order_index bắt buộc." });
    }
    if (!isNonEmpty(sectionType)) {
      errors.push({ sheet: "Sections", row: i + 1, field: "section_type", message: "section_type bắt buộc." });
    } else if (!SECTION_TYPE_MAP[sectionType.trim().toUpperCase()]) {
      errors.push({ sheet: "Sections", row: i + 1, field: "section_type", message: `section_type "${sectionType}" không hỗ trợ. Chỉ dùng: ${Object.keys(SECTION_TYPE_MAP).join(", ")}.` });
    }
    if (!isNonEmpty(title)) {
      errors.push({ sheet: "Sections", row: i + 1, field: "title", message: "title bắt buộc." });
    }
    if (questionCount === null) {
      errors.push({ sheet: "Sections", row: i + 1, field: "question_count", message: "question_count bắt buộc." });
    }
    if (totalPoints === null) {
      errors.push({ sheet: "Sections", row: i + 1, field: "total_points", message: "total_points bắt buộc." });
    }

    // Warnings
    if (sectionType.trim().toUpperCase() === "LISTENING" && !audioUrl) {
      warnings.push({ sheet: "Sections", row: i + 1, field: "audio_url", message: `Section LISTENING "${title}" chưa có audio_url. Audio sẽ cần nhập thủ công sau khi import.` });
    }
    if (sectionType.trim().toUpperCase() === "READING" && !passageText) {
      warnings.push({ sheet: "Sections", row: i + 1, field: "passage_text", message: `Section READING "${title}" chưa có passage_text. Passage sẽ cần nhập thủ công sau khi import.` });
    }
    if (sectionType.trim().toUpperCase() === "WRITING" && !essayType) {
      warnings.push({ sheet: "Sections", row: i + 1, field: "essay_type", message: `Section WRITING "${title}" chưa có essay_type.` });
    }

    sections.push({
      sectionId,
      orderIndex: orderIndex ?? i,
      sectionType,
      title,
      instructions: isNonEmpty(get(4)) ? get(4) : null,
      questionCount: questionCount ?? 0,
      totalPoints: totalPoints ?? 0,
      audioUrl,
      transcriptAdminOnly,
      passageText,
      essayType,
      targetWordCount,
      notes,
    });
  }

  return { sections, errors, warnings };
}

// ---------------------------------------------------------------------------
// Questions sheet parser
// ---------------------------------------------------------------------------

function parseQuestionsSheet(rows: string[][]): {
  questions: ParsedQuestion[];
  errors: ParseError[];
  warnings: ParseWarning[];
} {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const seenIds = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => !isNonEmpty(cell))) continue;

    const get = (col: number) => (row[col] ?? "").trim();

    const sectionId = get(0);
    const questionId = get(1);
    const questionType = get(3);
    const prompt = get(4);
    const points = parseFloatSafe(get(12));

    if (!isNonEmpty(sectionId)) {
      errors.push({ sheet: "Questions", row: i + 1, field: "section_id", message: "section_id bắt buộc." });
      continue;
    }
    if (!isNonEmpty(questionId)) {
      errors.push({ sheet: "Questions", row: i + 1, field: "question_id", message: "question_id bắt buộc." });
      continue;
    }
    if (seenIds.has(questionId)) {
      errors.push({ sheet: "Questions", row: i + 1, field: "question_id", message: `question_id "${questionId}" bị trùng.` });
      continue;
    }
    seenIds.add(questionId);

    const orderIndex = parseIntSafe(get(2));
    if (orderIndex === null) {
      errors.push({ sheet: "Questions", row: i + 1, field: "order_index", message: "order_index bắt buộc." });
    }
    if (!isNonEmpty(questionType)) {
      errors.push({ sheet: "Questions", row: i + 1, field: "question_type", message: "question_type bắt buộc." });
    } else if (!QUESTION_TYPE_MAP[questionType.trim().toUpperCase()] && !["TRUE_FALSE", "ORDERING"].includes(questionType.trim().toUpperCase())) {
      errors.push({ sheet: "Questions", row: i + 1, field: "question_type", message: `question_type "${questionType}" không hỗ trợ.` });
    } else if (!QUESTION_TYPE_MAP[questionType.trim().toUpperCase()]) {
      warnings.push({ sheet: "Questions", row: i + 1, field: "question_type", message: `question_type "${questionType}" chưa được hỗ trợ hoàn toàn. Câu hỏi sẽ được tạo nhưng có thể cần chỉnh sửa thêm.` });
    }
    if (!isNonEmpty(prompt)) {
      errors.push({ sheet: "Questions", row: i + 1, field: "prompt", message: "prompt bắt buộc." });
    }
    if (points === null) {
      errors.push({ sheet: "Questions", row: i + 1, field: "points", message: "points bắt buộc." });
    }

    // MCQ-specific validation
    const qType = questionType.trim().toUpperCase();
    if (QUESTION_TYPE_MAP[qType] && ["MCQ", "GUIDED_CLOZE", "LISTENING_MCQ", "READING_MCQ"].includes(qType)) {
      const optA = get(5), optB = get(6), optC = get(7), optD = get(8);
      if (![isNonEmpty(optA), isNonEmpty(optB), isNonEmpty(optC), isNonEmpty(optD)].filter(Boolean).length) {
        errors.push({ sheet: "Questions", row: i + 1, field: "options", message: `Câu hỏi MCQ cần có ít nhất 2 lựa chọn (option_a đến option_d).` });
      }
      const correct = get(9);
      if (!isNonEmpty(correct)) {
        errors.push({ sheet: "Questions", row: i + 1, field: "correct_answer", message: `Câu hỏi MCQ cần correct_answer (A/B/C/D).` });
      } else if (!["A", "B", "C", "D"].includes(correct.toUpperCase())) {
        errors.push({ sheet: "Questions", row: i + 1, field: "correct_answer", message: `correct_answer phải là A, B, C hoặc D (nhận: ${correct}).` });
      }
    }

    // WORD_FORMATION validation
    if (qType === "WORD_FORMATION") {
      if (!isNonEmpty(get(11))) {
        errors.push({ sheet: "Questions", row: i + 1, field: "root_word", message: "Câu hỏi WORD_FORMATION cần root_word." });
      }
      if (!isNonEmpty(get(9)) && !isNonEmpty(get(10))) {
        errors.push({ sheet: "Questions", row: i + 1, field: "correct_answer", message: "Câu hỏi WORD_FORMATION cần correct_answer." });
      }
    }

    // Short answer / open cloze validation (warning only, not error)
    if (["SHORT_ANSWER", "OPEN_CLOZE", "LISTENING_SHORT_ANSWER"].includes(qType)) {
      if (!isNonEmpty(get(9)) && !isNonEmpty(get(10))) {
        warnings.push({ sheet: "Questions", row: i + 1, field: "answer", message: `Câu hỏi ${questionType} chưa có correct_answer hoặc accepted_answers.` });
      }
    }

    questions.push({
      sectionId,
      questionId,
      orderIndex: orderIndex ?? i,
      questionType,
      prompt: isNonEmpty(prompt) ? prompt : null,
      optionA: isNonEmpty(get(5)) ? get(5) : null,
      optionB: isNonEmpty(get(6)) ? get(6) : null,
      optionC: isNonEmpty(get(7)) ? get(7) : null,
      optionD: isNonEmpty(get(8)) ? get(8) : null,
      correctAnswer: isNonEmpty(get(9)) ? get(9) : null,
      acceptedAnswers: isNonEmpty(get(10)) ? get(10) : null,
      rootWord: isNonEmpty(get(11)) ? get(11) : null,
      points,
      explanation: isNonEmpty(get(13)) ? get(13) : null,
      notes: isNonEmpty(get(14)) ? get(14) : null,
    });
  }

  return { questions, errors, warnings };
}

// ---------------------------------------------------------------------------
// Cross-sheet validation
// ---------------------------------------------------------------------------

function crossValidate(
  sections: ParsedSection[],
  questions: ParsedQuestion[],
): { errors: ParseError[]; warnings: ParseWarning[] } {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const sectionIds = new Set(sections.map((s) => s.sectionId));

  for (const q of questions) {
    if (!sectionIds.has(q.sectionId)) {
      errors.push({ sheet: "Questions", row: 0, field: "section_id", message: `question_id "${q.questionId}" có section_id "${q.sectionId}" không tồn tại trong sheet Sections.` });
    }
  }

  // Check section question count vs actual questions
  for (const section of sections) {
    const actualCount = questions.filter((q) => q.sectionId === section.sectionId).length;
    if (section.questionCount !== actualCount) {
      warnings.push({
        sheet: "Sections",
        row: 0,
        field: "question_count",
        message: `Section "${section.title}" có question_count=${section.questionCount} nhưng file chứa ${actualCount} câu hỏi.`,
      });
    }

    // Check points sum
    const actualPoints = questions.filter((q) => q.sectionId === section.sectionId).reduce((sum, q) => sum + (q.points ?? 0), 0);
    if (Math.abs(actualPoints - section.totalPoints) > 0.01) {
      warnings.push({
        sheet: "Sections",
        row: 0,
        field: "total_points",
        message: `Section "${section.title}" có total_points=${section.totalPoints} nhưng tổng điểm câu hỏi là ${actualPoints.toFixed(1)}.`,
      });
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Converts an ExcelJS worksheet row to a string array.
 * Rejects formula cells with a clear error.
 * Never evaluates or trusts cached formula values.
 */
function sheetToStringArray(
  row: Record<string, unknown> | undefined,
  colCount: number,
  sheetName: string,
  rowIndex: number,
): { cells: string[]; formulaErrors: ParseError[] } {
  const formulaErrors: ParseError[] = [];
  const cells: string[] = [];

  if (!row) return { cells: [], formulaErrors };

  for (let i = 0; i < colCount; i++) {
    const colLetter = String.fromCharCode(65 + i); // A, B, C, ...
    const cell = row[colLetter];

    if (!cell) {
      cells.push("");
      continue;
    }

    // Check if this is a formula cell
    if (hasFormula(cell)) {
      const formula = (cell as ExcelCell).f ?? "";
      formulaErrors.push({
        sheet: sheetName,
        row: rowIndex,
        field: `${colLetter}${rowIndex}`,
        message: `Sheet "${sheetName}" ô ${colLetter}${rowIndex} chứa công thức Excel (=${formula.slice(0, 50)}${formula.length > 50 ? "..." : ""}). Không chấp nhận công thức.`,
      });
      cells.push("");
      continue;
    }

    // Extract value from non-formula cells
    if (typeof cell === "object" && cell !== null) {
      const obj = cell as Record<string, unknown>;
      cells.push(String(obj.w ?? obj.v ?? "").trim());
    } else {
      cells.push(String(cell).trim());
    }
  }

  return { cells, formulaErrors };
}

export async function parseExcelContest(fileBuffer: ArrayBuffer): Promise<ParseResult> {
  // --- Resource limits guard ---
  if (fileBuffer.byteLength === 0) {
    return { data: null, errors: [{ sheet: "", row: 0, field: "file", message: "File trống." }], warnings: [] };
  }

  // Import exceljs dynamically to keep this server-only
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    return { data: null, errors: [{ sheet: "", row: 0, field: "file", message: "File không đúng định dạng XLSX." }], warnings: [] };
  }

  // --- Sheet count limit ---
  if (workbook.worksheets.length > MAX_SHEETS) {
    return {
      data: null,
      errors: [{ sheet: "", row: 0, field: "sheets", message: `File có ${workbook.worksheets.length} sheet, tối đa ${MAX_SHEETS}.` }],
      warnings: [],
    };
  }

  // --- Check required sheets exist ---
  const sheetNames = new Set(workbook.worksheets.map((ws) => ws.name));
  for (const required of REQUIRED_SHEET_NAMES) {
    if (!sheetNames.has(required)) {
      return {
        data: null,
        errors: [{ sheet: required, row: 0, field: "sheet", message: `Thiếu sheet "${required}".` }],
        warnings: [],
      };
    }
  }

  // --- Extract sheet data with row limits ---
  const contestInfoSheet = workbook.getWorksheet("Contest_Info");
  const sectionsSheet = workbook.getWorksheet("Sections");
  const questionsSheet = workbook.getWorksheet("Questions");

  const contestInfoRows: string[][] = [];
  const sectionsRows: string[][] = [];
  const questionsRows: string[][] = [];
  const allFormulaErrors: Array<{ sheet: string; row: number; field: string; message: string }> = [];

  // Process Contest_Info sheet
  if (contestInfoSheet) {
    const header = sheetToStringArray(contestInfoSheet.getRow(1).values as Record<string, unknown>, 4, "Contest_Info", 1);
    contestInfoRows.push(header.cells);
    allFormulaErrors.push(...header.formulaErrors);
    const infoRowCount = Math.min(contestInfoSheet.rowCount, MAX_ROWS_PER_SHEET);
    for (let i = 2; i <= infoRowCount; i++) {
      const result = sheetToStringArray(contestInfoSheet.getRow(i).values as Record<string, unknown>, 4, "Contest_Info", i);
      contestInfoRows.push(result.cells);
      allFormulaErrors.push(...result.formulaErrors);
    }
  }

  // Process Sections sheet
  if (sectionsSheet) {
    const header = sheetToStringArray(sectionsSheet.getRow(1).values as Record<string, unknown>, 13, "Sections", 1);
    sectionsRows.push(header.cells);
    allFormulaErrors.push(...header.formulaErrors);
    const sectionRowCount = Math.min(sectionsSheet.rowCount, MAX_ROWS_PER_SHEET);
    let totalSections = 0;
    for (let i = 2; i <= sectionRowCount; i++) {
      const row = sectionsSheet.getRow(i);
      const result = sheetToStringArray(row.values as Record<string, unknown>, 13, "Sections", i);
      if (result.cells.some((c) => c.trim())) totalSections++;
      if (totalSections > MAX_SECTIONS) {
        return {
          data: null,
          errors: [{ sheet: "Sections", row: i, field: "limit", message: `Số section vượt giới hạn ${MAX_SECTIONS}.` }],
          warnings: [],
        };
      }
      sectionsRows.push(result.cells);
      allFormulaErrors.push(...result.formulaErrors);
    }
  }

  // Process Questions sheet
  if (questionsSheet) {
    const header = sheetToStringArray(questionsSheet.getRow(1).values as Record<string, unknown>, 15, "Questions", 1);
    questionsRows.push(header.cells);
    allFormulaErrors.push(...header.formulaErrors);
    const questionRowCount = Math.min(questionsSheet.rowCount, MAX_ROWS_PER_SHEET);
    let totalQuestions = 0;
    let totalCells = 0;
    for (let i = 2; i <= questionRowCount; i++) {
      const row = questionsSheet.getRow(i);
      const result = sheetToStringArray(row.values as Record<string, unknown>, 15, "Questions", i);
      // Check cell text lengths
      for (let j = 0; j < result.cells.length; j++) {
        if (result.cells[j].length > MAX_CELL_TEXT_LENGTH) {
          return {
            data: null,
            errors: [{ sheet: "Questions", row: i, field: `col_${j}`, message: `Ô có quá ${MAX_CELL_TEXT_LENGTH} ký tự.` }],
            warnings: [],
          };
        }
        totalCells++;
        if (totalCells > MAX_TOTAL_CELLS) {
          return {
            data: null,
            errors: [{ sheet: "Questions", row: i, field: "limit", message: `Số ô vượt giới hạn ${MAX_TOTAL_CELLS}.` }],
            warnings: [],
          };
        }
      }
      if (result.cells.some((c) => c.trim())) totalQuestions++;
      if (totalQuestions > MAX_QUESTIONS) {
        return {
          data: null,
          errors: [{ sheet: "Questions", row: i, field: "limit", message: `Số câu hỏi vượt giới hạn ${MAX_QUESTIONS}.` }],
          warnings: [],
        };
      }
      questionsRows.push(result.cells);
      allFormulaErrors.push(...result.formulaErrors);
    }
  }

  if (!contestInfoRows.length || contestInfoRows.length <= 1) {
    return { data: null, errors: [{ sheet: "Contest_Info", row: 0, field: "file", message: "Sheet Contest_Info trống." }], warnings: [] };
  }
  if (!sectionsRows.length || sectionsRows.length <= 1) {
    return { data: null, errors: [{ sheet: "Sections", row: 0, field: "file", message: "Sheet Sections trống." }], warnings: [] };
  }
  if (!questionsRows.length || questionsRows.length <= 1) {
    return { data: null, errors: [{ sheet: "Questions", row: 0, field: "file", message: "Sheet Questions trống." }], warnings: [] };
  }

  // Fail fast if any formula cells were detected
  if (allFormulaErrors.length > 0) {
    return {
      data: null,
      errors: allFormulaErrors,
      warnings: [],
    };
  }

  const { info, errors, warnings } = parseContestInfoSheet(contestInfoRows);
  const { sections, errors: secErrors, warnings: secWarnings } = parseSectionsSheet(sectionsRows);
  const { questions, errors: qErrors, warnings: qWarnings } = parseQuestionsSheet(questionsRows);

  const allErrors = [...errors, ...secErrors, ...qErrors];
  if (allErrors.length > 0) return { data: null, errors: allErrors, warnings: [...warnings, ...secWarnings, ...qWarnings] };

  const { errors: cvErrors, warnings: cvWarnings } = crossValidate(sections, questions);

  return {
    data: { info, sections, questions },
    errors: cvErrors,
    warnings: [...warnings, ...secWarnings, ...qWarnings, ...cvWarnings],
  };
}
