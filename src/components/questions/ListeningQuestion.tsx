"use client";

import { Headphones } from "lucide-react";
import type { ClientQuestion } from "@/lib/problem-types";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

const UNAVAILABLE_NOTICE =
  "Nội dung nghe chưa sẵn sàng. Bạn chưa thể trả lời câu hỏi này.";

export function ListeningQuestion({ question }: Props) {
  return (
    <div className="grid gap-4 rounded-2xl bg-panel-muted p-4">
      <div className="flex items-center gap-2">
        <Headphones className="size-5 text-accent" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold" id={`listening-heading-${question.id}`}>
            Listening
          </h3>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-semibold leading-6 whitespace-pre-line">
          {question.prompt}
        </p>

        <div
          role="status"
          aria-live="polite"
          aria-labelledby={`listening-heading-${question.id}`}
          className="rounded-2xl bg-panel px-4 py-3 text-sm text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]"
        >
          {UNAVAILABLE_NOTICE}
        </div>
      </div>
    </div>
  );
}
