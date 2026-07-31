import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  auditContentPacks,
  SHORT_EXPLANATION_THRESHOLD,
  type ContentAuditReport,
  type ContentPackAuditInput,
} from "@/lib/content-audit";
import {
  inferContentPackImportType,
  selectImportFiles,
  type ContentPackInputFile,
} from "@/lib/content-packs/file-selection";
import { normalizeImportFile } from "@/lib/import/normalize-file";

type OutputFormat = "table" | "json";

function parseOutputFormat(args: string[]): OutputFormat {
  if (args.length === 0) return "table";
  if (args.length === 1 && args[0] === "--format=json") return "json";
  throw new Error("Chỉ hỗ trợ tùy chọn --format=json.");
}

async function loadPack(
  contentPacksDirectory: string,
  directoryName: string,
): Promise<ContentPackAuditInput> {
  const packDirectory = path.join(contentPacksDirectory, directoryName);
  const directoryEntries = await fs.readdir(packDirectory);
  const readErrors = new Map<string, string>();
  const candidates: ContentPackInputFile[] = await Promise.all(
    directoryEntries
      .filter((entry) => /\.(json|csv)$/i.test(entry))
      .map(async (entry) => {
        try {
          return {
            fileName: entry,
            content: await fs.readFile(path.join(packDirectory, entry), "utf8"),
          };
        } catch {
          readErrors.set(entry, "Không thể đọc file importer đã chọn.");
          return { fileName: entry, content: "" };
        }
      }),
  );
  const selection = selectImportFiles(candidates);
  const files = selection.selected.map((file) => {
    const parseError = readErrors.get(file.fileName);
    const importType = inferContentPackImportType(file.fileName);
    if (parseError || !importType) {
      return {
        fileName: file.fileName,
        parseError: parseError ?? "Định dạng file importer đã chọn không được hỗ trợ.",
      };
    }
    const normalized = normalizeImportFile(importType, file.content);
    return {
      fileName: file.fileName,
      payload: normalized.payload ?? undefined,
      normalizationIssues: normalized.issues,
    };
  });
  const manifestReadError = selection.manifestFileName
    ? readErrors.get(selection.manifestFileName)
    : undefined;
  const manifestParseError =
    manifestReadError ??
    (selection.manifestFileName && !selection.manifest
      ? "Manifest không chứa JSON object hợp lệ."
      : undefined);

  return {
    directory: directoryName,
    ...(selection.manifest ? { manifest: selection.manifest } : {}),
    ...(manifestParseError ? { manifestParseError } : {}),
    files,
  };
}

export async function loadRepositoryContentPacks(
  contentPacksDirectory = path.resolve(process.cwd(), "content-packs"),
) {
  const directoryEntries = await fs.readdir(contentPacksDirectory, {
    withFileTypes: true,
  });
  const packDirectories = directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    packDirectories.map((directoryName) =>
      loadPack(contentPacksDirectory, directoryName),
    ),
  );
}

function findingRows(report: ContentAuditReport) {
  return [
    {
      signal: "Problem thiếu hướng dẫn",
      count: report.findings.problemsWithoutInstructions.length,
    },
    {
      signal: "Câu hỏi thiếu giải thích",
      count: report.findings.missingExplanations.length,
    },
    {
      signal: `Giải thích ngắn hơn ${SHORT_EXPLANATION_THRESHOLD} ký tự (heuristic)`,
      count: report.findings.shortExplanations.length,
    },
    {
      signal: "Word Formation thiếu root word",
      count: report.findings.wordFormationWithoutRootWords.length,
    },
    {
      signal: "Reading không có passage dùng chung",
      count: report.findings.readingQuestionsWithoutPassages.length,
    },
    {
      signal: "Trios không đủ ba câu",
      count: report.findings.triosWithoutThreeSentences.length,
    },
    {
      signal: "Pronunciation thiếu contract target span hợp lệ",
      count: report.findings.pronunciationWithoutValidTargetSpans.length,
    },
    {
      signal: "Listening lỗi contract truyền thông / metadata",
      count: report.findings.listeningContractIssues.length,
    },
    {
      signal: "Lệch skill giữa problem/question",
      count: report.findings.skillMismatches.length,
    },
    {
      signal: "Lệch difficulty giữa problem/question",
      count: report.findings.difficultyMismatches.length,
    },
    {
      signal: "Đáp án option thiếu hoặc không thuộc options",
      count: report.findings.invalidCorrectOptions.length,
    },
    {
      signal: "Option không tương thích learner renderer",
      count: report.findings.rendererIncompatibleOptions.length,
    },
    {
      signal: "Câu có lựa chọn trùng sau chuẩn hóa, cần biên tập",
      count: report.findings.duplicateNormalizedOptionTexts.length,
    },
    {
      signal: "Nhóm prompt trùng lặp chính xác có nội dung",
      count: report.findings.duplicatePromptGroups.length,
    },
  ];
}

