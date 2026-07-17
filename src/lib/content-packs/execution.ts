import type { ContentPackStatus, ImportStatus, ImportType, Prisma } from "@prisma/client";
import {
  contentPackFileIdentityKey,
  deriveContentPackFileEntryId,
  normalizeContentPackFileName,
  type ContentPackFileIdentity,
} from "@/lib/content-packs/file-identity";

export type ContentPackFileExecution = ContentPackFileIdentity & {
  status: "PENDING" | ImportStatus;
  batchId?: string;
  problemsImported: number;
  questionsImported: number;
};

export type ContentPackExecutionPlanEntry = ContentPackFileIdentity & {
  state: "PENDING" | "FAILED";
};

export type ContentPackExecutionSummary = {
  status: ContentPackStatus;
  importedFiles: number;
  failedFiles: number;
  pendingFiles: number;
  problemsImported: number;
  questionsImported: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function readIdentity(value: unknown): ContentPackFileIdentity | null {
  const item = record(value);
  if (
    !isSha256(item.entryId) ||
    !Number.isSafeInteger(item.position) ||
    Number(item.position) < 0 ||
    typeof item.fileName !== "string" ||
    typeof item.normalizedFileName !== "string" ||
    !item.normalizedFileName ||
    !["JSON", "CSV"].includes(String(item.importType)) ||
    !isSha256(item.contentDigest)
  ) return null;
  const identity = {
    entryId: item.entryId,
    position: Number(item.position),
    fileName: item.fileName,
    normalizedFileName: item.normalizedFileName,
    importType: item.importType as ImportType,
    contentDigest: item.contentDigest,
  };
  if (normalizeContentPackFileName(identity.fileName) !== identity.normalizedFileName) return null;
  if (
    deriveContentPackFileEntryId(
      identity.position,
      identity.normalizedFileName,
      identity.importType,
      identity.contentDigest,
    ) !== identity.entryId
  ) return null;
  return identity;
}

export function contentPackBatchIdentitySummary(identity: ContentPackFileIdentity) {
  return {
    executionEntryId: identity.entryId,
    executionPosition: identity.position,
    fileName: identity.fileName,
    normalizedFileName: identity.normalizedFileName,
    importType: identity.importType,
    contentDigest: identity.contentDigest,
  };
}

export function readContentPackBatchIdentity(summary: unknown): ContentPackFileIdentity | null {
  const item = record(summary);
  return readIdentity({
    entryId: item.executionEntryId,
    position: item.executionPosition,
    fileName: item.fileName,
    normalizedFileName: item.normalizedFileName,
    importType: item.importType,
    contentDigest: item.contentDigest,
  });
}

export function summarizeContentPackExecution(
  results: ContentPackFileExecution[],
): ContentPackExecutionSummary {
  const importedFiles = results.filter((result) => result.status === "IMPORTED").length;
  const failedFiles = results.filter((result) => result.status === "FAILED").length;
  const pendingFiles = results.filter((result) => result.status === "PENDING" || result.status === "VALIDATED").length;
  const status: ContentPackStatus =
    pendingFiles > 0
      ? importedFiles > 0 ? "PARTIALLY_IMPORTED" : "VALIDATED"
      : importedFiles === 0
        ? "FAILED"
        : failedFiles > 0
          ? "PARTIALLY_IMPORTED"
          : "IMPORTED";
  return {
    status,
    importedFiles,
    failedFiles,
    pendingFiles,
    problemsImported: results.reduce(
      (total, result) => total + (result.status === "IMPORTED" ? result.problemsImported : 0),
      0,
    ),
    questionsImported: results.reduce(
      (total, result) => total + (result.status === "IMPORTED" ? result.questionsImported : 0),
      0,
    ),
  };
}

export function buildContentPackExecutionManifest(
  manifest: unknown,
  plan: ContentPackExecutionPlanEntry[],
) {
  const executionResults: ContentPackFileExecution[] = plan.map((entry) => ({
    ...entry,
    status: entry.state,
    problemsImported: 0,
    questionsImported: 0,
  }));
  return {
    ...record(manifest),
    executionPlan: plan,
    executionResults,
    executionSummary: summarizeContentPackExecution(executionResults),
  };
}

export function readContentPackExecutionPlan(manifest: unknown): ContentPackExecutionPlanEntry[] {
  const value = record(manifest).executionPlan;
  if (!Array.isArray(value)) return [];
  const plan: ContentPackExecutionPlanEntry[] = [];
  const entryIds = new Set<string>();
  const positions = new Set<number>();
  for (const entry of value) {
    const item = record(entry);
    const identity = readIdentity(item);
    if (!identity || !["PENDING", "FAILED"].includes(String(item.state))) return [];
    if (identity.position !== plan.length) return [];
    if (entryIds.has(identity.entryId) || positions.has(identity.position)) return [];
    entryIds.add(identity.entryId);
    positions.add(identity.position);
    plan.push({ ...identity, state: item.state as "PENDING" | "FAILED" });
  }
  return plan;
}

function executionFromBatch(batch: {
  id: string;
  status: ImportStatus;
  summary: unknown;
}): ContentPackFileExecution | null {
  const summary = record(batch.summary);
  const identity = readContentPackBatchIdentity(summary);
  if (!identity) return null;
  return {
    ...identity,
    status: batch.status,
    batchId: batch.id,
    problemsImported: batch.status === "IMPORTED" ? nonNegativeInteger(summary.problemsImported) : 0,
    questionsImported: batch.status === "IMPORTED" ? nonNegativeInteger(summary.questionsImported) : 0,
  };
}

/**
 * Rebuilds the pack execution state from its durable plan and linked batches.
 * The caller must already hold the ContentPack row lock.
 */
export async function reconcileContentPackExecutionInTransaction(
  tx: Prisma.TransactionClient,
  contentPackId: string,
) {
  const pack = await tx.contentPack.findUnique({ where: { id: contentPackId } });
  if (!pack) return null;
  const plan = readContentPackExecutionPlan(pack.manifestJson);
  if (!plan.length) return null;
  const batches = await tx.importBatch.findMany({
    where: { contentPackId },
    select: { id: true, status: true, summary: true },
    orderBy: { createdAt: "asc" },
  });
  const planByKey = new Map(plan.map((entry) => [contentPackFileIdentityKey(entry), entry]));
  const imported = new Map<string, ContentPackFileExecution>();
  const failed = new Map<string, ContentPackFileExecution>();
  for (const batch of batches) {
    const execution = executionFromBatch(batch);
    if (!execution) continue;
    const key = contentPackFileIdentityKey(execution);
    if (!planByKey.has(key)) continue;
    if (execution.status === "IMPORTED") {
      // Multiple committed batches for one durable entry are ambiguous. Do
      // not double-count them or represent the pack as successfully finalized.
      if (imported.has(key)) return null;
      imported.set(key, execution);
    } else if (execution.status === "FAILED" && !failed.has(key)) {
      failed.set(key, execution);
    }
  }
  const results = plan.map((entry): ContentPackFileExecution => {
    const key = contentPackFileIdentityKey(entry);
    return imported.get(key) ??
    failed.get(key) ?? {
      ...entry,
      status: entry.state,
      problemsImported: 0,
      questionsImported: 0,
    };
  });
  const summary = summarizeContentPackExecution(results);
  const manifestJson = {
    ...record(pack.manifestJson),
    executionResults: results,
    executionSummary: summary,
  };
  const contentPack = await tx.contentPack.update({
    where: { id: contentPackId },
    data: {
      status: summary.status,
      manifestJson: JSON.parse(JSON.stringify(manifestJson)),
    },
  });
  return { contentPack, results, summary };
}
