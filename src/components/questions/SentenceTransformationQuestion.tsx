"use client";

import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function SentenceTransformationQuestion({ question, value, onChange, disabled }: Props) {
  return (
    <label className="grid gap-3">
      <span className="text-sm font-semibold leading-6 whitespace-pre-line">{question.prompt}</span>
      {question.keyword ? (
        <span className="inline-flex w-fit rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
          Keyword: {question.keyword}
        </span>
      ) : null}
      <textarea
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="min-h-28 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
        placeholder="Viết câu trả lời hoàn chỉnh"
      />
    </label>
  );
}
