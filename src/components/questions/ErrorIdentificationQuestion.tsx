"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { getOptions } from "@/components/questions/question-utils";

type ErrorValue = {
  part?: string;
  correction?: string;
};

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: ErrorValue) => void;
  disabled?: boolean;
};

export function ErrorIdentificationQuestion({ question, value, onChange, disabled }: Props) {
  const options = getOptions(question.options);
  const current = (value && typeof value === "object" ? value : {}) as ErrorValue;

  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold leading-6">{question.prompt}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]"
          >
            <input
              type="radio"
              name={`${question.id}-part`}
              checked={current.part === option.id}
              disabled={disabled}
              onChange={() => onChange(question.id, { ...current, part: option.id })}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-semibold">{option.id}.</span> {option.text}
            </span>
          </label>
        ))}
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Phần sửa
        <input
          value={current.correction ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(question.id, { ...current, correction: event.target.value })}
          className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
          placeholder="Viết dạng đúng"
        />
      </label>
    </div>
  );
}
