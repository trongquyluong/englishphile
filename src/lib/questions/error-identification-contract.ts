export const ERROR_IDENTIFICATION_PART_IDS = ["A", "B", "C", "D"] as const;

export const ERROR_IDENTIFICATION_CORRECTION_LIMITS = {
  maxVariants: 8,
  maxVariantLength: 240,
  maxTotalLength: 1_000,
} as const;

export type ErrorIdentificationOption = {
  id: string;
  text: string;
};

export type ErrorIdentificationPartId =
  (typeof ERROR_IDENTIFICATION_PART_IDS)[number];

export type ErrorIdentificationContractIssueCode =
  | "OPTIONS_REQUIRED"
  | "OPTION_COUNT_NOT_FOUR"
  | "INVALID_OPTION_ID"
  | "DUPLICATE_OPTION_ID"
  | "MISSING_CANONICAL_OPTION_ID"
  | "INVALID_OPTION_TEXT"
  | "CORRECT_PART_REQUIRED"
  | "CORRECT_PART_INVALID"
  | "CORRECT_PART_NOT_IN_OPTIONS"
  | "CORRECTION_REQUIRED"
  | "CORRECTION_EMPTY_VARIANT"
  | "CORRECTION_TOO_LONG"
  | "TOO_MANY_CORRECTION_VARIANTS"
  | "CORRECTION_VARIANT_TOO_LONG";

export type ErrorIdentificationContractIssue = {
  code: ErrorIdentificationContractIssueCode;
  path: string;
  message: string;
  importLevel: "error" | "warning";
};

