import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ContestBuilderEdit } from "@/app/admin/contests-builder/[id]/edit/ContestBuilderEdit";
import { validateContestForPublish } from "@/app/admin/contests-builder/actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContestBuilderEditPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;

  const flashMessage = typeof query.message === "string" ? query.message : undefined;
  const flashError = typeof query.error === "string" ? query.error : undefined;

  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      sections: {
        include: { questions: { orderBy: { orderIndex: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!contest) notFound();

  const validationErrors = await validateContestForPublish(contest.id);

  const contestData = {
    id: contest.id,
    title: contest.title,
    slug: contest.slug,
    description: contest.description,
    status: contest.status,
    visibility: contest.visibility,
    accessCode: contest.accessCode,
    durationMinutes: contest.durationMinutes,
    startsAt: contest.startsAt?.toISOString() ?? null,
    endsAt: contest.endsAt?.toISOString() ?? null,
  };

  const sectionsData = contest.sections.map((section) => ({
    id: section.id,
    title: section.title,
    skillType: section.skillType,
    orderIndex: section.orderIndex,
    instructions: section.instructions,
    points: section.points,
    audioUrl: section.audioUrl,
    transcript: section.transcript,
    passageText: section.passageText,
    questions: section.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      type: q.type,
      prompt: q.prompt,
      optionsJson: q.optionsJson,
      answerJson: q.answerJson,
      points: q.points,
      explanation: q.explanation,
      rootWord: q.rootWord,
    })),
  }));

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/contests-builder" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Quay lại
        </Link>
      </div>

      <div>
        <p className="text-sm font-semibold text-accent">Quản trị / Contest Builder</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Chỉnh sửa: {contest.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{contest.slug}</p>
      </div>

      <ContestBuilderEdit
        contest={contestData}
        sections={sectionsData}
        validationErrors={validationErrors}
        flashMessage={flashMessage}
        flashError={flashError}
      />
    </div>
  );
}
