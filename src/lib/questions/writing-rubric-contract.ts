export const WRITING_RUBRIC_LIMITS = {
  maxCriteria: 12,
  maxCriterionLength: 240,
} as const;

export type WritingRubricPresentation = {
  criteria: string[];
};

function ownDataProperty(
  value: unknown,
  key: string,
): { found: boolean; value?: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { found: false };
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) {
    return { found: false };
  }

  return { found: true, value: descriptor.value };
}

/**
 * Projects the authored `Question.answer.rubric` string array into the only
 * rubric shape allowed to reach learner rendering. Invalid rubrics fail closed
 * as a whole; no answer sibling, metadata, explanation, or repair field is
 * copied.
 */
export function projectWritingRubric(
  answer: unknown,
): WritingRubricPresentation | null {
  const rubricProperty = ownDataProperty(answer, "rubric");
  if (!rubricProperty.found || !Array.isArray(rubricProperty.value)) {
    return null;
  }

  const rubric = rubricProperty.value;
  if (
    rubric.length === 0 ||
    rubric.length > WRITING_RUBRIC_LIMITS.maxCriteria
  ) {
    return null;
  }

  const criteria: string[] = [];
  for (const criterion of rubric) {
    if (typeof criterion !== "string") return null;
    const trimmed = criterion.trim();
    if (
      !trimmed ||
      trimmed.length > WRITING_RUBRIC_LIMITS.maxCriterionLength
    ) {
      return null;
    }
    criteria.push(trimmed);
  }

  return { criteria };
}
