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
      <span className="whitespace-pre-line rounded-2xl bg-panel-muted p-4 text-sm font-medium leading-7">
        {question.prompt}
      </span>
      <input
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="field min-h-11"
        placeholder="Một từ chung"
      />
    </label>
  );
}
