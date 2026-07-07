"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createContestAttempt, findContestByIdOrSlug, getContestAvailability, submitContestAttempt } from "@/lib/contests";
import { checkRateLimit } from "@/lib/rate-limit";

export async function startContestAction(formData: FormData) {
  const user = await requireUser();
  const contestId = String(formData.get("contestId") ?? "");
  const contest = await findContestByIdOrSlug(contestId);
  if (!contest) redirect("/contests");
  const limit = checkRateLimit({ key: `contest-start:${user.id}:${contest.id}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) redirect(`/contests/${contest.slug}?error=${encodeURIComponent(`Bạn thao tác quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`)}`);
  const availability = getContestAvailability(contest);
  if (!availability.canStart || !contest.problems.length) redirect(`/contests/${contest.slug}?error=${encodeURIComponent(availability.reason)}`);
  const attempt = await createContestAttempt(contest, user.id);
  redirect(`/contests/${contest.slug}/start?attempt=${attempt.id}`);
}

export async function submitContestAction(formData: FormData) {
  const user = await requireUser();
  const contestId = String(formData.get("contestId") ?? "");
  const attemptId = String(formData.get("attemptId") ?? "");
  const contest = await findContestByIdOrSlug(contestId);
  if (!contest || !attemptId) redirect("/contests");
  const limit = checkRateLimit({ key: `contest-submit:${user.id}:${contest.id}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) redirect(`/contests/${contest.slug}/start?attempt=${attemptId}&error=${encodeURIComponent(`Bạn nộp contest quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`)}`);

  const answersByProblem: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer:")) continue;
    const [, problemId, questionId] = key.split(":");
    if (!problemId || !questionId) continue;
    answersByProblem[problemId] ??= {};
    answersByProblem[problemId][questionId] = String(value);
  }

  await submitContestAttempt(contest, attemptId, user.id, answersByProblem);
  redirect(`/contests/${contest.slug}/result?attempt=${attemptId}`);
}
