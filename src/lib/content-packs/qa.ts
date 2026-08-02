import type { Prisma, Problem, Question } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateErrorIdentificationContract } from "@/lib/questions/error-identification-contract";
import { validateTriosContract } from "@/lib/questions/trios-contract";
import { validatePronunciationContract } from "@/lib/questions/pronunciation-contract";
import {
  validateListeningMCQContract,
  validateListeningShortAnswerContract,
} from "@/lib/questions/listening-contract";
import {
  ANSWER_POSITIONS,
  isShortNonBlankExplanation,
  ownDataValue,
  reviewAnswerPositionDistribution,
  SHORT_EXPLANATION_THRESHOLD,
} from "@/lib/content-quality-heuristics";

export type QaSeverity = "ERROR" | "WARNING" | "INFO";

export type QaIssue = {
  severity: QaSeverity;
  code?: "DUPLICATE_EXACT" | "DUPLICATE_HIGH_SIMILARITY" | "DUPLICATE_POSSIBLE" | string;
  entityType: "Problem" | "Question";
  entityId: string;
  problemId: string;
  problemTitle: string;
  path: string;
  message: string;
};

export type QaProblemResult = {
  problemId: string;
  title: string;
  slug: string;
  contentStatus: string;
  errors: number;
  warnings: number;
  infos: number;
  canPublish: boolean;
  issues: QaIssue[];
};

export type QaReport = {
  generatedAt: string;
  summary: {
    problemsChecked: number;
    publishableProblems: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  problems: QaProblemResult[];
  issues: QaIssue[];
};

type ProblemForQa = Problem & {
  sourceCollection: { id: string; name: string } | null;
  problemTopics: Array<{ topic: { id: string; name: string; slug: string } }>;
  questions: Question[];
};

const autoMarkable = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "ERROR_IDENTIFICATION",
  "READING_MCQ",
  "LISTENING_MCQ",
  "LISTENING_SHORT_ANSWER",
  "TRIOS_GAPPED_SENTENCES",
  "SHORT_ANSWER",
]);

const mcqLike = new Set(["PRONUNCIATION_ODD_ONE_OUT", "MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ"]);

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasAcceptedAnswer(answer: unknown) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
  const accepted = ownDataValue(answer, "accepted");
  const acceptedAnswers = ownDataValue(answer, "acceptedAnswers");
  return (
    (Array.isArray(accepted) && accepted.length > 0) ||
    (Array.isArray(acceptedAnswers) && acceptedAnswers.length > 0) ||
    typeof ownDataValue(answer, "correctForm") === "string" ||
    typeof ownDataValue(answer, "modelAnswer") === "string" ||
    typeof ownDataValue(answer, "correctOptionId") === "string" ||
    typeof ownDataValue(answer, "correctPart") === "string"
  );
}

function optionsValid(options: unknown) {
  if (!Array.isArray(options)) return false;
  if (options.length < 2) return false;

  for (let index = 0; index < options.length; index += 1) {
    const option = ownDataValue(options, index);
    if (!option || typeof option !== "object" || Array.isArray(option)) return false;

    const id = ownDataValue(option, "id");
    const text = ownDataValue(option, "text");
    if (
      typeof id !== "string" ||
      typeof text !== "string" ||
      text.trim().length === 0
    ) {
      return false;
    }
  }

  return true;
}

function pushIssue(issues: QaIssue[], problem: ProblemForQa, issue: Omit<QaIssue, "problemId" | "problemTitle">) {
  issues.push({
    ...issue,
    problemId: problem.id,
    problemTitle: problem.title,
  });
}

