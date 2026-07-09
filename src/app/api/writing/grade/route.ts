import { NextResponse } from "next/server";
import { z } from "zod";
import { gradeEssay, isWritingGraderEnabled, WritingGraderError } from "@/lib/ai/writing-grader";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  countWords,
  targetWordCountValues,
  WRITING_GRADER_MAX_ESSAY_CHARS,
  WRITING_GRADER_MAX_WORDS,
  WRITING_GRADER_MIN_WORDS,
} from "@/lib/writing-grader-shared";
import { getWritingPromptBySlug, mapEssayTypeToGraderValue } from "@/lib/writing-prompts";
import { WRITING_DAILY_LIMIT } from "@/lib/writing-submissions";

// Grading calls the AI provider and can take longer than the default limit.
export const maxDuration = 60;

const requestSchema = z.object({
  promptSlug: z.string().min(1),
  targetWordCount: z.enum(targetWordCountValues),
  essayText: z.string().trim().min(1).max(WRITING_GRADER_MAX_ESSAY_CHARS),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
  NOT_CONFIGURED: { message: "Tính năng chấm bài AI chưa được bật trên server.", status: 503 },
  PROVIDER_RATE_LIMITED: {
    message: "Hệ thống AI đang quá tải. Vui lòng đợi vài phút rồi thử lại.",
    status: 429,
  },
  CONTENT_BLOCKED: {
    message: "AI từ chối xử lý bài viết này. Hãy kiểm tra lại nội dung bài và thử lại.",
    status: 422,
  },
  INVALID_RESPONSE: {
    message: "AI trả về kết quả không đọc được. Vui lòng thử lại.",
    status: 502,
  },
  NETWORK_ERROR: {
    message: "Không kết nối được tới dịch vụ AI. Vui lòng thử lại sau.",
    status: 504,
  },
  PROVIDER_ERROR: {
    message: "Dịch vụ AI đang gặp sự cố. Vui lòng thử lại sau.",
    status: 502,
  },
};

async function checkDailyLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  // Get start of today in UTC
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const count = await prisma.writingSubmission.count({
    where: {
      userId,
      createdAt: { gte: startOfToday },
    },
  });

  const remaining = Math.max(0, WRITING_DAILY_LIMIT - count);
  return { allowed: count < WRITING_DAILY_LIMIT, remaining };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Bạn cần đăng nhập để nộp bài Writing.", 401);
  }

  if (!isWritingGraderEnabled()) {
    return errorResponse("Tính năng chấm bài AI chưa được bật trên server.", 503);
  }

  // Check per-user rate limit (short-term burst protection)
  const userLimit = checkRateLimit({ key: `writing-grade:${user.id}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!userLimit.ok) {
    const minutes = Math.max(1, Math.ceil(userLimit.retryAfterSeconds / 60));
    return errorResponse(`Bạn đã gửi khá nhiều bài trong thời gian ngắn. Thử lại sau khoảng ${minutes} phút nhé.`, 429);
  }

  // Check global rate limit
  const globalLimit = checkRateLimit({ key: "writing-grade:global", limit: 60, windowMs: 10 * 60 * 1000 });
  if (!globalLimit.ok) {
    return errorResponse("Hệ thống chấm bài đang bận. Vui lòng thử lại sau ít phút.", 429);
  }

  // Check daily submission limit
  const dailyLimit = await checkDailyLimit(user.id);
  if (!dailyLimit.allowed) {
    return errorResponse("Bạn đã dùng hết 5 lượt chấm Writing hôm nay. Hãy quay lại vào ngày mai.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(validationMessage(parsed.error), 400);
  }

  // Look up prompt from static bank — do not trust client-supplied promptText or essayType
  const prompt = getWritingPromptBySlug(parsed.data.promptSlug);
  if (!prompt) {
    return errorResponse("Đề bài không hợp lệ. Vui lòng chọn đề từ Gym Writing.", 400);
  }

  const wordCount = countWords(parsed.data.essayText);
  if (wordCount < WRITING_GRADER_MIN_WORDS) {
    return errorResponse(
      `Bài viết hiện có ${wordCount} từ — quá ngắn để chấm chính xác. Hãy viết ít nhất ${WRITING_GRADER_MIN_WORDS} từ.`,
      400,
    );
  }
  if (wordCount > WRITING_GRADER_MAX_WORDS) {
    return errorResponse(
      `Bài viết hiện có ${wordCount} từ — vượt giới hạn ${WRITING_GRADER_MAX_WORDS} từ cho mỗi lần chấm. Hãy rút gọn bớt.`,
      400,
    );
  }

  try {
    const essayType = mapEssayTypeToGraderValue(prompt.essayType);

    const result = await gradeEssay({
      prompt: prompt.statement,
      essayType: essayType as "opinion" | "discussion" | "advantage-disadvantage" | "outweigh" | "cause-effect-solution" | "double-question" | "other",
      targetWordCount: parsed.data.targetWordCount,
      essayText: parsed.data.essayText,
    });

    // Save submission to database
    await prisma.writingSubmission.create({
      data: {
        userId: user.id,
        promptSlug: prompt.slug,
        promptText: prompt.statement,
        essayType: prompt.essayType,
        targetWordCount: parsed.data.targetWordCount,
        essayText: parsed.data.essayText,
        resultJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ result, remaining: dailyLimit.remaining - 1 });
  } catch (error) {
    if (error instanceof WritingGraderError) {
      const mapped = graderErrorResponses[error.code];
      return errorResponse(mapped.message, mapped.status);
    }
    console.error("[writing-grade] unexpected error", error instanceof Error ? error.name : "unknown");
    return errorResponse("Có lỗi xảy ra khi chấm bài. Vui lòng thử lại.", 500);
  }
}
