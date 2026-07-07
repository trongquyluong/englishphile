import type { ContentPack, ImportType } from "@prisma/client";
import { importCsvRows, validateCsvRows } from "@/lib/import/csv-importer";
import { importJsonPayload, validateJsonImport } from "@/lib/import/json-importer";
import type { ImportExecutionResult, ImportPlan } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";

export type ContentPackInputFile = {
  fileName: string;
  content: string;
};

export type ContentPackManifestFile = {
  fileName: string;
  skillType?: string;
  problemCount?: number;
  questionCount?: number;
};

export type ContentPackManifest = {
  packName?: string;
  version?: string;
  description?: string;
  createdFor?: string;
  files?: ContentPackManifestFile[];
  totals?: {
    problemCount?: number;
    questionCount?: number;
  };
};

export type ContentPackFilePlan = {
  fileName: string;
  importType: ImportType;
  plan: ImportPlan | null;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
};

export type ContentPackValidationResult = {
  manifest: ContentPackManifest | null;
  packName: string;
  version: string | null;
  description: string | null;
  ignoredFiles: string[];
  files: ContentPackFilePlan[];
  summary: {
    fileCount: number;
    validFiles: number;
    invalidFiles: number;
    ignoredFiles: number;
    problemsToCreate: number;
    questionsToCreate: number;
    duplicatesSkipped: number;
    exactDuplicateQuestionsSkipped: number;
    highSimilarityQuestionsSkipped: number;
    possibleDuplicateQuestionsFlagged: number;
    errors: number;
    warnings: number;
  };
};

export type ContentPackImportResult = ContentPackValidationResult & {
  contentPack: ContentPack;
  results: Array<{
    fileName: string;
    status: string;
    batchId?: string;
    problemsImported: number;
    questionsImported: number;
  }>;
};

function safeParseManifest(content: string): ContentPackManifest | null {
  try {
    const parsed = JSON.parse(content) as ContentPackManifest;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function inferImportType(fileName: string): ImportType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".csv")) return "CSV";
  return null;
}

export function selectImportFiles(files: ContentPackInputFile[]) {
  const manifestFile = files.find((file) => file.fileName.toLowerCase() === "manifest.json");
  const manifest = manifestFile ? safeParseManifest(manifestFile.content) : null;
  const importable = files.filter((file) => {
    const lower = file.fileName.toLowerCase();
    return (lower.endsWith(".json") || lower.endsWith(".csv")) && lower !== "manifest.json";
  });
  const splitFiles = importable.filter((file) => /^\d{2}-/.test(file.fileName) && !file.fileName.startsWith("00-"));
  const hasAllInOne = importable.some((file) => file.fileName.startsWith("00-"));
  const selected = splitFiles.length > 0 && hasAllInOne ? splitFiles : importable;
  const selectedNames = new Set(selected.map((file) => file.fileName));
  const ignoredFiles = importable.filter((file) => !selectedNames.has(file.fileName)).map((file) => file.fileName);

  return {
    manifest,
    manifestFileName: manifestFile?.fileName ?? null,
    selected: selected.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    ignoredFiles,
  };
}

