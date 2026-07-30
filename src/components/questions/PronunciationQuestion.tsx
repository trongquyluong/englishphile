"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import {
  slicePronunciationText,
  validatePronunciationOptions,
} from "@/lib/questions/pronunciation-contract";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function PronunciationQuestion({
  question,
  value,
  onChange,
  disabled,
}: Props) {
  const contract = validatePronunciationOptions(question.options);
  const groupName = `pronunciation-${question.id}`;

  return (
    <div className="grid gap-2">
      <p className="rounded-md bg-panel-muted px-3 py-2 text-sm text-ink-soft">
        Chọn từ có phần gạch chân phát âm khác các từ còn lại.
      </p>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold leading-6">
          {question.prompt}
        </legend>
        {!contract.valid ? (
          <p
            role="status"
            className="rounded-2xl bg-panel px-4 py-3 text-sm text-ink-soft shadow-[inset_0_0_0_1px_var(--line-strong)]"
          >
            Câu phát âm này chưa có đủ dữ liệu gạch chân hợp lệ để hiển thị.
          </p>
        ) : (
          <div className="grid gap-2">
            {contract.options.map((option) => {
              const controlId = `${groupName}-${option.id}`;
              const parts = slicePronunciationText(
                option.text,
                option.targetSpan,
              );
              return (
                <label
                  key={option.id}
                  htmlFor={controlId}
                  aria-label={`Lựa chọn ${option.id}: ${option.text}. Phần gạch chân: ${parts.target}.`}
                  className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-panel px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,box-shadow] duration-150 hover:bg-accent-soft/40"
                >
                  <input
                    id={controlId}
                    type="radio"
                    name={groupName}
                    value={option.id}
                    checked={value === option.id}
                    disabled={disabled}
                    onChange={() => {
                      if (disabled) return;
                      onChange(question.id, option.id);
                    }}
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-semibold">{option.id}.</span>{" "}
                    <span>{parts.prefix}</span>
                    <span className="underline decoration-2 underline-offset-4">
                      {parts.target}
                    </span>
                    <span>{parts.suffix}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}