export type ErrorIdentificationContractResult = {
  valid: boolean;
  importDisposition: "valid" | "draft-warning" | "error";
  options: ErrorIdentificationOption[];
  correctPart: string | null;
  correctionVariants: string[];
  issues: ErrorIdentificationContractIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function visiblePrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

export function canonicalizeErrorIdentificationPart(value: unknown) {
  const visible = visiblePrimitive(value);
  return visible?.trim().toUpperCase() || null;
}

export function isErrorIdentificationPartId(
  value: unknown,
): value is ErrorIdentificationPartId {
  return (
    typeof value === "string" &&
    ERROR_IDENTIFICATION_PART_IDS.includes(value as ErrorIdentificationPartId)
  );
}

function issue(
  code: ErrorIdentificationContractIssueCode,
  path: string,
  message: string,
  importLevel: "error" | "warning",
): ErrorIdentificationContractIssue {
  return { code, path, message, importLevel };
}

/**
 * Import-only normalization for the option aliases and primitive values the
 * existing JSON/CSV pipeline already supports. Invalid values are preserved so
 * admin review can see and repair them; no option part is synthesized.
 */
export function normalizeErrorIdentificationOptions(value: unknown): unknown {
  if (!Array.isArray(value)) return value ?? null;

  return value.map((rawOption) => {
    if (!isRecord(rawOption)) return rawOption;
    const rawId =
      visiblePrimitive(rawOption.id) ??
      (typeof rawOption.label === "string" ? rawOption.label : null);
    const rawText = visiblePrimitive(rawOption.text);
    return {
      ...rawOption,
      ...(rawId === null
        ? {}
        : { id: canonicalizeErrorIdentificationPart(rawId) ?? "" }),
      ...(rawText === null ? {} : { text: rawText }),
    };
  });
}

/**
 * Pure renderer/persistence option contract. It accepts only the primitive
 * id/text representations used by the learner DTO and returns canonical IDs.
 */
export function validateErrorIdentificationOptions(
  value: unknown,
): Pick<ErrorIdentificationContractResult, "valid" | "options" | "issues"> {
  const issues: ErrorIdentificationContractIssue[] = [];
  if (!Array.isArray(value)) {
    return {
      valid: false,
      options: [],
      issues: [
        issue(
          "OPTIONS_REQUIRED",
          "options",
          "Error Identification cần đúng bốn phần lựa chọn A, B, C và D.",
          "warning",
        ),
      ],
    };
  }

  if (value.length !== ERROR_IDENTIFICATION_PART_IDS.length) {
    issues.push(
      issue(
        "OPTION_COUNT_NOT_FOUR",
        "options",
        "Error Identification cần đúng bốn phần lựa chọn.",
        "warning",
      ),
    );
  }

  const options: ErrorIdentificationOption[] = [];
  const canonicalIds: string[] = [];
  value.forEach((rawOption, index) => {
    const option = isRecord(rawOption) ? rawOption : {};
    const canonicalId = canonicalizeErrorIdentificationPart(option.id);
    const rawText = visiblePrimitive(option.text);

    if (
      !canonicalId ||
      !isErrorIdentificationPartId(canonicalId)
    ) {
      issues.push(
        issue(
          "INVALID_OPTION_ID",
          `options.${index}.id`,
          "Mã phần phải là A, B, C hoặc D.",
          "warning",
        ),
      );
    } else {
      canonicalIds.push(canonicalId);
    }

    if (rawText === null || !rawText.trim()) {
      issues.push(
        issue(
          "INVALID_OPTION_TEXT",
          `options.${index}.text`,
          "Mỗi phần phải có nội dung hiển thị cho người học.",
          "warning",
        ),
      );
    }

    if (canonicalId && rawText !== null) {
      options.push({ id: canonicalId, text: rawText });
    }
  });

  if (new Set(canonicalIds).size !== canonicalIds.length) {
    issues.push(
      issue(
        "DUPLICATE_OPTION_ID",
        "options",
        "Mỗi mã phần A, B, C và D chỉ được xuất hiện một lần.",
        "warning",
      ),
    );
  }

  const missingIds = ERROR_IDENTIFICATION_PART_IDS.filter(
    (id) => !canonicalIds.includes(id),
  );
  if (missingIds.length > 0) {
    issues.push(
      issue(
        "MISSING_CANONICAL_OPTION_ID",
        "options",
        `Thiếu mã phần bắt buộc: ${missingIds.join(", ")}.`,
        "warning",
      ),
    );
  }

  const canonicalOptions = ERROR_IDENTIFICATION_PART_IDS.flatMap((partId) =>
    options.filter((option) => option.id === partId),
  );
  return {
    valid: issues.length === 0,
    options: canonicalOptions,
    issues,
  };
}

/**
 * Normalize the currently supported `errorPart` import alias into the
 * canonical `correctPart` field. Slash-delimited correction alternatives stay
 * in the existing `correction` string field.
 */
export function normalizeErrorIdentificationAnswer(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const { errorPart, ...normalized } = value;
  if (
    typeof normalized.correctPart !== "string" &&
    typeof errorPart === "string"
  ) {
    normalized.correctPart = errorPart;
  }
  if (typeof normalized.correctPart === "string") {
    normalized.correctPart =
      canonicalizeErrorIdentificationPart(normalized.correctPart) ?? "";
  }
  if (typeof normalized.correction === "string") {
    normalized.correction = normalized.correction.trim();
  }
  return normalized;
}

export function parseErrorIdentificationCorrectionVariants(value: unknown) {
  if (typeof value !== "string") return [];
  return value.split("/").map((variant) => variant.trim());
}

export function validateErrorIdentificationContract(
  optionsValue: unknown,
  answerValue: unknown,
): ErrorIdentificationContractResult {
  const optionResult = validateErrorIdentificationOptions(optionsValue);
  const issues = [...optionResult.issues];
  const answer = isRecord(answerValue) ? answerValue : {};
  const correctPart = canonicalizeErrorIdentificationPart(answer.correctPart);

  if (
    typeof answer.correctPart !== "string" ||
    !answer.correctPart.trim()
  ) {
    issues.push(
      issue(
        "CORRECT_PART_REQUIRED",
        "answer.correctPart",
        "Error Identification cần correctPart.",
        "error",
      ),
    );
  } else if (
    !correctPart ||
    !isErrorIdentificationPartId(correctPart)
  ) {
    issues.push(
      issue(
        "CORRECT_PART_INVALID",
        "answer.correctPart",
        "correctPart phải là A, B, C hoặc D.",
        "warning",
      ),
    );
  } else if (!optionResult.options.some((option) => option.id === correctPart)) {
    issues.push(
      issue(
        "CORRECT_PART_NOT_IN_OPTIONS",
        "answer.correctPart",
        "correctPart phải thuộc bốn phần lựa chọn đã khai báo.",
        "warning",
      ),
    );
  }

  const correction = answer.correction;
  const correctionVariants = parseErrorIdentificationCorrectionVariants(correction);
  if (typeof correction !== "string" || !correction.trim()) {
    issues.push(
      issue(
        "CORRECTION_REQUIRED",
        "answer.correction",
        "Error Identification cần correction không để trống.",
        "error",
      ),
    );
  } else {
    if (correction.length > ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxTotalLength) {
      issues.push(
        issue(
          "CORRECTION_TOO_LONG",
          "answer.correction",
          `Correction không được dài quá ${ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxTotalLength} ký tự.`,
          "error",
        ),
      );
    }
    if (correctionVariants.some((variant) => !variant)) {
      issues.push(
        issue(
          "CORRECTION_EMPTY_VARIANT",
          "answer.correction",
          "Các correction phân tách bằng dấu / đều phải có nội dung.",
          "error",
        ),
      );
    }
    if (
      correctionVariants.length >
      ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariants
    ) {
      issues.push(
        issue(
          "TOO_MANY_CORRECTION_VARIANTS",
          "answer.correction",
          `Chỉ hỗ trợ tối đa ${ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariants} correction phân tách bằng dấu /.`,
          "error",
        ),
      );
    }
    if (
      correctionVariants.some(
        (variant) =>
          variant.length >
          ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariantLength,
      )
    ) {
      issues.push(
        issue(
          "CORRECTION_VARIANT_TOO_LONG",
          "answer.correction",
          `Mỗi correction không được dài quá ${ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariantLength} ký tự.`,
          "error",
        ),
      );
    }
  }

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
    options: optionResult.options,
    correctPart,
    correctionVariants: correctionVariants.filter(Boolean),
    issues,
  };
}
