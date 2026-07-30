export const PRONUNCIATION_OPTION_IDS = ["A", "B", "C", "D"] as const;
export const PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS = 200;

export type PronunciationOptionId =
  (typeof PRONUNCIATION_OPTION_IDS)[number];

export type PronunciationTargetSpan = {
  start: number;
  end: number;
};

export type SafePronunciationOption = {
  id: PronunciationOptionId;
  text: string;
  targetSpan: PronunciationTargetSpan;
};

export type PronunciationContractIssueCode =
  | "OPTIONS_REQUIRED"
  | "OPTION_COUNT_NOT_FOUR"
  | "INVALID_OPTION_ID"
  | "DUPLICATE_OPTION_ID"
  | "MISSING_CANONICAL_OPTION_ID"
  | "INVALID_OPTION_TEXT"
  | "OPTION_TEXT_TOO_LONG"
  | "TARGET_SPAN_REQUIRED"
  | "TARGET_SPAN_INVALID_OBJECT"
  | "TARGET_SPAN_START_REQUIRED"
  | "TARGET_SPAN_END_REQUIRED"
  | "TARGET_SPAN_START_INVALID"
  | "TARGET_SPAN_END_INVALID"
  | "TARGET_SPAN_RANGE_INVALID"
  | "TARGET_SPAN_WITHOUT_LETTER"
  | "ANSWER_REQUIRED"
  | "CORRECT_OPTION_REQUIRED"
  | "CORRECT_OPTION_INVALID"
  | "CORRECT_OPTION_NOT_IN_OPTIONS";

export type PronunciationContractIssue = {
  code: PronunciationContractIssueCode;
  path: string;
  message: string;
  importLevel: "error" | "warning";
};

export type PronunciationOptionsResult = {
  valid: boolean;
  options: SafePronunciationOption[];
  issues: PronunciationContractIssue[];
};

export type PronunciationAnswerResult = {
  valid: boolean;
  correctOptionId: PronunciationOptionId | null;
  issues: PronunciationContractIssue[];
};

