import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AccuracyBar, MetricCard, SimpleDistributionBar } from "@/components/analytics/AnalyticsCards";
import { AssignmentSubmissionStatusBadge } from "@/components/ui/Badges";
import { getAssignmentAnalytics } from "@/lib/analytics/teacher";
import { requireTeacher, canManageAssignment } from "@/lib/classroom/permissions";
import { percent } from "@/lib/analytics/student";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentAnalyticsPage({ params }: PageProps) {
  const user = await requireTeacher();
  const { id } = await params;
  const analytics = await getAssignmentAnalytics(id);
  if (!analytics) notFound();
  if (!canManageAssignment(user, analytics.assignment)) redirect("/dashboard");

  const maxDistribution = Math.max(1, ...analytics.scoreDistribution.map((bucket) => bucket.count));

  return (
    <div className="grid gap-6">
      <Link href={`/teacher/assignments/${id}`} className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại assignment
      </Link>

      <header className="surface rounded-lg p-5">
        <p className="text-sm font-semibold text-accent">Thống kê assignment</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{analytics.assignment.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Theo dõi completion, điểm, problem khó và câu cần chấm.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Đã nộp" value={analytics.completionCount} />
        <MetricCard label="Chưa nộp" value={analytics.notSubmittedCount} />
        <MetricCard label="Nộp muộn" value={analytics.lateCount} />
        <MetricCard label="Cần chấm" value={analytics.needsReviewCount} />
        <MetricCard label="Điểm trung bình" value={analytics.averageScoreLabel} />
        <MetricCard label="Tổng học sinh" value={analytics.students.length || analytics.assignment.submissions.length} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Phân bố điểm</h2>
          <div className="mt-4 grid gap-4">
            {analytics.scoreDistribution.map((bucket) => (
              <SimpleDistributionBar key={bucket.label} label={bucket.label} count={bucket.count} max={maxDistribution} />
            ))}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Hiệu suất theo problem</h2>
          <div className="mt-4 grid gap-3">
            {analytics.problemPerformance.map((problem) => (
              <div key={problem.problemId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/problems/${problem.slug}`} className="font-semibold">
                    {problem.title}
                  </Link>
                  <span className="text-sm font-semibold">{percent(problem.accuracy)}</span>
                </div>
                <AccuracyBar value={problem.accuracy} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Hiệu suất theo câu hỏi</h2>
        <div className="mt-4 grid gap-3">
          {analytics.questionPerformance.slice(0, 20).map((question) => (
            <div key={question.questionId} className="grid gap-2 rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-soft">{question.problemTitle}</p>
                  <p className="text-sm font-semibold">{question.prompt}</p>
                </div>
                <span className="text-sm font-semibold">{percent(question.accuracy)}</span>
              </div>
              <AccuracyBar value={question.accuracy} />
            </div>
          ))}
        </div>
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Danh sách học sinh</h2>
            <p className="mt-1 text-sm text-ink-soft">Điểm, trạng thái và link chấm bài khi cần.</p>
          </div>
          <Link href={`/teacher/grading?assignmentId=${id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Bài cần chấm
          </Link>
        </div>
        <div className="grid grid-cols-[minmax(220px,1fr)_140px_120px_170px_120px] bg-panel-muted px-4 py-3 text-xs font-semibold uppercase text-ink-soft">
          <span>Học sinh</span>
          <span>Trạng thái</span>
          <span>Điểm</span>
          <span>Thời điểm nộp</span>
          <span>Chấm bài</span>
        </div>
        {analytics.assignment.submissions.map((submission) => (
          <div key={submission.id} className="grid grid-cols-[minmax(220px,1fr)_140px_120px_170px_120px] items-center border-t border-line px-4 py-3 text-sm">
            <span className="font-semibold">{submission.user.displayName}</span>
            <AssignmentSubmissionStatusBadge status={submission.status} />
            <span>{submission.score ?? "—"}/{submission.total ?? "—"}</span>
            <span className="text-ink-soft">{submission.submittedAt ? submission.submittedAt.toLocaleString("vi-VN") : "—"}</span>
            <span>
              {submission.status === "NEEDS_REVIEW" ? (
                <Link href={`/teacher/grading?assignmentId=${id}&studentId=${submission.userId}`} className="font-semibold text-accent-strong">
                  Chấm bài
                </Link>
              ) : (
                "—"
              )}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
