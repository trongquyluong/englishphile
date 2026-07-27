import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";

const localRequire = createRequire(import.meta.url);

function asArrayBuffer(value: ExcelJS.Buffer): ArrayBuffer {
  const buffer = Buffer.from(value);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function createContestWorkbook(options: { formulaTitle?: boolean } = {}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  const info = workbook.addWorksheet("Contest_Info");
  info.addRow(["field", "value", "required", "notes"]);
  info.addRow(["title", "Synthetic contest", "yes", ""]);
  info.addRow(["visibility", "PUBLIC", "", ""]);
  info.addRow(["duration_minutes", "120", "", ""]);
  if (options.formulaTitle) {
    info.getCell("B2").value = { formula: "\"Synthetic contest\"", result: "Synthetic contest" };
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
  sections.addRow(["section-1", 1, "UOE_MCQ", "Section 1", "", 1, 1, "", "", "", "", "", ""]);

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
    "Choose the correct answer.",
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

describe("Phase 1D-C2 ExcelJS compatibility (helper/runtime)", () => {
  it("round-trips a real workbook through the production contest parser", async () => {
    const result = await parseExcelContest(await createContestWorkbook());

    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      info: { title: "Synthetic contest", visibility: "PUBLIC", durationMinutes: 120 },
      sections: [{ sectionId: "section-1", questionCount: 1 }],
      questions: [{ questionId: "question-1", correctAnswer: "A" }],
    });
  });

  it("rejects a malformed ZIP-signature workbook without exposing a dependency error", async () => {
    const malformed = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]).buffer;
    const result = await parseExcelContest(malformed);

    expect(result.data).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ field: "file" });
    expect(JSON.stringify(result)).not.toContain("Error:");
  });

  it("rejects an ExcelJS formula cell instead of trusting its cached result", async () => {
    const result = await parseExcelContest(await createContestWorkbook({ formulaTitle: true }));

    expect(result.data).toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: "Contest_Info", field: "B2" }),
    ]));
  });

  it("uses the patched UUID CommonJS export for ExcelJS conditional-formatting IDs", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("UUID");
    worksheet.getCell("A1").value = 1;
    worksheet.addConditionalFormatting({
      ref: "A1:A2",
      rules: [{
        type: "dataBar",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
        gradient: false,
      }],
    });

    const serialized = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(serialized);
    const loadedSheet = loaded.getWorksheet("UUID") as ExcelJS.Worksheet & {
      conditionalFormattings: Array<{ rules: Array<{ x14Id?: string }> }>;
    };

    expect(loadedSheet.conditionalFormattings[0].rules[0].x14Id)
      .toMatch(/^\{[0-9A-F-]{36}\}$/);
  });

  it("preserves ExcelJS streaming ZIP generation through Archiver and ZipStream", async () => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    const completed = once(output, "end");
    const writer = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output });
    const worksheet = writer.addWorksheet("Stream");
    worksheet.addRow(["archive", "compat"]).commit();
    worksheet.commit();
    await writer.commit();
    await completed;

    const archive = Buffer.concat(chunks);
    expect(archive.subarray(0, 2).toString()).toBe("PK");

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(archive as unknown as ExcelJS.Buffer);
    expect(loaded.getWorksheet("Stream")?.getCell("A1").value).toBe("archive");
  });
});

describe("Phase 1D-C2 archive consumer compatibility (simulation)", () => {
  it("matches, archives, and extracts bounded synthetic files with the overridden consumers", async () => {
    type Archive = NodeJS.ReadableStream & {
      directory(source: string, destination: false): unknown;
      finalize(): Promise<void>;
    };
    const archiver = localRequire("archiver") as (format: "zip") => Archive;
    const unzipper = localRequire("unzipper") as {
      Open: { buffer(value: Buffer): Promise<{ files: Array<{ path: string }> }> };
    };
    const fileUtility = localRequire("archiver-utils/file") as {
      expand(options: { cwd: string; nodir: boolean }, pattern: string): string[];
    };

    let temporaryDirectory: string | undefined;
    try {
      temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "englishphile-c2-archive-"));
      await fs.writeFile(path.join(temporaryDirectory, "alpha.txt"), "alpha");
      await fs.writeFile(path.join(temporaryDirectory, "skip.bin"), "skip");

      expect(fileUtility.expand(
        { cwd: temporaryDirectory, nodir: true },
        "**/*.txt",
      )).toEqual(["alpha.txt"]);

      const archive = archiver("zip");
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
      const ended = once(archive, "end");
      archive.directory(temporaryDirectory, false);
      await archive.finalize();
      await ended;

      const zipped = Buffer.concat(chunks);
      expect(zipped.byteLength).toBeLessThan(64 * 1024);
      const extracted = await unzipper.Open.buffer(zipped);
      expect(extracted.files.map((file) => file.path).sort()).toEqual(["alpha.txt", "skip.bin"]);
    } finally {
      if (temporaryDirectory) {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
  });
});

describe("Phase 1D-C2 brace-expansion probes (bounded subprocess)", () => {
  it("completes CPU and output-length probes on the production Minimatch 10 path", () => {
    const productionRequire = createRequire(localRequire.resolve("readdir-glob"));
    const minimatchPath = productionRequire.resolve("minimatch");
    const braceExpansionPath = createRequire(minimatchPath).resolve("brace-expansion");
    const script = [
      `const loaded = require(${JSON.stringify(minimatchPath)});`,
      "const minimatch = loaded.minimatch || loaded;",
      "const cpuPattern = 'a' + Array.from({length: 30}, () => '{}').join(',');",
      "minimatch('safe.txt', cpuPattern);",
      `const { expand } = require(${JSON.stringify(braceExpansionPath)});`,
      "const output = expand('{a,b}'.repeat(80), { max: 64, maxLength: 4096 });",
      "const length = output.reduce((sum, value) => sum + value.length, 0);",
      "if (output.length > 64 || length > 4096) process.exit(2);",
    ].join("");

    const result = spawnSync(
      process.execPath,
      ["--max-old-space-size=64", "-e", script],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        timeout: 2_000,
        windowsHide: true,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
