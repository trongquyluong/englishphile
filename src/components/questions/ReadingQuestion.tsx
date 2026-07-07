"use client";

import type { AnswerMap, ClientQuestion } from "@/lib/problem-types";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";

type Props = {
  questions: ClientQuestion[];
  answers: AnswerMap;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function ReadingQuestion({ questions, answers, onChange, disabled }: Props) {
  const passage = questions.find((question) => question.passage)?.passage;

  return (
    <div className="grid gap-5">
      {passage ? (
        <article className="rounded-lg bg-white p-4 text-sm leading-7 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]">
          {passage}
        </article>
      ) : null}
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
  );
}
