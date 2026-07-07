import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AccuracyBar, MetricCard, StatusPill } from "@/components/analytics/AnalyticsCards";
import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import { DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { getSkillAnalyticsForStudent } from "@/lib/analytics/skills";
import { percent } from "@/lib/analytics/student";
import { skillOrder, submissionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import type { SkillType } from "@prisma/client";

type PageProps = {
  params: Promise<{ skillType: string }>;
};

function formatAnswer(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

export default async function SkillAnalyticsPage({ params }: PageProps) {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard");
  const { skillType } = await params;
  if (!skillOrder.includes(skillType as SkillType)) notFound();

  const [analytics, profile] = await Promise.all([
    getSkillAnalyticsForStudent(user.id, skillType as SkillType),
    prisma.userSkillProfile.findUnique({ where: { userId_skillType: { userId: user.id, skillType: skillType as SkillType } } }),
  ]);

  return (
    <div className="grid gap-6">
      <Link href="/analytics" className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại thống kê
      </Link>

      <header className="surface rounded-lg p-5">
        <SkillBadge skill={analytics.skill.skillType} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Thống kê {analytics.skill.label}</h1>
        <p className="mt-2 text-sm text-ink-soft">Tập trung vào độ chính xác, lỗi sai và topic liên quan trong một dạng bài.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Độ chính xác" value={percent(analytics.skill.accuracy)} />
        <MetricCard label="Câu đã tính" value={analytics.skill.attempted} />
        <MetricCard label="Câu đúng" value={analytics.skill.correct.toFixed(1)} />
        <MetricCard label="Trạng thái" value={analytics.skill.statusLabel} />
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Diagnostic profile</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {profile
            ? `Level ước lượng: ${profile.estimatedLevel ?? "—"} · độ tin cậy ${Math.round(profile.confidence * 100)}% · ${profile.attempted} câu diagnostic/submission đã ghi nhận.`
            : "Chưa có hồ sơ diagnostic cho skill này."}
        </p>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tổng quan kỹ năng</h2>
          <StatusPill label={analytics.skill.statusLabel} />
        </div>
        <div className="mt-4">
          <AccuracyBar value={analytics.skill.accuracy} />
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          {analytics.skill.attempted} câu đã được chấm · {analytics.skill.needsReview} câu đang cần chấm tay.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Topic liên quan</h2>
          <div className="mt-4 grid gap-3">
            {analytics.relatedTopics.map((topic) => (
              <div key={topic.topicId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--line)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{topic.topicName}</span>
                  <span className="text-sm font-semibold">{percent(topic.accuracy)}</span>
                </div>
                <AccuracyBar value={topic.accuracy} />
              </div>
            ))}
            {!analytics.relatedTopics.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có topic liên quan.</p> : null}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Gợi ý luyện tập</h2>
          <div className="mt-4 grid gap-3">
            {analytics.recommendedProblems.map((problem) => (
              <Link key={problem.id} href={`/problems/${problem.slug}`} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--line)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{problem.title}</h3>
                  <ArrowRight className="size-4 text-ink-soft" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <DifficultyBadge difficulty={problem.difficulty} />
                  {problem.problemTopics.slice(0, 2).map(({ topic }) => (
                    <TopicTag key={topic.slug} name={topic.name} />
                  ))}
                </div>
              </Link>
            ))}
            {!analytics.recommendedProblems.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Không còn problem phù hợp chưa giải.</p> : null}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Lỗi sai trong skill này</h2>
        <div className="mt-4 grid gap-3">
          {analytics.wrongQuestions.map((answer) => (
            <article key={answer.id} className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
              <h3 className="font-semibold">{answer.problemTitle}</h3>
              <p className="mt-1 leading-6 text-ink-soft">{answer.prompt}</p>
              <QuestionRootWord question={{ type: answer.questionType, prompt: answer.prompt, rootWord: answer.rootWord }} className="mt-2" />
              <p className="mt-2 text-ink-soft">Câu trả lời: {formatAnswer(answer.studentAnswer)}</p>
              <p className="text-ink-soft">Đáp án: {answer.correctAnswer}</p>
            </article>
          ))}
          {!analytics.wrongQuestions.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có lỗi sai trong skill này.</p> : null}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Submission gần đây</h2>
        <div className="mt-4 grid gap-2">
          {analytics.recentSubmissions.map((submission) => (
            <Link key={submission.id} href={`/problems/${submission.problem.slug}`} className="rounded-md bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
              <span className="font-semibold">{submission.problem.title}</span>
              <span className="text-ink-soft">
                {" "}
                · {submissionStatusLabels[submission.status]} · {submission.score ?? "—"}/{submission.total ?? "—"}
              </span>
            </Link>
          ))}
          {!analytics.recentSubmissions.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có submission cho skill này.</p> : null}
        </div>
      </section>
    </div>
  );
}
