"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContentAuditLog } from "@/lib/admin/audit";
import { contentPackAuditSnapshots } from "@/lib/admin/audit-snapshots";
import { bulkUpdateProblemStatus } from "@/lib/admin/problems";
import { requireAdmin } from "@/lib/auth/session";
import { getContentQaReport } from "@/lib/content-packs/qa";
import { prisma } from "@/lib/prisma";
import { ADMIN_RESOURCE_UNAVAILABLE, lockContentPackForAdminMutation } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWith(path: string, result: { ok: boolean; message: string }): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${result.ok ? "message" : "error"}=${encodeURIComponent(result.message)}`);
}

export async function archiveContentPackAction(formData: FormData) {
  const user = await requireAdmin();
  const contentPackId = text(formData, "contentPackId");
  const archived = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, user.id);
    const locked = await lockContentPackForAdminMutation(tx, contentPackId);
    if (!locked) return false;
    const before = await tx.contentPack.findUnique({ where: { id: locked.id } });
    if (!before) return false;
    const updated = await tx.contentPack.update({ where: { id: contentPackId }, data: { status: "ARCHIVED" } });
    await createContentAuditLog({ userId: user.id, entityType: "ContentPack", entityId: contentPackId, action: "ARCHIVED", ...contentPackAuditSnapshots(before, updated) }, tx);
    return true;
  });
  if (!archived) redirectWith("/admin/content-packs", { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." });
  revalidatePath("/admin/content-packs");
  revalidatePath(`/admin/content-packs/${contentPackId}`);
  redirectWith("/admin/content-packs", { ok: true, message: "Đã lưu trữ gói dữ liệu." });
}

export async function contentPackBulkAction(formData: FormData) {
  const user = await requireAdmin();
  const contentPackId = text(formData, "contentPackId");
  const intent = text(formData, "intent");
  const contentPack = await prisma.contentPack.findUnique({
    where: { id: contentPackId },
    include: { problems: { select: { id: true } } },
  });
  if (!contentPack) redirectWith("/admin/content-packs", { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });

  if (intent === "publish-safe") {
    const report = await getContentQaReport({ contentPackId });
    const safeIds = report.problems.filter((problem) => problem.canPublish).map((problem) => problem.problemId);
    const result = safeIds.length
      ? await bulkUpdateProblemStatus(safeIds, "PUBLISHED", user.id, { qaRequirement: "safe", contentPackId })
      : { ok: true, message: "Không có bài an toàn để publish." };
    if (!result.ok) redirectWith(`/admin/content-packs/${contentPackId}`, result);
    revalidatePath(`/admin/content-packs/${contentPackId}`);
    revalidatePath("/admin/content-qa");
    redirectWith(`/admin/content-packs/${contentPackId}`, {
      ok: true,
      message: `Đã publish ${safeIds.length} bài không có lỗi QA. Bài có lỗi bị bỏ qua.`,
    });
  }

  if (intent === "needs-review") {
    const result = await bulkUpdateProblemStatus(contentPack.problems.map((problem) => problem.id), "NEEDS_REVIEW", user.id, { contentPackId });
    if (!result.ok) redirectWith(`/admin/content-packs/${contentPackId}`, result);
    revalidatePath(`/admin/content-packs/${contentPackId}`);
    redirectWith(`/admin/content-packs/${contentPackId}`, { ok: true, message: "Đã đánh dấu toàn bộ gói cần duyệt." });
  }

  if (intent === "archive-errors") {
    const report = await getContentQaReport({ contentPackId });
    const errorIds = report.problems.filter((problem) => problem.errors > 0).map((problem) => problem.problemId);
    if (errorIds.length) {
      const result = await bulkUpdateProblemStatus(errorIds, "ARCHIVED", user.id, { qaRequirement: "errors", contentPackId });
      if (!result.ok) redirectWith(`/admin/content-packs/${contentPackId}`, result);
    }
    revalidatePath(`/admin/content-packs/${contentPackId}`);
    redirectWith(`/admin/content-packs/${contentPackId}`, { ok: true, message: `Đã lưu trữ ${errorIds.length} bài có lỗi QA.` });
  }

  redirectWith(`/admin/content-packs/${contentPackId}`, { ok: false, message: "Thao tác không hợp lệ." });
}

export async function contentQaBulkAction(formData: FormData) {
  const user = await requireAdmin();
  const intent = text(formData, "intent");
  const problemIds = formData.getAll("problemId").map((value) => String(value)).filter(Boolean);
  if (problemIds.length === 0) redirectWith("/admin/content-qa", { ok: false, message: "Chưa chọn problem nào." });

  if (intent === "publish-safe") {
    const report = await getContentQaReport({ problemIds });
    const safeIds = report.problems.filter((problem) => problem.canPublish).map((problem) => problem.problemId);
    const result = safeIds.length
      ? await bulkUpdateProblemStatus(safeIds, "PUBLISHED", user.id, { qaRequirement: "safe" })
      : { ok: true, message: "Không có bài an toàn để publish." };
    if (!result.ok) redirectWith("/admin/content-qa", result);
    revalidatePath("/admin/content-qa");
    redirectWith("/admin/content-qa", { ok: true, message: `Đã publish ${safeIds.length} bài không có lỗi QA.` });
  }

  if (intent === "needs-review" || intent === "archive") {
    const result = await bulkUpdateProblemStatus(problemIds, intent === "archive" ? "ARCHIVED" : "NEEDS_REVIEW", user.id);
    if (!result.ok) redirectWith("/admin/content-qa", result);
    revalidatePath("/admin/content-qa");
    redirectWith("/admin/content-qa", {
      ok: true,
      message: intent === "archive" ? "Đã lưu trữ các bài đã chọn." : "Đã đánh dấu cần duyệt các bài đã chọn.",
    });
  }

  redirectWith("/admin/content-qa", { ok: false, message: "Thao tác không hợp lệ." });
}
