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
  const hasRenderableParts = options.length === 4;
  const controlPrefix = `error-identification-${question.id}`;

  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold leading-6">{question.prompt}</p>
      {hasRenderableParts ? (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Chọn phần có lỗi</legend>
          {options.map((option) => {
            const inputId = `${controlPrefix}-part-${option.id}`;
            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-panel px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-150 hover:bg-accent-soft/40"
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${controlPrefix}-part`}
                  aria-label={`Phần ${option.id}: ${option.text}`}
                  checked={current.part === option.id}
                  disabled={disabled}
                  onChange={() => {
                    if (disabled) return;
                    onChange(question.id, { ...current, part: option.id });
                  }}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-semibold">{option.id}.</span> {option.text}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <p role="status" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Câu hỏi này chưa có đủ bốn phần A–D để hiển thị.
        </p>
      )}
      <label
        htmlFor={`${controlPrefix}-correction`}
        className="grid gap-2 text-sm font-medium"
      >
        Phần sửa
        <input
          id={`${controlPrefix}-correction`}
          value={current.correction ?? ""}
          disabled={disabled}
          onChange={(event) => {
            if (disabled) return;
            onChange(question.id, {
              ...current,
              correction: event.target.value,
            });
          }}
          className="field min-h-11"
          placeholder="Viết dạng đúng"
        />
      </label>
    </div>
  );
}
