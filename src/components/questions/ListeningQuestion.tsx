"use client";

import { Headphones } from "lucide-react";
import type { ClientQuestion } from "@/lib/problem-types";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";

type ListeningMetadata = {
  audioUrl?: string;
  transcript?: string;
  sectionType?: string;
};

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

function getMetadata(value: unknown): ListeningMetadata {
  if (!value || typeof value !== "object") return {};
  const metadata = value as Record<string, unknown>;
  return {
    audioUrl: typeof metadata.audioUrl === "string" ? metadata.audioUrl : undefined,
    transcript: typeof metadata.transcript === "string" ? metadata.transcript : undefined,
    sectionType: typeof metadata.sectionType === "string" ? metadata.sectionType : undefined,
  };
}

export function ListeningQuestion({ question, value, onChange, disabled }: Props) {
  const metadata = getMetadata(question.metadata);

  return (
    <div className="grid gap-4 rounded-lg bg-panel-muted p-4">
      <div className="flex items-center gap-2">
        <Headphones className="size-5 text-accent" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Listening</p>
          {metadata.sectionType ? <p className="text-xs text-ink-soft">{metadata.sectionType}</p> : null}
        </div>
      </div>

      {metadata.audioUrl ? (
        <audio controls src={metadata.audioUrl} className="w-full">
          Trình duyệt không hỗ trợ audio.
        </audio>
      ) : (
        <div className="rounded-md bg-white px-3 py-3 text-sm text-ink-soft shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]">
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
            className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
            placeholder="Nhập câu trả lời"
          />
        </label>
      )}

      {metadata.transcript ? (
        <details className="rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]">
          <summary className="cursor-pointer font-semibold">Xem transcript</summary>
          <p className="mt-2 whitespace-pre-line leading-6 text-ink-soft">{metadata.transcript}</p>
        </details>
      ) : null}
    </div>
  );
}
