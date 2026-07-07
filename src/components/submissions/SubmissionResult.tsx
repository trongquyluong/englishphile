import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { ScoreSummary } from "@/components/submissions/ScoreSummary";
import type { SubmissionResultPayload } from "@/lib/problem-types";

export function SubmissionResult({ result }: { result: SubmissionResultPayload }) {
  return (
    <section className="grid gap-4">
      <ScoreSummary result={result} />
      <div className="grid gap-3">
        {result.answers.map((answer, index) => {
          const Icon = answer.isCorrect === true ? CheckCircle2 : answer.isCorrect === false ? XCircle : CircleHelp;
          const color =
            answer.isCorrect === true ? "text-accent" : answer.isCorrect === false ? "text-danger" : "text-warning";

          return (
            <article key={answer.questionId} className="rounded-2xl bg-panel p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 size-5 ${color}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Câu {index + 1}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{answer.feedback}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
