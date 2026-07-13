"use server";

import { redirect } from "next/navigation";
import { isAdminUser, requireUser } from "@/lib/auth/session";
import { createContestAttempt, findContestByIdOrSlug, getContestAvailability, submitContestAttempt } from "@/lib/contests";
import {
  authorizeContestAccess,
  getContestAccessGrantIdFromCookie,
} from "@/lib/security/access-grant";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseContestAnswerEntries } from "@/lib/security/submission-input";

/**
 * Submit access code for a private contest.
 * Uses POST (Server Action) instead of URL query parameters.
 * Creates an access grant on success.
 */
export async function submitAccessCodeAction(formData: FormData) {
  const user = await requireUser();
  const contestId = String(formData.get("contestId") ?? "");
  const accessCode = String(formData.get("accessCode") ?? "").trim();
  const genericFailure = `/contests?error=${encodeURIComponent(
    "Không thể xác minh mã truy cập. Vui lòng thử lại sau.",
  )}`;

  if (!contestId || contestId.length > 128) redirect(genericFailure);

  // Admin bypass
  if (isAdminUser(user)) {
    const contest = await findContestByIdOrSlug(contestId);
    if (!contest) redirect(genericFailure);
    redirect(`/contests/${contest.slug}`);
  }

  const rateLimitResult = await checkConfiguredRateLimit(RATE_LIMITS.CONTEST_ACCESS_CODE(user.id));
  if (rateLimitResult.status !== "allowed") redirect(genericFailure);

  let authorization: Awaited<ReturnType<typeof authorizeContestAccess>>;
  try {
    authorization = await authorizeContestAccess(user.id, contestId, accessCode);
  } catch (error) {
    console.error(
      "[contest-access] Authorization infrastructure error:",
      error instanceof Error ? error.name : "unknown",
    );
    redirect(genericFailure);
  }

  if (!authorization.authorized) redirect(genericFailure);
  const contest = await findContestByIdOrSlug(contestId);
  if (!contest) redirect(genericFailure);
  redirect(`/contests/${contest.slug}`);
}

/**
 * Start a contest attempt.
 * For private contests, validates the access grant instead of requiring a code.
 */
export async function startContestAction(formData: FormData) {
  const user = await requireUser();
  const contestId = String(formData.get("contestId") ?? "");
  const contest = await findContestByIdOrSlug(contestId);
  if (!contest) redirect("/contests");

  // Rate limit contest starts
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.CONTEST_START(contest.id, user.id));
  if (limit.status !== "allowed")
    redirect(
      `/contests/${contest.slug}?error=${encodeURIComponent(
        limit.status === "infrastructure-error"
          ? "Không thể bắt đầu contest lúc này. Vui lòng thử lại sau."
          : `Bạn thao tác quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`
      )}`
    );

  const availability = getContestAvailability(contest);
  const hasContent = contest.problems.length > 0 || contest.sections.length > 0;
  if (!availability.canStart || !hasContent)
    redirect(
      `/contests/${contest.slug}?error=${encodeURIComponent(availability.reason)}`
    );

  const isAdmin = isAdminUser(user);
  const grantId = isAdmin ? null : await getContestAccessGrantIdFromCookie();
  const attemptResult = await createContestAttempt(contest, user.id, {
    grantId,
    bypassPrivateAccess: isAdmin,
  });
  if (!attemptResult.ok) {
    redirect(
      `/contests/${contest.slug}?error=${encodeURIComponent(
        attemptResult.message
      )}`
    );
  }
  redirect(`/contests/${contest.slug}/start?attempt=${attemptResult.attempt.id}`);
}

export async function submitContestAction(formData: FormData) {
  const user = await requireUser();
  const contestId = String(formData.get("contestId") ?? "");
  const attemptId = String(formData.get("attemptId") ?? "");
  const contest = await findContestByIdOrSlug(contestId);
  if (!contest || !attemptId) redirect("/contests");

  // Rate limit contest submissions
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.CONTEST_SUBMIT(contest.id, user.id));
  if (limit.status !== "allowed")
    redirect(
      `/contests/${contest.slug}/start?attempt=${attemptId}&error=${encodeURIComponent(
        limit.status === "infrastructure-error"
          ? "Không thể nộp contest lúc này. Vui lòng thử lại sau."
          : `Bạn nộp contest quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`
      )}`
    );

  const problemQuestionIds = new Map(
    contest.problems.map((item) => [
      item.problemId,
      new Set(item.problem.questions.map((question) => question.id)),
    ]),
  );
  const sectionQuestionIds = new Map(
    contest.sections.map((section) => [
      section.id,
      new Set(section.questions.map((question) => question.id)),
    ]),
  );

  const { answersByProblem, answersBySection } = parseContestAnswerEntries(formData.entries(), {
    problemQuestions: problemQuestionIds,
    sectionQuestions: sectionQuestionIds,
  });

  await submitContestAttempt(contest, attemptId, user.id, answersByProblem, answersBySection);
  redirect(`/contests/${contest.slug}/result?attempt=${attemptId}`);
}
