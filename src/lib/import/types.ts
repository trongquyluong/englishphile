import type {
  Difficulty,
  ImportStatus,
  ImportType,
  QuestionType,
  SkillType,
  SourceType,
} from "@prisma/client";

export const sourceTypeValues = ["PDF", "DOCX", "CSV", "JSON", "MANUAL", "OTHER"] as const;
export const skillTypeValues = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "READING",
  "WRITING",
  "LISTENING",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
  "USE_OF_ENGLISH",
] as const;
export const questionTypeValues = [
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "READING_MCQ",
  "LISTENING_MCQ",
  "LISTENING_SHORT_ANSWER",
  "WRITING_PROMPT",
  "TRIOS_GAPPED_SENTENCES",
  "SHORT_ANSWER",
] as const;
export const difficultyValues = ["B2", "C1", "C2", "CHUYEN", "HSG"] as const;

export type ImportIssueLevel = "error" | "warning";

export type ImportIssue = {
  level: ImportIssueLevel;
  path: string;
  message: string;
  code?: string;
  duplicate?: {
    similarity: number;
    action: "skip" | "needs_review";
    existingQuestionId?: string;
    existingProblemId?: string;
    existingProblemTitle?: string;
    existingPromptExcerpt?: string;
  };
};

export type NormalizedSourceCollection = {
  name: string;
  description: string;
  originalFileName?: string | null;
  sourceType: SourceType;
  copyrightNote?: string | null;
};

export type NormalizedQuestion = {
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage?: string | null;
  options?: unknown;
  answer: unknown;
  explanation?: string | null;
  rootWord?: string | null;
  keyword?: string | null;
  targetSentence?: string | null;
  lineNumber?: number | null;
  metadata?: unknown;
  orderIndex: number;
};

export type NormalizedProblem = {
  title: string;
  slug: string;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  sourceCollection: NormalizedSourceCollection;
  statement: string;
  instructions?: string | null;
  estimatedMinutes?: number | null;
  topics: string[];
  questions: NormalizedQuestion[];
  orderIndex: number;
};

export type NormalizedImportPayload = {
  importType: ImportType;
  problems: NormalizedProblem[];
};

export type ImportSummary = {
  sourceCollectionsToCreate: number;
  sourceCollectionsReused: number;
  topicsToCreate: number;
  topicsReused: number;
  problemsToCreate: number;
  questionsToCreate: number;
  duplicateProblemsSkipped: number;
  duplicateQuestionsSkipped: number;
  exactDuplicateQuestionsSkipped: number;
  highSimilarityQuestionsSkipped: number;
  possibleDuplicateQuestionsFlagged: number;
  problemsImported: number;
  questionsImported: number;
  errors: number;
  warnings: number;
};

export type ProblemPreview = {
  title: string;
  slug: string;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  sourceName: string;
  topicNames: string[];
  questionCount: number;
  action: "create" | "skip";
  messages: string[];
};

export type ImportPlan = {
  ok: boolean;
  importType: ImportType;
  summary: ImportSummary;
  issues: ImportIssue[];
  preview: ProblemPreview[];
  payload: NormalizedImportPayload;
};

export type ImportExecutionResult = ImportPlan & {
  batchId?: string;
  status: ImportStatus;
};
