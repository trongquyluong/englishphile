import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ClipboardList, Sparkles, TriangleAlert } from "lucide-react";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getActiveLearningRecommendations } from "@/lib/diagnostic";
import { getStudentWrongQuestionStats } from "@/lib/analytics/student";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Gợi ý luyện tập",
  description: "Danh sách bài luyện được gợi ý theo diagnostic, điểm yếu và lỗi sai của người học.",
};

export default async function RecommendationsPage() {
  const user = await requireUser();
  const [profileRecommendations, fallbackProblems, wrongQuestions] = await Promise.all([
    getActiveLearningRecommendations(user.id, 8),
    getRecommendedProblemsForStudent(user.id, 8),
    getStudentWrongQuestionStats(user.id, 5),
  ]);
  const profileProblemIds = new Set(profileRecommendations.map((item) => item.problemId).filter(Boolean));
  const mergedProblems = [
    ...profileRecommendations
      .filter((item) => item.problem)
      .map((item) => ({ ...item.problem!, reason: item.reason })),
    ...fallbackProblems.filter((problem) => !profileProblemIds.has(problem.id)),
  ].slice(0, 10);

  const wrongProblemIds = [...new Set(wrongQuestions.map((question) => question.problemId))];
  const retryProblems = wrongProblemIds.length
    ? await prisma.problem.findMany({
        where: { id: { in: wrongProblemIds }, contentStatus: "PUBLISHED" },
        select: { id: true, slug: true },
      })
    : [];
  const retryById = new Map(retryProblems.map((problem) => [problem.id, problem.slug]));

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Bài nên luyện hôm nay</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Gợi ý cá nhân hóa</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Các gợi ý dựa trên diagnostic, kỹ năng yếu, topic yếu, câu sai và các bài đã xuất bản bạn chưa giải.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {mergedProblems.map((problem) => (
          <Link key={problem.id} href={`/problems/${problem.slug}`} className="surface surface-hover rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-balance">{problem.title}</h2>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <SkillBadge skill={problem.skillType} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{problem.reason}</p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent-strong">
              Luyện ngay <ArrowRight className="size-4" aria-hidden="true" />
            </div>
          </Link>
        ))}
        {!mergedProblems.length ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chưa có gợi ý đủ dữ liệu</h2>
            <p className="mt-2 text-sm text-ink-soft">Hãy làm diagnostic hoặc luyện một vài bài để hệ thống hiểu bạn hơn.</p>
            <Link href="/diagnostic" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              Làm diagnostic
            </Link>
          </div>
        ) : null}
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-warning" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Ôn lỗi sai gần đây</h2>
        </div>
        <div className="mt-4 grid gap-2">
          {wrongQuestions.map((question) => (
            <Link key={question.id} href={retryById.get(question.problemId) ? `/problems/${retryById.get(question.problemId)}` : "/wrong-questions"} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]">
              <span className="font-semibold">{question.problemTitle}</span>
              <span className="text-ink-soft"> · Ôn lại câu từng làm sai.</span>
            </Link>
          ))}
          {!wrongQuestions.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có lỗi sai gần đây.</p> : null}
        </div>
      </section>

      <Link href="/practice/adaptive" className="inline-flex w-fit min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
        <ClipboardList className="size-4" aria-hidden="true" />
        Tạo buổi luyện thích ứng
      </Link>
    </div>
  );
}
