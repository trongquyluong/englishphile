import { createContentAuditLog } from "@/lib/admin/audit";
import type { AdminResult } from "@/lib/admin/questions";
import { generateSlug } from "@/lib/import/duplicates";
import { prisma } from "@/lib/prisma";
import { lockTopicForAdminMutation } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";

export type TopicEditPayload = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
};

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export async function updateTopic(payload: TopicEditPayload, userId: string): Promise<AdminResult> {
  if (!payload.name.trim()) return { ok: false, message: "Tên topic không được để trống." };
  const slug = payload.slug.trim() || generateSlug(payload.name);
  if (!isValidSlug(slug)) return { ok: false, message: "Slug không hợp lệ." };
  if (payload.parentId === payload.id) return { ok: false, message: "Topic cha không hợp lệ." };

  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockTopicForAdminMutation(tx, payload.id);
    if (!locked) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    const before = await tx.topic.findUnique({ where: { id: locked.id } });
    if (!before) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    const duplicate = await tx.topic.findFirst({ where: { slug, NOT: { id: payload.id } } });
    if (duplicate) return { ok: false, message: "Slug đã tồn tại." };
    if (payload.parentId) {
      const parent = await tx.topic.findUnique({ where: { id: payload.parentId }, select: { id: true } });
      if (!parent) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    }
    const updated = await tx.topic.update({
      where: { id: payload.id },
      data: { name: payload.name.trim(), slug, description: payload.description?.trim() || null, parentId: payload.parentId || null },
    });
    await createContentAuditLog({ userId, entityType: "Topic", entityId: payload.id, action: "UPDATED", beforeJson: before, afterJson: updated }, tx);
    return { ok: true, message: "Đã cập nhật topic." };
  });
}
