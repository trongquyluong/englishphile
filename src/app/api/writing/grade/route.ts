import { NextResponse } from "next/server";
import { z } from "zod";
import { gradeEssay, isWritingGraderEnabled, WritingGraderError } from "@/lib/ai/writing-grader";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  countWords,
  essayTypeValues,
  targetWordCountValues,
  WRITING_GRADER_MAX_ESSAY_CHARS,
  WRITING_GRADER_MAX_PROMPT_CHARS,
  WRITING_GRADER_MAX_WORDS,
  WRITING_GRADER_MIN_WORDS,
} from "@/lib/writing-grader-shared";

// Grading calls the AI provider and can take longer than the default limit.
export const maxDuration = 60;

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(WRITING_GRADER_MAX_PROMPT_CHARS),
  essayType: z.enum(essayTypeValues),
  targetWordCount: z.enum(targetWordCountValues),
  essayText: z.string().trim().min(1).max(WRITING_GRADER_MAX_ESSAY_CHARS),
  consent: z.literal(true),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validationMessage(error: z.ZodError): string {
  const fields = new Set(error.issues.map((issue) => String(issue.path[0] ?? "")));
  if (fields.has("consent")) {
    return "Bạn cần xác nhận đồng ý gửi bài tới AI trước khi chấm.";
  }
  if (fields.has("prompt")) {
    return "Vui lòng nhập đề bài (tối đa 1500 ký tự).";
  }
  if (fields.has("essayText")) {
    return "Vui lòng dán bài viết của bạn vào ô bài làm.";
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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Bạn cần đăng nhập để dùng tính năng chấm bài AI.", 401);
  }

  if (!isWritingGraderEnabled()) {
    return errorResponse("Tính năng chấm bài AI chưa được bật trên server.", 503);
  }

  const userLimit = checkRateLimit({ key: `writing-grade:${user.id}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!userLimit.ok) {
    const minutes = Math.max(1, Math.ceil(userLimit.retryAfterSeconds / 60));
    return errorResponse(`Bạn đã gửi khá nhiều bài trong thời gian ngắn. Thử lại sau khoảng ${minutes} phút nhé.`, 429);
  }

  const globalLimit = checkRateLimit({ key: "writing-grade:global", limit: 60, windowMs: 10 * 60 * 1000 });
  if (!globalLimit.ok) {
    return errorResponse("Hệ thống chấm bài đang bận. Vui lòng thử lại sau ít phút.", 429);
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

  const wordCount = countWords(parsed.data.essayText);
  if (wordCount < WRITING_GRADER_MIN_WORDS) {
    return errorResponse(
      `Bài viết hiện có ${wordCount} từ — quá ngắn để chấm chính xác. Hãy viết ít nhất ${WRITING_GRADER_MIN_WORDS} từ.`,
      400,
    );
  }
  if (wordCount > WRITING_GRADER_MAX_WORDS) {
    return errorResponse(
      `Bài viết hiện có ${wordCount} từ — vượt giới hạn ${WRITING_GRADER_MAX_WORDS} từ của bản beta. Hãy rút gọn bớt.`,
      400,
    );
  }

  try {
    const result = await gradeEssay({
      prompt: parsed.data.prompt,
      essayType: parsed.data.essayType,
      targetWordCount: parsed.data.targetWordCount,
      essayText: parsed.data.essayText,
    });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof WritingGraderError) {
      const mapped = graderErrorResponses[error.code];
      return errorResponse(mapped.message, mapped.status);
    }
    console.error("[writing-grade] unexpected error", error instanceof Error ? error.name : "unknown");
    return errorResponse("Có lỗi xảy ra khi chấm bài. Vui lòng thử lại.", 500);
  }
}
