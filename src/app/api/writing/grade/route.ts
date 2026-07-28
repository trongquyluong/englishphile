import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWritingGlobalDailyLimit,
  gradeEssay,
  isWritingGraderEnabled,
  WritingGraderError,
} from "@/lib/ai/writing-grader";
import { getCurrentUser } from "@/lib/auth/session";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  reserveWritingQuota,
  markProviderStarted,
  releaseProviderStartedWritingReservation,
  cancelWritingReservation,
  getWritingQuotaStatus,
  persistCompletedWritingSubmission,
} from "@/lib/security/writing-quota";
import { getUtcQuotaKey } from "@/lib/security/writing-quota-core";
import { Prisma } from "@prisma/client";
import {
  countWords,
  isWritingReviewTimestamp,
  targetWordCountValues,
  WRITING_GRADER_MAX_ESSAY_CHARS,
  WRITING_GRADER_MAX_WORDS,
  WRITING_GRADER_MIN_WORDS,
} from "@/lib/writing-grader-shared";
import { getWritingPromptBySlug, mapEssayTypeToGraderValue } from "@/lib/writing-prompts";

// Grading calls the AI provider and can take longer than the default limit.
export const maxDuration = 60;

const requestSchema = z.object({
  promptSlug: z.string().min(1),
  targetWordCount: z.enum(targetWordCountValues),
  essayText: z.string().trim().min(1).max(WRITING_GRADER_MAX_ESSAY_CHARS),
});

function errorResponse(message: string, status: number, remaining?: number) {
  return NextResponse.json(
    {
      error: message,
      ...(remaining === undefined ? {} : { remaining }),
    },
    { status },
  );
}

async function readAuthoritativeRemaining(userId: string): Promise<number | undefined> {
  try {
    const quota = await getWritingQuotaStatus(userId);
    return Math.min(quota.total, Math.max(0, quota.remaining));
  } catch {
    console.error("[writing-grade]", { event: "quota-status-read-failure" });
    return undefined;
  }
}

async function learnerErrorResponse(
  userId: string,
  message: string,
  status: number,
  knownRemaining?: number,
) {
  const remaining =
    knownRemaining ?? (await readAuthoritativeRemaining(userId));
  return errorResponse(message, status, remaining);
}

async function releaseFailedGradeReservation(
  reservationId: string,
  userId: string,
): Promise<number | undefined> {
  const released = await releaseProviderStartedWritingReservation(
    reservationId,
    userId,
  );
  if (!released) {
    console.error("[writing-grade]", {
      event: "learner-reservation-release-not-confirmed",
    });
  }
  return readAuthoritativeRemaining(userId);
}

function validationMessage(error: z.ZodError): string {
  const fields = new Set(error.issues.map((issue) => String(issue.path[0] ?? "")));
  if (fields.has("promptSlug")) {
    return "Vui lòng chọn đề bài từ Gym Writing.";
  }
  if (fields.has("essayText")) {
    return "Vui lòng nhập bài viết của bạn vào ô bài làm.";
  }
  return "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại form.";
}

const graderErrorResponses: Record<WritingGraderError["code"], { message: string; status: number }> = {
  NOT_CONFIGURED: { message: "Tính năng chấm bài Writing chưa sẵn sàng.", status: 503 },
  PROVIDER_RATE_LIMITED: {
    message: "Hệ thống chấm bài đang quá tải. Vui lòng đợi vài phút rồi thử lại.",
    status: 429,
  },
  CONTENT_BLOCKED: {
    message: "Hệ thống không thể xử lý bài viết này. Hãy kiểm tra lại nội dung và thử lại.",
    status: 422,
  },
  INVALID_RESPONSE: {
    message: "Không tạo được kết quả chấm hợp lệ. Vui lòng thử lại.",
    status: 502,
  },
  NETWORK_ERROR: {
    message: "Không kết nối được tới hệ thống chấm bài. Vui lòng thử lại sau.",
    status: 504,
  },
  PROVIDER_ERROR: {
    message: "Hệ thống chấm bài đang gặp sự cố. Vui lòng thử lại sau.",
    status: 502,
  },
};

