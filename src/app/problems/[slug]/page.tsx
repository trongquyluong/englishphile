import { notFound } from "next/navigation";
import { ProblemClient } from "@/components/problems/ProblemClient";
import { ProblemHeader } from "@/components/problems/ProblemHeader";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { submissionStatusLabels } from "@/lib/labels";
import type { ClientProblem } from "@/lib/problem-types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const canManageContent = isAdminUser(user);

  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      sourceCollection: { select: { name: true } },
      problemTopics: { include: { topic: { select: { name: true, slug: true } } } },
      questions: {
        where: canManageContent ? undefined : { contentStatus: "PUBLISHED" },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!problem) {
    notFound();
  }

  if (problem.contentStatus !== "PUBLISHED" && !canManageContent) {
    notFound();
  }

  const history = user
    ? await prisma.submission.findMany({
        where: { userId: user.id, problemId: problem.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

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
      <ProblemHeader problem={clientProblem} />
      <ProblemClient
        problem={clientProblem}
        isAuthenticated={Boolean(user)}
        history={history.map((submission) => ({
          id: submission.id,
          status: submissionStatusLabels[submission.status],
          score: submission.score,
          total: submission.total,
          createdAt: submission.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
