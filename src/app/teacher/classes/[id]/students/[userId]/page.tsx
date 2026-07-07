import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccuracyBar, MetricCard, StatusPill } from "@/components/analytics/AnalyticsCards";
import { DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getStudentOverview, getStudentSkillStats, getStudentTopicStats, getStudentWrongQuestionStats, percent } from "@/lib/analytics/student";
import { requireManageClassroom } from "@/lib/classroom/permissions";
import { submissionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string; userId: string }>;
};

function formatAnswer(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

export default async function TeacherStudentAnalyticsPage({ params }: PageProps) {
  const { id, userId } = await params;
  await requireManageClassroom(id);
  const member = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: id, userId } },
    include: { user: true },
  });
  if (!member || member.role !== "STUDENT") notFound();

  const [overview, skillStats, topicStats, wrongQuestions, recommendations, needsReviewAnswers] = await Promise.all([
    getStudentOverview(userId),
    getStudentSkillStats(userId),
    getStudentTopicStats(userId),
    getStudentWrongQuestionStats(userId, 8),
    getRecommendedProblemsForStudent(userId, 5),
    prisma.submissionAnswer.findMany({
      where: { submission: { userId }, isCorrect: null, manualGrade: null },
      include: { question: true, submission: { include: { problem: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const weakestSkills = skillStats.filter((skill) => skill.attempted > 0).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1)).slice(0, 6);
  const weakestTopics = topicStats.filter((topic) => topic.attempted > 0).slice(0, 6);

  return (
    <div className="grid gap-6">
      <Link href={`/teacher/classes/${id}?tab=students`} className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại danh sách học sinh
      </Link>

      <header className="surface rounded-lg p-5">
        <p className="text-sm font-semibold text-accent">Hồ sơ học sinh</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{member.user.displayName}</h1>
        <p className="mt-2 text-sm text-ink-soft">{member.user.email}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Độ chính xác" value={percent(overview.answerStats.accuracy)} />
        <MetricCard label="Problem đã làm" value={overview.attemptedProblems} />
        <MetricCard label="Problem đã đúng" value={overview.solvedProblems} />
        <MetricCard label="Hoàn thành assignment" value={percent(overview.assignmentCompletion)} />
        <MetricCard label="Điểm assignment TB" value={percent(overview.averageScore)} />
        <MetricCard label="Cần chấm" value={overview.questionsNeedingReview} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Phân tích theo dạng bài</h2>
          <div className="mt-4 grid gap-3">
            {weakestSkills.map((skill) => (
              <div key={skill.skillType} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <div className="flex items-center justify-between gap-2">
                  <SkillBadge skill={skill.skillType} />
                  <StatusPill label={skill.statusLabel} />
                </div>
                <AccuracyBar value={skill.accuracy} />
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Phân tích theo topic</h2>
          <div className="mt-4 grid gap-3">
            {weakestTopics.map((topic) => (
              <div key={topic.topicId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <div className="flex items-center justify-between gap-2">
                  <TopicTag name={topic.topicName} />
                  <span className="text-sm font-semibold">{percent(topic.accuracy)}</span>
                </div>
                <AccuracyBar value={topic.accuracy} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Submission gần đây</h2>
        <div className="mt-4 grid gap-2">
          {overview.recentProgress.map((submission) => (
            <Link key={submission.id} href={`/problems/${submission.problemSlug}`} className="rounded-md bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <span className="font-semibold">{submission.problemTitle}</span>
              <span className="text-ink-soft">
                {" "}
                · {submissionStatusLabels[submission.status]} · {submission.score ?? "—"}/{submission.total ?? "—"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Lỗi sai</h2>
          <div className="mt-4 grid gap-3">
            {wrongQuestions.map((answer) => (
              <article key={answer.id} className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <SkillBadge skill={answer.skillType} />
                <h3 className="mt-2 font-semibold">{answer.problemTitle}</h3>
                <p className="mt-1 text-ink-soft">Câu trả lời: {formatAnswer(answer.studentAnswer)}</p>
                <p className="text-ink-soft">Đáp án: {answer.correctAnswer}</p>
              </article>
            ))}
            {!wrongQuestions.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có lỗi sai.</p> : null}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Câu cần chấm</h2>
          <div className="mt-4 grid gap-3">
            {needsReviewAnswers.map((answer) => (
              <Link key={answer.id} href={`/teacher/grading/${answer.id}`} className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <span className="font-semibold">{answer.submission.problem.title}</span>
                <span className="text-ink-soft"> · {answer.question.type}</span>
              </Link>
            ))}
            {!needsReviewAnswers.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Không có câu cần chấm.</p> : null}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Gợi ý luyện tiếp</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((problem) => (
            <Link key={problem.id} href={`/problems/${problem.slug}`} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <h3 className="font-semibold">{problem.title}</h3>
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
