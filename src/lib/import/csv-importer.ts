import type { ContentStatus } from "@prisma/client";
import type { ImportExecutionResult, ImportPlan } from "@/lib/import/types";
import { buildImportPlan } from "@/lib/import/duplicates";
import { normalizeCsvText } from "@/lib/import/normalize-file";
import { executeImportPlanAtomically } from "@/lib/import/atomic-import";
import { AdminResourceUnavailableError } from "@/lib/admin/mutation-locks";
import {
  contentPackFileIdentityMatches,
  createContentPackFileIdentity,
  type ContentPackFileIdentity,
} from "@/lib/content-packs/file-identity";

export { parseCsvImport } from "@/lib/import/normalize-file";

export async function validateCsvRows(text: string): Promise<ImportPlan> {
  const normalized = normalizeCsvText(text);
  return buildImportPlan(normalized.payload, normalized.issues);
}

export async function importCsvRows(
  text: string,
  userId: string,
  options: { publishImmediately?: boolean; contentPackId?: string; fileIdentity?: ContentPackFileIdentity } = {},
): Promise<ImportExecutionResult> {
  const plan = await validateCsvRows(text);
  const fileIdentity = options.fileIdentity
    ? createContentPackFileIdentity(options.fileIdentity.fileName, "CSV", text, options.fileIdentity.position)
    : undefined;
  if (options.contentPackId && (!fileIdentity || !contentPackFileIdentityMatches(fileIdentity, options.fileIdentity!))) {
    throw new AdminResourceUnavailableError();
  }

  const contentStatus: ContentStatus =
    options.publishImmediately && plan.summary.possibleDuplicateQuestionsFlagged === 0 ? "PUBLISHED" : "NEEDS_REVIEW";
  return executeImportPlanAtomically(plan, {
    importType: "CSV",
    userId,
    contentStatus,
    contentPackId: options.contentPackId,
    fileIdentity,
  });
}