export type PronunciationContractResult = {
  valid: boolean;
  importDisposition: "valid" | "draft-warning" | "error";
  options: SafePronunciationOption[];
  correctOptionId: PronunciationOptionId | null;
  issues: PronunciationContractIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function issue(
  code: PronunciationContractIssueCode,
  path: string,
  message: string,
  importLevel: "error" | "warning",
): PronunciationContractIssue {
  return { code, path, message, importLevel };
}

export function canonicalizePronunciationOptionId(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() || null : null;
}

export function isPronunciationOptionId(
  value: unknown,
): value is PronunciationOptionId {
  return (
    typeof value === "string" &&
    PRONUNCIATION_OPTION_IDS.includes(value as PronunciationOptionId)
  );
}

/**
 * Import-only alias normalization. It preserves option text and targetSpan
 * values exactly, never creates a span, and never mutates the caller's data.
 */
export function normalizePronunciationOptions(value: unknown): unknown {
  if (!Array.isArray(value)) return value ?? null;

  return value.map((rawOption) => {
    if (!isRecord(rawOption)) return rawOption;
    const sourceId =
      typeof rawOption.id === "string"
        ? rawOption.id
        : typeof rawOption.label === "string"
          ? rawOption.label
          : null;
    return {
      ...rawOption,
      ...(sourceId === null
        ? {}
        : { id: canonicalizePronunciationOptionId(sourceId) ?? "" }),
    };
  });
}

/**
 * Import-only answer alias normalization. `accepted`, `display`, and metadata
 * are deliberately ignored. No missing answer is synthesized.
 */
export function normalizePronunciationAnswer(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const normalized = { ...value };
  if (
    typeof normalized.correctOptionId !== "string" &&
    typeof normalized.correctOption === "string"
  ) {
    normalized.correctOptionId = normalized.correctOption;
  }
  if (typeof normalized.correctOptionId === "string") {
    normalized.correctOptionId =
      canonicalizePronunciationOptionId(normalized.correctOptionId) ?? "";
  }
  return normalized;
}

export function pronunciationCodePoints(text: string) {
  return Array.from(text);
}

/**
 * Slice with the contract's zero-based, half-open Unicode code-point model.
 * Combining marks are separate code points; this does not use UTF-16 offsets
 * or infer grapheme-cluster boundaries.
 */
export function slicePronunciationText(
  text: string,
  span: PronunciationTargetSpan,
) {
  const codePoints = pronunciationCodePoints(text);
  return {
    prefix: codePoints.slice(0, span.start).join(""),
    target: codePoints.slice(span.start, span.end).join(""),
    suffix: codePoints.slice(span.end).join(""),
  };
}

function validateTargetSpan(
  rawSpan: unknown,
  text: string | null,
  path: string,
): { span: PronunciationTargetSpan | null; issues: PronunciationContractIssue[] } {
  if (rawSpan === null || rawSpan === undefined) {
    return {
      span: null,
      issues: [
        issue(
          "TARGET_SPAN_REQUIRED",
          path,
          "Mỗi lựa chọn Pronunciation cần targetSpan với start và end.",
          "warning",
        ),
      ],
    };
  }
  if (!isRecord(rawSpan)) {
    return {
      span: null,
      issues: [
        issue(
          "TARGET_SPAN_INVALID_OBJECT",
          path,
          "targetSpan phải là object với start và end.",
          "warning",
        ),
      ],
    };
  }

  const issues: PronunciationContractIssue[] = [];
  const start = rawSpan.start;
  const end = rawSpan.end;
  if (!Object.hasOwn(rawSpan, "start")) {
    issues.push(
      issue(
        "TARGET_SPAN_START_REQUIRED",
        `${path}.start`,
        "targetSpan.start là bắt buộc.",
        "warning",
      ),
    );
  } else if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    !Number.isInteger(start)
  ) {
    issues.push(
      issue(
        "TARGET_SPAN_START_INVALID",
        `${path}.start`,
        "targetSpan.start phải là số nguyên hữu hạn.",
        "warning",
      ),
    );
  }
  if (!Object.hasOwn(rawSpan, "end")) {
    issues.push(
      issue(
        "TARGET_SPAN_END_REQUIRED",
        `${path}.end`,
        "targetSpan.end là bắt buộc.",
        "warning",
      ),
    );
  } else if (
    typeof end !== "number" ||
    !Number.isFinite(end) ||
    !Number.isInteger(end)
  ) {
    issues.push(
      issue(
        "TARGET_SPAN_END_INVALID",
        `${path}.end`,
        "targetSpan.end phải là số nguyên hữu hạn.",
        "warning",
      ),
    );
  }

  if (
    issues.length === 0 &&
    typeof start === "number" &&
    typeof end === "number" &&
    text !== null
  ) {
    const codePoints = pronunciationCodePoints(text);
    if (start < 0 || start >= end || end > codePoints.length) {
      issues.push(
        issue(
          "TARGET_SPAN_RANGE_INVALID",
          path,
          "targetSpan phải thỏa 0 <= start < end <= độ dài Unicode của text.",
          "warning",
        ),
      );
    } else {
      const target = codePoints.slice(start, end).join("");
      if (!/\p{L}/u.test(target)) {
        issues.push(
          issue(
            "TARGET_SPAN_WITHOUT_LETTER",
            path,
            "Phần được chọn phải chứa ít nhất một chữ cái Unicode.",
            "warning",
          ),
        );
      }
    }
  }

  return {
    span:
      issues.length === 0 &&
      typeof start === "number" &&
      typeof end === "number" &&
      text !== null
        ? { start, end }
        : null,
    issues,
  };
}

/**
 * Complete learner-rendering contract. Text is limited to 200 Unicode code
 * points to bound DTO/rendering work while comfortably covering a displayed
 * pronunciation option. Original string content is preserved; it is not
 * trimmed, stringified, repaired, clamped, or inferred.
 */
