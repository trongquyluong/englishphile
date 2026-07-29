"use client";

import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function TriosQuestion({ question, value, onChange, disabled }: Props) {
  const inputId = `trios-${question.id}-shared-word`;
  const promptId = `trios-${question.id}-prompt`;
  const sentencesId = `trios-${question.id}-sentences`;
  const sentences = question.triosSentences;

  return (
    <section
      aria-labelledby={promptId}
      className="grid gap-4"
    >
      <p
        id={promptId}
        className="rounded-2xl bg-panel-muted p-4 text-sm font-medium leading-7"
      >
        {question.prompt}
      </p>
      {sentences ? (
        <>
          <ol id={sentencesId} className="grid list-decimal gap-3 pl-6">
            {sentences.map((sentence, index) => (
              <li
                key={`${question.id}-sentence-${index + 1}`}
                className="rounded-2xl bg-panel px-4 py-3 text-sm leading-7 shadow-[inset_0_0_0_1px_var(--line-strong)]"
              >
                {sentence}
              </li>
            ))}
          </ol>
          <label
            htmlFor={inputId}
            className="grid gap-2 text-sm font-medium"
          >
            Từ chung cho cả ba câu
            <input
              id={inputId}
              aria-describedby={sentencesId}
              value={typeof value === "string" ? value : ""}
              disabled={disabled}
              onChange={(event) => {
                if (disabled) return;
                onChange(question.id, event.target.value);
              }}
              className="field min-h-11"
              placeholder="Nhập một từ"
            />
          </label>
        </>
      ) : (
        <p
          role="status"
          className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          Câu hỏi này chưa có đủ ba câu hợp lệ để hiển thị.
        </p>
      )}
    </section>
  );
}
