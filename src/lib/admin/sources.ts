import type { SourceType } from "@prisma/client";
import { createContentAuditLog } from "@/lib/admin/audit";
import type { AdminResult } from "@/lib/admin/questions";
import { sourceTypeValues } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";

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

  const before = await prisma.sourceCollection.findUnique({ where: { id: payload.id } });
  if (!before) return { ok: false, message: "Không tìm thấy nguồn." };

  const updated = await prisma.sourceCollection.update({
    where: { id: payload.id },
    data: {
      name: payload.name.trim(),
      description: payload.description.trim(),
      originalFileName: payload.originalFileName?.trim() || null,
      sourceType: payload.sourceType,
      copyrightNote: payload.copyrightNote?.trim() || null,
    },
  });

  await createContentAuditLog({
    userId,
    entityType: "SourceCollection",
    entityId: payload.id,
    action: "UPDATED",
    beforeJson: before,
    afterJson: updated,
  });

  return { ok: true, message: "Đã cập nhật nguồn tài liệu." };
}
