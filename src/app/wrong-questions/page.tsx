import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { ContentStatusBadge, DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { summarizeCorrectAnswer } from "@/lib/answer-checking";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function formatStudentAnswer(value: unknown) {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${String(item ?? "")}`)
      .join("; ");
  }

  return String(value ?? "—");
}

export default async function WrongQuestionsPage() {
  const user = await requireUser();
  const wrongAnswers = await prisma.submissionAnswer.findMany({
    where: {
      isCorrect: false,
      submission: { userId: user.id },
    },
    include: {
      question: {
        include: {
          problem: {
            include: {
              problemTopics: { include: { topic: true } },
            },
          },
        },
      },
      submission: true,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-danger">Wrong-answer review</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Câu đã làm sai</h1>
        <p className="mt-2 text-sm text-ink-soft">Danh sách lấy từ SubmissionAnswer có isCorrect = false.</p>
      </div>

      {wrongAnswers.length ? (
        <div className="grid gap-3">
          {wrongAnswers.map((answer) => (
            <article key={answer.id} className="surface rounded-lg p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TriangleAlert className="size-5 text-danger" aria-hidden="true" />
                    <SkillBadge skill={answer.question.skillType} />
                    <DifficultyBadge difficulty={answer.question.difficulty} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{answer.question.problem.title}</h2>
                  {answer.question.problem.contentStatus !== "PUBLISHED" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <ContentStatusBadge status={answer.question.problem.contentStatus} />
                      <span className="text-xs text-ink-soft">Nội dung này không còn hiển thị mặc định trong kho bài.</span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {answer.question.problem.problemTopics.slice(0, 3).map(({ topic }) => (
                      <TopicTag key={topic.id} name={topic.name} />
                    ))}
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div>
                      <dt className="font-semibold">Lần trả lời sai</dt>
                      <dd className="mt-1 text-ink-soft">{formatStudentAnswer(answer.studentAnswer)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Đáp án đúng</dt>
                      <dd className="mt-1 text-ink-soft">{summarizeCorrectAnswer(answer.question)}</dd>
                    </div>
                  </dl>
                </div>
                {answer.question.problem.contentStatus === "PUBLISHED" ? (
                  <Link
                    href={`/problems/${answer.question.problem.slug}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background"
                  >
                    Retry
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-panel-muted px-4 text-sm font-semibold text-ink-soft">
                    Đã lưu trữ
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface rounded-lg p-8 text-center">
          <h2 className="text-lg font-semibold">Chưa có câu sai</h2>
          <p className="mt-2 text-sm text-ink-soft">Làm vài bài objective để trang này bắt đầu có dữ liệu review.</p>
        </div>
      )}
    </div>
  );
}
