import { z } from "zod";
import type { Difficulty, QuestionType, SkillType, SourceType } from "@prisma/client";
import {
  difficultyValues,
  type ImportIssue,
  type NormalizedProblem,
  type NormalizedQuestion,
  type NormalizedSourceCollection,
  questionTypeValues,
  skillTypeValues,
  sourceTypeValues,
} from "@/lib/import/types";
import { generateSlug } from "@/lib/import/duplicates";

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const sourceSchema = z.object({
  name: z.string().trim().min(1, "Tên nguồn là bắt buộc."),
  description: z.string().trim().optional().default("Nguồn import thủ công."),
  originalFileName: nullableString.optional(),
  sourceType: z.enum(sourceTypeValues, {
    message: "sourceType không hợp lệ.",
  }).default("JSON"),
  copyrightNote: nullableString.optional(),
});

const questionSchema = z.object({
  type: z.enum(questionTypeValues, { message: "questionType không hợp lệ." }),
  skillType: z.enum(skillTypeValues, { message: "skillType không hợp lệ." }),
  difficulty: z.enum(difficultyValues, { message: "difficulty không hợp lệ." }),
  prompt: z.string().optional().default(""),
  passage: nullableString.optional(),
  options: z.unknown().optional().nullable(),
  answer: z.unknown().optional().nullable(),
  explanation: nullableString.optional(),
  rootWord: nullableString.optional(),
  keyword: nullableString.optional(),
  targetSentence: nullableString.optional(),
  lineNumber: z.coerce.number().int().positive().optional().nullable(),
  metadata: z.unknown().optional().nullable(),
});

const problemSchema = z.object({
  title: z.string().trim().min(1, "Tên problem là bắt buộc."),
  slug: z.string().trim().optional().nullable(),
  skillType: z.enum(skillTypeValues, { message: "skillType không hợp lệ." }),
  questionType: z.enum(questionTypeValues, { message: "questionType không hợp lệ." }),
  difficulty: z.enum(difficultyValues, { message: "difficulty không hợp lệ." }),
  statement: z.string().trim().min(1, "Statement là bắt buộc."),
  instructions: nullableString.optional(),
  estimatedMinutes: z.coerce.number().int().positive().optional().nullable(),
  topics: z.array(z.string()).optional().default([]),
  questions: z.array(z.unknown()).min(1, "Problem cần ít nhất một question."),
});

export const jsonImportSchema = z.object({
  sourceCollection: sourceSchema,
  problems: z.array(z.unknown()).min(1, "Payload cần ít nhất một problem."),
});

type SourceInput = z.input<typeof sourceSchema>;

function zodIssues(error: z.ZodError, pathPrefix: string): ImportIssue[] {
  return error.issues.map((issue) => ({
    level: "error",
    path: [pathPrefix, ...issue.path.map(String)].filter(Boolean).join("."),
    message: issue.message,
  }));
}

export function parseJsonText(text: string) {
  try {
    return { data: JSON.parse(text) as unknown, issues: [] as ImportIssue[] };
  } catch (error) {
    return {
      data: null,
      issues: [
        {
          level: "error" as const,
          path: "json",
          message: `JSON không hợp lệ: ${error instanceof Error ? error.message : "không đọc được nội dung"}.`,
        },
      ],
    };
  }
}

