import type { ContentStatus } from "@prisma/client";
import type { ImportIssue, ImportPlan } from "@/lib/import/types";
import { validateErrorIdentificationContract } from "@/lib/questions/error-identification-contract";
import { validateTriosContract } from "@/lib/questions/trios-contract";
import { validatePronunciationContract } from "@/lib/questions/pronunciation-contract";

function publicationIssues(plan: ImportPlan): ImportIssue[] {
  return plan.payload.problems.flatMap((problem) =>
    problem.questions.flatMap((question) => {
      const contract =
        question.type === "PRONUNCIATION_ODD_ONE_OUT"
          ? {
              prefix: "PRONUNCIATION",
              issues: validatePronunciationContract(
                question.options,
                question.answer,
              ).issues,
            }
          : question.type === "ERROR_IDENTIFICATION"
          ? {
              prefix: "ERROR_IDENTIFICATION",
              issues: validateErrorIdentificationContract(
                question.options,
                question.answer,
              ).issues,
            }
          : question.type === "TRIOS_GAPPED_SENTENCES"
            ? {
                prefix: "TRIOS",
                issues: validateTriosContract(
                  question.metadata,
                  question.answer,
                ).issues,
              }
            : null;
      if (!contract) return [];
      return contract.issues.map((contractIssue) => ({
        level: "error" as const,
        path: `problems.${problem.slug}.questions.${question.orderIndex}.${contractIssue.path}`,
        message: contractIssue.message,
        code: `${contract.prefix}_${contractIssue.code}`,
      }));
    }),
  );
}

/**
 * Immediate import-publish is a publication boundary. Replace the import-only
 * contract warnings with publication errors and recompute the plan status
 * before the atomic executor can write published rows.
 */
export function enforceImportPublicationContract(
  plan: ImportPlan,
  contentStatus: ContentStatus,
): ImportPlan {
  if (contentStatus !== "PUBLISHED") return plan;

  const retainedIssues = plan.issues.filter(
    (candidate) =>
      candidate.level === "error" ||
      !(
        candidate.code?.startsWith("ERROR_IDENTIFICATION_") ||
        candidate.code?.startsWith("TRIOS_") ||
        candidate.code?.startsWith("PRONUNCIATION_")
      ),
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
