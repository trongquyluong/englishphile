import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Target } from "lucide-react";
import { AccuracyBar, MetricCard, StatusPill } from "@/components/analytics/AnalyticsCards";
import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import { DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getStudentOverview, getStudentSkillStats, getStudentTopicStats, getStudentWrongQuestionStats, percent } from "@/lib/analytics/student";
import { getLatestLearnerDiagnosticResult } from "@/lib/diagnostic";
import { prisma } from "@/lib/prisma";

function formatAnswer(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function StudentAnalyticsPage() {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard");

  const [overview, skillStats, topicStats, wrongQuestions, recommendations, latestDiagnostic] = await Promise.all([
    getStudentOverview(user.id),
    getStudentSkillStats(user.id),
    getStudentTopicStats(user.id),
    getStudentWrongQuestionStats(user.id, 6),
    getRecommendedProblemsForStudent(user.id, 6),
    getLatestLearnerDiagnosticResult(user.id),
  ]);
  const strongestSkills = [...skillStats]
    .filter((stat) => stat.attempted >= 5 && stat.accuracy !== null)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
    .slice(0, 3);
  const weakestSkills = [...skillStats]
    .filter((stat) => stat.attempted > 0)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 3);

  const recentWrongIds = wrongQuestions.map((question) => question.problemId);
  const retryProblems = recentWrongIds.length
    ? await prisma.problem.findMany({
        where: { id: { in: recentWrongIds }, contentStatus: "PUBLISHED" },
        select: { id: true, slug: true },
      })
    : [];
  const retrySlugByProblem = new Map(retryProblems.map((problem) => [problem.id, problem.slug]));

  return (
    <div className="grid gap-6">
      <header className="surface rounded-lg p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-accent" aria-hidden="true" />
          <p className="text-sm font-semibold text-accent">Thống kê</p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tiến độ luyện tập cá nhân</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Theo dõi level diagnostic, độ chính xác, dạng bài yếu, topic cần ôn và gợi ý luyện tập dựa trên dữ liệu thật.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Level diagnostic" value={latestDiagnostic?.estimatedLevel ?? "—"} />
        <MetricCard label="Độ tin cậy" value={latestDiagnostic?.scoring?.confidenceLabel ?? "—"} />
        <MetricCard label="Problem đã làm" value={overview.attemptedProblems} />
        <MetricCard label="Problem đã đúng" value={overview.solvedProblems} />
        <MetricCard label="Độ chính xác" value={percent(overview.answerStats.accuracy)} />
        <MetricCard label="Cần chấm tay" value={overview.questionsNeedingReview} />
      </section>

      {latestDiagnostic ? (
        <section className="surface rounded-lg p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">So với diagnostic gần nhất</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {latestDiagnostic.scoring?.confidenceReason ?? "Diagnostic đã được dùng để khởi tạo hồ sơ kỹ năng."}
              </p>
            </div>
            <Link href={`/diagnostic/result?attempt=${latestDiagnostic.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Xem kết quả diagnostic
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Dạng bài yếu nhất</h2>
          <div className="mt-4 grid gap-3">
            {weakestSkills.length ? (
              weakestSkills.map((skill) => (
                <Link key={skill.skillType} href={`/analytics/skills/${skill.skillType}`} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--line)]">
                  <div className="flex items-center justify-between gap-3">
                    <SkillBadge skill={skill.skillType} />
                    <StatusPill label={skill.statusLabel} />
                  </div>
                  <AccuracyBar value={skill.accuracy} />
                  <p className="text-sm text-ink-soft">
                    {skill.attempted} câu · đúng {skill.correct.toFixed(1)} · {percent(skill.accuracy)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có đủ dữ liệu để xác định dạng bài yếu.</p>
            )}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Dạng bài mạnh nhất</h2>
          <div className="mt-4 grid gap-3">
            {strongestSkills.length ? (
              strongestSkills.map((skill) => (
                <Link key={skill.skillType} href={`/analytics/skills/${skill.skillType}`} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--line)]">
                  <div className="flex items-center justify-between gap-3">
                    <SkillBadge skill={skill.skillType} />
                    <StatusPill label={skill.statusLabel} />
                  </div>
                  <AccuracyBar value={skill.accuracy} />
                  <p className="text-sm text-ink-soft">{percent(skill.accuracy)} · tiếp tục duy trì nhịp luyện.</p>
                </Link>
              ))
            ) : (
              <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Cần thêm submission để xác định điểm mạnh.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="p-5">
          <h2 className="text-lg font-semibold">Theo dạng bài</h2>
          <p className="mt-1 text-sm text-ink-soft">Chỉ tính câu đã chấm tự động hoặc đã được chấm tay.</p>
        </div>
        <div className="grid grid-cols-[minmax(180px,1fr)_120px_120px_140px_140px] bg-panel-muted px-4 py-3 text-xs font-semibold uppercase text-ink-soft">
          <span>Dạng bài</span>
          <span>Attempted</span>
          <span>Correct</span>
          <span>Accuracy</span>
          <span>Trạng thái</span>
        </div>
        {skillStats.map((skill) => (
          <Link key={skill.skillType} href={`/analytics/skills/${skill.skillType}`} className="grid grid-cols-[minmax(180px,1fr)_120px_120px_140px_140px] items-center border-t border-line px-4 py-3 text-sm hover:bg-panel-muted">
            <span className="font-semibold">{skill.label}</span>
            <span className="tabular-nums">{skill.attempted}</span>
            <span className="tabular-nums">{skill.correct.toFixed(1)}</span>
            <span>{percent(skill.accuracy)}</span>
            <StatusPill label={skill.statusLabel} />
          </Link>
        ))}
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Theo topic</h2>
        <div className="mt-4 grid gap-3">
          {topicStats.slice(0, 10).map((topic) => (
            <div key={topic.topicId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TopicTag name={topic.topicName} />
                <span className="text-sm font-semibold">{percent(topic.accuracy)}</span>
              </div>
              <AccuracyBar value={topic.accuracy} />
              <p className="text-sm text-ink-soft">
                {topic.attempted} câu · đúng {topic.correct.toFixed(1)} · {topic.recommendedAction}
              </p>
            </div>
          ))}
          {!topicStats.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có dữ liệu topic.</p> : null}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Lỗi sai gần đây</h2>
        <div className="mt-4 grid gap-3">
          {wrongQuestions.map((question) => (
            <article key={question.id} className="rounded-md bg-white p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <SkillBadge skill={question.skillType} />
                  <h3 className="mt-2 font-semibold">{question.problemTitle}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{question.prompt}</p>
                  <QuestionRootWord question={{ type: question.questionType, prompt: question.prompt, rootWord: question.rootWord }} className="mt-2" />
                  <p className="mt-2 text-sm text-ink-soft">Câu trả lời: {formatAnswer(question.studentAnswer)}</p>
                  <p className="text-sm text-ink-soft">{question.feedback}</p>
                </div>
                {retrySlugByProblem.get(question.problemId) ? (
                  <Link href={`/problems/${retrySlugByProblem.get(question.problemId)}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-panel-muted px-3 text-sm font-semibold">
                    Làm lại
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {!wrongQuestions.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có lỗi sai được ghi nhận.</p> : null}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Gợi ý luyện tập</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((problem) => (
            <Link key={problem.id} href={`/problems/${problem.slug}`} className="grid gap-3 rounded-md bg-white p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{problem.title}</h3>
                <ArrowRight className="size-4 text-ink-soft" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <SkillBadge skill={problem.skillType} />
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <p className="text-sm text-ink-soft">{problem.reason}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
