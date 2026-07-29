export const TRIOS_GAP_MARKER = "_____" as const;
export const TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS = 80;

export type TriosSentences = readonly [string, string, string];

export type TriosContractIssueCode =
  | "METADATA_REQUIRED"
  | "SENTENCES_REQUIRED"
  | "SENTENCES_NOT_ARRAY"
  | "SENTENCE_COUNT_NOT_THREE"
  | "SENTENCE_NOT_STRING"
  | "SENTENCE_EMPTY"
  | "GAP_MARKER_REQUIRED"
  | "GAP_MARKER_INVALID"
  | "ANSWER_REQUIRED"
  | "ACCEPTED_REQUIRED"
  | "ACCEPTED_SHAPE_INVALID"
  | "ACCEPTED_COUNT_NOT_ONE"
  | "ACCEPTED_VALUE_NOT_STRING"
  | "ACCEPTED_EMPTY"
  | "ACCEPTED_MULTIWORD"
  | "ACCEPTED_TOO_LONG"
  | "ACCEPTED_INVALID_WORD"
  | "ACCEPTED_ALIAS_CONFLICT";

export type TriosContractIssue = {
  code: TriosContractIssueCode;
  path: string;
  message: string;
  importLevel: "error" | "warning";
};

export type TriosSentencesResult = {
  valid: boolean;
  sentences: TriosSentences | null;
  issues: TriosContractIssue[];
};

export type TriosAnswerResult = {
  valid: boolean;
  sharedAnswer: string | null;
  issues: TriosContractIssue[];
};

export type TriosContractResult = {
  valid: boolean;
  importDisposition: "valid" | "draft-warning" | "error";
  sentences: TriosSentences | null;
  sharedAnswer: string | null;
  issues: TriosContractIssue[];
};

type AcceptedAlias = "acceptedAnswers" | "accepted";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function issue(
  code: TriosContractIssueCode,
  path: string,
  message: string,
  importLevel: "error" | "warning",
): TriosContractIssue {
  return { code, path, message, importLevel };
}

function validateSentence(value: unknown, index: number): {
  sentence: string | null;
  issues: TriosContractIssue[];
} {
  const path = `metadata.sentences.${index}`;
  if (typeof value !== "string") {
    return {
      sentence: null,
      issues: [
        issue(
          "SENTENCE_NOT_STRING",
          path,
          "Mỗi câu Trios phải là chuỗi văn bản.",
          "warning",
        ),
      ],
    };
  }

  const sentence = value.trim();
  if (!sentence) {
    return {
      sentence: null,
      issues: [
        issue(
          "SENTENCE_EMPTY",
          path,
          "Mỗi câu Trios phải có nội dung.",
          "warning",
        ),
      ],
    };
  }

  const underscoreRuns = sentence.match(/_+/g) ?? [];
  if (underscoreRuns.length === 0) {
    return {
      sentence: null,
      issues: [
        issue(
          "GAP_MARKER_REQUIRED",
          path,
          `Mỗi câu Trios phải có đúng một dấu khuyết ${TRIOS_GAP_MARKER}.`,
          "warning",
        ),
      ],
    };
  }
  if (
    underscoreRuns.length !== 1 ||
    underscoreRuns[0] !== TRIOS_GAP_MARKER
  ) {
    return {
      sentence: null,
      issues: [
        issue(
          "GAP_MARKER_INVALID",
          path,
          `Mỗi câu Trios chỉ được có một dấu khuyết ${TRIOS_GAP_MARKER}.`,
          "warning",
        ),
      ],
    };
  }

  return { sentence, issues: [] };
}

/**
 * Pure learner-rendering contract. `metadata.sentences` is the only structured
 * source; passage text is never split or repaired into a tuple.
 */
export function validateTriosSentences(metadataValue: unknown): TriosSentencesResult {
  if (!isRecord(metadataValue)) {
    return {
      valid: false,
      sentences: null,
      issues: [
        issue(
          "METADATA_REQUIRED",
          "metadata",
          "Trios cần metadata dạng object chứa đúng ba câu.",
          "warning",
        ),
      ],
    };
  }

  if (!Object.hasOwn(metadataValue, "sentences")) {
    return {
      valid: false,
      sentences: null,
      issues: [
        issue(
          "SENTENCES_REQUIRED",
          "metadata.sentences",
          "Trios cần metadata.sentences chứa đúng ba câu.",
          "warning",
        ),
      ],
    };
  }

  const rawSentences = metadataValue.sentences;
  if (!Array.isArray(rawSentences)) {
    return {
      valid: false,
      sentences: null,
      issues: [
        issue(
          "SENTENCES_NOT_ARRAY",
          "metadata.sentences",
          "metadata.sentences của Trios phải là một mảng.",
          "warning",
        ),
      ],
    };
  }

  const issues: TriosContractIssue[] = [];
  if (rawSentences.length !== 3) {
    issues.push(
      issue(
        "SENTENCE_COUNT_NOT_THREE",
        "metadata.sentences",
        "Trios cần đúng ba câu theo thứ tự câu 1, 2, 3.",
        "warning",
      ),
    );
  }

  const normalized = rawSentences.map((sentence, index) => {
    const result = validateSentence(sentence, index);
    issues.push(...result.issues);
    return result.sentence;
  });

  if (
    issues.length > 0 ||
    normalized.length !== 3 ||
    normalized.some((sentence) => sentence === null)
  ) {
    return { valid: false, sentences: null, issues };
  }

  return {
    valid: true,
    sentences: normalized as [string, string, string],
    issues: [],
  };
}

