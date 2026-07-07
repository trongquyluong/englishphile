"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { getAnswerNote } from "@/components/questions/question-utils";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function WordFormationQuestion({ question, value, onChange, disabled }: Props) {
  const note = getAnswerNote(question.answer);

  return (
    <label className="grid gap-3">
      <span className="text-sm font-semibold leading-6">{question.prompt}</span>
      <span className="inline-flex w-fit rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
        Root word: {question.rootWord ?? note?.correctForm ?? "—"}
      </span>
      <input
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
        placeholder="Nhập dạng từ đúng"
      />
    </label>
  );
}
