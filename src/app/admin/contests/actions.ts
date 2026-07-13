"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createContest, parseContestStatus, parseContestType, parseContestVisibility, updateContest } from "@/lib/contests";
import { prisma } from "@/lib/prisma";

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

async function ensurePublishedProblems(problemIds: string[]) {
  const published = await prisma.problem.findMany({
    where: { id: { in: problemIds }, contentStatus: "PUBLISHED" },
    select: { id: true },
  });
  return published.length === problemIds.length;
}

export async function createContestAction(formData: FormData) {
  const user = await requireAdmin();
  const title = text(formData, "title");
  const problems = parseProblems(formData);
  if (!title) redirectBack("/admin/contests/new", false, "Tiêu đề không được để trống.");
  if (!problems.length) redirectBack("/admin/contests/new", false, "Contest cần có ít nhất một problem đã xuất bản.");
  if (!(await ensurePublishedProblems(problems.map((problem) => problem.problemId)))) {
    redirectBack("/admin/contests/new", false, "Contest chỉ được dùng problem đã xuất bản.");
  }

  const contest = await createContest({
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
    createdById: user.id,
    problems,
  });

  revalidatePath("/contests");
  revalidatePath("/admin/contests");
  redirect(`/admin/contests/${contest.id}?message=${encodeURIComponent("Đã tạo contest.")}`);
}

export async function updateContestAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests/${contestId}/edit`;
  const title = text(formData, "title");
  const problems = parseProblems(formData);
  const newVisibility = parseContestVisibility(text(formData, "visibility"));
  if (!title) redirectBack(returnTo, false, "Tiêu đề không được để trống.");
  if (!problems.length) redirectBack(returnTo, false, "Contest cần có ít nhất một problem đã xuất bản.");
  if (!(await ensurePublishedProblems(problems.map((problem) => problem.problemId)))) {
    redirectBack(returnTo, false, "Contest chỉ được dùng problem đã xuất bản.");
  }

  // Reject missing contests before entering the mutation transaction.
  const current = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { id: true },
  });
  if (!current) redirectBack(returnTo, false, "Không tìm thấy contest.");

  const contest = await updateContest(contestId, {
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
  });

  revalidatePath("/contests");
  revalidatePath("/admin/contests");
  revalidatePath(`/admin/contests/${contest.id}`);
  redirect(`/admin/contests/${contest.id}?message=${encodeURIComponent("Đã cập nhật contest.")}`);
}
