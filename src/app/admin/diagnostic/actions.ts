"use server";

import type { Difficulty } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { difficultyOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

function redirectWithMessage(message: string) {
  redirect(`/admin/diagnostic?message=${encodeURIComponent(message)}`);
}

function getSelectedProblemIds(formData: FormData) {
  return formData.getAll("problemId").map(String).filter(Boolean);
}

function getDifficulty(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return difficultyOrder.includes(text as Difficulty) ? (text as Difficulty) : null;
}

export async function updateDiagnosticEligibilityAction(formData: FormData) {
  await requireAdmin();

  const problemIds = getSelectedProblemIds(formData);
  const intent = String(formData.get("intent") ?? "mark");
  const diagnosticWeight = Math.max(1, Math.min(5, Number(formData.get("diagnosticWeight") ?? 1) || 1));
  const recommendedMinLevel = getDifficulty(formData.get("recommendedMinLevel"));
  const recommendedMaxLevel = getDifficulty(formData.get("recommendedMaxLevel"));

  if (!problemIds.length) {
    redirectWithMessage("Hãy chọn ít nhất một problem.");
  }

  const data =
    intent === "remove"
      ? {
          isDiagnosticEligible: false,
          diagnosticWeight: 1,
          recommendedMinLevel: null,
          recommendedMaxLevel: null,
        }
      : {
          isDiagnosticEligible: true,
          diagnosticWeight,
          recommendedMinLevel,
          recommendedMaxLevel,
        };

  await prisma.problem.updateMany({
    where: { id: { in: problemIds }, contentStatus: "PUBLISHED" },
    data,
  });

  revalidatePath("/admin/diagnostic");
  redirectWithMessage(intent === "remove" ? "Đã gỡ diagnostic eligibility." : "Đã đánh dấu diagnostic-eligible.");
}
