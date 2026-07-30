"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { countWords } from "@/lib/writing-grader-shared";

type WritingValue = {
  thesis?: string;
  mainIdea1?: string;
  mainIdea2?: string;
  vocabulary?: string;
  essay?: string;
};

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: WritingValue) => void;
  disabled?: boolean;
};

export function WritingQuestion({ question, value, onChange, disabled }: Props) {
  const current = (value && typeof value === "object" ? value : {}) as WritingValue;
  const controlPrefix = `writing-${question.id}`;
  const essayWordCount = countWords(current.essay ?? "");
  const update = (patch: Partial<WritingValue>) => {
    if (disabled) return;
    onChange(question.id, { ...current, ...patch });
  };

  return (
    <div className="grid gap-4">
      <article className="rounded-2xl bg-panel-muted p-4 text-sm leading-7">{question.prompt}</article>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor={`${controlPrefix}-thesis`}>Luận điểm chính</label>
          <input
            id={`${controlPrefix}-thesis`}
            value={current.thesis ?? ""}
            disabled={disabled}
            onChange={(event) => update({ thesis: event.target.value })}
            className="field min-h-11"
          />
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor={`${controlPrefix}-main-idea-1`}>Ý chính 1</label>
          <input
            id={`${controlPrefix}-main-idea-1`}
            value={current.mainIdea1 ?? ""}
            disabled={disabled}
            onChange={(event) => update({ mainIdea1: event.target.value })}
            className="field min-h-11"
          />
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor={`${controlPrefix}-main-idea-2`}>Ý chính 2</label>
          <input
            id={`${controlPrefix}-main-idea-2`}
            value={current.mainIdea2 ?? ""}
            disabled={disabled}
            onChange={(event) => update({ mainIdea2: event.target.value })}
            className="field min-h-11"
          />
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor={`${controlPrefix}-vocabulary`}>Từ vựng dự định dùng</label>
          <input
            id={`${controlPrefix}-vocabulary`}
            value={current.vocabulary ?? ""}
            disabled={disabled}
            onChange={(event) => update({ vocabulary: event.target.value })}
            className="field min-h-11"
          />
        </div>
      </div>
      <div className="grid gap-2 text-sm font-medium">
        <label htmlFor={`${controlPrefix}-essay`}>Bài viết</label>
        <textarea
          id={`${controlPrefix}-essay`}
          value={current.essay ?? ""}
          disabled={disabled}
          onChange={(event) => update({ essay: event.target.value })}
          className="field min-h-56 p-3"
          placeholder="Viết bài luận tiếng Anh của bạn tại đây..."
          aria-describedby={`${controlPrefix}-essay-word-count`}
        />
        <p
          id={`${controlPrefix}-essay-word-count`}
          className="tabular-nums text-xs font-medium text-ink-soft"
        >
          Bài viết hiện có {essayWordCount} từ. Hãy tự rà soát nội dung trước khi gửi.
        </p>
      </div>
      <section
        aria-labelledby={`${controlPrefix}-rubric-heading`}
        className="rounded-2xl bg-panel p-4 shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <h3 id={`${controlPrefix}-rubric-heading`} className="text-sm font-semibold">
          Tiêu chí tự rà soát
        </h3>
        {question.writingRubric ? (
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-ink-soft sm:grid-cols-2">
            {question.writingRubric.criteria.map((criterion, index) => (
              <li key={`${index}-${criterion}`}>{criterion}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Người biên soạn chưa cung cấp bộ tiêu chí chi tiết cho đề này.
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-ink-soft">
          Các tiêu chí này dùng để tự rà soát, không phải đáp án hay điểm chấm tự động.
        </p>
      </section>
    </div>
  );
}
