import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { contestStatusLabels, contestTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function AdminContestsBuilderPage() {
  await requireAdmin();
  const contests = await prisma.contest.findMany({
    include: {
      _count: { select: { sections: true, attempts: true } },
      sections: { include: { _count: { select: { questions: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Quản trị</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Contest Builder</h1>
          <p className="mt-2 text-sm text-ink-soft">Tạo contest với section và câu hỏi tuỳ chỉnh, hỗ trợ Listening audio.</p>
        </div>
        <Link
          href="/admin/contests-builder/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tạo contest
        </Link>
      </div>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="hidden border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft lg:grid lg:grid-cols-[minmax(280px,1fr)_120px_100px_100px_100px_120px]">
          <span>Contest</span>
          <span>Loại</span>
          <span>Status</span>
          <span>Sections</span>
          <span>Câu hỏi</span>
          <span>Attempts</span>
        </div>
        <div className="divide-y divide-line">
          {contests.map((contest) => {
            const sectionCount = contest._count.sections;
            const questionCount = contest.sections.reduce((sum, s) => sum + s._count.questions, 0);
            return (
              <Link
                key={contest.id}
                href={`/admin/contests-builder/${contest.id}/edit`}
                className="grid gap-3 px-5 py-4 hover:bg-panel-muted lg:grid-cols-[minmax(280px,1fr)_120px_100px_100px_100px_120px] lg:items-center"
              >
                <div>
                  <p className="font-semibold">{contest.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">{contest.slug}</p>
                </div>
                <span className="text-sm text-ink-soft">{contestTypeLabels[contest.contestType]}</span>
                <span className="text-sm font-semibold">{contestStatusLabels[contest.status]}</span>
                <span className="tabular-nums text-sm">{sectionCount}</span>
                <span className="tabular-nums text-sm">{questionCount}</span>
                <span className="tabular-nums text-sm">{contest._count.attempts}</span>
              </Link>
            );
          })}
          {!contests.length ? (
            <div className="p-10 text-center">
              <p className="text-sm text-ink-soft">Chưa có contest nào.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
