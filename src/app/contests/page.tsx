import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, Medal } from "lucide-react";
import { contestStatusLabels, contestTypeLabels } from "@/lib/labels";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestAvailability } from "@/lib/contests";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Contests",
  description: "Làm đề thi cũ và contest tiếng Anh theo thời gian trên Englishphile.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs = [
  { id: "all", label: "Tất cả" },
  { id: "past", label: "Đề cũ" },
  { id: "open", label: "Contest đang mở" },
  { id: "upcoming", label: "Sắp diễn ra" },
  { id: "ended", label: "Đã kết thúc" },
] as const;

type ContestTab = (typeof tabs)[number]["id"];

function getTab(value: unknown): ContestTab {
  return tabs.some((tab) => tab.id === value) ? (value as ContestTab) : "all";
}

export default async function ContestsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const activeTab = getTab(query.tab);
  const now = new Date();
  const contests = await prisma.contest.findMany({
    where: {
      visibility: "PUBLIC",
      status: { notIn: ["DRAFT", "ARCHIVED"] },
    },
    include: {
      _count: { select: { problems: true } },
      attempts: user ? { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1 } : false,
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });
  const filteredContests = contests.filter((contest) => {
    if (activeTab === "past") return contest.contestType === "PAST_EXAM";
    if (activeTab === "open") return getContestAvailability(contest, now).canStart && contest.status !== "ENDED";
    if (activeTab === "upcoming") return contest.startsAt && contest.startsAt > now;
    if (activeTab === "ended") return contest.status === "ENDED" || Boolean(contest.endsAt && contest.endsAt < now);
    return true;
  });

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Medal className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Contests</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Đề thi cũ và contest theo thời gian</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Làm bài theo section, giới hạn thời gian và điểm số. Leaderboard có thể được bổ sung sau; hiện tại tập trung vào trải nghiệm làm đề chắc chắn.
            </p>
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "all" ? "/contests" : `/contests?tab=${tab.id}`}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-[background-color,color] duration-150 ${
              activeTab === tab.id ? "bg-foreground text-background" : "bg-panel-muted text-ink-soft hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredContests.map((contest) => {
          const attempt = Array.isArray(contest.attempts) ? contest.attempts[0] : null;
          const availability = getContestAvailability(contest, now);
          return (
            <Link key={contest.id} href={`/contests/${contest.slug}`} className="surface surface-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">{contestTypeLabels[contest.contestType]}</p>
                  <h2 className="mt-2 font-semibold text-balance">{contest.title}</h2>
                </div>
                <span className="rounded-lg bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">{contestStatusLabels[contest.status]}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{contest.description ?? "Contest luyện tập từ nội dung đã xuất bản."}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden="true" />
                  {contest.durationMinutes ? `${contest.durationMinutes} phút` : "Không giới hạn"}
                </span>
                <span>{contest._count.problems} problems</span>
                {attempt ? <span>{attempt.status === "IN_PROGRESS" ? "Đang làm" : "Đã làm"}</span> : <span>Chưa làm</span>}
              </div>
              <p className="mt-3 text-xs font-medium text-ink-soft">{availability.reason}</p>
              <div className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
                {attempt?.status === "IN_PROGRESS" ? "Tiếp tục" : attempt?.submittedAt ? "Xem kết quả" : "Mở contest"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
        {!filteredContests.length ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chưa có contest nào trong mục này</h2>
            <p className="mt-2 text-sm text-ink-soft">Khi quản trị viên publish contest hoặc đề thi cũ phù hợp, danh sách sẽ xuất hiện tại đây.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
