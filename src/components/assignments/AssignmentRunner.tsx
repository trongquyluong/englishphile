"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { ProblemHeader } from "@/components/problems/ProblemHeader";
import { QuestionRenderer } from "@/components/questions/QuestionRenderer";
import type { AnswerMap, ClientProblem } from "@/lib/problem-types";
import { cn } from "@/lib/utils";

type Props = {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    dueAt: string | null;
    timeLimitMinutes: number | null;
    problems: ClientProblem[];
  };
};

type AssignmentAnswers = Record<string, AnswerMap>;

export function AssignmentRunner({ assignment }: Props) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AssignmentAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentProblem = assignment.problems[currentIndex];
  const answeredByProblem = useMemo(
    () =>
      assignment.problems.map((problem) => {
        const problemAnswers = answers[problem.id] ?? {};
        return problem.questions.filter((question) => {
          const answer = problemAnswers[question.id];
          if (answer && typeof answer === "object") {
            return Object.values(answer).some((value) => String(value ?? "").trim().length > 0);
          }
          return String(answer ?? "").trim().length > 0;
        }).length;
      }),
    [answers, assignment.problems],
  );
  const answeredCount = answeredByProblem.reduce((sum, count) => sum + count, 0);
  const totalQuestions = assignment.problems.reduce((sum, problem) => sum + problem.questions.length, 0);

  const handleChange = (questionId: string, value: unknown) => {
    if (!currentProblem) return;
    setAnswers((current) => ({
      ...current,
      [currentProblem.id]: {
        ...(current[currentProblem.id] ?? {}),
        [questionId]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/assignments/${assignment.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, startedAt: startedAt ?? new Date().toISOString() }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Không thể nộp bài lúc này.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/assignments/${assignment.id}/result`);
    router.refresh();
  };

  if (!assignment.problems.length || !currentProblem) {
    return (
      <div className="surface rounded-lg p-6">
        <h1 className="text-2xl font-semibold">{assignment.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Bài giao này chưa có problem để làm.</p>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <section className="surface rounded-lg p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Sẵn sàng làm bài</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Bài gồm {assignment.problems.length} problem và {totalQuestions} câu. Kết quả sẽ được lưu khi em bấm nộp bài.
        </p>
        <div className="mt-4 grid gap-2">
          {assignment.problems.map((problem, index) => (
            <div key={problem.id} className="rounded-md bg-panel-muted px-3 py-2 text-sm">
              <span className="font-semibold">#{index + 1}</span> {problem.title}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setStartedAt(new Date().toISOString());
              setHasStarted(true);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background"
          >
            Bắt đầu làm bài
          </button>
          <Link href="/classes" className="inline-flex min-h-11 items-center justify-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
            Về lớp học
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="surface h-fit rounded-lg p-4 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase text-ink-soft">Bài được giao</p>
        <h1 className="mt-2 text-lg font-semibold">{assignment.title}</h1>
        {assignment.description ? <p className="mt-2 text-sm leading-6 text-ink-soft">{assignment.description}</p> : null}
        <div className="mt-4 grid gap-2 text-sm text-ink-soft">
          <span>Đã trả lời {answeredCount}/{totalQuestions} câu</span>
          {assignment.dueAt ? <span>Hạn nộp: {new Date(assignment.dueAt).toLocaleString("vi-VN")}</span> : null}
          {assignment.timeLimitMinutes ? <span>Thời gian: {assignment.timeLimitMinutes} phút</span> : null}
        </div>

        <div className="mt-4 grid gap-2">
          {assignment.problems.map((problem, index) => (
            <button
              key={problem.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-[background-color,color] duration-150",
                index === currentIndex ? "bg-foreground text-background" : "bg-panel-muted text-foreground hover:bg-accent-soft",
              )}
            >
              <span className="font-semibold">#{index + 1}</span> {problem.title}
              <span className={cn("mt-1 block text-xs", index === currentIndex ? "text-background/70" : "text-ink-soft")}>
                {answeredByProblem[index]}/{problem.questions.length} câu
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="grid gap-5">
        <ProblemHeader problem={currentProblem} />
        <section className="surface rounded-lg p-5">
          {currentProblem.instructions ? (
            <div className="mb-5 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
              {currentProblem.instructions}
            </div>
          ) : null}
          <QuestionRenderer
            problem={currentProblem}
            answers={answers[currentProblem.id] ?? {}}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </section>

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

        <div className="flex flex-col gap-3 rounded-lg bg-panel-muted p-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0 || isSubmitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Trước
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {currentIndex < assignment.problems.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((index) => Math.min(assignment.problems.length - 1, index + 1))}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background"
              >
                Tiếp theo
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="size-4" aria-hidden="true" />
                {isSubmitting ? "Đang nộp..." : "Nộp bài"}
              </button>
            )}
            <Link href="/classes" className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold">
              Về lớp học
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