function checkQuestion(problem: ProblemForQa, question: Question, issues: QaIssue[]) {
  const path = `questions.${question.orderIndex}`;

  if (!question.prompt.trim() && !question.passage?.trim()) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.prompt`,
      message: "Thiếu prompt hoặc passage cho câu hỏi.",
    });
  }

  if (autoMarkable.has(question.type) && !hasAcceptedAnswer(question.answer)) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.answer`,
      message: "Thiếu answer JSON cho câu hỏi có thể chấm tự động.",
    });
  }

  if (mcqLike.has(question.type) && !optionsValid(question.options)) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.options`,
      message: "MCQ-like question cần options hợp lệ.",
    });
  }

  if (question.type === "ERROR_IDENTIFICATION") {
    const contract = validateErrorIdentificationContract(
      question.options,
      question.answer,
    );
    contract.issues.forEach((contractIssue) => {
      pushIssue(issues, problem, {
        severity: "ERROR",
        code: `ERROR_IDENTIFICATION_${contractIssue.code}`,
        entityType: "Question",
        entityId: question.id,
        path: `${path}.${contractIssue.path}`,
        message: contractIssue.message,
      });
    });
  }

  if (question.type === "PRONUNCIATION_ODD_ONE_OUT") {
    const contract = validatePronunciationContract(
      question.options,
      question.answer,
    );
    contract.issues.forEach((contractIssue) => {
      pushIssue(issues, problem, {
        severity: "ERROR",
        code: `PRONUNCIATION_${contractIssue.code}`,
        entityType: "Question",
        entityId: question.id,
        path: `${path}.${contractIssue.path}`,
        message: contractIssue.message,
      });
    });
  }

  if (!question.explanation?.trim()) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.explanation`,
      message: "Thiếu explanation; học sinh sẽ khó tự review.",
    });
  }

  if (isShortNonBlankExplanation(question.explanation)) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      code: "EXPLANATION_TOO_SHORT",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.explanation`,
      message: `Phần giải thích ngắn hơn ${SHORT_EXPLANATION_THRESHOLD} ký tự; cần người biên soạn rà soát độ đầy đủ.`,
    });
  }

  if (question.type === "WORD_FORMATION" && !question.rootWord?.trim()) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.rootWord`,
      message: "Word Formation nên có rootWord.",
    });
  }

  if (question.type === "SENTENCE_TRANSFORMATION" && !hasAcceptedAnswer(question.answer) && !question.targetSentence?.trim()) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.answer`,
      message: "Sentence Transformation thiếu model answer.",
    });
  }

  if (question.type === "WRITING_PROMPT") {
    const metadata = asObject(question.metadata);
    const rubric = metadata.rubric;
    if (!Array.isArray(rubric) || rubric.length === 0) {
      pushIssue(issues, problem, {
        severity: "WARNING",
        entityType: "Question",
        entityId: question.id,
        path: `${path}.metadata.rubric`,
        message: "Writing Prompt nên có rubric metadata.",
      });
    }
  }

  if (question.type === "TRIOS_GAPPED_SENTENCES") {
    const contract = validateTriosContract(question.metadata, question.answer);
    contract.issues.forEach((contractIssue) => {
      pushIssue(issues, problem, {
        severity: "ERROR",
        code: `TRIOS_${contractIssue.code}`,
        entityType: "Question",
        entityId: question.id,
        path: `${path}.${contractIssue.path}`,
        message: contractIssue.message,
      });
    });
  }

  if (question.type === "LISTENING_MCQ") {
    const contract = validateListeningMCQContract(
      question.options,
      question.answer,
      question.metadata,
      question.prompt
    );
    contract.issues.forEach((contractIssue) => {
      pushIssue(issues, problem, {
        severity: "ERROR",
        code: contractIssue.code,
        entityType: "Question",
        entityId: question.id,
        path: `${path}.${contractIssue.path}`,
        message: contractIssue.message,
      });
    });
  }

  if (question.type === "LISTENING_SHORT_ANSWER") {
    const contract = validateListeningShortAnswerContract(
      question.answer,
      question.metadata,
      question.prompt
    );
    contract.issues.forEach((contractIssue) => {
      pushIssue(issues, problem, {
        severity: "ERROR",
        code: contractIssue.code,
        entityType: "Question",
        entityId: question.id,
        path: `${path}.${contractIssue.path}`,
        message: contractIssue.message,
      });
    });
  }

  const metadata = asObject(question.metadata);
  const duplicateRisk = asObject(metadata.duplicateRisk);
  if (duplicateRisk.level === "POSSIBLE") {
    pushIssue(issues, problem, {
      severity: "ERROR",
      code: "DUPLICATE_POSSIBLE",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.metadata.duplicateRisk`,
      message: "Câu hỏi có rủi ro trùng lặp và cần quản trị viên review trước khi publish.",
    });
  }
}

