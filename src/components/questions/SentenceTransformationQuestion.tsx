"use client";

import { cn } from "@/lib/utils";
import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function SentenceTransformationQuestion({ question, value, onChange, disabled }: Props) {
  const { keyword, targetSentence } = question;

  const placeholder = keyword || targetSentence
    ? "Nhập câu viết lại hoàn chỉnh, dùng từ cho sẵn."
    : "Nhập câu viết lại hoàn chỉnh, đảm bảo nghĩa tương đương.";

  return (
    <label className="grid gap-3">
      {/* Task label */}
      <span className="text-xs font-semibold uppercase tracking-wide text-accent">Viết lại câu — giữ nghĩa, không thêm thông tin</span>

      {/* Original sentence */}
      <span className="text-sm font-semibold leading-6 whitespace-pre-line">{question.prompt}</span>

      {/* Keyword */}
      {keyword ? (
        <span className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-md bg-panel-muted px-3 py-1.5 text-sm font-semibold text-ink-soft",
        )}>
          <span className="text-xs font-normal uppercase tracking-wide">Từ bắt buộc</span>
          <span className="font-bold">{keyword}</span>
        </span>
      ) : null}

      {/* Given beginning / target sentence */}
      {targetSentence ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-panel-muted px-3 py-1.5 text-sm font-semibold text-ink-soft">
          <span className="text-xs font-normal uppercase tracking-wide">Bắt đầu bằng</span>
          <span className="font-normal italic">{targetSentence}</span>
        </span>
      ) : null}

      {/* Instruction when nothing given */}
      {!keyword && !targetSentence ? (
        <p className="text-xs leading-5 text-ink-soft">
          Nếu đề không cho từ bắt buộc hoặc phần mở đầu, hãy nhập cả câu hoàn chỉnh sao cho nghĩa tương đương.
        </p>
      ) : null}

      <textarea
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(question.id, event.target.value)}
        className="min-h-28 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
        placeholder={placeholder}
      />
    </label>
  );
}