export async function validateContentPackFiles(files: ContentPackInputFile[]): Promise<ContentPackValidationResult> {
  const { manifest, selected, ignoredFiles } = selectImportFiles(files);
  const packName =
    manifest?.packName ??
    (selected.length === 1
      ? selected[0].fileName
      : selected.length > 1
        ? `${selected[0].fileName} + ${selected.length - 1} files`
        : "Content pack chưa đặt tên");
  const version = manifest?.version ?? null;
  const description = manifest?.description ?? null;
  const filePlans: ContentPackFilePlan[] = [];

  for (const file of selected) {
    const importType = inferImportType(file.fileName);
    if (!importType) {
      filePlans.push({
        fileName: file.fileName,
        importType: "JSON",
        plan: null,
        skipped: true,
        skipReason: "Chỉ hỗ trợ JSON/CSV.",
        errors: ["Chỉ hỗ trợ JSON/CSV."],
      });
      continue;
    }

    const plan = importType === "CSV" ? await validateCsvRows(file.content) : await validateJsonImport(file.content);
    filePlans.push({
      fileName: file.fileName,
      importType,
      plan,
      skipped: false,
      errors: plan.issues.filter((issue) => issue.level === "error").map((issue) => issue.message),
    });
  }

  const summary = filePlans.reduce(
    (current, item) => {
      if (item.skipped || !item.plan) {
        current.invalidFiles += 1;
        current.errors += item.errors.length;
        return current;
      }
      if (item.plan.ok) current.validFiles += 1;
      else current.invalidFiles += 1;
      current.problemsToCreate += item.plan.summary.problemsToCreate;
      current.questionsToCreate += item.plan.summary.questionsToCreate;
      current.duplicatesSkipped += item.plan.summary.duplicateProblemsSkipped + item.plan.summary.duplicateQuestionsSkipped;
      current.exactDuplicateQuestionsSkipped += item.plan.summary.exactDuplicateQuestionsSkipped;
      current.highSimilarityQuestionsSkipped += item.plan.summary.highSimilarityQuestionsSkipped;
      current.possibleDuplicateQuestionsFlagged += item.plan.summary.possibleDuplicateQuestionsFlagged;
      current.errors += item.plan.summary.errors;
      current.warnings += item.plan.summary.warnings;
      return current;
    },
    {
      fileCount: filePlans.length,
      validFiles: 0,
      invalidFiles: 0,
      ignoredFiles: ignoredFiles.length,
      problemsToCreate: 0,
      questionsToCreate: 0,
      duplicatesSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      errors: 0,
      warnings: 0,
    },
  );

  return { manifest, packName, version, description, ignoredFiles, files: filePlans, summary };
}

export async function importContentPackFiles(
  files: ContentPackInputFile[],
  userId: string,
  options: { publishImmediately?: boolean; fileName?: string } = {},
): Promise<ContentPackImportResult> {
  const validation = await validateContentPackFiles(files);
  const contentPack = await prisma.contentPack.create({
    data: {
      name: validation.packName,
      version: validation.version,
      description: validation.description,
      manifestJson: validation.manifest ? JSON.parse(JSON.stringify(validation.manifest)) : undefined,
      fileName: options.fileName ?? (files.length === 1 ? files[0].fileName : null),
      status: validation.summary.validFiles > 0 ? "VALIDATED" : "FAILED",
      importedById: userId,
    },
  });

  const results: ContentPackImportResult["results"] = [];
  for (const filePlan of validation.files) {
    const source = files.find((file) => file.fileName === filePlan.fileName);
    if (!source || !filePlan.plan?.ok || filePlan.skipped) {
      continue;
    }

    const result: ImportExecutionResult =
      filePlan.importType === "CSV"
        ? await importCsvRows(source.content, userId, {
            publishImmediately: options.publishImmediately,
            contentPackId: contentPack.id,
            fileName: filePlan.fileName,
          })
        : await importJsonPayload(source.content, userId, {
            publishImmediately: options.publishImmediately,
            contentPackId: contentPack.id,
            fileName: filePlan.fileName,
          });

    results.push({
      fileName: filePlan.fileName,
      status: result.status,
      batchId: result.batchId,
      problemsImported: result.summary.problemsImported,
      questionsImported: result.summary.questionsImported,
    });
  }

  const importedFiles = results.filter((result) => result.status === "IMPORTED").length;
  const nextStatus =
    importedFiles === 0
      ? "FAILED"
      : importedFiles < validation.summary.validFiles
        ? "PARTIALLY_IMPORTED"
        : validation.summary.invalidFiles > 0
          ? "PARTIALLY_IMPORTED"
          : "IMPORTED";

  const updatedPack = await prisma.contentPack.update({
    where: { id: contentPack.id },
    data: { status: nextStatus },
  });

  return { ...validation, contentPack: updatedPack, results };
}