function checkProblem(problem: ProblemForQa): QaIssue[] {
  const issues: QaIssue[] = [];

  if (!problem.statement.trim()) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Problem",
      entityId: problem.id,
      path: "statement",
      message: "Thiếu statement.",
    });
  }

  if (!problem.instructions?.trim()) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Problem",
      entityId: problem.id,
      path: "instructions",
      message: "Thiếu instructions.",
    });
  }

  if (problem.questions.length === 0) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Problem",
      entityId: problem.id,
      path: "questions",
      message: "Problem chưa có câu hỏi.",
    });
  }

  if (problem.problemTopics.length === 0) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Problem",
      entityId: problem.id,
      path: "topics",
      message: "Problem chưa có topic.",
    });
  }

  if (!problem.sourceCollection) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Problem",
      entityId: problem.id,
      path: "sourceCollection",
      message: "Problem chưa gắn source collection.",
    });
  }

  if (!problem.estimatedMinutes) {
    pushIssue(issues, problem, {
      severity: "INFO",
      entityType: "Problem",
      entityId: problem.id,
      path: "estimatedMinutes",
      message: "Nên bổ sung estimatedMinutes.",
    });
  }

  if (problem.contentStatus === "NEEDS_REVIEW") {
    pushIssue(issues, problem, {
      severity: "INFO",
      entityType: "Problem",
      entityId: problem.id,
      path: "contentStatus",
      message: "Nội dung đang ở trạng thái Cần duyệt.",
    });
  }

  if (problem.questionType === "READING_MCQ" && !problem.questions.some((question) => question.passage?.trim())) {
    pushIssue(issues, problem, {
      severity: "ERROR",
      entityType: "Problem",
      entityId: problem.id,
      path: "questions.passage",
      message: "Reading problem thiếu passage.",
    });
  }

  problem.questions.forEach((question) => checkQuestion(problem, question, issues));

  const structurallyInvalidQuestionIds = new Set(
    issues
      .filter(
        (issue) =>
          issue.severity === "ERROR" && issue.entityType === "Question",
      )
      .map((issue) => issue.entityId),
  );
  const distribution = reviewAnswerPositionDistribution(
    problem.questions.filter(
      (question) => !structurallyInvalidQuestionIds.has(question.id),
    ),
  );
  if (distribution.isSkewed) {
    const counts = ANSWER_POSITIONS.map(
      (position) => `${position}=${distribution.counts[position]}`,
    ).join(", ");
    pushIssue(issues, problem, {
      severity: "WARNING",
      code: "ANSWER_POSITION_SKEW",
      entityType: "Problem",
      entityId: problem.id,
      path: "questions.answerPositionDistribution",
      message: `Tín hiệu rà soát phân bố vị trí đáp án: ${counts}.`,
    });
  }
  return issues;
}

export async function getContentQaReport(
  options: { contentPackId?: string; problemIds?: string[] } = {},
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<QaReport> {
  const where = options.contentPackId
    ? { contentPackId: options.contentPackId }
    : options.problemIds?.length
      ? { id: { in: options.problemIds } }
      : {};
  const problems = await db.problem.findMany({
    where,
    include: {
      sourceCollection: true,
      problemTopics: { include: { topic: true } },
      questions: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const slugCounts = problems.reduce<Record<string, number>>((current, problem) => {
    current[problem.slug] = (current[problem.slug] ?? 0) + 1;
    return current;
  }, {});

  const results = problems.map((problem) => {
    const issues = checkProblem(problem);
    if (slugCounts[problem.slug] > 1) {
      pushIssue(issues, problem, {
        severity: "ERROR",
        entityType: "Problem",
        entityId: problem.id,
        path: "slug",
        message: "Slug bị trùng trong phạm vi QA.",
      });
    }
    const errors = issues.filter((issue) => issue.severity === "ERROR").length;
    const warnings = issues.filter((issue) => issue.severity === "WARNING").length;
    const infos = issues.filter((issue) => issue.severity === "INFO").length;
    return {
      problemId: problem.id,
      title: problem.title,
      slug: problem.slug,
      contentStatus: problem.contentStatus,
      errors,
      warnings,
      infos,
      canPublish: errors === 0,
      issues,
    };
  });

  const issues = results.flatMap((result) => result.issues);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      problemsChecked: results.length,
      publishableProblems: results.filter((result) => result.canPublish).length,
      errors: issues.filter((issue) => issue.severity === "ERROR").length,
      warnings: issues.filter((issue) => issue.severity === "WARNING").length,
      infos: issues.filter((issue) => issue.severity === "INFO").length,
    },
    problems: results,
    issues,
  };
}

export async function getPublishableProblemIds(
  problemIds: string[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const report = await getContentQaReport({ problemIds }, db);
  return report.problems.filter((problem) => problem.canPublish).map((problem) => problem.problemId);
}
