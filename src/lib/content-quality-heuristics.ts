export const SHORT_EXPLANATION_THRESHOLD = 45;

export const SUBSTANTIVE_PROMPT_MIN_LENGTH = 20;

const genericPromptQuestionTypes = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "TRIOS_GAPPED_SENTENCES",
]);

export type SubstantivePromptDuplicateMember = {
  questionId: string;
  problemId: string;
};

export type SubstantivePromptDuplicateGroup = {
  normalizedPrompt: string;
  members: SubstantivePromptDuplicateMember[];
};

export function isShortNonBlankExplanation(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const length = value.trim().length;
  return length > 0 && length < SHORT_EXPLANATION_THRESHOLD;
}

export const ANSWER_POSITIONS = ["A", "B", "C", "D"] as const;

export type AnswerPosition = (typeof ANSWER_POSITIONS)[number];

export type AnswerPositionDistribution = Record<AnswerPosition, number>;

export type AnswerPositionDistributionReview = {
  eligibleQuestions: number;
  counts: AnswerPositionDistribution;
  isSkewed: boolean;
};

const eligibleQuestionTypes = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "GUIDED_CLOZE",
  "READING_MCQ",
  "LISTENING_MCQ",
]);

type OwnDataProperty =
  | { present: false }
  | { present: true; safe: false }
  | { present: true; safe: true; value: unknown };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataProperty(
  value: unknown,
  key: PropertyKey,
): OwnDataProperty {
  if (!value || typeof value !== "object") return { present: false };
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return { present: false };
  if (!("value" in descriptor)) return { present: true, safe: false };
  return { present: true, safe: true, value: descriptor.value };
}

export function ownDataValue(value: unknown, key: PropertyKey): unknown {
  const property = ownDataProperty(value, key);
  return property.present && property.safe ? property.value : undefined;
}

