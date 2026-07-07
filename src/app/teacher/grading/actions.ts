"use server";

import type { ManualGradeCorrectness } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/classroom/permissions";
import { getSubmissionAnswerForGrading, saveManualGrade } from "@/lib/grading/manual-grading";
import { manualGradeCorrectnessLabels } from "@/lib/labels";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCorrectness(value: string): ManualGradeCorrectness {
  return value in manualGradeCorrectnessLabels ? (value as ManualGradeCorrectness) : "NEEDS_REVISION";
}

export async function saveManualGradeAction(formData: FormData) {
  const user = await requireTeacher();
  const submissionAnswerId = text(formData, "submissionAnswerId");
  const answer = await getSubmissionAnswerForGrading(submissionAnswerId, user);
  if (!answer) redirect(`/teacher/grading?error=${encodeURIComponent("Bạn không có quyền chấm câu trả lời này.")}`);

  const correctness = parseCorrectness(text(formData, "correctness"));
  const feedback = text(formData, "feedback");
  const rubricJson =
    answer.question.type === "WRITING_PROMPT"
      ? {
          taskResponse: text(formData, "taskResponse"),
          coherence: text(formData, "coherence"),
          lexicalResource: text(formData, "lexicalResource"),
          grammarRangeAccuracy: text(formData, "grammarRangeAccuracy"),
          sophistication: text(formData, "sophistication"),
        }
      : {
          grammarNote: text(formData, "grammarNote"),
        };

  await saveManualGrade({
    submissionAnswerId,
    gradedById: user.id,
    correctness,
    score: numberOrNull(formData, "score"),
    maxScore: numberOrNull(formData, "maxScore"),
    feedback,
    rubricJson,
  });

  revalidatePath("/teacher/grading");
  revalidatePath(`/teacher/grading/${submissionAnswerId}`);
  const assignment = answer.submission.assignmentProblemSubmissions[0]?.assignmentSubmission.assignment;
  if (assignment) {
    revalidatePath(`/teacher/assignments/${assignment.id}`);
    revalidatePath(`/teacher/assignments/${assignment.id}/analytics`);
  }
  redirect(`/teacher/grading?message=${encodeURIComponent("Đã lưu điểm và cập nhật kết quả.")}`);
}
