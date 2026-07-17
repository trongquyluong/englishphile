import type { Prisma, Problem, Question } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  const object = asObject(answer);
  return (
    (Array.isArray(object.accepted) && object.accepted.length > 0) ||
    (Array.isArray(object.acceptedAnswers) && object.acceptedAnswers.length > 0) ||
    typeof object.correctForm === "string" ||
    typeof object.modelAnswer === "string" ||
    typeof object.correctOptionId === "string" ||
    typeof object.correctPart === "string"
  );
}

function optionsValid(options: unknown) {
  if (!Array.isArray(options)) return false;
  return options.length >= 2 && options.every((option) => {
    const item = asObject(option);
    return typeof item.id === "string" && typeof item.text === "string";
  });
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

  if (!question.explanation?.trim()) {
    pushIssue(issues, problem, {
      severity: "WARNING",
      entityType: "Question",
      entityId: question.id,
      path: `${path}.explanation`,
      message: "Thiếu explanation; học sinh sẽ khó tự review.",
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
    const metadata = asObject(question.metadata);
    const sentences = metadata.sentences;
    if (Array.isArray(sentences) && sentences.length !== 3) {
      pushIssue(issues, problem, {
        severity: "WARNING",
        entityType: "Question",
        entityId: question.id,
        path: `${path}.metadata.sentences`,
        message: "Trios nên có đúng ba câu.",
      });
    }
    if (!hasAcceptedAnswer(question.answer)) {
      pushIssue(issues, problem, {
        severity: "ERROR",
        entityType: "Question",
        entityId: question.id,
        path: `${path}.answer`,
        message: "Trios thiếu shared word được chấp nhận.",
      });
    }
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

export async function getPublishableProblemIds(problemIds: string[]) {
  const report = await getContentQaReport({ problemIds });
  return report.problems.filter((problem) => problem.canPublish).map((problem) => problem.problemId);
}
