import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AccuracyBar, MetricCard, StatusPill } from "@/components/analytics/AnalyticsCards";
import { SkillBadge } from "@/components/ui/Badges";
import { getClassOverview, getClassSkillStats, getClassTopicStats, getStudentsNeedingAttention, getTopDifficultProblems } from "@/lib/analytics/teacher";
import { requireManageClassroom } from "@/lib/classroom/permissions";
import { percent } from "@/lib/analytics/student";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClassAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  const { classroom } = await requireManageClassroom(id);
  const [overview, skillStats, topicStats, difficultProblems, studentsNeedingAttention] = await Promise.all([
    getClassOverview(id),
    getClassSkillStats(id),
    getClassTopicStats(id),
    getTopDifficultProblems(id),
    getStudentsNeedingAttention(id),
  ]);

  const weakestSkills = skillStats.filter((skill) => skill.attempted > 0).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1)).slice(0, 8);
  const weakestTopics = topicStats.filter((topic) => topic.attempted > 0).slice(0, 8);

  return (
    <div className="grid gap-6">
      <Link href={`/teacher/classes/${id}`} className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại lớp
      </Link>

      <header className="surface rounded-lg p-5">
        <p className="text-sm font-semibold text-accent">Thống kê lớp</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{classroom.name}</h1>
        <p className="mt-2 text-sm text-ink-soft">Hiệu suất theo dạng bài, topic, problem và học sinh cần hỗ trợ.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Độ chính xác lớp" value={percent(overview.classAccuracy.accuracy)} />
        <MetricCard label="Học sinh hoạt động" value={overview.activeStudents} />
        <MetricCard label="Hoàn thành bài giao" value={percent(overview.assignmentCompletion)} />
        <MetricCard label="Bài đã nộp" value={overview.submittedAssignments} />
        <MetricCard label="Điểm TB assignment" value={percent(overview.averageScore)} />
        <MetricCard label="Bài cần chấm" value={overview.assignmentsNeedingReview} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Hiệu suất theo dạng bài</h2>
          <div className="mt-4 grid gap-3">
            {weakestSkills.map((skill) => (
              <div key={skill.skillType} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <div className="flex items-center justify-between gap-2">
                  <SkillBadge skill={skill.skillType} />
                  <StatusPill label={skill.statusLabel} />
                </div>
                <AccuracyBar value={skill.accuracy} />
                <p className="text-sm text-ink-soft">{skill.attempted} câu · {percent(skill.accuracy)}</p>
              </div>
            ))}
            {!weakestSkills.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có dữ liệu kỹ năng.</p> : null}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Hiệu suất theo topic</h2>
          <div className="mt-4 grid gap-3">
            {weakestTopics.map((topic) => (
              <div key={topic.topicId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{topic.topicName}</span>
                  <span className="text-sm font-semibold">{percent(topic.accuracy)}</span>
                </div>
                <AccuracyBar value={topic.accuracy} />
                <p className="text-sm text-ink-soft">{topic.recommendedAction}</p>
              </div>
            ))}
            {!weakestTopics.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có dữ liệu topic.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Bài khó nhất</h2>
          <div className="mt-4 grid gap-3">
            {difficultProblems.map((problem) => (
              <Link key={problem.problemId} href={`/problems/${problem.slug}`} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <h3 className="font-semibold">{problem.title}</h3>
                <AccuracyBar value={problem.accuracy} />
                <p className="text-sm text-ink-soft">{problem.attempted} lượt câu · {percent(problem.accuracy)}</p>
              </Link>
            ))}
            {!difficultProblems.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có problem đủ dữ liệu.</p> : null}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Học sinh cần hỗ trợ</h2>
          <div className="mt-4 grid gap-3">
            {studentsNeedingAttention.slice(0, 8).map((student) => (
              <Link key={student.id} href={`/teacher/classes/${id}/students/${student.id}`} className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <span className="font-semibold">{student.displayName}</span>
                <span className="text-ink-soft"> · {percent(student.accuracy)} · {student.reason}</span>
              </Link>
            ))}
            {!studentsNeedingAttention.length ? <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa có học sinh cần hỗ trợ đặc biệt.</p> : null}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bài cần chấm</h2>
            <p className="mt-1 text-sm text-ink-soft">Mở hàng đợi chấm bài đã lọc theo lớp này.</p>
          </div>
          <Link href={`/teacher/grading?classroomId=${id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Chấm bài
          </Link>
        </div>
      </section>
    </div>
  );
}
