"use server";

import { redirect } from "next/navigation";
import {
  createDiagnosticAttempt,
  DIAGNOSTIC_UNAVAILABLE_MESSAGE,
  getLatestDiagnosticAttempt,
  scoreDiagnosticAttempt,
} from "@/lib/diagnostic";
import { requireUser } from "@/lib/auth/session";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseDiagnosticAnswerEntries } from "@/lib/security/submission-input";

export async function startDiagnosticAction() {
  const user = await requireUser();
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.DIAGNOSTIC_START(user.id));
  if (limit.status !== "allowed") {
    const message = limit.status === "infrastructure-error"
      ? "Không thể bắt đầu diagnostic lúc này. Vui lòng thử lại sau."
      : `Bạn tạo diagnostic quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`;
    redirect(`/diagnostic?error=${encodeURIComponent(message)}`);
  }

  // Resume existing IN_PROGRESS attempt if one exists
  const existing = await getLatestDiagnosticAttempt(user.id, "IN_PROGRESS");
  if (existing) redirect(`/diagnostic/start?attempt=${existing.id}`);

  const attempt = await createDiagnosticAttempt(user.id);
  redirect(`/diagnostic/start?attempt=${attempt.id}`);
}

export async function submitDiagnosticAction(formData: FormData) {
  const user = await requireUser();
  const attemptId = String(formData.get("attemptId") ?? "");
  if (!attemptId) redirect("/diagnostic");
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.DIAGNOSTIC_SUBMIT(user.id));
  if (limit.status !== "allowed") {
    const message = limit.status === "infrastructure-error"
      ? "Không thể nộp diagnostic lúc này. Vui lòng thử lại sau."
      : `Bạn nộp diagnostic quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`;
    redirect(`/diagnostic?error=${encodeURIComponent(message)}`);
  }

  const answers = parseDiagnosticAnswerEntries(formData.entries());

  try {
    await scoreDiagnosticAttempt(attemptId, user.id, answers);
  } catch {
    redirect(`/diagnostic?error=${encodeURIComponent(DIAGNOSTIC_UNAVAILABLE_MESSAGE)}`);
  }
  redirect(`/diagnostic/result?attempt=${attemptId}`);
}
