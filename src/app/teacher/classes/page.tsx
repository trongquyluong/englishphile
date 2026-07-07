import Link from "next/link";
import { BookOpenCheck, Plus, UsersRound } from "lucide-react";
import { createClassroomAction } from "@/app/teacher/actions";
import { AssignmentStatusBadge } from "@/components/ui/Badges";
import { requireTeacher } from "@/lib/classroom/permissions";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function TeacherClassesPage({ searchParams }: PageProps) {
  const user = await requireTeacher();
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  const classrooms = await prisma.classroom.findMany({
    where: user.role === "ADMIN" ? undefined : { teacherId: user.id },
    include: {
      members: { include: { user: true } },
      assignments: { where: { status: "PUBLISHED" }, orderBy: { dueAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">Giáo viên</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Lớp học</h1>
          <p className="mt-2 text-sm text-ink-soft">Quản lý lớp, mã tham gia và bài đang giao cho học sinh.</p>
        </div>
        {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
        <div className="grid gap-3">
          {classrooms.length ? (
            classrooms.map((classroom) => {
              const studentCount = classroom.members.filter((member) => member.role === "STUDENT").length;
              return (
                <article key={classroom.id} className="surface rounded-lg p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{classroom.name}</h2>
                      {classroom.description ? <p className="mt-2 text-sm leading-6 text-ink-soft">{classroom.description}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
                        <span className="inline-flex items-center gap-1">
                          <UsersRound className="size-4" aria-hidden="true" />
                          Số học sinh: <strong className="text-foreground">{studentCount}</strong>
                        </span>
                        <span>
                          Bài đang giao: <strong className="text-foreground">{classroom.assignments.length}</strong>
                        </span>
                        <span>
                          Mã tham gia: <strong className="font-mono text-foreground">{classroom.joinCode}</strong>
                        </span>
                      </div>
                    </div>
                    <Link href={`/teacher/classes/${classroom.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                      Vào lớp
                    </Link>
                  </div>
                  {classroom.assignments.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {classroom.assignments.slice(0, 3).map((assignment) => (
                        <Link key={assignment.id} href={`/teacher/assignments/${assignment.id}`} className="inline-flex items-center gap-2 rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                          <AssignmentStatusBadge status={assignment.status} />
                          {assignment.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="surface rounded-lg p-6 text-sm text-ink-soft">Chưa có lớp học. Tạo lớp đầu tiên để bắt đầu giao bài.</div>
          )}
        </div>
      </section>

      <aside className="surface h-fit rounded-lg p-5 lg:sticky lg:top-24">
        <div className="flex items-center gap-2">
          <Plus className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Tạo lớp mới</h2>
        </div>
        <form action={createClassroomAction} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Tên lớp
            <input name="name" required className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal" placeholder="Chuyên Anh 9A" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Mô tả
            <textarea name="description" className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" />
          </label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            <BookOpenCheck className="size-4" aria-hidden="true" />
            Tạo lớp
          </button>
        </form>
      </aside>
    </div>
  );
}
