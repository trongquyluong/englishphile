import Link from "next/link";
import { ClipboardCheck, Filter } from "lucide-react";
import { SkillBadge } from "@/components/ui/Badges";
import { requireTeacher } from "@/lib/classroom/permissions";
import { getManualGradingQueue } from "@/lib/grading/manual-grading";
import { skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function ManualGradingQueuePage({ searchParams }: PageProps) {
  const user = await requireTeacher();
  const params = await searchParams;
  const filters = {
    classroomId: getParam(params, "classroomId"),
    assignmentId: getParam(params, "assignmentId"),
    skillType: getParam(params, "skillType"),
    studentId: getParam(params, "studentId"),
    date: getParam(params, "date"),
  };
  const message = getParam(params, "message");
  const error = getParam(params, "error");

  const [queue, classrooms, assignments, students] = await Promise.all([
    getManualGradingQueue(user, filters),
    prisma.classroom.findMany({
      where: user.role === "ADMIN" ? undefined : { teacherId: user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.findMany({
      where: user.role === "ADMIN" ? undefined : { OR: [{ createdById: user.id }, { classroom: { teacherId: user.id } }] },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        classroomMemberships:
          user.role === "ADMIN"
            ? undefined
            : {
                some: { classroom: { teacherId: user.id } },
              },
      },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <header className="surface rounded-lg p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-accent" aria-hidden="true" />
          <p className="text-sm font-semibold text-accent">Chấm bài</p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bài cần chấm</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Hàng đợi gồm writing, sentence transformation chưa khớp chính xác và submission đang cần giáo viên kiểm tra.
        </p>
      </header>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <form className="surface rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Filter className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Bộ lọc</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select name="classroomId" defaultValue={filters.classroomId ?? ""} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
            <option value="">Tất cả lớp</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
          <select name="assignmentId" defaultValue={filters.assignmentId ?? ""} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
            <option value="">Tất cả assignment</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
          <select name="skillType" defaultValue={filters.skillType ?? ""} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
            <option value="">Tất cả dạng bài</option>
            {skillOrder.map((skill) => (
              <option key={skill} value={skill}>
                {skillLabels[skill]}
              </option>
            ))}
          </select>
          <select name="studentId" defaultValue={filters.studentId ?? ""} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
            <option value="">Tất cả học sinh</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName}
              </option>
            ))}
          </select>
          <input name="date" type="date" defaultValue={filters.date ?? ""} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm" />
        </div>
        <button className="mt-4 min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Lọc bài cần chấm</button>
      </form>

      <section className="surface overflow-hidden rounded-lg">
        <div className="grid grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_150px_minmax(160px,1fr)_170px_110px] bg-panel-muted px-4 py-3 text-xs font-semibold uppercase text-ink-soft">
          <span>Học sinh</span>
          <span>Problem</span>
          <span>Dạng câu</span>
          <span>Assignment</span>
          <span>Thời điểm nộp</span>
          <span>Thao tác</span>
        </div>
        {queue.map((item) => (
          <div key={item.id} className="grid grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_150px_minmax(160px,1fr)_170px_110px] items-center border-t border-line px-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{item.student.displayName}</span>
              <span className="block text-xs text-ink-soft">{item.student.email}</span>
            </span>
            <span className="font-semibold">{item.problem.title}</span>
            <span>
              <SkillBadge skill={item.question.skillType} />
            </span>
            <span className="text-ink-soft">{item.assignment?.title ?? "—"}</span>
            <span className="text-ink-soft">{item.submittedAt.toLocaleString("vi-VN")}</span>
            <Link href={`/teacher/grading/${item.id}`} className="font-semibold text-accent-strong">
              Chấm bài
            </Link>
          </div>
        ))}
        {!queue.length ? <p className="border-t border-line p-5 text-sm text-ink-soft">Không có bài cần chấm theo bộ lọc hiện tại.</p> : null}
      </section>
    </div>
  );
}
