import type { QuestionType } from "@prisma/client";
import { MAX_CELL_TEXT_LENGTH, MAX_FILE_SIZE_BYTES, MAX_QUESTIONS, MAX_SECTIONS } from "@/lib/import/resource-limits";

type RecordValue = Record<string, unknown>;

export const CONTEST_ATTEMPT_LIMITS = {
  maxProblems: MAX_QUESTIONS,
  maxSections: MAX_SECTIONS,
  maxResults: MAX_QUESTIONS,
  maxBreakdownEntries: MAX_QUESTIONS,
  maxIdentifierBytes: 128,
  maxTitleBytes: 1024,
  maxSectionBytes: 512,
  maxPromptBytes: MAX_CELL_TEXT_LENGTH,
  maxRootWordBytes: 256,
  maxLearnerAnswerBytes: 16 * 1024,
  maxStoredBytes: MAX_FILE_SIZE_BYTES,
} as const;

const QUESTION_TYPES = new Set<QuestionType>([
  "PRONUNCIATION_ODD_ONE_OUT", "MCQ", "OPEN_CLOZE", "GUIDED_CLOZE", "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION", "ERROR_IDENTIFICATION", "READING_MCQ", "LISTENING_MCQ",
  "LISTENING_SHORT_ANSWER", "WRITING_PROMPT", "TRIOS_GAPPED_SENTENCES", "SHORT_ANSWER",
]);

export type LearnerContestQuestionResult = {
  questionId: string;
  type?: QuestionType;
  prompt?: string;
  rootWord?: string | null;
  studentAnswer?: unknown;
  isCorrect: boolean | null;
};

export type LearnerContestResult = {
  version: 1;
  score: number;
  total: number;
  sectionBreakdown: Array<{ section: string; score: number; total: number; needsReview: number }>;
  problems: Array<{ contestProblemId?: string; problemId: string; title: string; section: string; results: LearnerContestQuestionResult[] }>;
  sectionResults: Array<{ sectionId: string; sectionTitle: string; skillType?: string; results: LearnerContestQuestionResult[] }>;
};

type ParseState = { resultCount: number };

function byteLength(value: string) { return Buffer.byteLength(value, "utf8"); }
function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}
function boundedText(value: unknown, maxBytes: number, required = false): string | null {
  if (typeof value !== "string" || (required && value.length === 0) || byteLength(value) > maxBytes) return null;
  return value;
}
function boundedNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_QUESTIONS ? value : null;
}

const ERROR_IDENTIFICATION_ANSWER_FIELDS = ["part", "correction"] as const;
const WRITING_ANSWER_FIELDS = ["thesis", "mainIdea1", "mainIdea2", "vocabulary", "essay"] as const;

function parseStringAnswerObject(value: unknown, fields: readonly string[]): { ok: true; value: RecordValue } | { ok: false } {
  const item = record(value);
  if (!item || Object.keys(item).some((key) => !fields.includes(key))) return { ok: false };
  const output = Object.create(null) as RecordValue;
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(item, field);
    if (!descriptor) continue;
    if (!("value" in descriptor) || typeof descriptor.value !== "string") return { ok: false };
    output[field] = descriptor.value;
  }
  return { ok: true, value: output };
}

function parseLearnerAnswer(value: unknown, type: QuestionType | undefined): { ok: true; value: unknown } | { ok: false } {
  let output: unknown;
  if (value === null || typeof value === "boolean" || typeof value === "string") output = value;
  else if (typeof value === "number" && Number.isFinite(value)) output = value;
  else if (type === "ERROR_IDENTIFICATION") {
    const parsed = parseStringAnswerObject(value, ERROR_IDENTIFICATION_ANSWER_FIELDS);
    if (!parsed.ok) return parsed;
    output = parsed.value;
  } else if (type === "WRITING_PROMPT") {
    const parsed = parseStringAnswerObject(value, WRITING_ANSWER_FIELDS);
    if (!parsed.ok) return parsed;
    output = parsed.value;
  } else return { ok: false };
  if (byteLength(JSON.stringify(output)) > CONTEST_ATTEMPT_LIMITS.maxLearnerAnswerBytes) return { ok: false };
  return { ok: true, value: output };
}

function parseQuestionResult(value: unknown, state: ParseState): LearnerContestQuestionResult | null {
  const item = record(value);
  if (!item || ++state.resultCount > CONTEST_ATTEMPT_LIMITS.maxResults) return null;
  const questionId = boundedText(item.questionId, CONTEST_ATTEMPT_LIMITS.maxIdentifierBytes, true);
  if (!questionId || (item.isCorrect !== true && item.isCorrect !== false && item.isCorrect !== null)) return null;
  const result: LearnerContestQuestionResult = { questionId, isCorrect: item.isCorrect };

  let questionType: QuestionType | undefined;
  if (item.type !== undefined) {
    if (typeof item.type !== "string" || !QUESTION_TYPES.has(item.type as QuestionType)) return null;
    questionType = item.type as QuestionType;
    result.type = questionType;
  }
  if (item.prompt !== undefined) {
    const prompt = boundedText(item.prompt, CONTEST_ATTEMPT_LIMITS.maxPromptBytes);
    if (prompt === null) return null;
    result.prompt = prompt;
  }
  if (item.rootWord !== undefined) {
    if (item.rootWord === null) result.rootWord = null;
    else {
      const rootWord = boundedText(item.rootWord, CONTEST_ATTEMPT_LIMITS.maxRootWordBytes);
      if (rootWord === null) return null;
      result.rootWord = rootWord;
    }
  }
  if (item.studentAnswer !== undefined) {
    const answer = parseLearnerAnswer(item.studentAnswer, questionType);
    if (!answer.ok) return null;
    result.studentAnswer = answer.value;
  }
  return result;
}

