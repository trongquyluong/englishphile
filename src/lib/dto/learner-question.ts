import type {
  ContentStatus,
  Difficulty,
  QuestionType,
  SkillType,
} from "@prisma/client";

export type LearnerOptionDTO = {
  id: string;
  text: string;
};

export type LearnerQuestionDTO = {
  id: string;
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage: string | null;
  options: LearnerOptionDTO[];
  rootWord: string | null;
  keyword: string | null;
  targetSentence: string | null;
  lineNumber: number | null;
  orderIndex: number;
  problemTitle: string | null;
  audioUrl: string | null;
  sectionType: string | null;
};

export type LearnerProblemDTO = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  contentStatus: ContentStatus;
  statement: string;
  instructions: string | null;
  estimatedMinutes: number | null;
  acceptanceRate: number | null;
  sourceCollection: { name: string } | null;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
  questions: LearnerQuestionDTO[];
};

export type LearnerQuestionSource = {
  id: string;
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage: string | null;
  options: unknown;
  rootWord: string | null;
  keyword: string | null;
  targetSentence: string | null;
  lineNumber: number | null;
  metadata: unknown;
  orderIndex: number;
  problem?: { title: string } | null;
};

export type LearnerProblemSource = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  contentStatus: ContentStatus;
  statement: string;
  instructions: string | null;
  estimatedMinutes: number | null;
  acceptanceRate: number | null;
  sourceCollection: { name: string } | null;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
  questions: LearnerQuestionSource[];
};

/**
 * Positive database allowlist for learner question presentation. Canonical
 * answers and explanations are intentionally not loaded by learner pages.
 */
export const learnerQuestionPresentationSelect = {
  id: true,
  type: true,
  skillType: true,
  difficulty: true,
  prompt: true,
  passage: true,
  options: true,
  rootWord: true,
  keyword: true,
  targetSentence: true,
  lineNumber: true,
  metadata: true,
  orderIndex: true,
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeLearnerOptions(value: unknown): LearnerOptionDTO[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const option = asRecord(item);
      const id = typeof option.id === "string" || typeof option.id === "number"
        ? String(option.id)
        : "";
      const text = typeof option.text === "string" || typeof option.text === "number"
        ? String(option.text)
        : "";
      return id ? { id, text } : null;
    })
    .filter((item): item is LearnerOptionDTO => item !== null);
}

export function toLearnerQuestionDTO(question: LearnerQuestionSource): LearnerQuestionDTO {
  const metadata = asRecord(question.metadata);

  return {
    id: question.id,
    type: question.type,
    skillType: question.skillType,
    difficulty: question.difficulty,
    prompt: question.prompt,
    passage: question.passage,
    options: normalizeLearnerOptions(question.options),
    rootWord: question.rootWord,
    keyword: question.keyword,
    targetSentence: question.targetSentence,
    lineNumber: question.lineNumber,
    orderIndex: question.orderIndex,
    problemTitle: question.problem?.title ?? null,
    audioUrl: nullableString(metadata.audioUrl),
    sectionType: nullableString(metadata.sectionType),
  };
}

export function toLearnerProblemDTO(problem: LearnerProblemSource): LearnerProblemDTO {
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    skillType: problem.skillType,
    questionType: problem.questionType,
    difficulty: problem.difficulty,
    contentStatus: problem.contentStatus,
    statement: problem.statement,
    instructions: problem.instructions,
    estimatedMinutes: problem.estimatedMinutes,
    acceptanceRate: problem.acceptanceRate,
    sourceCollection: problem.sourceCollection
      ? { name: problem.sourceCollection.name }
      : null,
    problemTopics: problem.problemTopics.map(({ topic }) => ({
      topic: { name: topic.name, slug: topic.slug },
    })),
    questions: problem.questions.map(toLearnerQuestionDTO),
  };
}
