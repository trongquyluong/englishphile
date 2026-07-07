import Link from "next/link";
import { Medal, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { contestStatusLabels, contestTypeLabels, contestVisibilityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function AdminContestsPage() {
  await requireAdmin();
  const contests = await prisma.contest.findMany({
    include: { _count: { select: { problems: true, attempts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Quản trị</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Contests</h1>
          <p className="mt-2 text-sm text-ink-soft">Tạo đề thi cũ, contest luyện tập hoặc contest trực tiếp từ problem đã xuất bản.</p>
        </div>
        <Link href="/admin/contests/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
          <Plus className="size-4" aria-hidden="true" />
          Tạo contest
        </Link>
      </div>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="hidden border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft lg:grid lg:grid-cols-[minmax(260px,1fr)_140px_120px_120px_110px_140px]">
          <span>Contest</span>
          <span>Type</span>
          <span>Status</span>
          <span>Visibility</span>
          <span>Problems</span>
          <span>Attempts</span>
        </div>
        <div className="divide-y divide-line">
          {contests.map((contest) => (
            <Link key={contest.id} href={`/admin/contests/${contest.id}`} className="grid gap-3 px-5 py-4 hover:bg-panel-muted lg:grid-cols-[minmax(260px,1fr)_140px_120px_120px_110px_140px] lg:items-center">
              <div>
                <p className="font-semibold">{contest.title}</p>
                <p className="mt-1 text-xs text-ink-soft">{contest.slug}</p>
              </div>
              <span className="text-sm text-ink-soft">{contestTypeLabels[contest.contestType]}</span>
              <span className="text-sm font-semibold">{contestStatusLabels[contest.status]}</span>
              <span className="text-sm text-ink-soft">{contestVisibilityLabels[contest.visibility]}</span>
              <span className="tabular-nums text-sm">{contest._count.problems}</span>
              <span className="tabular-nums text-sm">{contest._count.attempts}</span>
            </Link>
          ))}
          {!contests.length ? (
            <div className="p-8 text-center">
              <Medal className="mx-auto size-8 text-accent" aria-hidden="true" />
              <p className="mt-3 text-sm text-ink-soft">Chưa có contest.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
