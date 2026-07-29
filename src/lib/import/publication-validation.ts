import type { ContentStatus } from "@prisma/client";
import type { ImportIssue, ImportPlan } from "@/lib/import/types";
import { validateErrorIdentificationContract } from "@/lib/questions/error-identification-contract";

function publicationIssues(plan: ImportPlan): ImportIssue[] {
  return plan.payload.problems.flatMap((problem) =>
    problem.questions.flatMap((question) => {
      if (question.type !== "ERROR_IDENTIFICATION") return [];
      const contract = validateErrorIdentificationContract(
        question.options,
        question.answer,
      );
      return contract.issues.map((contractIssue) => ({
        level: "error" as const,
        path: `problems.${problem.slug}.questions.${question.orderIndex}.${contractIssue.path}`,
        message: contractIssue.message,
        code: `ERROR_IDENTIFICATION_${contractIssue.code}`,
      }));
    }),
  );
}

/**
 * Immediate import-publish is a publication boundary. Replace the import-only
 * Error Identification warnings with publication errors and recompute the plan
 * status before the atomic executor can write published rows.
 */
export function enforceImportPublicationContract(
  plan: ImportPlan,
  contentStatus: ContentStatus,
): ImportPlan {
  if (contentStatus !== "PUBLISHED") return plan;

  const retainedIssues = plan.issues.filter(
    (candidate) =>
      candidate.level === "error" ||
      !candidate.code?.startsWith("ERROR_IDENTIFICATION_"),
  );
  const issues = [...retainedIssues, ...publicationIssues(plan)];
  const errors = issues.filter((candidate) => candidate.level === "error").length;
  const warnings = issues.filter((candidate) => candidate.level === "warning").length;

  return {
    ...plan,
    ok: errors === 0,
    issues,
    summary: {
      ...plan.summary,
      errors,
      warnings,
    },
  };
}
