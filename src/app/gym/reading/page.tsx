import Link from "next/link";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/auth/session";
import { hasCompletedDiagnostic } from "@/lib/diagnostic";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { prisma } from "@/lib/prisma";

export default async function GymReadingPage() {
  const user = await getCurrentUser();
  const [problems, profile, recommendations, diagnosticCompleted] = await Promise.all([
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED", skillType: "READING" },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: 36,
    }),
    user ? prisma.userSkillProfile.findUnique({ where: { userId_skillType: { userId: user.id, skillType: "READING" } } }) : Promise.resolve(null),
    user ? getPersonalizedRecommendations(user.id, 8) : Promise.resolve([]),
    user ? hasCompletedDiagnostic(user.id) : Promise.resolve(false),
  ]);
  const readingRecommendations = recommendations.filter((problem) => problem.skillType === "READING").slice(0, 3);

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Gym / Reading</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Đọc hiểu theo năng lực</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Luyện passage, inference, vocabulary in context, tone và purpose. Bắt đầu bằng bài vừa sức, sau đó nâng độ khó theo kết quả.
            </p>
            {!diagnosticCompleted ? (
              <div className="mt-5">
                <Link href="/diagnostic" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
                  <Target className="size-4" aria-hidden="true" />
                  Kiểm tra trình độ
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {user ? (
        <section className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
          <div className="surface rounded-2xl p-5">
            <p className="text-sm font-semibold text-accent">Trạng thái Reading</p>
            <p className="mt-3 text-2xl font-semibold">
              {profile?.attempted ? `${Math.round((profile.accuracy ?? 0) * 100)}%` : "Chưa đủ dữ liệu"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{profile?.attempted ?? 0} câu đã có dữ liệu</p>
          </div>
          <div className="surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Reading nên luyện</h2>
            <div className="mt-3 grid gap-2">
              {readingRecommendations.map((problem) => (
                <Link key={problem.id} href={problem.actionLink} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[var(--shadow-border)]">
                  <span className="font-semibold">{problem.title}</span>
                  <span className="text-ink-soft"> · {problem.reason}</span>
                </Link>
              ))}
              {!readingRecommendations.length ? (
                <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">
                  {diagnosticCompleted
                    ? "Chưa có gợi ý Reading riêng. Hãy làm một bài đọc ngắn bên dưới."
                    : "Chưa có gợi ý Reading riêng. Hãy làm bài kiểm tra đầu vào hoặc một bài đọc ngắn."}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {problems.map((problem) => (
          <Link key={problem.id} href={`/problems/${problem.slug}`} className="surface surface-hover rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-balance">{problem.title}</h2>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{problem.statement}</p>
            <div className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              Luyện ngay <ArrowRight className="size-4" aria-hidden="true" />
            </div>
          </Link>
        ))}
        {!problems.length ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chưa có bài Reading đã xuất bản</h2>
            <p className="mt-2 text-sm text-ink-soft">Khi nội dung Reading được review và publish, bài luyện sẽ xuất hiện tại đây.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