function parseResultArray(value: unknown, state: ParseState): LearnerContestQuestionResult[] | null {
  if (!Array.isArray(value) || value.length > CONTEST_ATTEMPT_LIMITS.maxResults) return null;
  const parsed = value.map((entry) => parseQuestionResult(entry, state));
  return parsed.some((entry) => entry === null) ? null : parsed as LearnerContestQuestionResult[];
}

function parseContestResult(value: unknown, allowLegacy: boolean): LearnerContestResult | null {
  const source = record(value);
  if (!source || (source.version !== 1 && !(allowLegacy && source.version === undefined))) return null;
  const score = boundedNumber(source.score);
  const total = boundedNumber(source.total);
  if (score === null || total === null || score > total) return null;
  const rawProblems = source.problems ?? [];
  const rawSections = source.sectionResults ?? [];
  const rawBreakdown = source.sectionBreakdown ?? [];
  if (!Array.isArray(rawProblems) || rawProblems.length > CONTEST_ATTEMPT_LIMITS.maxProblems
    || !Array.isArray(rawSections) || rawSections.length > CONTEST_ATTEMPT_LIMITS.maxSections
    || !Array.isArray(rawBreakdown) || rawBreakdown.length > CONTEST_ATTEMPT_LIMITS.maxBreakdownEntries) return null;

  const state: ParseState = { resultCount: 0 };
  const problems = rawProblems.map((value) => {
    const item = record(value);
    const results = item ? parseResultArray(item.results, state) : null;
    const problemId = item ? boundedText(item.problemId, CONTEST_ATTEMPT_LIMITS.maxIdentifierBytes, true) : null;
    const title = item ? boundedText(item.title, CONTEST_ATTEMPT_LIMITS.maxTitleBytes) : null;
    const section = item ? boundedText(item.section, CONTEST_ATTEMPT_LIMITS.maxSectionBytes) : null;
    if (!item || !results || !problemId || title === null || section === null) return null;
    const contestProblemId = item.contestProblemId === undefined ? undefined : boundedText(item.contestProblemId, CONTEST_ATTEMPT_LIMITS.maxIdentifierBytes, true);
    if (item.contestProblemId !== undefined && !contestProblemId) return null;
    return { ...(contestProblemId ? { contestProblemId } : {}), problemId, title, section, results };
  });
  const sectionResults = rawSections.map((value) => {
    const item = record(value);
    const results = item ? parseResultArray(item.results, state) : null;
    const sectionId = item ? boundedText(item.sectionId, CONTEST_ATTEMPT_LIMITS.maxIdentifierBytes, true) : null;
    const sectionTitle = item ? boundedText(item.sectionTitle, CONTEST_ATTEMPT_LIMITS.maxTitleBytes) : null;
    if (!item || !results || !sectionId || sectionTitle === null) return null;
    const skillType = item.skillType === undefined ? undefined : boundedText(item.skillType, CONTEST_ATTEMPT_LIMITS.maxIdentifierBytes, true);
    if (item.skillType !== undefined && !skillType) return null;
    return { sectionId, sectionTitle, ...(skillType ? { skillType } : {}), results };
  });
  const sectionBreakdown = rawBreakdown.map((value) => {
    const item = record(value);
    const section = item ? boundedText(item.section, CONTEST_ATTEMPT_LIMITS.maxSectionBytes) : null;
    const itemScore = item ? boundedNumber(item.score) : null;
    const itemTotal = item ? boundedNumber(item.total) : null;
    const needsReview = item ? boundedNumber(item.needsReview) : null;
    return section === null || itemScore === null || itemTotal === null || needsReview === null || itemScore > itemTotal
      ? null : { section, score: itemScore, total: itemTotal, needsReview };
  });
  if ([...problems, ...sectionResults, ...sectionBreakdown].some((entry) => entry === null)) return null;

  const output: LearnerContestResult = {
    version: 1,
    score,
    total,
    problems: problems as LearnerContestResult["problems"],
    sectionResults: sectionResults as LearnerContestResult["sectionResults"],
    sectionBreakdown: sectionBreakdown as LearnerContestResult["sectionBreakdown"],
  };
  return byteLength(JSON.stringify(output)) <= CONTEST_ATTEMPT_LIMITS.maxStoredBytes ? output : null;
}

/**
 * New-write boundary. Prompt/title/rootWord are exact learner-visible presentation
 * snapshots retained only so later editorial changes do not rewrite historical review.
 */
export function toStoredContestAttemptResult(source: unknown): LearnerContestResult {
  const parsed = parseContestResult(source, true);
  if (!parsed) throw new Error("Contest result could not be safely stored.");
  return parsed;
}

/** Positive reader for only version 1 and the documented pre-version legacy shape. */
export function toLearnerContestResult(value: unknown): LearnerContestResult | null {
  try {
    return parseContestResult(value, true);
  } catch {
    return null;
  }
}
