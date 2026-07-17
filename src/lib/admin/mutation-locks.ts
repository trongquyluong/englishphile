import { Prisma } from "@prisma/client";

export const ADMIN_RESOURCE_UNAVAILABLE = "Tài nguyên không tồn tại hoặc không còn khả dụng.";
export const MAX_ADMIN_BULK_ITEMS = 50;
export const MAX_ADMIN_BULK_QUESTIONS = 1000;

export class AdminResourceUnavailableError extends Error {
  constructor() {
    super(ADMIN_RESOURCE_UNAVAILABLE);
    this.name = "AdminResourceUnavailableError";
  }
}

export function isAdminResourceUnavailableError(error: unknown): error is AdminResourceUnavailableError {
  return error instanceof AdminResourceUnavailableError;
}

export function parseBoundedUniqueIds(ids: string[]) {
  const normalized = ids.map((id) => id.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return { ok: false as const, message: "Chưa chọn nội dung nào." };
  }
  if (normalized.length > MAX_ADMIN_BULK_ITEMS) {
    return { ok: false as const, message: `Mỗi thao tác chỉ hỗ trợ tối đa ${MAX_ADMIN_BULK_ITEMS} mục.` };
  }
  if (new Set(normalized).size !== normalized.length) {
    return { ok: false as const, message: "Danh sách có mã bị trùng." };
  }
  return { ok: true as const, ids: normalized };
}

export async function lockContestForAdminMutation(tx: Prisma.TransactionClient, contestId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contest"
    WHERE "id" = ${contestId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockContentPackForAdminMutation(
  tx: Prisma.TransactionClient,
  contentPackId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "ContentPack"
    WHERE "id" = ${contentPackId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockSourceCollectionForAdminMutation(
  tx: Prisma.TransactionClient,
  sourceCollectionId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "SourceCollection"
    WHERE "id" = ${sourceCollectionId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockTopicForAdminMutation(tx: Prisma.TransactionClient, topicId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Topic"
    WHERE "id" = ${topicId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockProblemsForAdminMutation(tx: Prisma.TransactionClient, problemIds: string[]) {
  if (problemIds.length === 0) return [];
  return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Problem"
    WHERE "id" IN (${Prisma.join(problemIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

export async function shareLockPublishedProblems(tx: Prisma.TransactionClient, problemIds: string[]) {
  if (problemIds.length === 0) return [];
  return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Problem"
    WHERE "id" IN (${Prisma.join(problemIds)})
      AND "contentStatus" = 'PUBLISHED'::"ContentStatus"
    ORDER BY "id"
    FOR SHARE
  `);
}
