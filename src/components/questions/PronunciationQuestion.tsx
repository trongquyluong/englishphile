"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function PronunciationQuestion(props: Props) {
  return (
    <div className="grid gap-2">
      <p className="rounded-md bg-panel-muted px-3 py-2 text-sm text-ink-soft">
        Chọn từ có phần gạch chân phát âm khác các từ còn lại.
      </p>
      <MultipleChoiceQuestion {...props} />
    </div>
  );
}
