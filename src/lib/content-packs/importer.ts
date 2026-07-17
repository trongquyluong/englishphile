import type { ContentPack, ImportType } from "@prisma/client";
import { importCsvRows, validateCsvRows } from "@/lib/import/csv-importer";
import { importJsonPayload, validateJsonImport } from "@/lib/import/json-importer";
import type { ImportExecutionResult, ImportPlan } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import {
  buildContentPackExecutionManifest,
  contentPackBatchIdentitySummary,
  readContentPackExecutionPlan,
  readContentPackBatchIdentity,
  reconcileContentPackExecutionInTransaction,
  type ContentPackFileExecution,
  type ContentPackExecutionPlanEntry,
} from "@/lib/content-packs/execution";
import {
  contentPackFileIdentityKey,
  createContentPackFileIdentity,
  normalizeContentPackFileName,
  type ContentPackFileIdentity,
} from "@/lib/content-packs/file-identity";
import {
  AdminResourceUnavailableError,
  isAdminResourceUnavailableError,
  lockContentPackForAdminMutation,
} from "@/lib/admin/mutation-locks";
import {
  isContentAdminTransactionAuthorizationError,
  requireContentAdminInTransaction,
} from "@/lib/auth/content-admin-transaction";

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
  identity: ContentPackFileIdentity;
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
  results: ContentPackFileExecution[];
};

function expectedPlanDoesNotMatchStored(
  expected: ContentPackExecutionPlanEntry[],
  stored: ContentPackExecutionPlanEntry[],
) {
  return expected.length !== stored.length || expected.some((entry, index) => {
    const storedEntry = stored[index];
    return !storedEntry || contentPackFileIdentityKey(entry) !== contentPackFileIdentityKey(storedEntry);
  });
}

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
    selected,
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
  const normalizedNameCounts = new Map<string, number>();
  for (const file of selected) {
    const normalized = normalizeContentPackFileName(file.fileName);
    normalizedNameCounts.set(normalized, (normalizedNameCounts.get(normalized) ?? 0) + 1);
  }

  for (const [position, file] of selected.entries()) {
    const importType = inferImportType(file.fileName);
    if (!importType) {
      // selectImportFiles currently excludes this branch. Retain a stable
      // failed identity if a future selector broadens accepted candidates.
      const identity = createContentPackFileIdentity(file.fileName, "JSON", file.content, position);
      filePlans.push({
        fileName: file.fileName,
        importType: "JSON",
        identity,
        plan: null,
        skipped: true,
        skipReason: "Chỉ hỗ trợ JSON/CSV.",
        errors: ["Chỉ hỗ trợ JSON/CSV."],
      });
      continue;
    }

    const identity = createContentPackFileIdentity(file.fileName, importType, file.content, position);
    if ((normalizedNameCounts.get(identity.normalizedFileName) ?? 0) > 1) {
      filePlans.push({
        fileName: file.fileName,
        importType,
        identity,
        plan: null,
        skipped: true,
        skipReason: "Tên file bị trùng trong cùng gói.",
        errors: ["Tên file bị trùng trong cùng gói."],
      });
      continue;
    }

    const plan = importType === "CSV" ? await validateCsvRows(file.content) : await validateJsonImport(file.content);
    filePlans.push({
      fileName: file.fileName,
      importType,
      identity,
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
  options: { publishImmediately?: boolean; fileName?: string; resumeContentPackId?: string } = {},
): Promise<ContentPackImportResult> {
  const validation = await validateContentPackFiles(files);
  const executionPlan: ContentPackExecutionPlanEntry[] = validation.files.map((file) => ({
    ...file.identity,
    state: file.skipped || !file.plan?.ok ? "FAILED" : "PENDING",
  }));
  const contentPack = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    if (options.resumeContentPackId) {
      const locked = await lockContentPackForAdminMutation(tx, options.resumeContentPackId);
      if (!locked) throw new AdminResourceUnavailableError();
      const existing = await tx.contentPack.findUnique({ where: { id: locked.id } });
      if (!existing) throw new AdminResourceUnavailableError();
      const storedPlan = readContentPackExecutionPlan(existing.manifestJson);
      if (
        expectedPlanDoesNotMatchStored(executionPlan, storedPlan)
      ) {
        throw new AdminResourceUnavailableError();
      }
      return existing;
    }
    return tx.contentPack.create({
      data: {
        name: validation.packName,
        version: validation.version,
        description: validation.description,
        manifestJson: JSON.parse(JSON.stringify(buildContentPackExecutionManifest(validation.manifest, executionPlan))),
        fileName: options.fileName ?? (files.length === 1 ? files[0].fileName : null),
        status: validation.summary.validFiles > 0 ? "VALIDATED" : "FAILED",
        importedById: userId,
      },
    });
  });

  for (const filePlan of validation.files) {
    const source = files.find((file) => file.fileName === filePlan.fileName);
    if (!source || !filePlan.plan?.ok || filePlan.skipped) {
      continue;
    }

    try {
      const result: ImportExecutionResult =
        filePlan.importType === "CSV"
          ? await importCsvRows(source.content, userId, {
              publishImmediately: options.publishImmediately,
              contentPackId: contentPack.id,
              fileIdentity: filePlan.identity,
            })
          : await importJsonPayload(source.content, userId, {
              publishImmediately: options.publishImmediately,
              contentPackId: contentPack.id,
              fileIdentity: filePlan.identity,
            });
      if (result.status !== "IMPORTED") {
        // The atomic helper durably recorded a FAILED batch (for example,
        // when normalized commit limits reject the plan). Final reconciliation
        // below will reflect that failure without creating a duplicate marker.
        continue;
      }
    } catch (error) {
      if (isContentAdminTransactionAuthorizationError(error) || isAdminResourceUnavailableError(error)) {
        throw error;
      }
      await prisma.$transaction(async (tx) => {
        await requireContentAdminInTransaction(tx, userId);
        const locked = await lockContentPackForAdminMutation(tx, contentPack.id);
        if (!locked) throw new AdminResourceUnavailableError();
        const importedBatches = await tx.importBatch.findMany({
          where: {
            contentPackId: contentPack.id,
            status: "IMPORTED",
          },
          select: { id: true, summary: true },
        });
        const identityKey = contentPackFileIdentityKey(filePlan.identity);
        const alreadyImported = importedBatches.some((batch) => {
          const identity = readContentPackBatchIdentity(batch.summary);
          return identity ? contentPackFileIdentityKey(identity) === identityKey : false;
        });
        if (!alreadyImported) {
          await tx.importBatch.create({
            data: {
              userId,
              importType: filePlan.importType,
              status: "FAILED",
              summary: {
                ...filePlan.plan!.summary,
                ...contentPackBatchIdentitySummary(filePlan.identity),
                problemsImported: 0,
                questionsImported: 0,
              },
              errorLog: [{ level: "error", path: "import", message: "Không thể commit file này." }],
              contentPackId: contentPack.id,
            },
          });
        }
        const reconciled = await reconcileContentPackExecutionInTransaction(tx, contentPack.id);
        if (!reconciled) throw new AdminResourceUnavailableError();
      });
    }
  }

  const finalized = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockContentPackForAdminMutation(tx, contentPack.id);
    if (!locked) throw new AdminResourceUnavailableError();
    const reconciled = await reconcileContentPackExecutionInTransaction(tx, contentPack.id);
    if (!reconciled || reconciled.summary.pendingFiles > 0) {
      throw new Error("Không thể hoàn tất trạng thái gói dữ liệu.");
    }
    return reconciled;
  });

  return { ...validation, contentPack: finalized.contentPack, results: finalized.results };
}
