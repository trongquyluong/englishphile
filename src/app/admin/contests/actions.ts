"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createContest, parseContestStatus, parseContestType, parseContestVisibility, updateContest } from "@/lib/contests";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? value : null;
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function redirectBack(path: string, ok: boolean, message: string): never {
  redirect(`${path}?${ok ? "message" : "error"}=${encodeURIComponent(message)}`);
}

function parseProblems(formData: FormData) {
  const problemIds = [...new Set(formData.getAll("problemId").map((value) => String(value)).filter(Boolean))];
  return problemIds.map((problemId, index) => ({
    problemId,
    section: text(formData, `section_${problemId}`) || "Use of English",
    orderIndex: numberOrNull(formData, `order_${problemId}`) ?? index,
    points: numberOrNull(formData, `points_${problemId}`),
  }));
}

export async function createContestAction(formData: FormData) {
  const user = await requireAdmin();
  const title = text(formData, "title");
  const problems = parseProblems(formData);
  if (!title) redirectBack("/admin/contests/new", false, "Tiêu đề không được để trống.");
  if (!problems.length) redirectBack("/admin/contests/new", false, "Contest cần có ít nhất một problem đã xuất bản.");

  const result = await createContest({
    title,
    slug: text(formData, "slug"),
    description: nullableText(formData, "description"),
    contestType: parseContestType(text(formData, "contestType")),
    status: parseContestStatus(text(formData, "status")),
    visibility: parseContestVisibility(text(formData, "visibility")),
    durationMinutes: numberOrNull(formData, "durationMinutes"),
    startsAt: dateOrNull(formData, "startsAt"),
    endsAt: dateOrNull(formData, "endsAt"),
    sourceName: nullableText(formData, "sourceName"),
    rules: nullableText(formData, "rules"),
    problems,
  }, user.id);
  if (!result.ok) {
    redirectBack(result.kind === "validation" ? "/admin/contests/new" : "/admin/contests", false, result.message);
  }
  const contest = result.contest;

  revalidatePath("/contests");
  revalidatePath("/admin/contests");
  redirect(`/admin/contests/${contest.id}?message=${encodeURIComponent("Đã tạo contest.")}`);
}

export async function updateContestAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests/${contestId}/edit`;
  const title = text(formData, "title");
  const problems = parseProblems(formData);
  const newVisibility = parseContestVisibility(text(formData, "visibility"));
  if (!title) redirectBack(returnTo, false, "Tiêu đề không được để trống.");
  if (!problems.length) redirectBack(returnTo, false, "Contest cần có ít nhất một problem đã xuất bản.");

  const result = await updateContest(contestId, {
    title,
    slug: text(formData, "slug"),
    description: nullableText(formData, "description"),
    contestType: parseContestType(text(formData, "contestType")),
    status: parseContestStatus(text(formData, "status")),
    visibility: newVisibility,
    durationMinutes: numberOrNull(formData, "durationMinutes"),
    startsAt: dateOrNull(formData, "startsAt"),
    endsAt: dateOrNull(formData, "endsAt"),
    sourceName: nullableText(formData, "sourceName"),
    rules: nullableText(formData, "rules"),
    problems,
  }, user.id);
  if (!result.ok) {
    redirectBack(result.kind === "validation" ? returnTo : "/admin/contests", false, result.message);
  }
  const contest = result.contest;

  revalidatePath("/contests");
  revalidatePath("/admin/contests");
  revalidatePath(`/admin/contests/${contest.id}`);
  redirect(`/admin/contests/${contest.id}?message=${encodeURIComponent("Đã cập nhật contest.")}`);
}