export function validatePronunciationOptions(
  value: unknown,
): PronunciationOptionsResult {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      options: [],
      issues: [
        issue(
          "OPTIONS_REQUIRED",
          "options",
          "Pronunciation cần đúng bốn lựa chọn A, B, C và D.",
          "warning",
        ),
      ],
    };
  }

  const issues: PronunciationContractIssue[] = [];
  if (value.length !== PRONUNCIATION_OPTION_IDS.length) {
    issues.push(
      issue(
        "OPTION_COUNT_NOT_FOUR",
        "options",
        "Pronunciation cần đúng bốn lựa chọn.",
        "warning",
      ),
    );
  }

  const candidates: SafePronunciationOption[] = [];
  const canonicalIds: string[] = [];
  value.forEach((rawOption, index) => {
    const option = isRecord(rawOption) ? rawOption : {};
    const canonicalId = canonicalizePronunciationOptionId(option.id);
    const optionPath = `options.${index}`;

    if (!canonicalId || !isPronunciationOptionId(canonicalId)) {
      issues.push(
        issue(
          "INVALID_OPTION_ID",
          `${optionPath}.id`,
          "Mã lựa chọn Pronunciation phải là A, B, C hoặc D.",
          "warning",
        ),
      );
    } else {
      canonicalIds.push(canonicalId);
    }

    const text = typeof option.text === "string" ? option.text : null;
    if (text === null || !text.trim()) {
      issues.push(
        issue(
          "INVALID_OPTION_TEXT",
          `${optionPath}.text`,
          "Mỗi lựa chọn Pronunciation phải có text dạng chuỗi và không để trống.",
          "warning",
        ),
      );
    } else if (
      pronunciationCodePoints(text).length >
      PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS
    ) {
      issues.push(
        issue(
          "OPTION_TEXT_TOO_LONG",
          `${optionPath}.text`,
          `Text của lựa chọn Pronunciation không được dài quá ${PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS} ký tự Unicode.`,
          "warning",
        ),
      );
    }

    const spanResult = validateTargetSpan(
      Object.hasOwn(option, "targetSpan") ? option.targetSpan : undefined,
      text,
      `${optionPath}.targetSpan`,
    );
    issues.push(...spanResult.issues);
    if (
      canonicalId &&
      isPronunciationOptionId(canonicalId) &&
      text !== null &&
      text.trim() &&
      pronunciationCodePoints(text).length <=
        PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS &&
      spanResult.span
    ) {
      candidates.push({
        id: canonicalId,
        text,
        targetSpan: spanResult.span,
      });
    }
  });

  if (new Set(canonicalIds).size !== canonicalIds.length) {
    issues.push(
      issue(
        "DUPLICATE_OPTION_ID",
        "options",
        "Mỗi mã A, B, C và D chỉ được xuất hiện một lần.",
        "warning",
      ),
    );
  }
  const missingIds = PRONUNCIATION_OPTION_IDS.filter(
    (id) => !canonicalIds.includes(id),
  );
  if (missingIds.length > 0) {
    issues.push(
      issue(
        "MISSING_CANONICAL_OPTION_ID",
        "options",
        `Thiếu mã lựa chọn bắt buộc: ${missingIds.join(", ")}.`,
        "warning",
      ),
    );
  }

  if (issues.length > 0) {
    return { valid: false, options: [], issues };
  }
  return {
    valid: true,
    options: PRONUNCIATION_OPTION_IDS.flatMap((id) =>
      candidates.filter((candidate) => candidate.id === id),
    ),
    issues: [],
  };
}

function declaredPronunciationOptionIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawOption) => {
    if (!isRecord(rawOption)) return [];
    const id = canonicalizePronunciationOptionId(rawOption.id);
    return id && isPronunciationOptionId(id) ? [id] : [];
  });
}

export function validatePronunciationAnswer(
  answerValue: unknown,
  optionsValue: unknown,
): PronunciationAnswerResult {
  if (!isRecord(answerValue)) {
    return {
      valid: false,
      correctOptionId: null,
      issues: [
        issue(
          "ANSWER_REQUIRED",
          "answer",
          "Pronunciation cần answer dạng object với correctOptionId.",
          "error",
        ),
      ],
    };
  }

  const rawAnswer = answerValue.correctOptionId;
  if (typeof rawAnswer === "string" && !rawAnswer.trim()) {
    return {
      valid: false,
      correctOptionId: null,
      issues: [
        issue(
          "CORRECT_OPTION_REQUIRED",
          "answer.correctOptionId",
          "correctOptionId của Pronunciation không được để trống.",
          "error",
        ),
      ],
    };
  }
  if (typeof rawAnswer !== "string") {
    return {
      valid: false,
      correctOptionId: null,
      issues: [
        issue(
          "CORRECT_OPTION_REQUIRED",
          "answer.correctOptionId",
          "Pronunciation cần correctOptionId dạng chuỗi.",
          "error",
        ),
      ],
    };
  }

  const correctOptionId = canonicalizePronunciationOptionId(rawAnswer);
  if (!correctOptionId || !isPronunciationOptionId(correctOptionId)) {
    return {
      valid: false,
      correctOptionId: null,
      issues: [
        issue(
          "CORRECT_OPTION_INVALID",
          "answer.correctOptionId",
          "correctOptionId của Pronunciation phải là A, B, C hoặc D.",
          "error",
        ),
      ],
    };
  }

  const declaredIds = declaredPronunciationOptionIds(optionsValue);
  if (
    declaredIds.length > 0 &&
    !declaredIds.includes(correctOptionId)
  ) {
    return {
      valid: false,
      correctOptionId,
      issues: [
        issue(
          "CORRECT_OPTION_NOT_IN_OPTIONS",
          "answer.correctOptionId",
          "correctOptionId phải thuộc bốn lựa chọn Pronunciation đã khai báo.",
          "error",
        ),
      ],
    };
  }

  return { valid: true, correctOptionId, issues: [] };
}

export function validatePronunciationContract(
  optionsValue: unknown,
  answerValue: unknown,
): PronunciationContractResult {
  const optionResult = validatePronunciationOptions(optionsValue);
  const answerResult = validatePronunciationAnswer(answerValue, optionsValue);
  const issues = [...optionResult.issues, ...answerResult.issues];
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
    options: issues.length === 0 ? optionResult.options : [],
    correctOptionId: answerResult.correctOptionId,
    issues,
  };
}