export async function POST(request: Request) {
  // Validate request origin (CSRF protection)
  const originCheck = await validateRequestOrigin();
  if (!originCheck.valid) {
    return errorResponse(getOriginErrorMessage(), 403);
  }

  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Bạn cần đăng nhập để nộp bài Writing.", 401);
  }

  if (!isWritingGraderEnabled()) {
    return learnerErrorResponse(
      user.id,
      "Tính năng chấm bài Writing chưa sẵn sàng.",
      503,
    );
  }

  // Check per-user rate limit (short-term burst protection)
  const userLimit = await checkConfiguredRateLimit(RATE_LIMITS.WRITING_GRADE(user.id));
  if (userLimit.status !== "allowed") {
    if (userLimit.status === "infrastructure-error") {
      return learnerErrorResponse(
        user.id,
        "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
        503,
      );
    }
    const minutes = Math.max(1, Math.ceil(userLimit.retryAfterSeconds / 60));
    return learnerErrorResponse(
      user.id,
      `Bạn đã gửi khá nhiều bài trong thời gian ngắn. Thử lại sau khoảng ${minutes} phút nhé.`,
      429,
    );
  }

  // Check global rate limit
  const globalLimit = await checkConfiguredRateLimit(RATE_LIMITS.WRITING_GRADE_GLOBAL);
  if (globalLimit.status !== "allowed") {
    if (globalLimit.status === "infrastructure-error") {
      return learnerErrorResponse(
        user.id,
        "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
        503,
      );
    }
    return learnerErrorResponse(
      user.id,
      "Hệ thống chấm bài đang bận. Vui lòng thử lại sau ít phút.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return learnerErrorResponse(user.id, "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return learnerErrorResponse(user.id, validationMessage(parsed.error), 400);
  }

  // Look up prompt from static bank — do not trust client-supplied promptText or essayType
  const prompt = getWritingPromptBySlug(parsed.data.promptSlug);
  if (!prompt) {
    return learnerErrorResponse(
      user.id,
      "Đề bài không hợp lệ. Vui lòng chọn đề từ Gym Writing.",
      400,
    );
  }

  const wordCount = countWords(parsed.data.essayText);
  if (wordCount < WRITING_GRADER_MIN_WORDS) {
    return learnerErrorResponse(
      user.id,
      `Bài viết hiện có ${wordCount} từ — quá ngắn để chấm chính xác. Hãy viết ít nhất ${WRITING_GRADER_MIN_WORDS} từ.`,
      400,
    );
  }
  if (wordCount > WRITING_GRADER_MAX_WORDS) {
    return learnerErrorResponse(
      user.id,
      `Bài viết hiện có ${wordCount} từ — vượt giới hạn ${WRITING_GRADER_MAX_WORDS} từ cho mỗi lần chấm. Hãy rút gọn bớt.`,
      400,
    );
  }

  // Reserve a quota slot BEFORE calling the AI grader (prevents race condition)
  const reservation = await reserveWritingQuota(user.id);
  if (!reservation.allowed) {
    if (reservation.reason === "infrastructure-error") {
      return learnerErrorResponse(
        user.id,
        "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
        503,
      );
    }
    // quota-exceeded
    return learnerErrorResponse(
      user.id,
      "Bạn đã dùng hết 2 lượt chấm Writing hôm nay. Hãy quay lại vào ngày mai.",
      429,
      reservation.remaining,
    );
  }

  // Reserve a separate global daily allowance immediately before the provider
  // call. Invalid or unavailable configuration fails closed and releases the
  // still-unstarted per-user reservation.
  const globalDailyLimit = getWritingGlobalDailyLimit();
  if (!globalDailyLimit) {
    await cancelWritingReservation(reservation.reservationId, user.id);
    return learnerErrorResponse(
      user.id,
      "Tính năng chấm bài Writing tạm thời chưa sẵn sàng.",
      503,
    );
  }

  const globalDailyAllowance = await checkConfiguredRateLimit(
    RATE_LIMITS.WRITING_GRADE_DAILY_GLOBAL(
      getUtcQuotaKey(new Date()),
      globalDailyLimit,
    ),
  );
  if (globalDailyAllowance.status !== "allowed") {
    await cancelWritingReservation(reservation.reservationId, user.id);
    if (globalDailyAllowance.status === "infrastructure-error") {
      return learnerErrorResponse(
        user.id,
        "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
        503,
      );
    }
    return learnerErrorResponse(
      user.id,
      "Hệ thống đã dùng hết lượt chấm bài hôm nay. Hãy quay lại vào ngày mai.",
      429,
    );
  }

  // Mark provider as starting — this prevents cleanup from reclaiming the slot
  // if the provider is called and we're waiting for a response.
  const providerStarted = await markProviderStarted(reservation.reservationId, user.id);
  if (!providerStarted) {
    await cancelWritingReservation(reservation.reservationId, user.id);
    return learnerErrorResponse(
      user.id,
      "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
      503,
    );
  }

  const essayType = mapEssayTypeToGraderValue(prompt.essayType);
  let result: Awaited<ReturnType<typeof gradeEssay>>;
  try {
    // Call AI grader OUTSIDE the database transaction
    result = await gradeEssay({
      prompt: prompt.statement,
      essayType: essayType as "opinion" | "discussion" | "advantage-disadvantage" | "outweigh" | "cause-effect-solution" | "double-question" | "other",
      targetWordCount: parsed.data.targetWordCount,
      essayText: parsed.data.essayText,
    });
  } catch (error) {
    const remaining = await releaseFailedGradeReservation(
      reservation.reservationId,
      user.id,
    );
    if (error instanceof WritingGraderError) {
      const mapped = graderErrorResponses[error.code];
      return errorResponse(mapped.message, mapped.status, remaining);
    }

    console.error("[writing-grade]", {
      event: "unexpected-pre-persistence-failure",
    });
    return errorResponse(
      "Có lỗi xảy ra khi chấm bài. Bản nháp của bạn vẫn được giữ để thử lại.",
      500,
      remaining,
    );
  }

  try {
    // Persist the submission and COMPLETED transition atomically after the
    // provider returns a validated, normalized result.
    const submission = await persistCompletedWritingSubmission(reservation.reservationId, user.id, {
      promptSlug: prompt.slug,
      promptText: prompt.statement,
      essayType: prompt.essayType,
      targetWordCount: parsed.data.targetWordCount,
      essayText: parsed.data.essayText,
      resultJson: result as unknown as Prisma.InputJsonValue,
    });
    const reviewTimestamp = submission.createdAt.getTime();
    const timestampValid = isWritingReviewTimestamp(reviewTimestamp);
    if (!timestampValid) {
      console.error("[writing-grade]", {
        event: "persistence-timestamp-invalid",
      });
    }

    const remaining = await readAuthoritativeRemaining(user.id);
    return NextResponse.json({
      result,
      ...(timestampValid ? { reviewTimestamp } : {}),
      ...(remaining === undefined ? {} : { remaining }),
    });
  } catch {
    console.error("[writing-grade]", { event: "persistence-failure" });
    const remaining = await releaseFailedGradeReservation(
      reservation.reservationId,
      user.id,
    );
    return errorResponse(
      "Chưa thể lưu kết quả chấm. Bản nháp của bạn vẫn được giữ để thử lại.",
      500,
      remaining,
    );
  }
}
