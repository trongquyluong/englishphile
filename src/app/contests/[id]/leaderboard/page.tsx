import Link from "next/link";
import { notFound } from "next/navigation";
import { Medal } from "lucide-react";
import { findContestByIdOrSlug } from "@/lib/contests";
import { contestAttemptStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function displayName(user: { username: string | null; fullName: string | null; displayName: string }) {
  return user.username || user.fullName || user.displayName;
}

function formatTime(seconds: number | null) {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default async function ContestLeaderboardPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await findContestByIdOrSlug(id);
  if (!contest || contest.visibility !== "PUBLIC" || contest.status === "DRAFT" || contest.status === "ARCHIVED") notFound();

  const attempts = await prisma.contestAttempt.findMany({
    where: {
      contestId: contest.id,
      status: { in: ["SUBMITTED", "LATE", "NEEDS_REVIEW"] },
      submittedAt: { not: null },
    },
    include: { user: { select: { username: true, fullName: true, displayName: true } } },
    orderBy: [{ score: "desc" }, { timeSpentSeconds: "asc" }, { submittedAt: "asc" }],
    take: 50,
  });

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Leaderboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{contest.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
          Bảng này chỉ hiển thị tên người dùng hoặc họ tên công khai. Email không được hiển thị.
        </p>
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="hidden border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft md:grid md:grid-cols-[80px_minmax(220px,1fr)_110px_140px_170px]">
          <span>Hạng</span>
          <span>Học viên</span>
          <span>Điểm</span>
          <span>Thời gian</span>
          <span>Trạng thái</span>
        </div>
        <div className="divide-y divide-line">
          {attempts.map((attempt, index) => (
            <div key={attempt.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[80px_minmax(220px,1fr)_110px_140px_170px] md:items-center">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-panel-muted font-semibold tabular-nums">
                {index < 3 ? <Medal className="size-4 text-accent" aria-hidden="true" /> : index + 1}
              </span>
              <span className="font-semibold">{displayName(attempt.user)}</span>
              <span className="tabular-nums text-ink-soft">{attempt.score ?? 0}/{attempt.total ?? 0}</span>
              <span className="tabular-nums text-ink-soft">{formatTime(attempt.timeSpentSeconds)}</span>
              <span className="text-ink-soft">{contestAttemptStatusLabels[attempt.status]}</span>
            </div>
          ))}
          {!attempts.length ? (
            <div className="p-8 text-center">
              <Medal className="mx-auto size-8 text-accent" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold">Chưa có lượt nộp</h2>
              <p className="mt-2 text-sm text-ink-soft">Leaderboard sẽ có dữ liệu sau khi học viên nộp contest.</p>
            </div>
          ) : null}
        </div>
      </section>

      <Link href={`/contests/${contest.slug}`} className="inline-flex w-fit min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
        Quay lại contest
      </Link>
    </div>
  );
}
