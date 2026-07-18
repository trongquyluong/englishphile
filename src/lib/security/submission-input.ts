import type { QuestionType } from "@prisma/client";

type FormEntry = readonly [string, FormDataEntryValue];

export const PRACTICE_INPUT_LIMITS = {
  maxBodyBytes: 72 * 1024,
  maxAnswerEntries: 50,
  maxRandomQuestionIds: 20,
  maxIdentifierLength: 128,
  maxNestingDepth: 3,
  maxArrayLength: 20,
  maxAnswerBytes: 16 * 1024,
  maxAnswersBytes: 64 * 1024,
} as const;

export const MINIMIZED_SUBMISSION_ANSWERS = Object.freeze({ version: 1 as const });

const FORBIDDEN_PROPERTY_NAMES = new Set(["__proto__", "prototype", "constructor"]);

export class PracticeSubmissionInputError extends Error {
  constructor() {
    super("INVALID_PRACTICE_SUBMISSION");
    this.name = "PracticeSubmissionInputError";
  }
}

function invalid(): never {
  throw new PracticeSubmissionInputError();
}

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function parseIdentifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || byteLength(value) > PRACTICE_INPUT_LIMITS.maxIdentifierLength) {
    return invalid();
  }
  return value;
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // Cancellation is best-effort; the request still fails closed.
  }
}

/** Read and UTF-8 decode a request body without buffering beyond maxBodyBytes. */
export async function readBoundedPracticeRequestBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > PRACTICE_INPUT_LIMITS.maxBodyBytes) {
    if (request.body) {
      try {
        await request.body.cancel();
      } catch {
        // Cancellation is best-effort; no body bytes are consumed here.
      }
    }
    return invalid();
  }

  const reader = request.body?.getReader();
  if (!reader) return invalid();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return invalid();
      totalBytes += value.byteLength;
      if (totalBytes > PRACTICE_INPUT_LIMITS.maxBodyBytes) {
        await cancelReader(reader);
        return invalid();
      }
      chunks.push(value);
    }
  } catch {
    return invalid();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return invalid();
  }
}

export function normalizeBoundedPracticeJson(value: unknown, depth = 0): unknown {
  if (depth > PRACTICE_INPUT_LIMITS.maxNestingDepth) return invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (Array.isArray(value)) {
    if (value.length > PRACTICE_INPUT_LIMITS.maxArrayLength) return invalid();
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) return invalid();
    }
    return value.map((item) => normalizeBoundedPracticeJson(item, depth + 1));
  }

  if (!value || typeof value !== "object") return invalid();
  const source = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(source);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const output = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_PROPERTY_NAMES.has(key) || byteLength(key) > PRACTICE_INPUT_LIMITS.maxIdentifierLength) return invalid();
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !("value" in descriptor)) return invalid();
    output[key] = normalizeBoundedPracticeJson(descriptor.value, depth + 1);
  }
  return output;
}

function parseAnswerMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const keys = Object.keys(value);
  if (keys.length > PRACTICE_INPUT_LIMITS.maxAnswerEntries) return invalid();

  const answers = Object.create(null) as Record<string, unknown>;
  for (const rawQuestionId of keys) {
    const questionId = parseIdentifier(rawQuestionId);
    if (FORBIDDEN_PROPERTY_NAMES.has(questionId)) return invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, rawQuestionId);
    if (!descriptor || !("value" in descriptor)) return invalid();
    const answer = normalizeBoundedPracticeJson(descriptor.value);
    if (byteLength(JSON.stringify(answer)) > PRACTICE_INPUT_LIMITS.maxAnswerBytes) return invalid();
    answers[questionId] = answer;
  }
  if (byteLength(JSON.stringify(answers)) > PRACTICE_INPUT_LIMITS.maxAnswersBytes) return invalid();
  return answers;
}

function parseBody(rawBody: string): Record<string, unknown> {
  if (byteLength(rawBody) > PRACTICE_INPUT_LIMITS.maxBodyBytes) return invalid();
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return invalid();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const normalized = normalizeBoundedPracticeJson(value);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return invalid();
  return normalized as Record<string, unknown>;
}

function requireOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PROPERTY_NAMES.has(key) || !allowed.has(key)) return invalid();
  }
}

export function parseSingleProblemSubmissionBody(rawBody: string) {
  const body = parseBody(rawBody);
  requireOnlyKeys(body, new Set(["problemId", "answers"]));
  return {
    problemId: parseIdentifier(body.problemId),
    answers: parseAnswerMap(body.answers ?? {}),
  };
}

