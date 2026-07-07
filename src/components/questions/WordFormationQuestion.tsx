"use client";

import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function WordFormationQuestion({ question, value, onChange, disabled }: Props) {
  return (
    <label className="grid gap-3">
      <span className="text-sm font-semibold leading-6">{question.prompt}</span>
      <QuestionRootWord question={question} />
      <input
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="field min-h-11"
        placeholder="Nhập dạng từ đúng"
      />
    </label>
  );
}
