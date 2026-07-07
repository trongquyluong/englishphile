"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContentAuditLog } from "@/lib/admin/audit";
import { setProblemContentStatus } from "@/lib/admin/problems";
import { requireAdmin } from "@/lib/auth/session";
import { getContentQaReport } from "@/lib/content-packs/qa";
import { prisma } from "@/lib/prisma";

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
  const before = await prisma.contentPack.findUnique({ where: { id: contentPackId } });
  if (!before) redirectWith("/admin/content-packs", { ok: false, message: "Không tìm thấy gói dữ liệu." });
  const updated = await prisma.contentPack.update({ where: { id: contentPackId }, data: { status: "ARCHIVED" } });
  await createContentAuditLog({
    userId: user.id,
    entityType: "ContentPack",
    entityId: contentPackId,
    action: "ARCHIVED",
    beforeJson: before,
    afterJson: updated,
  });
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
  if (!contentPack) redirectWith("/admin/content-packs", { ok: false, message: "Không tìm thấy gói dữ liệu." });

  if (intent === "publish-safe") {
    const report = await getContentQaReport({ contentPackId });
    const safeIds = report.problems.filter((problem) => problem.canPublish).map((problem) => problem.problemId);
    let published = 0;
    for (const problemId of safeIds) {
      const result = await setProblemContentStatus(problemId, "PUBLISHED", user.id);
      if (result.ok) published += 1;
    }
    revalidatePath(`/admin/content-packs/${contentPackId}`);
    revalidatePath("/admin/content-qa");
    redirectWith(`/admin/content-packs/${contentPackId}`, {
      ok: true,
      message: `Đã publish ${published} bài không có lỗi QA. Bài có lỗi bị bỏ qua.`,
    });
  }

  if (intent === "needs-review") {
    for (const problem of contentPack.problems) {
      await setProblemContentStatus(problem.id, "NEEDS_REVIEW", user.id);
    }
    revalidatePath(`/admin/content-packs/${contentPackId}`);
    redirectWith(`/admin/content-packs/${contentPackId}`, { ok: true, message: "Đã đánh dấu toàn bộ gói cần duyệt." });
  }

  if (intent === "archive-errors") {
    const report = await getContentQaReport({ contentPackId });
    const errorIds = report.problems.filter((problem) => problem.errors > 0).map((problem) => problem.problemId);
    for (const problemId of errorIds) {
      await setProblemContentStatus(problemId, "ARCHIVED", user.id);
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
    let published = 0;
    for (const problemId of safeIds) {
      const result = await setProblemContentStatus(problemId, "PUBLISHED", user.id);
      if (result.ok) published += 1;
    }
    revalidatePath("/admin/content-qa");
    redirectWith("/admin/content-qa", { ok: true, message: `Đã publish ${published} bài không có lỗi QA.` });
  }

  if (intent === "needs-review" || intent === "archive") {
    for (const problemId of problemIds) {
      await setProblemContentStatus(problemId, intent === "archive" ? "ARCHIVED" : "NEEDS_REVIEW", user.id);
    }
    revalidatePath("/admin/content-qa");
    redirectWith("/admin/content-qa", {
      ok: true,
      message: intent === "archive" ? "Đã lưu trữ các bài đã chọn." : "Đã đánh dấu cần duyệt các bài đã chọn.",
    });
  }

  redirectWith("/admin/content-qa", { ok: false, message: "Thao tác không hợp lệ." });
}
