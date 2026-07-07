"use client";

import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function TriosQuestion({ question, value, onChange, disabled }: Props) {
  return (
    <label className="grid gap-3">
      <span className="whitespace-pre-line rounded-lg bg-panel-muted p-4 text-sm font-medium leading-7">
        {question.prompt}
      </span>
      <input
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
        placeholder="Một từ chung"
      />
    </label>
  );
}
