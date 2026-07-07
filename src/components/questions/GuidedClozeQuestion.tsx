"use client";

import type { AnswerMap, ClientQuestion } from "@/lib/problem-types";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";

type Props = {
  questions: ClientQuestion[];
  answers: AnswerMap;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function GuidedClozeQuestion({ questions, answers, onChange, disabled }: Props) {
  const passage = questions.find((question) => question.passage)?.passage;

  return (
    <div className="grid gap-5">
      {passage ? (
        <article className="rounded-2xl bg-panel-muted p-4 text-sm leading-7 text-foreground">{passage}</article>
      ) : null}
      <div className="grid gap-5">
        {questions.map((question) => (
          <MultipleChoiceQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
