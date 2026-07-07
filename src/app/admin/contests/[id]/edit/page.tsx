import { notFound } from "next/navigation";
import { updateContestAction } from "@/app/admin/contests/actions";
import { ContestForm } from "@/components/admin/ContestForm";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditContestPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const [contest, problems] = await Promise.all([
    prisma.contest.findUnique({ where: { id }, include: { problems: true } }),
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        skillType: true,
        difficulty: true,
        estimatedMinutes: true,
        sourceCollection: { select: { name: true } },
        problemTopics: { include: { topic: { select: { name: true } } } },
      },
      orderBy: [{ skillType: "asc" }, { orderIndex: "asc" }],
      take: 120,
    }),
  ]);
  if (!contest) notFound();
  const contestForForm = {
    id: contest.id,
    title: contest.title,
    slug: contest.slug,
    description: contest.description,
    contestType: contest.contestType,
    status: contest.status,
    visibility: contest.visibility,
    durationMinutes: contest.durationMinutes,
    startsAt: contest.startsAt?.toISOString() ?? null,
    endsAt: contest.endsAt?.toISOString() ?? null,
    sourceName: contest.sourceName,
    rules: contest.rules,
    problems: contest.problems.map((problem) => ({
      problemId: problem.problemId,
      section: problem.section,
      orderIndex: problem.orderIndex,
      points: problem.points,
    })),
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Quản trị / Contests</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Chỉnh sửa contest</h1>
      </div>
      <ContestForm action={updateContestAction} problems={problems} contest={contestForForm} error={error} />
    </div>
  );
}
