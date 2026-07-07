"use client";

import type { AnswerMap, ClientQuestion } from "@/lib/problem-types";

type Props = {
  questions: ClientQuestion[];
  answers: AnswerMap;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function OpenClozeQuestion({ questions, answers, onChange, disabled }: Props) {
  const passage = questions.find((question) => question.passage)?.passage;

  return (
    <div className="grid gap-5">
      {passage ? (
        <article className="rounded-2xl bg-panel-muted p-4 text-sm leading-7 text-foreground">{passage}</article>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {questions.map((question) => (
          <label key={question.id} className="grid gap-2 text-sm font-medium">
            {question.prompt}
            <input
              value={typeof answers[question.id] === "string" ? String(answers[question.id]) : ""}
              disabled={disabled}
              onChange={(event) => onChange(question.id, event.target.value)}
              className="field min-h-11"
              placeholder="Một từ"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
