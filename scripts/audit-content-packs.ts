import { promises as fs } from "node:fs";
import path from "node:path";
import {
  auditContentPacks,
  parseContentPackManifest,
  SHORT_EXPLANATION_THRESHOLD,
  type ContentAuditReport,
  type ContentPackAuditInput,
} from "@/lib/content-audit";

type OutputFormat = "table" | "json";

function parseOutputFormat(args: string[]): OutputFormat {
  if (args.length === 0) return "table";
  if (args.length === 1 && args[0] === "--format=json") return "json";
  throw new Error("Chỉ hỗ trợ tùy chọn --format=json.");
}

async function parseJsonFile(filePath: string): Promise<{
  payload?: unknown;
  parseError?: string;
}> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    try {
      return { payload: JSON.parse(text) as unknown };
    } catch {
      return { parseError: "File không chứa JSON hợp lệ." };
    }
  } catch {
    return { parseError: "Không thể đọc file được manifest liệt kê." };
  }
}

function safeListedFilePath(packDirectory: string, fileName: string) {
  const resolvedPackDirectory = path.resolve(packDirectory);
  const resolvedFile = path.resolve(resolvedPackDirectory, fileName);
  if (path.dirname(resolvedFile) !== resolvedPackDirectory) return undefined;
  return resolvedFile;
}

async function loadPack(
  contentPacksDirectory: string,
  directoryName: string,
): Promise<ContentPackAuditInput> {
  const packDirectory = path.join(contentPacksDirectory, directoryName);
  const manifestPath = path.join(packDirectory, "manifest.json");
  const manifestResult = await parseJsonFile(manifestPath);

  if (manifestResult.parseError) {
    return {
      directory: directoryName,
      manifestParseError: manifestResult.parseError,
      files: [],
    };
  }

  const manifest = manifestResult.payload;
  const parsedManifest = parseContentPackManifest(manifest);
  const files = [];

  for (const entry of parsedManifest.entries) {
    const listedPath = safeListedFilePath(packDirectory, entry.fileName);
    if (!listedPath) {
      files.push({
        fileName: entry.fileName,
        parseError: "Đường dẫn split file không an toàn.",
      });
      continue;
    }
    const parsedFile = await parseJsonFile(listedPath);
    files.push({ fileName: entry.fileName, ...parsedFile });
  }

  return {
    directory: directoryName,
    manifest,
    files,
  };
}

async function loadRepositoryContentPacks() {
  const contentPacksDirectory = path.resolve(process.cwd(), "content-packs");
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

void main();
