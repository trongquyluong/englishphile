import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssignmentRunner } from "@/components/assignments/AssignmentRunner";
import { AssignmentStatusBadge, AssignmentTypeBadge } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { canSubmitAssignment, canViewAssignment } from "@/lib/classroom/permissions";
import type { ClientProblem } from "@/lib/problem-types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentAssignmentPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      classroom: true,
      submissions: { where: { userId: user.id }, orderBy: { submittedAt: "desc" } },
      problems: {
        where: { problem: { contentStatus: "PUBLISHED" } },
        orderBy: { orderIndex: "asc" },
        include: {
          problem: {
            include: {
              sourceCollection: { select: { name: true } },
              problemTopics: { include: { topic: { select: { name: true, slug: true } } } },
              questions: { where: { contentStatus: "PUBLISHED" }, orderBy: { orderIndex: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!assignment) notFound();
  if (user.role !== "STUDENT") redirect(`/teacher/assignments/${assignment.id}`);
  if (!(await canViewAssignment(user, assignment)) || !(await canSubmitAssignment(user, assignment))) notFound();

  const latestSubmission = assignment.submissions[0];
  const problems: ClientProblem[] = assignment.problems.map(({ problem }) => ({
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    skillType: problem.skillType,
    questionType: problem.questionType,
    difficulty: problem.difficulty,
    contentStatus: problem.contentStatus,
    statement: problem.statement,
    instructions: problem.instructions,
    estimatedMinutes: problem.estimatedMinutes,
    acceptanceRate: problem.acceptanceRate,
    sourceCollection: problem.sourceCollection,
    problemTopics: problem.problemTopics,
    questions: problem.questions.map((question) => ({
      id: question.id,
      type: question.type,
      skillType: question.skillType,
      difficulty: question.difficulty,
      prompt: question.prompt,
      passage: question.passage,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      rootWord: question.rootWord,
      keyword: question.keyword,
      targetSentence: question.targetSentence,
      lineNumber: question.lineNumber,
      metadata: question.metadata,
      orderIndex: question.orderIndex,
    })),
  }));

  return (
    <div className="grid gap-5">
      <section className="surface rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <AssignmentStatusBadge status={assignment.status} />
              <AssignmentTypeBadge type={assignment.assignmentType} />
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{assignment.title}</h1>
            {assignment.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{assignment.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
              <span>Lớp: {assignment.classroom?.name ?? "Bài mở"}</span>
              <span>Hạn nộp: {assignment.dueAt ? assignment.dueAt.toLocaleString("vi-VN") : "Không đặt"}</span>
              <span>Thời gian: {assignment.timeLimitMinutes ? `${assignment.timeLimitMinutes} phút` : "Không giới hạn"}</span>
              <span>{problems.length} problem</span>
            </div>
          </div>
          {latestSubmission?.submittedAt ? (
            <Link href={`/assignments/${assignment.id}/result`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-4 text-sm font-semibold">
              Xem kết quả đã nộp
            </Link>
          ) : null}
        </div>
      </section>

      <AssignmentRunner
        assignment={{
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          dueAt: assignment.dueAt?.toISOString() ?? null,
          timeLimitMinutes: assignment.timeLimitMinutes,
          problems,
        }}
      />
    </div>
  );
}
