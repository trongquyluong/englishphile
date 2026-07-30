import { notFound } from "next/navigation";
import { ProblemClient } from "@/components/problems/ProblemClient";
import { ProblemHeader } from "@/components/problems/ProblemHeader";
import { getCurrentUser, isContentAdminUser } from "@/lib/auth/session";
import {
  learnerQuestionPresentationSelect,
  toLearnerProblemDTO,
} from "@/lib/dto/learner-question";
import { getLearnerWritingRubrics } from "@/lib/dto/learner-writing-rubric.server";
import { submissionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const canManageContent = isContentAdminUser(user);

  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      sourceCollection: { select: { name: true } },
      problemTopics: { include: { topic: { select: { name: true, slug: true } } } },
      questions: {
        where: canManageContent ? undefined : { contentStatus: "PUBLISHED" },
        orderBy: { orderIndex: "asc" },
        select: learnerQuestionPresentationSelect,
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

  const writingRubrics = await getLearnerWritingRubrics(
    problem.questions.map((question) => question.id),
  );
  const clientProblem = toLearnerProblemDTO(problem, writingRubrics);

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