export function normalizeSourceCollection(input: SourceInput, fallbackType: SourceType): NormalizedSourceCollection | null {
  const parsed = sourceSchema.safeParse({ ...input, sourceType: input.sourceType ?? fallbackType });
  if (!parsed.success) return null;
  return {
    name: parsed.data.name,
    description: parsed.data.description,
    originalFileName: parsed.data.originalFileName,
    sourceType: parsed.data.sourceType,
    copyrightNote: parsed.data.copyrightNote,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getAcceptedAnswers(answer: Record<string, unknown>) {
  const accepted = answer.accepted ?? answer.acceptedAnswers;
  if (Array.isArray(accepted)) {
    return accepted.map(String).filter(Boolean);
  }
  if (typeof accepted === "string" && accepted.trim()) {
    return [accepted.trim()];
  }
  if (typeof answer.display === "string" && answer.display.trim()) {
    return [answer.display.trim()];
  }
  return [];
}

function normalizeOptions(options: unknown) {
  if (!Array.isArray(options)) return options ?? null;
  return options.map((option) => {
    if (!isRecord(option)) return option;
    const id = typeof option.id === "string" ? option.id : typeof option.label === "string" ? option.label : undefined;
    return id ? { ...option, id } : option;
  });
}

function normalizeAnswer(questionType: QuestionType, answer: unknown) {
  if (!isRecord(answer)) {
    return answer;
  }

  const normalized = { ...answer };

  if (
    ["MCQ", "GUIDED_CLOZE", "PRONUNCIATION_ODD_ONE_OUT", "READING_MCQ", "LISTENING_MCQ"].includes(questionType) &&
    typeof normalized.correctOptionId !== "string" &&
    typeof normalized.correctOption === "string"
  ) {
    normalized.correctOptionId = normalized.correctOption;
  }

  if (
    questionType === "ERROR_IDENTIFICATION" &&
    typeof normalized.correctPart !== "string" &&
    typeof normalized.errorPart === "string"
  ) {
    normalized.correctPart = normalized.errorPart;
  }

  if ("accepted" in normalized) {
    const acceptedAnswers = getAcceptedAnswers(normalized);
    return {
      ...normalized,
      acceptedAnswers,
      display: typeof normalized.display === "string" ? normalized.display : acceptedAnswers[0],
    };
  }

  if (
    questionType === "WORD_FORMATION" &&
    typeof normalized.correctForm === "string" &&
    !Array.isArray(normalized.acceptedAnswers)
  ) {
    return { ...normalized, acceptedAnswers: [normalized.correctForm] };
  }

  return normalized;
}

function validateQuestionRules(question: NormalizedQuestion, path: string): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const hasPrompt = question.prompt.trim().length > 0;
  const hasPassage = Boolean(question.passage?.trim());
  const answer = isRecord(question.answer) ? question.answer : {};
  const options = Array.isArray(question.options) ? question.options : [];

  if (!hasPrompt && !hasPassage) {
    issues.push({ level: "error", path: `${path}.prompt`, message: "Question cần prompt hoặc passage." });
  }

  if (
    ["MCQ", "GUIDED_CLOZE", "PRONUNCIATION_ODD_ONE_OUT", "READING_MCQ", "LISTENING_MCQ"].includes(question.type) &&
    options.length === 0
  ) {
    issues.push({ level: "error", path: `${path}.options`, message: "Dạng trắc nghiệm cần options." });
  }

  if (
    ["MCQ", "GUIDED_CLOZE", "PRONUNCIATION_ODD_ONE_OUT", "READING_MCQ", "LISTENING_MCQ"].includes(question.type) &&
    typeof answer.correctOptionId !== "string"
  ) {
    issues.push({ level: "error", path: `${path}.answer`, message: "Dạng trắc nghiệm cần answer.correctOptionId." });
  }

  if (
    ["OPEN_CLOZE", "WORD_FORMATION", "SHORT_ANSWER", "LISTENING_SHORT_ANSWER"].includes(question.type) &&
    getAcceptedAnswers(answer).length === 0
  ) {
    issues.push({ level: "error", path: `${path}.answer`, message: "Dạng điền từ cần accepted/acceptedAnswers." });
  }

  if (question.type === "TRIOS_GAPPED_SENTENCES" && getAcceptedAnswers(answer).length !== 1) {
    issues.push({ level: "error", path: `${path}.answer`, message: "Trios cần đúng một accepted shared word." });
  }

  if (question.type === "ERROR_IDENTIFICATION") {
    if (typeof answer.correctPart !== "string") {
      issues.push({ level: "error", path: `${path}.answer.correctPart`, message: "Error Identification cần correctPart." });
    }
    if (typeof answer.correction !== "string") {
      issues.push({ level: "error", path: `${path}.answer.correction`, message: "Error Identification cần correction." });
    }
  }

  if (question.type === "SENTENCE_TRANSFORMATION" && getAcceptedAnswers(answer).length === 0) {
    issues.push({ level: "warning", path: `${path}.answer`, message: "Sentence Transformation nên có accepted/model answer để đối chiếu." });
  }

  if (question.type === "WRITING_PROMPT" && !isRecord(question.answer)) {
    issues.push({ level: "error", path: `${path}.answer`, message: "Writing Prompt cần answer rubric/checklist." });
  }

  return issues;
}

export function normalizeQuestion(input: unknown, path: string, orderIndex: number) {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    return { question: null, issues: zodIssues(parsed.error, path) };
  }

  const question: NormalizedQuestion = {
    type: parsed.data.type as QuestionType,
    skillType: parsed.data.skillType as SkillType,
    difficulty: parsed.data.difficulty as Difficulty,
    prompt: parsed.data.prompt.trim(),
    passage: parsed.data.passage,
    options: normalizeOptions(parsed.data.options),
    answer: normalizeAnswer(parsed.data.type as QuestionType, parsed.data.answer),
    explanation: parsed.data.explanation,
    rootWord: parsed.data.rootWord,
    keyword: parsed.data.keyword,
    targetSentence: parsed.data.targetSentence,
    lineNumber: parsed.data.lineNumber,
    metadata: parsed.data.metadata ?? null,
    orderIndex,
  };

  const issues = validateQuestionRules(question, path);
  return { question: issues.some((issue) => issue.level === "error") ? null : question, issues };
}

