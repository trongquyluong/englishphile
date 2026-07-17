import type { ImportExecutionResult, ImportPlan } from "@/lib/import/types";
import type { ContentStatus } from "@prisma/client";
import { buildImportPlan } from "@/lib/import/duplicates";
import { normalizeJsonPayload, parseJsonText } from "@/lib/import/validation";
import { executeImportPlanAtomically } from "@/lib/import/atomic-import";
import { AdminResourceUnavailableError } from "@/lib/admin/mutation-locks";
import {
  contentPackFileIdentityMatches,
  createContentPackFileIdentity,
  type ContentPackFileIdentity,
} from "@/lib/content-packs/file-identity";

export async function validateJsonImport(text: string): Promise<ImportPlan> {
  const parsed = parseJsonText(text);
  if (!parsed.data) {
    return buildImportPlan({ importType: "JSON", problems: [] }, parsed.issues);
  }

  const normalized = normalizeJsonPayload(parsed.data);
  if (!normalized.payload) {
    return buildImportPlan({ importType: "JSON", problems: [] }, normalized.issues);
  }

  return buildImportPlan(normalized.payload, normalized.issues);
}

export async function importJsonPayload(
  text: string,
  userId: string,
  options: { publishImmediately?: boolean; contentPackId?: string; fileIdentity?: ContentPackFileIdentity } = {},
): Promise<ImportExecutionResult> {
  const plan = await validateJsonImport(text);
  const fileIdentity = options.fileIdentity
    ? createContentPackFileIdentity(options.fileIdentity.fileName, "JSON", text, options.fileIdentity.position)
    : undefined;
  if (options.contentPackId && (!fileIdentity || !contentPackFileIdentityMatches(fileIdentity, options.fileIdentity!))) {
    throw new AdminResourceUnavailableError();
  }

  const contentStatus: ContentStatus =
    options.publishImmediately && plan.summary.possibleDuplicateQuestionsFlagged === 0 ? "PUBLISHED" : "NEEDS_REVIEW";
  return executeImportPlanAtomically(plan, {
    importType: "JSON",
    userId,
    contentStatus,
    contentPackId: options.contentPackId,
    fileIdentity,
  });
}
