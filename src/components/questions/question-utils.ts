import type { Option } from "@/lib/problem-types";

export function getOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const option = item as Record<string, unknown>;
      return {
        id: String(option.id ?? ""),
        text: String(option.text ?? ""),
      };
    })
    .filter((item): item is Option => Boolean(item?.id));
}

export function getAnswerNote(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const answer = value as Record<string, unknown>;
  return {
    note: typeof answer.note === "string" ? answer.note : null,
    wordClass: typeof answer.wordClass === "string" ? answer.wordClass : null,
    correctForm: typeof answer.correctForm === "string" ? answer.correctForm : null,
    modelAnswer: typeof answer.modelAnswer === "string" ? answer.modelAnswer : null,
    rubric: Array.isArray(answer.rubric) ? answer.rubric.map(String) : [],
  };
}
