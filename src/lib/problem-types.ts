import type { ContentStatus, Difficulty, ProblemStatus, QuestionType, SkillType } from "@prisma/client";

export type Option = {
  id: string;
  text: string;
};

export type ClientQuestion = {
  id: string;
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage: string | null;
  options: unknown;
  answer?: unknown;
  explanation: string | null;
  rootWord: string | null;
  keyword: string | null;
  targetSentence: string | null;
  lineNumber: number | null;
  metadata: unknown;
  orderIndex: number;
};

export type ClientProblem = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  contentStatus?: ContentStatus;
  statement: string;
  instructions: string | null;
  estimatedMinutes: number | null;
  acceptanceRate: number | null;
  sourceCollection: { name: string } | null;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
  questions: ClientQuestion[];
};

export type AnswerMap = Record<string, unknown>;

export type SubmissionResultPayload = {
  submissionId?: string;
  status: string;
  score: number;
  total: number;
  answers: Array<{
    questionId: string;
    isCorrect: boolean | null;
    feedback: string;
    correctAnswer: string;
  }>;
};

export type ProblemListItem = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  difficulty: Difficulty;
  contentStatus?: ContentStatus;
  acceptanceRate: number | null;
  sourceCollection: { name: string } | null;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
  status: ProblemStatus;
};
