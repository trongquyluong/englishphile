import { createAssignmentAction } from "@/app/teacher/actions";
import { AssignmentBuilder } from "@/components/assignments/AssignmentBuilder";
import { requireTeacher } from "@/lib/classroom/permissions";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function NewAssignmentPage({ searchParams }: PageProps) {
  const user = await requireTeacher();
  const params = await searchParams;
  const defaultClassroomId = getParam(params, "classroomId");
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  const [classrooms, problems] = await Promise.all([
    prisma.classroom.findMany({
      where: user.role === "ADMIN" ? undefined : { teacherId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED" },
      orderBy: [{ skillType: "asc" }, { difficulty: "asc" }, { orderIndex: "asc" }],
      select: {
        id: true,
        title: true,
        skillType: true,
        difficulty: true,
        estimatedMinutes: true,
        sourceCollection: { select: { id: true, name: true } },
        problemTopics: { include: { topic: { select: { id: true, name: true, slug: true } } } },
      },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold text-accent">Giáo viên</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Giao bài</h1>
        <p className="mt-2 text-sm text-ink-soft">Tạo practice set, homework hoặc mock test từ problem đã xuất bản.</p>
      </header>
      <AssignmentBuilder
        action={createAssignmentAction}
        classrooms={classrooms}
        problems={problems}
        defaultClassroomId={defaultClassroomId}
        error={error}
        message={message}
      />
    </div>
  );
}
