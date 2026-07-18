import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { importContentPackFiles, selectImportFiles, validateContentPackFiles, type ContentPackInputFile } from "@/lib/content-packs/importer";
import { prisma } from "@/lib/prisma";
import { classifySafeError } from "@/lib/operations/safe-error";

function printUsage() {
  console.error("Usage: npm run import:pack -- content-packs/pilot-pack-001");
  console.error("       npm run import:json -- path/to/file.json");
}

async function readInputFiles(targetPath: string): Promise<{ displayPath: string; files: ContentPackInputFile[] }> {
  const absolutePath = path.resolve(process.cwd(), targetPath);
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const entries = await fs.readdir(absolutePath);
    const files = await Promise.all(
      entries
        .filter((entry) => /\.(json|csv)$/i.test(entry))
        .map(async (entry) => ({
          fileName: entry,
          content: await fs.readFile(path.join(absolutePath, entry), "utf8"),
        })),
    );
    return { displayPath: targetPath, files };
  }

  if (stat.isFile() && /\.(json|csv)$/i.test(absolutePath)) {
    return {
      displayPath: targetPath,
      files: [
        {
          fileName: path.basename(absolutePath),
          content: await fs.readFile(absolutePath, "utf8"),
        },
      ],
    };
  }

  throw new Error("Chỉ hỗ trợ thư mục content pack hoặc file .json/.csv.");
}

async function getImporterUserId() {
  const ownerEmail = String(process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (ownerEmail) {
    const owner = await prisma.user.findFirst({
      where: { email: { equals: ownerEmail, mode: "insensitive" } },
    });
    if (owner) return owner.id;
  }

  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error("Không tìm thấy tài khoản quản trị để ghi import batch.");
  return user.id;
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { displayPath, files } = await readInputFiles(targetPath);
  if (!files.length) {
    throw new Error("Không tìm thấy file JSON/CSV trong content pack.");
  }

  const selected = selectImportFiles(files);
  const validation = await validateContentPackFiles(files);
  const userId = await getImporterUserId();
  const result = await importContentPackFiles(files, userId, { publishImmediately: false, fileName: displayPath });
  const problemsImported = result.results.reduce((total, item) => total + item.problemsImported, 0);
  const questionsImported = result.results.reduce((total, item) => total + item.questionsImported, 0);

  console.log("");
  console.log("Englishphile content pack import");
  console.log("--------------------------------");
  console.log("Content pack: selected operator bundle");
  console.log(`Status: ${result.contentPack.status}`);
  console.log("Source path: configured operator path");
  console.log(`Files selected: ${selected.selected.length}`);
  if (selected.ignoredFiles.length) {
    console.log(`Files ignored: ${selected.ignoredFiles.length}`);
  }
  console.log(`Valid files: ${validation.summary.validFiles}`);
  console.log(`Invalid files: ${validation.summary.invalidFiles}`);
  console.log(`Problems imported: ${problemsImported}`);
  console.log(`Questions imported: ${questionsImported}`);
  console.log(`Duplicates skipped: ${validation.summary.duplicatesSkipped}`);
  console.log(`Exact duplicate questions skipped: ${validation.summary.exactDuplicateQuestionsSkipped}`);
  console.log(`High-similarity questions skipped: ${validation.summary.highSimilarityQuestionsSkipped}`);
  console.log(`Possible duplicate questions flagged: ${validation.summary.possibleDuplicateQuestionsFlagged}`);
  console.log(`Errors: ${validation.summary.errors}`);
  console.log("");
  console.log("Next steps:");
  console.log("- Review the created pack in the admin content-pack page.");
  console.log("- Run QA from the admin content-QA page.");
  console.log("- Imported problems default to NEEDS_REVIEW.");
  console.log("");

  if (validation.summary.validFiles === 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`Content-pack import failed (${classifySafeError(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
