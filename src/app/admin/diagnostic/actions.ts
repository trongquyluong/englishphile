"use server";

import type { Difficulty } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { difficultyOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ADMIN_RESOURCE_UNAVAILABLE, lockProblemsForAdminMutation, parseBoundedUniqueIds } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";

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
  const user = await requireAdmin();

  const parsedIds = parseBoundedUniqueIds(getSelectedProblemIds(formData));
  const intent = String(formData.get("intent") ?? "mark");
  const diagnosticWeight = Math.max(1, Math.min(5, Number(formData.get("diagnosticWeight") ?? 1) || 1));
  const recommendedMinLevel = getDifficulty(formData.get("recommendedMinLevel"));
  const recommendedMaxLevel = getDifficulty(formData.get("recommendedMaxLevel"));

  if (!parsedIds.ok) return redirectWithMessage(parsedIds.message);
  const problemIds = parsedIds.ids;

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

  const updated = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, user.id);
    const locked = await lockProblemsForAdminMutation(tx, problemIds);
    if (locked.length !== problemIds.length) return false;
    const published = await tx.problem.count({ where: { id: { in: problemIds }, contentStatus: "PUBLISHED" } });
    if (published !== problemIds.length) return false;
    const result = await tx.problem.updateMany({ where: { id: { in: problemIds }, contentStatus: "PUBLISHED" }, data });
    return result.count === problemIds.length;
  });
  if (!updated) redirectWithMessage(ADMIN_RESOURCE_UNAVAILABLE);

  revalidatePath("/admin/diagnostic");
  redirectWithMessage(intent === "remove" ? "Đã gỡ diagnostic eligibility." : "Đã đánh dấu diagnostic-eligible.");
}
