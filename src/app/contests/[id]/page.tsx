import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ListChecks, Trophy } from "lucide-react";
import { startContestAction } from "@/app/contests/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { findContestByIdOrSlug, getContestAvailability } from "@/lib/contests";
import { contestStatusLabels, contestTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContestDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const contest = await findContestByIdOrSlug(id);
  if (!contest || contest.visibility !== "PUBLIC" || contest.status === "DRAFT" || contest.status === "ARCHIVED") notFound();
  const latestAttempt = user
    ? await prisma.contestAttempt.findFirst({
        where: { contestId: contest.id, userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const sections = [...new Set(contest.problems.map((item) => item.section))];
  const availability = getContestAvailability(contest);
  const activeAttempt = latestAttempt?.status === "IN_PROGRESS" ? latestAttempt : null;

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">{contestTypeLabels[contest.contestType]}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{contest.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">{contest.description ?? "Contest luyện tập từ nội dung đã xuất bản."}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1 rounded-lg bg-panel-muted px-2 py-1">
            <Clock className="size-4" aria-hidden="true" />
            {contest.durationMinutes ? `${contest.durationMinutes} phút` : "Không giới hạn"}
          </span>
          <span className="rounded-lg bg-panel-muted px-2 py-1">{contestStatusLabels[contest.status]}</span>
          <span className="rounded-lg bg-panel-muted px-2 py-1">{contest.problems.length} problems</span>
          {contest.startsAt ? <span className="rounded-lg bg-panel-muted px-2 py-1">Mở: {contest.startsAt.toLocaleString("vi-VN")}</span> : null}
          {contest.endsAt ? <span className="rounded-lg bg-panel-muted px-2 py-1">Kết thúc: {contest.endsAt.toLocaleString("vi-VN")}</span> : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Sections</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {sections.map((section) => (
              <div key={section} className="rounded-xl bg-panel-muted p-3 text-sm">
                <span className="font-semibold">{section}</span>
                <span className="text-ink-soft"> · {contest.problems.filter((item) => item.section === section).length} problems</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="surface rounded-2xl p-5">
          <Trophy className="size-6 text-accent" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Sẵn sàng làm bài?</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{contest.rules ?? "Làm bài nghiêm túc, nộp một lần khi hoàn thành. Writing có thể cần chấm tay."}</p>
          {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
          <p className="mt-3 rounded-lg bg-panel-muted px-3 py-2 text-sm text-ink-soft">{availability.reason}</p>
          <div className="mt-5 grid gap-2">
            {activeAttempt ? (
              <Link href={`/contests/${contest.slug}/start?attempt=${activeAttempt.id}`} className="btn btn-primary">
                Tiếp tục lượt đang làm
              </Link>
            ) : null}
            {latestAttempt?.submittedAt ? (
              <Link href={`/contests/${contest.slug}/result?attempt=${latestAttempt.id}`} className="btn btn-primary">
                Xem kết quả gần nhất
              </Link>
            ) : null}
            <form action={startContestAction}>
              <input type="hidden" name="contestId" value={contest.id} />
              <button disabled={!availability.canStart || !contest.problems.length} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-panel-muted px-4 text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55">
                Bắt đầu contest
              </button>
            </form>
            <Link href={`/contests/${contest.slug}/leaderboard`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
              Leaderboard
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
