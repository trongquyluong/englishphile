// Shared between the writing grader client form, API route, and server AI
// helper. Must stay importable from client components: no "server-only",
// no environment variable reads.

export const WRITING_GRADER_MIN_WORDS = 80;
export const WRITING_GRADER_MAX_WORDS = 700;
export const WRITING_GRADER_MAX_PROMPT_CHARS = 1500;
export const WRITING_GRADER_MAX_ESSAY_CHARS = 30000;

export const essayTypeOptions = [
  { value: "opinion", label: "Opinion essay" },
  { value: "discussion", label: "Discussion essay" },
  { value: "advantage-disadvantage", label: "Advantage–Disadvantage essay" },
  { value: "outweigh", label: "Outweigh essay" },
  { value: "cause-effect-solution", label: "Cause/Effect/Solution essay" },
  { value: "double-question", label: "Double-question essay" },
  { value: "other", label: "Dạng khác" },
] as const;

export type EssayType = (typeof essayTypeOptions)[number]["value"];

export const essayTypeValues = essayTypeOptions.map((option) => option.value) as [EssayType, ...EssayType[]];

export const targetWordCountOptions = [
  { value: "250-300", label: "250–300 từ" },
  { value: "300-350", label: "300–350 từ" },
  { value: "350-400", label: "350–400 từ" },
  { value: "400-500", label: "400–500 từ" },
] as const;

export type TargetWordCount = (typeof targetWordCountOptions)[number]["value"];

export const targetWordCountValues = targetWordCountOptions.map((option) => option.value) as [
  TargetWordCount,
  ...TargetWordCount[],
];

export const DEFAULT_TARGET_WORD_COUNT: TargetWordCount = "300-350";

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export type WritingGradeRequest = {
  prompt: string;
  essayType: EssayType;
  targetWordCount: TargetWordCount;
  essayText: string;
  consent: boolean;
};

export type CriterionGrade = {
  score: number;
  maxScore: number;
  comment: string;
};

export type WritingGradeResult = {
  totalScore: number;
  maxScore: 30;
  criteria: {
    content: CriterionGrade;
    organization: CriterionGrade;
    language: CriterionGrade;
    mechanics: CriterionGrade;
  };
  overallComment: string;
  strengths: string[];
  priorityIssues: string[];
  detailedFeedback: Array<{
    quote: string;
    issue: string;
    explanation: string;
    suggestedRevision: string;
  }>;
  suggestedRewrite?: {
    thesis?: string;
    paragraph?: string;
  };
  nextPracticeTasks: string[];
  warnings: string[];
};
