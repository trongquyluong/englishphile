import type { ContentStatus } from "@prisma/client";
import type { ImportIssue, ImportPlan } from "@/lib/import/types";
import { validateErrorIdentificationContract } from "@/lib/questions/error-identification-contract";
import { validateTriosContract } from "@/lib/questions/trios-contract";
import { validatePronunciationContract } from "@/lib/questions/pronunciation-contract";
import {
  validateListeningMCQContract,
  validateListeningShortAnswerContract,
} from "@/lib/questions/listening-contract";

function publicationIssues(plan: ImportPlan): ImportIssue[] {
  return plan.payload.problems.flatMap((problem) =>
    problem.questions.flatMap((question) => {
      let issues: { code: string; message: string; path: string }[] = [];
      if (question.type === "PRONUNCIATION_ODD_ONE_OUT") {
        issues = validatePronunciationContract(question.options, question.answer).issues.map(i => ({ code: `PRONUNCIATION_${i.code}`, message: i.message, path: i.path }));
      } else if (question.type === "ERROR_IDENTIFICATION") {
        issues = validateErrorIdentificationContract(question.options, question.answer).issues.map(i => ({ code: `ERROR_IDENTIFICATION_${i.code}`, message: i.message, path: i.path }));
      } else if (question.type === "TRIOS_GAPPED_SENTENCES") {
        issues = validateTriosContract(question.metadata, question.answer).issues.map(i => ({ code: `TRIOS_${i.code}`, message: i.message, path: i.path }));
      } else if (question.type === "LISTENING_MCQ") {
        issues = validateListeningMCQContract(question.options, question.answer, question.metadata, question.prompt).issues;
      } else if (question.type === "LISTENING_SHORT_ANSWER") {
        issues = validateListeningShortAnswerContract(question.answer, question.metadata, question.prompt).issues;
      }

      if (issues.length === 0) return [];
      return issues.map((contractIssue) => ({
        level: "error" as const,
        path: `problems.${problem.slug}.questions.${question.orderIndex}.${contractIssue.path}`,
        message: contractIssue.message,
        code: contractIssue.code,
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

  const retainedIssues = plan.issues
    .filter(
      (candidate) =>
        candidate.level === "error" ||
        !(
          candidate.code?.startsWith("ERROR_IDENTIFICATION_") ||
          candidate.code?.startsWith("TRIOS_") ||
          candidate.code?.startsWith("PRONUNCIATION_") ||
          candidate.code?.startsWith("LISTENING_")
        ) ||
        candidate.code === "LISTENING_LEGACY_AUDIO_URL" ||
        candidate.code === "LISTENING_LEGACY_SECTION_TYPE"
    )
    .map((candidate) => {
      if (candidate.code === "LISTENING_LEGACY_AUDIO_URL" || candidate.code === "LISTENING_LEGACY_SECTION_TYPE") {
        return { ...candidate, level: "error" as const };
      }
      return candidate;
    });
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
