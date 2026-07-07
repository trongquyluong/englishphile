import { createContentAuditLog } from "@/lib/admin/audit";
import type { AdminResult } from "@/lib/admin/questions";
import { generateSlug } from "@/lib/import/duplicates";
import { prisma } from "@/lib/prisma";

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

  const before = await prisma.topic.findUnique({ where: { id: payload.id } });
  if (!before) return { ok: false, message: "Không tìm thấy topic." };

  const duplicate = await prisma.topic.findFirst({ where: { slug, NOT: { id: payload.id } } });
  if (duplicate) return { ok: false, message: "Slug đã tồn tại." };

  const updated = await prisma.topic.update({
    where: { id: payload.id },
    data: {
      name: payload.name.trim(),
      slug,
      description: payload.description?.trim() || null,
      parentId: payload.parentId || null,
    },
  });

  await createContentAuditLog({
    userId,
    entityType: "Topic",
    entityId: payload.id,
    action: "UPDATED",
    beforeJson: before,
    afterJson: updated,
  });

  return { ok: true, message: "Đã cập nhật topic." };
}
