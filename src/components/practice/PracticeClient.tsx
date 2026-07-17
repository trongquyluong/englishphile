"use client";

import { useMemo, useState } from "react";
import type { AnswerMap, ClientProblem, ClientQuestion, SubmissionResultPayload } from "@/lib/problem-types";
import { QuestionRenderer } from "@/components/questions/QuestionRenderer";
import { SubmissionResult } from "@/components/submissions/SubmissionResult";
import { skillLabels } from "@/lib/labels";

type PracticeClientProps = {
  questions: ClientQuestion[];
};

export function PracticeClient({ questions }: PracticeClientProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<SubmissionResultPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answeredCount = useMemo(
    () => questions.filter((question) => String(answers[question.id] ?? "").trim().length > 0).length,
    [answers, questions],
  );

  const onChange = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const submit = async () => {
    setIsSubmitting(true);
    const response = await fetch("/api/practice/random", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: questions.map((question) => question.id), answers }),
    });
    const payload = (await response.json()) as SubmissionResultPayload;
    setResult(payload);
    setIsSubmitting(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid gap-4">
        {questions.map((question, index) => {
          const fakeProblem: ClientProblem = {
            id: question.id,
            title: `Câu ${index + 1}`,
            slug: question.id,
            skillType: question.skillType,
            questionType: question.type,
            difficulty: question.difficulty,
            contentStatus: "PUBLISHED",
            statement: question.prompt,
            instructions: null,
            estimatedMinutes: null,
            acceptanceRate: null,
            sourceCollection: null,
            problemTopics: [],
            questions: [question],
          };

          return (
            <article key={question.id} className="surface rounded-3xl p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink-soft">Câu {index + 1}</h2>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                  {skillLabels[question.skillType]}
                </span>
              </div>
              <QuestionRenderer problem={fakeProblem} answers={answers} onChange={onChange} disabled={isSubmitting} />
            </article>
          );
        })}
      </section>

      <aside className="surface h-fit rounded-3xl p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Phiên luyện ngẫu nhiên</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Đã trả lời <span className="tabular font-semibold text-foreground">{answeredCount}</span>/
          <span className="tabular">{questions.length}</span> câu.
        </p>
        <button type="button" onClick={submit} disabled={isSubmitting} className="btn btn-primary mt-5 w-full">
          {isSubmitting ? "Đang chấm..." : "Nộp phiên luyện"}
        </button>
        {result ? <div className="mt-5"><SubmissionResult result={result} /></div> : null}
      </aside>
    </div>
  );
}