export function normalizeSubstantivePromptForReview(
  questionType: unknown,
  prompt: unknown,
): string | null {
  if (typeof questionType !== "string" || typeof prompt !== "string") {
    return null;
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) return null;

  const normalized = trimmedPrompt
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");

  if (normalized.length < SUBSTANTIVE_PROMPT_MIN_LENGTH) return null;
  return genericPromptQuestionTypes.has(questionType) ? null : normalized;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

type SafeSubstantivePromptCandidate = {
  questionId: string;
  problemId: string;
  questionType: string;
  normalizedPrompt: string;
};

function readSubstantivePromptCandidate(
  value: unknown,
): SafeSubstantivePromptCandidate | null {
  const id = ownDataProperty(value, "id");
  const problemId = ownDataProperty(value, "problemId");
  const type = ownDataProperty(value, "type");
  const prompt = ownDataProperty(value, "prompt");
  if (
    !id.present ||
    !id.safe ||
    typeof id.value !== "string" ||
    id.value.length === 0 ||
    !problemId.present ||
    !problemId.safe ||
    typeof problemId.value !== "string" ||
    problemId.value.length === 0 ||
    !type.present ||
    !type.safe ||
    typeof type.value !== "string" ||
    !prompt.present ||
    !prompt.safe
  ) {
    return null;
  }

  const normalizedPrompt = normalizeSubstantivePromptForReview(
    type.value,
    prompt.value,
  );
  return normalizedPrompt
    ? {
        questionId: id.value,
        problemId: problemId.value,
        questionType: type.value,
        normalizedPrompt,
      }
    : null;
}

function compareSubstantivePromptCandidates(
  left: SafeSubstantivePromptCandidate,
  right: SafeSubstantivePromptCandidate,
): number {
  return (
    ordinalCompare(left.questionId, right.questionId) ||
    ordinalCompare(left.normalizedPrompt, right.normalizedPrompt) ||
    ordinalCompare(left.problemId, right.problemId) ||
    ordinalCompare(left.questionType, right.questionType)
  );
}

export function groupSubstantiveDuplicatePromptsForReview(
  candidates: readonly unknown[],
): SubstantivePromptDuplicateGroup[] {
  const safeCandidates = candidates
    .map(readSubstantivePromptCandidate)
    .filter((candidate): candidate is SafeSubstantivePromptCandidate =>
      candidate !== null,
    )
    .sort(compareSubstantivePromptCandidates);
  const uniqueCandidates = new Map<string, SafeSubstantivePromptCandidate>();
  for (const candidate of safeCandidates) {
    if (!uniqueCandidates.has(candidate.questionId)) {
      uniqueCandidates.set(candidate.questionId, candidate);
    }
  }

  const grouped = new Map<string, SubstantivePromptDuplicateMember[]>();
  for (const candidate of uniqueCandidates.values()) {
    const members = grouped.get(candidate.normalizedPrompt) ?? [];
    members.push({
      questionId: candidate.questionId,
      problemId: candidate.problemId,
    });
    grouped.set(candidate.normalizedPrompt, members);
  }

  return [...grouped.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort(([left], [right]) => ordinalCompare(left, right))
    .map(([normalizedPrompt, members]) => ({
      normalizedPrompt,
      members: [...members].sort((left, right) =>
        ordinalCompare(left.questionId, right.questionId) ||
        ordinalCompare(left.problemId, right.problemId),
      ),
    }));
}

function canonicalAnswerPosition(value: unknown): AnswerPosition | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (ANSWER_POSITIONS as readonly string[]).includes(normalized)
    ? (normalized as AnswerPosition)
    : null;
}

function resolveStringAlias(
  value: Record<string, unknown>,
  canonicalKey: string,
  aliasKey: string,
): string | null {
  const canonical = ownDataProperty(value, canonicalKey);
  if (canonical.present && !canonical.safe) return null;
  if (canonical.present && typeof canonical.value === "string") {
    return canonical.value;
  }

  const alias = ownDataProperty(value, aliasKey);
  if (alias.present && !alias.safe) return null;
  return alias.present && typeof alias.value === "string" ? alias.value : null;
}

function resolveEligibleAnswerPosition(questionValue: unknown): AnswerPosition | null {
  if (!isPlainRecord(questionValue)) return null;

  const typeProperty = ownDataProperty(questionValue, "type");
  if (
    !typeProperty.present ||
    !typeProperty.safe ||
    typeof typeProperty.value !== "string" ||
    !eligibleQuestionTypes.has(typeProperty.value)
  ) {
    return null;
  }

  const optionsProperty = ownDataProperty(questionValue, "options");
  if (
    !optionsProperty.present ||
    !optionsProperty.safe ||
    !Array.isArray(optionsProperty.value) ||
    optionsProperty.value.length !== ANSWER_POSITIONS.length
  ) {
    return null;
  }

  const identifiers: AnswerPosition[] = [];
  for (let index = 0; index < ANSWER_POSITIONS.length; index += 1) {
    const optionProperty = Object.getOwnPropertyDescriptor(
      optionsProperty.value,
      String(index),
    );
    if (!optionProperty || !("value" in optionProperty)) return null;
    if (!isPlainRecord(optionProperty.value)) return null;

    const text = ownDataValue(optionProperty.value, "text");
    if (typeof text !== "string" || text.trim().length === 0) return null;

    const rawIdentifier = resolveStringAlias(optionProperty.value, "id", "label");
    const identifier = canonicalAnswerPosition(rawIdentifier);
    if (!identifier || identifier !== ANSWER_POSITIONS[index]) return null;
    identifiers.push(identifier);
  }

  if (new Set(identifiers).size !== ANSWER_POSITIONS.length) return null;

  const answerProperty = ownDataProperty(questionValue, "answer");
  if (
    !answerProperty.present ||
    !answerProperty.safe ||
    !isPlainRecord(answerProperty.value)
  ) {
    return null;
  }

  const rawAnswer = resolveStringAlias(
    answerProperty.value,
    "correctOptionId",
    "correctOption",
  );
  const answer = canonicalAnswerPosition(rawAnswer);
  return answer && identifiers.includes(answer) ? answer : null;
}

export function reviewAnswerPositionDistribution(
  questions: readonly unknown[],
): AnswerPositionDistributionReview {
  const counts: AnswerPositionDistribution = { A: 0, B: 0, C: 0, D: 0 };

  for (const question of questions) {
    const position = resolveEligibleAnswerPosition(question);
    if (position) counts[position] += 1;
  }

  const eligibleQuestions = ANSWER_POSITIONS.reduce(
    (total, position) => total + counts[position],
    0,
  );
  const hasMajority = ANSWER_POSITIONS.some(
    (position) => counts[position] > eligibleQuestions / 2,
  );
  const hasMissingPosition = ANSWER_POSITIONS.some(
    (position) => counts[position] === 0,
  );

  return {
    eligibleQuestions,
    counts,
    isSkewed:
      eligibleQuestions >= 4 &&
      (hasMajority || (eligibleQuestions >= 8 && hasMissingPosition)),
  };
}
