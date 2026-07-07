import type { Prisma, QuestionType } from "@prisma/client";

type DiagnosticQuestionData = {
  type: QuestionType;
  rootWord: string | null;
};

export const diagnosticQuestionDataWhere: Prisma.QuestionWhereInput = {
  OR: [
    { type: { not: "WORD_FORMATION" } },
    {
      AND: [
        { type: "WORD_FORMATION" },
        { rootWord: { not: null } },
        { rootWord: { not: "" } },
      ],
    },
  ],
};

export function hasRequiredDiagnosticQuestionData(question: DiagnosticQuestionData) {
  if (question.type !== "WORD_FORMATION") return true;
  return Boolean(question.rootWord?.trim());
}