function printHumanReport(report: ContentAuditReport) {
  console.log("Englishphile — kiểm kê content pack trong repository");
  console.table([
    {
      packs: report.inventory.packs,
      splitFiles: report.inventory.splitFiles,
      problems: report.inventory.problems,
      questions: report.inventory.questions,
      optionQuestions: report.inventory.optionQuestions,
    },
  ]);

  console.log("Theo content pack");
  console.table(report.packs);

  console.log("Theo skill");
  console.table(
    Object.entries(report.bySkill).map(([skill, counts]) => ({
      skill,
      ...counts,
    })),
  );

  console.log("Câu hỏi theo question type");
  console.table(
    Object.entries(report.byQuestionType).map(([questionType, questions]) => ({
      questionType,
      questions,
    })),
  );

  console.log("Theo difficulty");
  console.table(
    Object.entries(report.byDifficulty).map(([difficulty, counts]) => ({
      difficulty,
      ...counts,
    })),
  );

  console.log("Phân bố vị trí đáp án của câu hỏi option");
  console.table(
    Object.entries(report.answerPositions).map(([position, questions]) => ({
      position,
      questions,
    })),
  );

  console.log("Tín hiệu chất lượng");
  console.table(findingRows(report));
  if (report.findings.shortExplanations.length > 0) {
    console.log("Vị trí giải thích ngắn (heuristic, excerpt tối đa 120 ký tự)");
    console.table(report.findings.shortExplanations);
  }
  if (report.findings.duplicatePromptGroups.length > 0) {
    console.log("Vị trí prompt trùng lặp chính xác có nội dung");
    console.table(
      report.findings.duplicatePromptGroups.flatMap((group, groupIndex) =>
        group.locations.map((location) => ({
          group: groupIndex + 1,
          occurrences: group.occurrences,
          ...location,
        })),
      ),
    );
  }

  console.log("Tính nhất quán manifest/inventory");
  console.table([
    {
      manifestMismatches: report.manifestMismatches.length,
      malformedInputs: report.malformedInputs.length,
      status: report.hasInventoryErrors ? "KHÔNG HỢP LỆ" : "HỢP LỆ",
    },
  ]);

  if (report.manifestMismatches.length > 0) {
    console.table(report.manifestMismatches);
  }
  if (report.malformedInputs.length > 0) {
    console.table(report.malformedInputs);
  }
  if (report.normalizerWarnings.length > 0) {
    console.log("Cảnh báo từ import normalizer");
    console.table(report.normalizerWarnings);
  }
}

async function main() {
  let format: OutputFormat;
  try {
    format = parseOutputFormat(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Tùy chọn không hợp lệ.");
    process.exitCode = 1;
    return;
  }

  try {
    const packs = await loadRepositoryContentPacks();
    const report = auditContentPacks(packs);
    if (format === "json") {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printHumanReport(report);
    }
    if (report.hasInventoryErrors) process.exitCode = 1;
  } catch {
    if (format === "json") {
      process.stdout.write(
        `${JSON.stringify({
          error: "Không thể kiểm kê thư mục content-packs.",
        })}\n`,
      );
    } else {
      console.error("Không thể kiểm kê thư mục content-packs.");
    }
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  void main();
}
