import ExcelJS from "exceljs";

export const RAW_FORMULA_SENTINEL = "RAW_FORMULA_VALUE_MUST_NOT_RENDER";
export const RAW_SHARED_FORMULA_SENTINEL = "RAW_SHARED_FORMULA_MUST_NOT_RENDER";
export const UNRELATED_WORKBOOK_SENTINEL = "UNRELATED_WORKBOOK_CONTENT_MUST_NOT_RENDER";

export type SyntheticWorkbookVariant = "valid" | "formula" | "shared-formula" | "many-formulas";

function asArrayBuffer(value: ExcelJS.Buffer): ArrayBuffer {
  const buffer = Buffer.from(value);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

export async function createSyntheticContestWorkbook(
  variant: SyntheticWorkbookVariant,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  const info = workbook.addWorksheet("Contest_Info");
  info.addRow(["field", "value", "required", "notes"]);
  info.addRow(["title", "Synthetic contest", "yes", ""]);
  info.addRow(["description", UNRELATED_WORKBOOK_SENTINEL, "", ""]);
  info.addRow(["visibility", "PUBLIC", "", ""]);
  info.addRow(["duration_minutes", "120", "", ""]);

  if (variant === "formula") {
    info.getCell("B2").value = {
      formula: `"${RAW_FORMULA_SENTINEL}"`,
      result: "Synthetic contest",
    };
  } else if (variant === "shared-formula") {
    info.fillFormula(
      "D2:D3",
      `"${RAW_SHARED_FORMULA_SENTINEL}"`,
      () => "synthetic",
    );
  } else if (variant === "many-formulas") {
    for (let row = 2; row <= 30; row++) {
      info.getCell(`D${row}`).value = {
        formula: `"${RAW_FORMULA_SENTINEL}-${row}"`,
        result: "synthetic",
      };
    }
  }

  const sections = workbook.addWorksheet("Sections");
  sections.addRow([
    "section_id",
    "order_index",
    "section_type",
    "title",
    "instructions",
    "question_count",
    "total_points",
    "audio_url",
    "transcript_admin_only",
    "passage_text",
    "essay_type",
    "target_word_count",
    "notes",
  ]);
  sections.addRow([
    "section-1",
    1,
    "UOE_MCQ",
    "Synthetic section",
    "",
    1,
    1,
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const questions = workbook.addWorksheet("Questions");
  questions.addRow([
    "section_id",
    "question_id",
    "order_index",
    "question_type",
    "prompt",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_answer",
    "accepted_answers",
    "root_word",
    "points",
    "explanation",
    "notes",
  ]);
  questions.addRow([
    "section-1",
    "question-1",
    1,
    "MCQ",
    "Choose the synthetic answer.",
    "A",
    "B",
    "C",
    "D",
    "A",
    "",
    "",
    1,
    "",
    "",
  ]);

  return asArrayBuffer(await workbook.xlsx.writeBuffer());
}
