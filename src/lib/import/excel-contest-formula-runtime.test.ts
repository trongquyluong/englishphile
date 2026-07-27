import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";
import {
  RAW_FORMULA_SENTINEL,
  RAW_SHARED_FORMULA_SENTINEL,
  createSyntheticContestWorkbook,
  type SyntheticWorkbookVariant,
} from "@/lib/import/test-fixtures/synthetic-contest-workbook";

async function parseWithoutSourceMutation(variant: SyntheticWorkbookVariant) {
  const source = await createSyntheticContestWorkbook(variant);
  const before = Buffer.from(source).toString("base64");
  const result = await parseExcelContest(source);

  expect(source.byteLength).toBeGreaterThan(0);
  expect(Buffer.from(source).toString("base64")).toBe(before);
  return { source, result };
}

describe("contest Excel formula validation (production parser/helper runtime)", () => {
  it("parses a valid generated workbook without mutating its source buffer", async () => {
    const { result } = await parseWithoutSourceMutation("valid");

    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      info: { title: "Synthetic contest", visibility: "PUBLIC", durationMinutes: 120 },
      sections: [{ sectionId: "section-1", questionCount: 1 }],
      questions: [{ questionId: "question-1", correctAnswer: "A" }],
    });
  });

  it("rejects a formula cell without returning its formula text", async () => {
    const { result } = await parseWithoutSourceMutation("formula");
    const serialized = JSON.stringify(result);

    expect(result.data).toBeNull();
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "FORMULA_NOT_ALLOWED",
        sheet: "Contest_Info",
        row: 2,
        field: "B2",
      }),
    ]);
    expect(serialized).not.toContain(RAW_FORMULA_SENTINEL);
    expect(serialized).not.toContain("formula:");
  });

  it("rejects ExcelJS shared-formula cells without mutating or disclosing them", async () => {
    const source = await createSyntheticContestWorkbook("shared-formula");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(source.slice(0) as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Contest_Info")?.getCell("D3").value)
      .toEqual(expect.objectContaining({ sharedFormula: "D2" }));

    const before = Buffer.from(source).toString("base64");
    const result = await parseExcelContest(source);
    const serialized = JSON.stringify(result);

    expect(Buffer.from(source).toString("base64")).toBe(before);
    expect(result.data).toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "FORMULA_NOT_ALLOWED", field: "D2" }),
      expect.objectContaining({ code: "FORMULA_NOT_ALLOWED", field: "D3" }),
    ]));
    expect(serialized).not.toContain(RAW_SHARED_FORMULA_SENTINEL);
  });

  it("bounds formula validation output when a workbook contains many formula cells", async () => {
    const { result } = await parseWithoutSourceMutation("many-formulas");

    expect(result.data).toBeNull();
    expect(result.errors).toHaveLength(21);
    expect(result.errors.slice(0, 20).every((error) => error.code === "FORMULA_NOT_ALLOWED"))
      .toBe(true);
    expect(result.errors.at(-1)).toMatchObject({
      code: "FORMULA_NOT_ALLOWED",
      field: "formula",
    });
    expect(JSON.stringify(result)).not.toContain(RAW_FORMULA_SENTINEL);
  });
});
