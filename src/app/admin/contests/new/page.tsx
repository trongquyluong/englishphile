import { createContestAction } from "@/app/admin/contests/actions";
import { ContestForm } from "@/components/admin/ContestForm";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContestPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const problems = await prisma.problem.findMany({
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
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Quản trị / Contests</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tạo contest</h1>
      </div>
      <ContestForm action={createContestAction} problems={problems} error={error} />
    </div>
  );
}