export function parseRandomPracticeSubmissionBody(rawBody: string) {
  const body = parseBody(rawBody);
  requireOnlyKeys(body, new Set(["questionIds", "answers"]));
  if (!Array.isArray(body.questionIds) || body.questionIds.length === 0 || body.questionIds.length > PRACTICE_INPUT_LIMITS.maxRandomQuestionIds) {
    return invalid();
  }
  const questionIds = body.questionIds.map(parseIdentifier);
  if (new Set(questionIds).size !== questionIds.length) return invalid();
  return { questionIds, answers: parseAnswerMap(body.answers ?? {}) };
}

export function requireExactQuestionSet(
  submittedIds: Iterable<string>,
  authorizedIds: Iterable<string>,
) {
  const submitted = new Set(submittedIds);
  const authorized = new Set(authorizedIds);
  if (submitted.size !== authorized.size || [...submitted].some((id) => !authorized.has(id))) return invalid();
}

export function requireAnswerKeysBelongToQuestions(
  answers: Record<string, unknown>,
  authorizedIds: Iterable<string>,
) {
  const authorized = new Set(authorizedIds);
  if (Object.keys(answers).some((id) => !authorized.has(id))) return invalid();
}

const WRITING_FIELDS = new Set(["thesis", "mainIdea1", "mainIdea2", "vocabulary", "essay"]);
const ERROR_IDENTIFICATION_FIELDS = new Set(["part", "correction"]);

function requireStringObject(value: unknown, allowedFields: ReadonlySet<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key) || typeof (value as Record<string, unknown>)[key] !== "string") return invalid();
  }
}

/** Enforce the answer shape actually rendered for each persisted QuestionType. */
export function requireSupportedQuestionAnswerShapes(
  answers: Record<string, unknown>,
  questions: ReadonlyArray<{ id: string; type: QuestionType }>,
) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  for (const [questionId, answer] of Object.entries(answers)) {
    const question = questionById.get(questionId);
    if (!question) return invalid();
    if (question.type === "ERROR_IDENTIFICATION") {
      requireStringObject(answer, ERROR_IDENTIFICATION_FIELDS);
    } else if (question.type === "WRITING_PROMPT") {
      requireStringObject(answer, WRITING_FIELDS);
    } else if (typeof answer !== "string") {
      return invalid();
    }
  }
}

export function parseDiagnosticAnswerEntries(
  entries: Iterable<FormEntry>,
): Record<string, unknown> {
  const answers = Object.create(null) as Record<string, unknown>;

  for (const [key, value] of entries) {
    if (!key.startsWith("answer:")) continue;
    const [, questionId, field] = key.split(":");
    if (!questionId) continue;
    if (!field) {
      answers[questionId] = String(value);
      continue;
    }

    const current = answers[questionId];
    const objectAnswer = current && typeof current === "object" && !Array.isArray(current)
      ? current as Record<string, unknown>
      : Object.create(null) as Record<string, unknown>;
    objectAnswer[field] = String(value);
    answers[questionId] = objectAnswer;
  }

  return answers;
}

export function parseContestAnswerEntries(
  entries: Iterable<FormEntry>,
  allowed: {
    problemQuestions: ReadonlyMap<string, ReadonlySet<string>>;
    sectionQuestions: ReadonlyMap<string, ReadonlySet<string>>;
  },
): {
  answersByProblem: Record<string, Record<string, unknown>>;
  answersBySection: Record<string, Record<string, unknown>>;
} {
  const answersByProblem = Object.create(null) as Record<string, Record<string, unknown>>;
  const answersBySection = Object.create(null) as Record<string, Record<string, unknown>>;

  for (const [key, value] of entries) {
    const parts = key.split(":");
    if (key.startsWith("sectionAnswer:")) {
      const [, sectionId, questionId] = parts;
      if (!sectionId || !questionId || !allowed.sectionQuestions.get(sectionId)?.has(questionId)) continue;
      answersBySection[sectionId] ??= Object.create(null) as Record<string, unknown>;
      answersBySection[sectionId][questionId] = String(value);
      continue;
    }

    if (key.startsWith("answer:")) {
      const [, problemId, questionId] = parts;
      if (!problemId || !questionId || !allowed.problemQuestions.get(problemId)?.has(questionId)) continue;
      answersByProblem[problemId] ??= Object.create(null) as Record<string, unknown>;
      answersByProblem[problemId][questionId] = String(value);
    }
  }

  return { answersByProblem, answersBySection };
}
