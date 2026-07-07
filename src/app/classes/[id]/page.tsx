import Link from "next/link";
import { CalendarClock, CheckCircle2, PlayCircle } from "lucide-react";
import { AssignmentStatusBadge, AssignmentSubmissionStatusBadge, AssignmentTypeBadge } from "@/components/ui/Badges";
import { requireStudentClassroom } from "@/lib/classroom/permissions";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentClassDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { user } = await requireStudentClassroom(id);

  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id },
    include: {
      teacher: true,
      assignments: {
        where: { status: "PUBLISHED" },
        include: {
          submissions: { where: { userId: user.id } },
          problems: true,
        },
        orderBy: { dueAt: "asc" },
      },
    },
  });

  const active = classroom.assignments.filter((assignment) => !assignment.submissions.some((submission) => submission.submittedAt));
  const submitted = classroom.assignments.filter((assignment) => assignment.submissions.some((submission) => submission.submittedAt));

  return (
    <div className="grid gap-6">
      <header className="surface rounded-lg p-5">
        <p className="text-sm font-semibold text-accent">Lớp học</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{classroom.name}</h1>
        {classroom.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{classroom.description}</p> : null}
        <p className="mt-3 text-sm text-ink-soft">Giáo viên: {classroom.teacher.displayName}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface rounded-lg p-5">
          <p className="text-sm font-semibold text-ink-soft">Bài đang giao</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{active.length}</p>
        </div>
        <div className="surface rounded-lg p-5">
          <p className="text-sm font-semibold text-ink-soft">Đã nộp</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{submitted.length}</p>
        </div>
        <div className="surface rounded-lg p-5">
          <p className="text-sm font-semibold text-ink-soft">Tổng bài</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{classroom.assignments.length}</p>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Bài được giao</h2>
          <Link href="/classes/join" className="text-sm font-semibold text-accent-strong">
            Tham gia lớp khác
          </Link>
        </div>
        {classroom.assignments.length ? (
          classroom.assignments.map((assignment) => {
            const submission = assignment.submissions[0];
            return (
              <article key={assignment.id} className="surface rounded-lg p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <AssignmentStatusBadge status={assignment.status} />
                      <AssignmentTypeBadge type={assignment.assignmentType} />
                      {submission ? <AssignmentSubmissionStatusBadge status={submission.status} /> : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{assignment.title}</h3>
                    {assignment.description ? <p className="mt-2 text-sm leading-6 text-ink-soft">{assignment.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        Hạn nộp: {assignment.dueAt ? assignment.dueAt.toLocaleString("vi-VN") : "Không đặt"}
                      </span>
                      <span>{assignment.problems.length} problem</span>
                      {submission ? <span>Điểm: {submission.score ?? "—"}/{submission.total ?? "—"}</span> : null}
                    </div>
                  </div>
                  {submission?.submittedAt ? (
                    <Link href={`/assignments/${assignment.id}/result`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-panel-muted px-4 text-sm font-semibold">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Xem kết quả
                    </Link>
                  ) : (
                    <Link href={`/assignments/${assignment.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                      <PlayCircle className="size-4" aria-hidden="true" />
                      Làm bài
                    </Link>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="surface rounded-lg p-5 text-sm text-ink-soft">Lớp này chưa có bài được giao.</p>
        )}
      </section>
    </div>
  );
}