export function normalizeProblem(
  input: unknown,
  sourceCollection: NormalizedSourceCollection,
  path: string,
  orderIndex: number,
) {
  const parsed = problemSchema.safeParse(input);
  if (!parsed.success) {
    return { problem: null, issues: zodIssues(parsed.error, path) };
  }

  const issues: ImportIssue[] = [];
  const questions: NormalizedQuestion[] = [];
  parsed.data.questions.forEach((rawQuestion, index) => {
    const result = normalizeQuestion(rawQuestion, `${path}.questions.${index}`, index);
    issues.push(...result.issues);
    if (result.question) {
      questions.push(result.question);
    }
  });

  if (questions.length === 0) {
    issues.push({ level: "error", path: `${path}.questions`, message: "Problem không còn question hợp lệ để import." });
  }

  const problem: NormalizedProblem = {
    title: parsed.data.title,
    slug: generateSlug(parsed.data.slug || parsed.data.title),
    skillType: parsed.data.skillType as SkillType,
    questionType: parsed.data.questionType as QuestionType,
    difficulty: parsed.data.difficulty as Difficulty,
    sourceCollection,
    statement: parsed.data.statement,
    instructions: parsed.data.instructions,
    estimatedMinutes: parsed.data.estimatedMinutes,
    topics: parsed.data.topics.map((topic) => topic.trim()).filter(Boolean),
    questions,
    orderIndex,
  };

  return { problem: issues.some((issue) => issue.level === "error" && issue.path.endsWith(".questions")) ? null : problem, issues };
}

export function normalizeJsonPayload(raw: unknown) {
  const parsed = jsonImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { payload: null, issues: zodIssues(parsed.error, "") };
  }

  const sourceCollection = normalizeSourceCollection(parsed.data.sourceCollection, "JSON");
  if (!sourceCollection) {
    return {
      payload: null,
      issues: [{ level: "error" as const, path: "sourceCollection", message: "Source collection không hợp lệ." }],
    };
  }

  const issues: ImportIssue[] = [];
  const problems: NormalizedProblem[] = [];
  parsed.data.problems.forEach((rawProblem, index) => {
    const result = normalizeProblem(rawProblem, sourceCollection, `problems.${index}`, index);
    issues.push(...result.issues);
    if (result.problem) {
      problems.push(result.problem);
    }
  });

  return {
    payload: {
      importType: "JSON" as const,
      problems,
    },
    issues,
  };
}
