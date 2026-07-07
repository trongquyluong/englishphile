import Link from "next/link";
import { redirect } from "next/navigation";
import { AssignmentSubmissionStatusBadge, ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { summarizeCorrectAnswer } from "@/lib/answer-checking";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentResultPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId: id, userId: user.id } },
    include: {
      assignment: true,
      problemSubmissions: {
        include: {
          problem: true,
          submission: {
            include: {
              submissionAnswers: { include: { question: true }, orderBy: { createdAt: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!submission) redirect(`/assignments/${id}`);

  const showAnswers = submission.assignment.showAnswersAfterSubmit;
  const correctCount = submission.problemSubmissions.reduce(
    (sum, item) => sum + (item.submission?.submissionAnswers.filter((answer) => answer.isCorrect === true).length ?? 0),
    0,
  );
  const wrongCount = submission.problemSubmissions.reduce(
    (sum, item) => sum + (item.submission?.submissionAnswers.filter((answer) => answer.isCorrect === false).length ?? 0),
    0,
  );
  const needsReviewCount = submission.problemSubmissions.reduce(
    (sum, item) => sum + (item.submission?.submissionAnswers.filter((answer) => answer.isCorrect === null).length ?? 0),
    0,
  );

  return (
    <div className="grid gap-6">
      <header className="surface rounded-lg p-5">
        <AssignmentSubmissionStatusBadge status={submission.status} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Kết quả: {submission.assignment.title}</h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
          <span>Điểm: <strong className="text-foreground">{submission.score ?? "—"}/{submission.total ?? "—"}</strong></span>
          <span>Nộp lúc: {submission.submittedAt ? submission.submittedAt.toLocaleString("vi-VN") : "—"}</span>
          <span>Thời gian: {submission.timeSpentSeconds ? `${Math.round(submission.timeSpentSeconds / 60)} phút` : "—"}</span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Đúng", correctCount],
          ["Sai", wrongCount],
          ["Cần chấm", needsReviewCount],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-lg p-5">
            <p className="text-sm font-semibold text-ink-soft">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {!showAnswers ? (
        <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          Quản trị viên đã tắt chế độ hiện đáp án sau khi nộp.
        </p>
      ) : null}

      <section className="grid gap-4">
        {submission.problemSubmissions.map((item, index) => (
          <article key={item.id} className="surface rounded-lg p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-soft">Problem #{index + 1}</p>
                <h2 className="mt-1 text-lg font-semibold">{item.problem.title}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <SkillBadge skill={item.problem.skillType} />
                  <DifficultyBadge difficulty={item.problem.difficulty} />
                  <ContentStatusBadge status={item.problem.contentStatus} />
                </div>
              </div>
              <span className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                {item.score ?? "—"}/{item.total ?? "—"}
              </span>
            </div>

            {showAnswers ? (
              <div className="mt-4 grid gap-2">
                {item.submission?.submissionAnswers.map((answer) => (
                  <div key={answer.id} className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold">{answer.question.prompt}</p>
                      <span className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold">
                        {answer.isCorrect === true ? "Đúng" : answer.isCorrect === false ? "Sai" : "Cần chấm"}
                      </span>
                    </div>
                    <p className="mt-2 text-ink-soft">Câu trả lời: {JSON.stringify(answer.studentAnswer)}</p>
                    <p className="mt-1 text-ink-soft">Đáp án: {summarizeCorrectAnswer(answer.question)}</p>
                    {answer.feedback ? <p className="mt-2 leading-6 text-ink-soft">{answer.feedback}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/wrong-questions" className="inline-flex min-h-10 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Xem lỗi sai
        </Link>
        <Link href="/classes" className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
          Về lớp học
        </Link>
      </div>
    </div>
  );
}
