import Link from "next/link";
import { BookOpenCheck, CalendarClock, Plus, UsersRound } from "lucide-react";
import { AssignmentStatusBadge, AssignmentTypeBadge } from "@/components/ui/Badges";
import { isAdminUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function StudentClassesPage() {
  const user = await requireUser();

  if (isAdminUser(user)) {
    return (
      <div className="grid gap-5">
        <section className="surface rounded-lg p-6">
          <h1 className="text-3xl font-semibold tracking-tight">Lớp học</h1>
          <p className="mt-2 text-sm text-ink-soft">Tài khoản giáo viên quản lý lớp ở khu vực teacher.</p>
          <Link href="/teacher/classes" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            Mở lớp giáo viên
          </Link>
        </section>
      </div>
    );
  }

  const memberships = await prisma.classroomMember.findMany({
    where: { userId: user.id, role: "STUDENT" },
    include: {
      classroom: {
        include: {
          teacher: true,
          assignments: {
            where: { status: "PUBLISHED" },
            include: { submissions: { where: { userId: user.id } } },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Học sinh</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Lớp học</h1>
          <p className="mt-2 text-sm text-ink-soft">Theo dõi bài được giao, hạn nộp và kết quả trong từng lớp.</p>
        </div>
        <Link href="/classes/join" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          <Plus className="size-4" aria-hidden="true" />
          Tham gia lớp
        </Link>
      </header>

      <section className="grid gap-4">
        {memberships.length ? (
          memberships.map((membership) => {
            const activeAssignments = membership.classroom.assignments.filter((assignment) => !assignment.submissions.some((submission) => submission.submittedAt));
            const dueSoon = activeAssignments.find((assignment) => assignment.dueAt);
            return (
              <article key={membership.id} className="surface rounded-lg p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{membership.classroom.name}</h2>
                    <p className="mt-2 text-sm text-ink-soft">Giáo viên: {membership.classroom.teacher.displayName}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <BookOpenCheck className="size-4" aria-hidden="true" />
                        Bài đang giao: <strong className="text-foreground">{activeAssignments.length}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        Sắp đến hạn: {dueSoon?.dueAt ? dueSoon.dueAt.toLocaleString("vi-VN") : "—"}
                      </span>
                    </div>
                  </div>
                  <Link href={`/classes/${membership.classroom.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                    Mở lớp
                  </Link>
                </div>
                {membership.classroom.assignments.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {membership.classroom.assignments.slice(0, 3).map((assignment) => (
                      <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="inline-flex items-center gap-2 rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                        <AssignmentStatusBadge status={assignment.status} />
                        <AssignmentTypeBadge type={assignment.assignmentType} />
                        {assignment.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="surface rounded-lg p-6 text-center">
            <UsersRound className="mx-auto size-8 text-accent" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">Chưa tham gia lớp nào</h2>
            <p className="mt-2 text-sm text-ink-soft">Nhập mã tham gia từ giáo viên để nhận bài được giao.</p>
            <Link href="/classes/join" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Tham gia lớp
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
