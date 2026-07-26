import Link from "next/link";
import { redirect } from "next/navigation";
import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import { contestAttemptStatusLabels } from "@/lib/labels";
import { requireUser } from "@/lib/auth/session";
import { findContestByIdOrSlug } from "@/lib/contests";
import { learnerFeedbackForCorrectness } from "@/lib/dto/submission";
import { toLearnerContestResult } from "@/lib/dto/contest-attempt";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function answerText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export default async function ContestResultPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";
  const contest = await findContestByIdOrSlug(id);
  if (!contest || !attemptId) redirect("/contests");
  const attempt = await prisma.contestAttempt.findFirst({ where: { id: attemptId, contestId: contest.id, userId: user.id } });
  if (!attempt) redirect(`/contests/${contest.slug}`);
  const result = toLearnerContestResult(attempt.answersJson);

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Kết quả contest</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{contest.title}</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-panel-muted p-4">
            <p className="text-sm text-ink-soft">Điểm</p>
            <p className="tabular-nums mt-1 text-2xl font-semibold">{attempt.score ?? 0}/{attempt.total ?? 0}</p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <p className="text-sm text-ink-soft">Trạng thái</p>
            <p className="mt-1 font-semibold">{contestAttemptStatusLabels[attempt.status]}</p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <p className="text-sm text-ink-soft">Thời gian</p>
            <p className="tabular-nums mt-1 font-semibold">{attempt.timeSpentSeconds ? `${Math.round(attempt.timeSpentSeconds / 60)} phút` : "—"}</p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <p className="text-sm text-ink-soft">Nộp lúc</p>
            <p className="mt-1 font-semibold">{attempt.submittedAt?.toLocaleString("vi-VN") ?? "Chưa nộp"}</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Breakdown theo section</h2>
        <div className="mt-4 grid gap-2">
          {result?.sectionBreakdown.map((section) => (
            <div key={section.section} className="grid gap-2 rounded-xl bg-white p-3 text-sm shadow-[var(--shadow-border)] sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <span className="font-semibold">{section.section}</span>
              <span className="tabular-nums text-ink-soft">{section.score}/{section.total}</span>
              <span className="text-ink-soft">{section.needsReview ? `${section.needsReview} cần chấm tay` : "Đã chấm tự động"}</span>
            </div>
          ))}
          {!result?.sectionBreakdown.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có breakdown.</p> : null}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Review câu trả lời</h2>
        <div className="mt-4 grid gap-2">
          {result?.problems.map((problem) => {
            const correct = problem.results.filter((item) => item.isCorrect === true).length;
            const wrong = problem.results.filter((item) => item.isCorrect === false).length;
            const needsReview = problem.results.filter((item) => item.isCorrect === null).length;
            return (
              <div key={problem.problemId} className="rounded-xl bg-white p-4 text-sm shadow-[var(--shadow-border)]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">{problem.title}</p>
                  <p className="text-ink-soft">{problem.section} · đúng {correct} · sai {wrong} · cần chấm {needsReview}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {problem.results.map((item, index) => (
                    <div key={item.questionId} className="rounded-lg bg-panel-muted p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Câu {index + 1}</p>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-[var(--shadow-border)]">
                          {item.isCorrect === true ? "Đúng" : item.isCorrect === false ? "Sai" : "Cần chấm thủ công"}
                        </span>
                      </div>
                      {item.prompt ? <p className="mt-2 leading-6 text-ink-soft">{item.prompt}</p> : null}
                      {item.type && item.prompt ? (
                        <QuestionRootWord question={{ type: item.type, prompt: item.prompt, rootWord: item.rootWord ?? null }} className="mt-2 bg-white" />
                      ) : null}
                      <p className="mt-2 text-ink-soft">Bài làm: <span className="font-semibold text-foreground">{answerText(item.studentAnswer)}</span></p>
                      <p className="mt-1 text-ink-soft">{learnerFeedbackForCorrectness(item.isCorrect)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!result?.problems.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có dữ liệu problem.</p> : null}

          {/* Section-based questions (standalone) */}
          {result?.sectionResults.map((section) => {
            const correct = section.results.filter((item) => item.isCorrect === true).length;
            const wrong = section.results.filter((item) => item.isCorrect === false).length;
            const needsReview = section.results.filter((item) => item.isCorrect === null).length;
            return (
              <div key={section.sectionId} className="rounded-xl bg-white p-4 text-sm shadow-[var(--shadow-border)]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">{section.sectionTitle}</p>
                  <p className="text-ink-soft">đúng {correct} · sai {wrong} · cần chấm {needsReview}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {section.results.map((item, index) => (
                    <div key={item.questionId} className="rounded-lg bg-panel-muted p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Câu {index + 1}</p>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-[var(--shadow-border)]">
                          {item.isCorrect === true ? "Đúng" : item.isCorrect === false ? "Sai" : "Cần chấm thủ công"}
                        </span>
                      </div>
                      {item.prompt ? <p className="mt-2 leading-6 text-ink-soft">{item.prompt}</p> : null}
                      {item.type && item.prompt ? (
                        <QuestionRootWord question={{ type: item.type, prompt: item.prompt, rootWord: item.rootWord ?? null }} className="mt-2 bg-white" />
                      ) : null}
                      <p className="mt-2 text-ink-soft">Bài làm: <span className="font-semibold text-foreground">{answerText(item.studentAnswer)}</span></p>
                      <p className="mt-1 text-ink-soft">{learnerFeedbackForCorrectness(item.isCorrect)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {result?.sectionResults.length && !result.problems.length ? (
            <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có dữ liệu.</p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/contests" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
          Quay lại Contests
        </Link>
        <Link href="/gym" className="btn btn-sm btn-primary">
          Vào Gym
        </Link>
        <Link href={`/contests/${contest.slug}/leaderboard`} className="btn btn-sm btn-secondary">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
