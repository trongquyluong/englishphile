import Link from "next/link";
import { Fragment } from "react";
import { CalendarClock, RefreshCcw, Settings } from "lucide-react";
import { regenerateJoinCodeAction, updateClassroomAction } from "@/app/teacher/actions";
import { AssignmentStatusBadge, AssignmentTypeBadge } from "@/components/ui/Badges";
import { requireManageClassroom } from "@/lib/classroom/permissions";
import { assignmentSubmissionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs = [
  { id: "overview", label: "Tổng quan" },
  { id: "students", label: "Học sinh" },
  { id: "assignments", label: "Bài được giao" },
  { id: "results", label: "Kết quả" },
  { id: "settings", label: "Cài đặt" },
] as const;

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function TeacherClassDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  await requireManageClassroom(id);
  const activeTab = getParam(query, "tab") ?? "overview";
  const error = getParam(query, "error");
  const message = getParam(query, "message");

  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id },
    include: {
      teacher: true,
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      assignments: {
        include: {
          submissions: { include: { user: true } },
          problems: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const students = classroom.members.filter((member) => member.role === "STUDENT");
  const solvedCounts = await prisma.userProblemStatus.groupBy({
    by: ["userId"],
    where: { userId: { in: students.map((member) => member.userId) }, status: "SOLVED" },
    _count: { _all: true },
  });
  const solvedByUser = new Map(solvedCounts.map((item) => [item.userId, item._count._all]));

  return (
    <div className="grid gap-5">
      <header className="surface rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">Lớp học</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{classroom.name}</h1>
            {classroom.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{classroom.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
              <span>Giáo viên: {classroom.teacher.displayName}</span>
              <span>Mã tham gia: <strong className="font-mono text-foreground">{classroom.joinCode}</strong></span>
              <span>{students.length} học sinh</span>
              <span>{classroom.assignments.length} bài giao</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/teacher/classes/${classroom.id}/analytics`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
              Thống kê lớp
            </Link>
            <Link href={`/teacher/classes/${classroom.id}/assignments/new`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Tạo assignment
            </Link>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-lg bg-panel-muted p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/teacher/classes/${classroom.id}?tab=${tab.id}`}
            className={cn(
              "min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-semibold",
              activeTab === tab.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-white hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Số học sinh", students.length],
            ["Bài được giao", classroom.assignments.length],
            ["Đang mở", classroom.assignments.filter((assignment) => assignment.status === "PUBLISHED").length],
            ["Đã nộp", classroom.assignments.reduce((sum, assignment) => sum + assignment.submissions.length, 0)],
          ].map(([label, value]) => (
            <div key={label} className="surface rounded-lg p-5">
              <p className="text-sm font-semibold text-ink-soft">{label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
          <div className="surface rounded-lg p-5 md:col-span-4">
            <h2 className="text-lg font-semibold">Hoạt động gần đây</h2>
            <p className="mt-2 text-sm text-ink-soft">Hoạt động gần đây sẽ hiển thị chi tiết hơn khi analytics lớp học được mở rộng.</p>
          </div>
        </section>
      ) : null}

      {activeTab === "students" ? (
        <section className="surface overflow-hidden rounded-lg">
          <div className="grid grid-cols-[minmax(220px,1fr)_240px_140px_160px_120px] bg-panel-muted px-4 py-3 text-xs font-semibold uppercase text-ink-soft">
            <span>Học sinh</span>
            <span>Email</span>
            <span>Problem đã giải</span>
            <span>Độ chính xác TB</span>
            <span>Hoạt động cuối</span>
          </div>
          {students.map((member) => (
            <div key={member.id} className="grid grid-cols-[minmax(220px,1fr)_240px_140px_160px_120px] items-center border-t border-line px-4 py-3 text-sm">
              <span className="font-semibold">{member.user.displayName}</span>
              <span className="text-ink-soft">{member.user.email}</span>
              <span className="tabular-nums">{solvedByUser.get(member.userId) ?? 0}</span>
              <span className="text-ink-soft">Chưa tính</span>
              <span className="text-ink-soft">—</span>
            </div>
          ))}
          {!students.length ? <p className="border-t border-line p-5 text-sm text-ink-soft">Chưa có học sinh trong lớp.</p> : null}
        </section>
      ) : null}

      {activeTab === "assignments" ? (
        <section className="grid gap-3">
          {classroom.assignments.map((assignment) => {
            const submitted = assignment.submissions.filter((submission) => submission.submittedAt).length;
            const scored = assignment.submissions.filter((submission) => submission.total && submission.total > 0);
            const average =
              scored.length > 0
                ? Math.round(
                    (scored.reduce((sum, submission) => sum + ((submission.score ?? 0) / (submission.total ?? 1)), 0) /
                      scored.length) *
                      100,
                  )
                : null;
            return (
              <article key={assignment.id} className="surface rounded-lg p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <AssignmentStatusBadge status={assignment.status} />
                      <AssignmentTypeBadge type={assignment.assignmentType} />
                    </div>
                    <h2 className="mt-3 text-lg font-semibold">{assignment.title}</h2>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        Hạn nộp: {assignment.dueAt ? assignment.dueAt.toLocaleString("vi-VN") : "Không đặt"}
                      </span>
                      <span>Hoàn thành: {submitted}/{students.length}</span>
                      <span>Điểm TB: {average === null ? "—" : `${average}%`}</span>
                    </div>
                  </div>
                  <Link href={`/teacher/assignments/${assignment.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
                    Mở chi tiết
                  </Link>
                </div>
              </article>
            );
          })}
          {!classroom.assignments.length ? <p className="surface rounded-lg p-5 text-sm text-ink-soft">Chưa có bài được giao.</p> : null}
        </section>
      ) : null}

      {activeTab === "results" ? (
        <section className="surface overflow-x-auto rounded-lg p-5">
          <h2 className="text-lg font-semibold">Kết quả</h2>
          <div className="mt-4 min-w-[720px]">
            <div className="grid gap-2" style={{ gridTemplateColumns: `220px repeat(${Math.max(classroom.assignments.length, 1)}, minmax(160px,1fr))` }}>
              <span className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">Học sinh</span>
              {classroom.assignments.map((assignment) => (
                <span key={assignment.id} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                  {assignment.title}
                </span>
              ))}
              {students.map((member) => (
                <Fragment key={member.id}>
                  <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                    {member.user.displayName}
                  </span>
                  {classroom.assignments.map((assignment) => {
                    const submission = assignment.submissions.find((item) => item.userId === member.userId);
                    return (
                      <span key={`${member.id}-${assignment.id}`} className="rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                        {submission ? (
                          <>
                            {assignmentSubmissionStatusLabels[submission.status]} · {submission.score ?? "—"}/{submission.total ?? "—"}
                          </>
                        ) : (
                          "Chưa nộp"
                        )}
                      </span>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <form action={updateClassroomAction} className="surface rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Cài đặt lớp</h2>
            </div>
            <input type="hidden" name="classroomId" value={classroom.id} />
            <label className="mt-4 grid gap-1 text-sm font-semibold">
              Tên lớp
              <input name="name" defaultValue={classroom.name} required className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal" />
            </label>
            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Mô tả
              <textarea name="description" defaultValue={classroom.description ?? ""} className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" />
            </label>
            <button className="mt-4 min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Lưu thay đổi</button>
          </form>

          <form action={regenerateJoinCodeAction} className="surface h-fit rounded-lg p-5">
            <input type="hidden" name="classroomId" value={classroom.id} />
            <h2 className="text-lg font-semibold">Mã tham gia</h2>
            <p className="mt-2 font-mono text-2xl font-semibold">{classroom.joinCode}</p>
            <p className="mt-2 text-sm text-ink-soft">Học sinh dùng mã này ở trang tham gia lớp.</p>
            <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-4 text-sm font-semibold">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Tạo mã mới
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
