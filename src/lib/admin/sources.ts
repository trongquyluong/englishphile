import type { SourceType } from "@prisma/client";
import { createContentAuditLog } from "@/lib/admin/audit";
import { sourceAuditSnapshots } from "@/lib/admin/audit-snapshots";
import type { AdminResult } from "@/lib/admin/questions";
import { sourceTypeValues } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { lockSourceCollectionForAdminMutation } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";

export type SourceCollectionEditPayload = {
  id: string;
  name: string;
  description: string;
  originalFileName?: string | null;
  sourceType: SourceType;
  copyrightNote?: string | null;
};

export async function updateSourceCollection(payload: SourceCollectionEditPayload, userId: string): Promise<AdminResult> {
  if (!payload.name.trim()) return { ok: false, message: "Tên nguồn không được để trống." };
  if (!payload.description.trim()) return { ok: false, message: "Mô tả nguồn không được để trống." };
  if (!sourceTypeValues.includes(payload.sourceType)) return { ok: false, message: "Source type không hợp lệ." };

  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockSourceCollectionForAdminMutation(tx, payload.id);
    if (!locked) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    const before = await tx.sourceCollection.findUnique({ where: { id: locked.id } });
    if (!before) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    const updated = await tx.sourceCollection.update({
      where: { id: payload.id },
      data: {
        name: payload.name.trim(),
        description: payload.description.trim(),
        originalFileName: payload.originalFileName?.trim() || null,
        sourceType: payload.sourceType,
        copyrightNote: payload.copyrightNote?.trim() || null,
      },
    });
    await createContentAuditLog({ userId, entityType: "SourceCollection", entityId: payload.id, action: "UPDATED", ...sourceAuditSnapshots(before, updated) }, tx);
    return { ok: true, message: "Đã cập nhật nguồn tài liệu." };
  });
}
