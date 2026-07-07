import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { contestStatusLabels, contestTypeLabels, contestVisibilityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminContestDetailPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const message = typeof query.message === "string" ? query.message : undefined;
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { orderIndex: "asc" }, include: { problem: true } },
      attempts: { include: { user: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!contest) notFound();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Quản trị / Contest</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{contest.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{contest.description ?? "Chưa có mô tả."}</p>
        </div>
        <Link href={`/admin/contests/${contest.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
          <Pencil className="size-4" aria-hidden="true" />
          Chỉnh sửa
        </Link>
      </div>
      {message ? <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">{message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Type", contestTypeLabels[contest.contestType]],
          ["Status", contestStatusLabels[contest.status]],
          ["Visibility", contestVisibilityLabels[contest.visibility]],
          ["Duration", contest.durationMinutes ? `${contest.durationMinutes} phút` : "Không giới hạn"],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
            <p className="mt-2 font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Problems</h2>
        <div className="mt-4 grid gap-2">
          {contest.problems.map((item) => (
            <Link key={item.id} href={`/admin/problems/${item.problemId}`} className="rounded-xl bg-white p-3 text-sm shadow-[var(--shadow-border)]">
              <span className="font-semibold">{item.problem.title}</span>
              <span className="text-ink-soft"> Â· {item.section}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Attempts gần đây</h2>
        <div className="mt-4 grid gap-2">
          {contest.attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-xl bg-white p-3 text-sm shadow-[var(--shadow-border)]">
              <span className="font-semibold">{attempt.user.displayName}</span>
              <span className="text-ink-soft"> Â· {attempt.score ?? "â€”"}/{attempt.total ?? "â€”"} Â· {attempt.createdAt.toLocaleString("vi-VN")}</span>
            </div>
          ))}
          {!contest.attempts.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có lượt làm.</p> : null}
        </div>
      </section>
    </div>
  );
}
