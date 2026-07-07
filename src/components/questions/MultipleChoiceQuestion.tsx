"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { getOptions } from "@/components/questions/question-utils";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function MultipleChoiceQuestion({ question, value, onChange, disabled }: Props) {
  const options = getOptions(question.options);

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold leading-6">{question.prompt}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-panel px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,box-shadow] duration-150 hover:bg-accent-soft/40"
          >
            <input
              type="radio"
              name={question.id}
              value={option.id}
              checked={value === option.id}
              disabled={disabled}
              onChange={() => onChange(question.id, option.id)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-semibold">{option.id}.</span> {option.text}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
