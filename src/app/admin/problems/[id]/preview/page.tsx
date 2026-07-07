import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemClient } from "@/components/problems/ProblemClient";
import { ProblemHeader } from "@/components/problems/ProblemHeader";
import { requireAdmin } from "@/lib/auth/session";
import type { ClientProblem } from "@/lib/problem-types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProblemPreviewPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      sourceCollection: { select: { name: true } },
      problemTopics: { include: { topic: { select: { name: true, slug: true } } } },
      questions: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!problem) notFound();

  const clientProblem: ClientProblem = {
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
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/problems/${problem.id}`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-3 text-sm font-semibold">
          Quay lại admin detail
        </Link>
        <Link href={`/admin/problems/${problem.id}/edit`} className="inline-flex min-h-10 items-center rounded-md bg-foreground px-3 text-sm font-semibold text-background">
          Chỉnh sửa
        </Link>
      </div>
      <ProblemHeader problem={clientProblem} />
      <ProblemClient problem={clientProblem} isAuthenticated history={[]} previewMode />
    </div>
  );
}
