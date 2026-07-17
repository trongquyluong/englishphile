import type { ContentStatus, Difficulty, ProblemStatus, SkillType } from "@prisma/client";
import type {
  LearnerProblemDTO,
  LearnerQuestionDTO,
  LearnerOptionDTO,
} from "@/lib/dto/learner-question";

export type Option = LearnerOptionDTO;
export type ClientQuestion = LearnerQuestionDTO;
export type ClientProblem = LearnerProblemDTO;

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
