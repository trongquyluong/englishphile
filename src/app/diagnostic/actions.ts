"use server";

import { redirect } from "next/navigation";
import { createDiagnosticAttempt, getLatestDiagnosticAttempt, scoreDiagnosticAttempt } from "@/lib/diagnostic";
import { requireUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function startDiagnosticAction() {
  const user = await requireUser();
  const limit = checkRateLimit({ key: `diagnostic-start:${user.id}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) redirect(`/diagnostic?error=${encodeURIComponent(`Bạn tạo diagnostic quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`)}`);

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
  const limit = checkRateLimit({ key: `diagnostic-submit:${user.id}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) redirect(`/diagnostic/start?attempt=${attemptId}&error=${encodeURIComponent(`Bạn nộp diagnostic quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.`)}`);

  const answers: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer:")) continue;
    const [, questionId, field] = key.split(":");
    if (!questionId) continue;
    if (field) {
      const current = answers[questionId];
      const objectAnswer = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : {};
      objectAnswer[field] = String(value);
      answers[questionId] = objectAnswer;
    } else {
      answers[questionId] = String(value);
    }
  }

  await scoreDiagnosticAttempt(attemptId, user.id, answers);
  redirect(`/diagnostic/result?attempt=${attemptId}`);
}
