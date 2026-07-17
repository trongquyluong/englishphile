"use client";

import { Headphones } from "lucide-react";
import type { ClientQuestion } from "@/lib/problem-types";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function ListeningQuestion({ question, value, onChange, disabled }: Props) {
  return (
    <div className="grid gap-4 rounded-2xl bg-panel-muted p-4">
      <div className="flex items-center gap-2">
        <Headphones className="size-5 text-accent" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Listening</p>
          {question.sectionType ? <p className="text-xs text-ink-soft">{question.sectionType}</p> : null}
        </div>
      </div>

      {question.audioUrl ? (
        <audio controls src={question.audioUrl} className="w-full">
          Trình duyệt không hỗ trợ audio.
        </audio>
      ) : (
        <div className="rounded-2xl bg-panel px-3 py-3 text-sm text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">
          Audio sẽ được gắn ở metadata khi có nội dung nghe chính thức.
        </div>
      )}

      {question.type === "LISTENING_MCQ" ? (
        <MultipleChoiceQuestion question={question} value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <label className="grid gap-3">
          <span className="text-sm font-semibold leading-6 whitespace-pre-line">{question.prompt}</span>
          <input
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(question.id, event.target.value)}
            className="field min-h-11"
            placeholder="Nhập câu trả lời"
          />
        </label>
      )}

    </div>
  );
}