function acceptedAliasValue(
  answer: Record<string, unknown>,
  alias: AcceptedAlias,
): { value: string | null; issues: TriosContractIssue[] } {
  const path = `answer.${alias}`;
  const raw = answer[alias];
  if (typeof raw !== "string" && !Array.isArray(raw)) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_SHAPE_INVALID",
          path,
          `${alias} của Trios phải là một chuỗi hoặc mảng chứa đúng một chuỗi.`,
          "error",
        ),
      ],
    };
  }

  const values = typeof raw === "string" ? [raw] : raw;
  if (values.length !== 1) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_COUNT_NOT_ONE",
          path,
          "Trios cần đúng một shared word được chấp nhận.",
          "error",
        ),
      ],
    };
  }

  const accepted = values[0];
  if (typeof accepted !== "string") {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_VALUE_NOT_STRING",
          `${path}.0`,
          "Shared word của Trios phải là chuỗi văn bản.",
          "error",
        ),
      ],
    };
  }

  const trimmed = accepted.trim();
  if (!trimmed) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_EMPTY",
          `${path}.0`,
          "Shared word của Trios không được để trống.",
          "error",
        ),
      ],
    };
  }
  if (/\s/u.test(trimmed)) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_MULTIWORD",
          `${path}.0`,
          "Shared word của Trios phải là đúng một từ, không chứa khoảng trắng.",
          "error",
        ),
      ],
    };
  }
  if (Array.from(trimmed).length > TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_TOO_LONG",
          `${path}.0`,
          `Shared word của Trios không được dài quá ${TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS} ký tự Unicode.`,
          "error",
        ),
      ],
    };
  }
  if (!/^\p{L}[\p{L}\p{M}]*(?:['’\-][\p{L}\p{M}]+)*$/u.test(trimmed)) {
    return {
      value: null,
      issues: [
        issue(
          "ACCEPTED_INVALID_WORD",
          `${path}.0`,
          "Shared word của Trios chỉ hỗ trợ chữ cái với dấu nháy hoặc gạch nối nằm giữa các phần từ.",
          "error",
        ),
      ],
    };
  }

  return { value: trimmed, issues: [] };
}

/**
 * Resolves the existing acceptedAnswers/accepted aliases without consulting
 * display fields or metadata.sharedWord. If both aliases exist, both must be
 * valid and must name the same trimmed word.
 */
export function validateTriosAnswer(answerValue: unknown): TriosAnswerResult {
  if (!isRecord(answerValue)) {
    return {
      valid: false,
      sharedAnswer: null,
      issues: [
        issue(
          "ANSWER_REQUIRED",
          "answer",
          "Trios cần answer dạng object với đúng một shared word.",
          "error",
        ),
      ],
    };
  }

  const aliases = (["acceptedAnswers", "accepted"] as const).filter((alias) =>
    Object.hasOwn(answerValue, alias),
  );
  if (aliases.length === 0) {
    return {
      valid: false,
      sharedAnswer: null,
      issues: [
        issue(
          "ACCEPTED_REQUIRED",
          "answer.acceptedAnswers",
          "Trios cần acceptedAnswers hoặc accepted với đúng một shared word.",
          "error",
        ),
      ],
    };
  }

  const results = aliases.map((alias) => ({
    alias,
    ...acceptedAliasValue(answerValue, alias),
  }));
  const issues = results.flatMap((result) => result.issues);
  const values = results.flatMap((result) =>
    result.value === null ? [] : [result.value],
  );
  if (
    issues.length === 0 &&
    values.length === 2 &&
    values[0] !== values[1]
  ) {
    issues.push(
      issue(
        "ACCEPTED_ALIAS_CONFLICT",
        "answer",
        "acceptedAnswers và accepted của Trios phải chứa cùng một shared word.",
        "error",
      ),
    );
  }

  return {
    valid: issues.length === 0,
    sharedAnswer: issues.length === 0 ? (values[0] ?? null) : null,
    issues,
  };
}

/**
 * Import normalization preserves extra answer fields and only canonicalizes a
 * valid supported alias. Invalid shapes remain visible to validation/review.
 */
export function normalizeTriosAnswer(answerValue: unknown): unknown {
  if (!isRecord(answerValue)) return answerValue;

  const normalized = { ...answerValue };
  for (const alias of ["acceptedAnswers", "accepted"] as const) {
    if (!Object.hasOwn(normalized, alias)) continue;
    const result = acceptedAliasValue(normalized, alias);
    if (result.issues.length === 0 && result.value !== null) {
      normalized[alias] = [result.value];
    }
  }

  if (
    !Object.hasOwn(normalized, "acceptedAnswers") &&
    Object.hasOwn(normalized, "accepted")
  ) {
    const accepted = acceptedAliasValue(normalized, "accepted");
    if (accepted.issues.length === 0 && accepted.value !== null) {
      normalized.acceptedAnswers = [accepted.value];
      if (typeof normalized.display !== "string") {
        normalized.display = accepted.value;
      }
    }
  }

  return normalized;
}

export function validateTriosContract(
  metadataValue: unknown,
  answerValue: unknown,
): TriosContractResult {
  const sentenceResult = validateTriosSentences(metadataValue);
  const answerResult = validateTriosAnswer(answerValue);
  const issues = [...sentenceResult.issues, ...answerResult.issues];
  const importDisposition = issues.some(
    (contractIssue) => contractIssue.importLevel === "error",
  )
    ? "error"
    : issues.length > 0
      ? "draft-warning"
      : "valid";

  return {
    valid: issues.length === 0,
    importDisposition,
    sentences: sentenceResult.sentences,
    sharedAnswer: answerResult.sharedAnswer,
    issues,
  };
}
