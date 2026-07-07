import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Archive, CheckCircle2, Copy, Lock, Pencil, PlayCircle } from "lucide-react";
import { assignmentStatusAction } from "@/app/teacher/actions";
import { AssignmentStatusBadge, AssignmentSubmissionStatusBadge, AssignmentTypeBadge, DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { canManageAssignment, requireTeacher } from "@/lib/classroom/permissions";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function StatusButton({ assignmentId, intent, label, icon }: { assignmentId: string; intent: string; label: string; icon: ReactNode }) {
  return (
    <form action={assignmentStatusAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="intent" value={intent} />
      <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        {icon}
        {label}
      </button>
    </form>
  );
}

export default async function TeacherAssignmentDetailPage({ params, searchParams }: PageProps) {
  const user = await requireTeacher();
  const { id } = await params;
  const query = await searchParams;
  const error = getParam(query, "error");
  const message = getParam(query, "message");

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      classroom: { include: { members: { include: { user: true } } } },
      createdBy: true,
      problems: {
        orderBy: { orderIndex: "asc" },
        include: {
          problem: {
            include: {
              sourceCollection: true,
              problemTopics: { include: { topic: true } },
              _count: { select: { questions: true } },
            },
          },
        },
      },
      submissions: { include: { user: true }, orderBy: { submittedAt: "desc" } },
    },
  });

  if (!assignment) notFound();
  if (!canManageAssignment(user, assignment)) redirect("/dashboard");

  const students = assignment.classroom?.members.filter((member) => member.role === "STUDENT") ?? [];
  const submitted = assignment.submissions.filter((submission) => submission.submittedAt).length;
  const scored = assignment.submissions.filter((submission) => submission.total && submission.total > 0);
  const average =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, submission) => sum + ((submission.score ?? 0) / (submission.total ?? 1)), 0) / scored.length) *
            100,
        )
      : null;

  return (
    <div className="grid gap-6">
      <header className="surface rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <AssignmentStatusBadge status={assignment.status} />
              <AssignmentTypeBadge type={assignment.assignmentType} />
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{assignment.title}</h1>
            {assignment.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{assignment.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
              <span>Lớp: {assignment.classroom ? assignment.classroom.name : "Không gắn lớp"}</span>
              <span>Hạn nộp: {assignment.dueAt ? assignment.dueAt.toLocaleString("vi-VN") : "Không đặt"}</span>
              <span>Thời gian: {assignment.timeLimitMinutes ? `${assignment.timeLimitMinutes} phút` : "Không giới hạn"}</span>
              <span>{assignment.problems.length} problem</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/teacher/assignments/${assignment.id}/analytics`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
              Thống kê assignment
            </Link>
            <Link href="/teacher/assignments/new" className="inline-flex min-h-10 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Tạo bài mới
            </Link>
          </div>
        </div>
      </header>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Thao tác</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusButton assignmentId={assignment.id} intent="publish" label="Xuất bản" icon={<CheckCircle2 className="size-4" aria-hidden="true" />} />
          <StatusButton assignmentId={assignment.id} intent="close" label="Đóng bài" icon={<Lock className="size-4" aria-hidden="true" />} />
          <StatusButton assignmentId={assignment.id} intent="archive" label="Lưu trữ" icon={<Archive className="size-4" aria-hidden="true" />} />
          <StatusButton assignmentId={assignment.id} intent="duplicate" label="Nhân bản" icon={<Copy className="size-4" aria-hidden="true" />} />
          {assignment.status === "DRAFT" ? (
            <Link href="/teacher/assignments/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
              <Pencil className="size-4" aria-hidden="true" />
              Chỉnh sửa bản nháp
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Số học sinh", students.length || "—"],
          ["Đã nộp", students.length ? `${submitted}/${students.length}` : submitted],
          ["Điểm trung bình", average === null ? "—" : `${average}%`],
          ["Cần chấm", assignment.submissions.filter((submission) => submission.status === "NEEDS_REVIEW").length],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-lg p-5">
            <p className="text-sm font-semibold text-ink-soft">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Danh sách problem</h2>
        <div className="mt-4 grid gap-3">
          {assignment.problems.map((item, index) => (
            <article key={item.id} className="rounded-md bg-white p-4 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-soft">#{index + 1}</p>
                  <h3 className="mt-1 font-semibold">{item.problem.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <SkillBadge skill={item.problem.skillType} />
                    <DifficultyBadge difficulty={item.problem.difficulty} />
                    {item.problem.problemTopics.slice(0, 2).map(({ topic }) => (
                      <TopicTag key={topic.id} name={topic.name} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/problems/${item.problem.slug}`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-3 text-sm font-semibold">
                    Mở bài
                  </Link>
                  <span className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-3 text-sm text-ink-soft">
                    {item.problem._count.questions} câu
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-lg font-semibold">Submission của học sinh</h2>
            <p className="mt-1 text-sm text-ink-soft">Theo dõi trạng thái nộp bài, điểm và thời gian làm bài.</p>
          </div>
          <PlayCircle className="size-5 text-accent" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-[minmax(220px,1fr)_130px_120px_170px_110px] bg-panel-muted px-4 py-3 text-xs font-semibold uppercase text-ink-soft">
          <span>Học sinh</span>
          <span>Trạng thái</span>
          <span>Điểm</span>
          <span>Thời điểm nộp</span>
          <span>Kết quả</span>
        </div>
        {(students.length ? students.map((member) => member.user) : assignment.submissions.map((submission) => submission.user)).map((student) => {
          const submission = assignment.submissions.find((item) => item.userId === student.id);
          return (
            <div key={student.id} className="grid grid-cols-[minmax(220px,1fr)_130px_120px_170px_110px] items-center border-t border-line px-4 py-3 text-sm">
              <span className="font-semibold">{student.displayName}</span>
              <span>{submission ? <AssignmentSubmissionStatusBadge status={submission.status} /> : "Chưa nộp"}</span>
              <span>{submission ? `${submission.score ?? "—"}/${submission.total ?? "—"}` : "—"}</span>
              <span className="text-ink-soft">{submission?.submittedAt ? submission.submittedAt.toLocaleString("vi-VN") : "—"}</span>
              <span>
                {submission ? (
                  <a href={`#submission-${submission.id}`} className="text-sm font-semibold text-accent-strong">
                    Xem
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
