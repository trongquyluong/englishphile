import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, GraduationCap, ListChecks, Medal, Trophy } from "lucide-react";
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
  { id: "open", label: "Đang mở" },
  { id: "upcoming", label: "Sắp diễn ra" },
  { id: "ended", label: "Đã kết thúc" },
] as const;

type ContestTab = (typeof tabs)[number]["id"];

function getTab(value: unknown): ContestTab {
  return tabs.some((tab) => tab.id === value) ? (value as ContestTab) : "all";
}

const upcomingExamSets = [
  {
    title: "Đề chuyên Anh lớp 10",
    description: "Tuyển tập đề thi vào lớp 10 chuyên Anh, làm với thời gian như thi thật.",
    icon: GraduationCap,
  },
  {
    title: "Đề HSG tỉnh",
    description: "Đề học sinh giỏi cấp tỉnh theo từng năm, kèm đáp án và phần xem lại lỗi.",
    icon: Trophy,
  },
  {
    title: "Đề luyện theo kỹ năng",
    description: "Đề rút gọn tập trung một kỹ năng, ví dụ chỉ Reading hoặc chỉ Use of English.",
    icon: ListChecks,
  },
];

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
              Luyện đề theo thời gian, làm bài theo từng section. Nộp xong bạn xem được điểm và những câu cần sửa.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="hosted-contests" className="grid gap-4">
        <h2 id="hosted-contests" className="text-lg font-semibold">Contest</h2>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc contest theo trạng thái">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "all" ? "/contests" : `/contests?tab=${tab.id}`}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-[background-color,color] duration-150 ${
                activeTab === tab.id ? "bg-foreground text-background" : "bg-panel-muted text-ink-soft hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredContests.map((contest) => {
            const attempt = Array.isArray(contest.attempts) ? contest.attempts[0] : null;
            const availability = getContestAvailability(contest, now);
            return (
              <Link key={contest.id} href={`/contests/${contest.slug}`} className="surface surface-hover rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">{contestTypeLabels[contest.contestType]}</p>
                    <h3 className="mt-2 font-semibold text-balance">{contest.title}</h3>
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
                <div className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
                  {attempt?.status === "IN_PROGRESS" ? "Tiếp tục" : attempt?.submittedAt ? "Xem kết quả" : "Mở contest"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
          {!filteredContests.length ? (
            <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
              <h3 className="text-xl font-semibold">
                {activeTab === "all" || activeTab === "open" ? "Chưa có contest đang mở" : "Chưa có contest trong mục này"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Bạn có thể quay lại sau hoặc luyện trong Gym trước.</p>
              <Link
                href="/gym"
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
              >
                Vào Gym
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="exam-bank" className="grid gap-4">
        <div>
          <h2 id="exam-bank" className="text-lg font-semibold">Đề thi HSG/Chuyên</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
            Kho đề thi HSG/Chuyên sẽ được bổ sung sau. Mỗi đề sẽ có thời gian làm bài, đáp án và phần xem lại lỗi.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {upcomingExamSets.map((examSet) => {
            const Icon = examSet.icon;
            return (
              <article key={examSet.title} className="surface rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-panel-muted text-ink-soft">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-lg bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">Sắp có</span>
                </div>
                <h3 className="mt-3 font-semibold">{examSet.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{examSet.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
