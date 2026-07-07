import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, BookOpen, Dumbbell, Headphones, PenTool, Sparkles, Target } from "lucide-react";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getStudentSkillStats } from "@/lib/analytics/student";
import { getActiveLearningRecommendations, getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Gym",
  description: "Gym là trung tâm luyện Reading, Writing, Listening và Use of English theo trình độ cá nhân.",
};

const gymCards = [
  {
    title: "Reading",
    href: "/gym/reading",
    icon: BookOpen,
    description: "Đọc hiểu, suy luận, mục đích tác giả, vocabulary in context.",
  },
  {
    title: "Writing",
    href: "/gym/writing",
    icon: PenTool,
    description: "Prompt viết, lập dàn ý, cấu trúc bài và vốn từ học thuật.",
  },
  {
    title: "Listening",
    href: "/gym/listening",
    icon: Headphones,
    description: "Khung luyện nghe future-ready cho audio, transcript và câu hỏi.",
  },
  {
    title: "Use of English",
    href: "/gym/use-of-english",
    icon: Dumbbell,
    description: "Grammar, vocabulary, cloze, transformation, collocations.",
  },
];

export default async function GymPage() {
  const user = await getCurrentUser();
  const [diagnostic, profileRecommendations, fallbackRecommendations, skillStats, recentSubmissions, wrongCount] = user
    ? await Promise.all([
        getLatestDiagnosticAttempt(user.id),
        getActiveLearningRecommendations(user.id, 4),
        getRecommendedProblemsForStudent(user.id, 4),
        getStudentSkillStats(user.id),
        prisma.submission.findMany({
          where: { userId: user.id },
          include: { problem: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        prisma.userProblemStatus.count({ where: { userId: user.id, status: "WRONG" } }),
      ])
    : [null, [], [], [], [], 0] as const;

  const profileProblemIds = new Set(profileRecommendations.map((item) => item.problemId).filter(Boolean));
  const recommendations = [
    ...profileRecommendations.filter((item) => item.problem).map((item) => ({ ...item.problem!, reason: item.reason })),
    ...fallbackRecommendations.filter((problem) => !profileProblemIds.has(problem.id)),
  ].slice(0, 4);
  const weakestSkill = skillStats.filter((skill) => skill.attempted > 0).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))[0];

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl bg-foreground p-6 text-background shadow-[0_24px_70px_-40px_rgba(23,33,27,0.55)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-background/60">Gym</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-balance">Luyện kỹ năng theo trình độ hiện tại</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-background/72">
          Gym là trung tâm luyện tập của Englishphile: chọn kỹ năng, làm bài phù hợp, xem lỗi sai và quay lại đúng phần cần cải thiện.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={user ? "/recommendations" : "/auth/sign-up"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-background px-4 text-sm font-semibold text-foreground transition-transform duration-150 ease-out active:scale-[0.96]">
            Bài nên luyện
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href={user ? "/practice/adaptive" : "/auth/sign-in"} className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-background">
            Luyện thích ứng
          </Link>
        </div>
      </section>

      {!diagnostic ? (
        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">Kiểm tra trình độ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Bắt đầu bằng diagnostic</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {user
                  ? "Englishphile sẽ ước lượng level và ưu tiên bài luyện phù hợp hơn."
                  : "Tạo tài khoản để lưu kết quả diagnostic, nhận gợi ý cá nhân và theo dõi tiến bộ."}
              </p>
            </div>
            <Link href={user ? "/diagnostic" : "/auth/sign-up"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
              <Target className="size-4" aria-hidden="true" />
              {user ? "Kiểm tra trình độ" : "Tạo tài khoản"}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {gymCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="surface surface-hover rounded-2xl p-5">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{card.description}</p>
            </Link>
          );
        })}
      </section>

      {user ? (
        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Trạng thái kỹ năng</h2>
              <p className="mt-1 text-sm text-ink-soft">Dựa trên diagnostic và các submission đã chấm được.</p>
            </div>
            <Link href="/analytics" className="text-sm font-semibold text-accent-strong">Xem thống kê</Link>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {skillStats.slice(0, 8).map((skill) => (
              <Link key={skill.skillType} href={`/analytics/skills/${skill.skillType}`} className="rounded-xl bg-white p-3 shadow-[var(--shadow-border)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{skill.label}</p>
                  <span className="text-xs font-semibold text-ink-soft">{skill.statusLabel}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((skill.accuracy ?? 0) * 100)}%` }} />
                </div>
              </Link>
            ))}
            {!skillStats.some((skill) => skill.attempted > 0) ? (
              <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft md:col-span-2 xl:col-span-4">
                Chưa đủ dữ liệu. Làm diagnostic để mở khóa trạng thái kỹ năng.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Gợi ý hôm nay</h2>
              <p className="mt-1 text-sm text-ink-soft">Dựa trên diagnostic, lỗi sai và phần còn yếu.</p>
            </div>
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3">
            {recommendations.map((problem) => (
              <Link key={problem.id} href={`/problems/${problem.slug}`} className="rounded-xl bg-white p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[var(--shadow-border-hover)]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-balance">{problem.title}</h3>
                  <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <SkillBadge skill={problem.skillType} />
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{problem.reason}</p>
              </Link>
            ))}
            {!recommendations.length ? (
              <div className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">
                <p>{user ? "Chưa có gợi ý. Hãy làm diagnostic hoặc một bài luyện ngắn." : "Đăng nhập để Englishphile đề xuất bài luyện theo trình độ và lỗi sai của bạn."}</p>
                {!user ? (
                  <Link href="/auth/sign-in" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
                    Đăng nhập
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Tiến độ nhanh</h2>
          </div>
          <dl className="mt-4 grid gap-3">
            <div className="rounded-xl bg-panel-muted p-4">
              <dt className="text-sm text-ink-soft">Kỹ năng cần chú ý</dt>
              <dd className="mt-1 font-semibold">{weakestSkill?.label ?? "Chưa đủ dữ liệu"}</dd>
            </div>
            <div className="rounded-xl bg-panel-muted p-4">
              <dt className="text-sm text-ink-soft">Câu đang sai</dt>
              <dd className="tabular-nums mt-1 text-2xl font-semibold">{wrongCount}</dd>
            </div>
            <div className="rounded-xl bg-panel-muted p-4">
              <dt className="text-sm text-ink-soft">Submission gần đây</dt>
              <dd className="mt-2 grid gap-2">
                {recentSubmissions.map((submission) => (
                  <Link key={submission.id} href={`/problems/${submission.problem.slug}`} className="text-sm font-semibold text-accent-strong">
                    {submission.problem.title}
                  </Link>
                ))}
                {!recentSubmissions.length ? <span className="text-sm text-ink-soft">Chưa có submission.</span> : null}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}
