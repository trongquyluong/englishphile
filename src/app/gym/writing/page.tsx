import Link from "next/link";
import { ArrowRight, FilePenLine, PenTool, Sparkles } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/auth/session";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { prisma } from "@/lib/prisma";

export default async function GymWritingPage() {
  const user = await getCurrentUser();
  const [problems, reviewCount, profile, recommendations] = await Promise.all([
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED", skillType: "WRITING" },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: 36,
    }),
    user
      ? prisma.submissionAnswer.count({
          where: { submission: { userId: user.id, problem: { skillType: "WRITING" } }, isCorrect: null },
        })
      : Promise.resolve(0),
    user ? prisma.userSkillProfile.findUnique({ where: { userId_skillType: { userId: user.id, skillType: "WRITING" } } }) : Promise.resolve(null),
    user ? getPersonalizedRecommendations(user.id, 8) : Promise.resolve([]),
  ]);
  const writingRecommendations = recommendations.filter((problem) => problem.skillType === "WRITING").slice(0, 3);

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <PenTool className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Gym / Writing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Viết có kế hoạch, không viết theo cảm tính</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Chọn prompt, lập thesis, gom ý chính và luyện cách triển khai. Writing có thể cần review thủ công trước khi tính điểm.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-mint rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Chấm bài Writing bằng AI</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft text-pretty">
                Dán bài luận của bạn để nhận điểm ước lượng và nhận xét chi tiết theo tiêu chí chuyên Anh: nội dung, bố cục,
                ngôn ngữ và lỗi diễn đạt.
              </p>
            </div>
          </div>
          <Link href="/gym/writing/grader" className="btn btn-primary shrink-0 self-start sm:self-center">
            Chấm bài ngay
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl p-5">
          <FilePenLine className="size-5 text-accent" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink-soft">Prompt đã xuất bản</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">{problems.length}</p>
        </div>
        <div className="surface rounded-2xl p-5">
          <Sparkles className="size-5 text-accent" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink-soft">Bài cần review</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">{reviewCount}</p>
        </div>
        <Link href="/wiki" className="surface surface-hover rounded-2xl p-5">
          <p className="text-sm font-semibold text-accent">Wiki</p>
          <h2 className="mt-2 text-lg font-semibold">Ôn cấu trúc bài viết</h2>
        </Link>
      </section>

      {user ? (
        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Writing cá nhân hóa</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {profile?.attempted ? `${profile.attempted} câu đã có dữ liệu.` : "Writing cần review thủ công nên dữ liệu sẽ tích lũy chậm hơn."}
              </p>
            </div>
            <Link href="/wiki" className="text-sm font-semibold text-accent-strong">Mở Wiki Writing</Link>
          </div>
          <div className="mt-3 grid gap-2">
            {writingRecommendations.map((problem) => (
              <Link key={problem.id} href={problem.actionLink} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[var(--shadow-border)]">
                <span className="font-semibold">{problem.title}</span>
                <span className="text-ink-soft"> · {problem.reason}</span>
              </Link>
            ))}
            {!writingRecommendations.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có gợi ý Writing riêng. Hãy chọn một prompt vừa sức.</p> : null}
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
              Viết bài <ArrowRight className="size-4" aria-hidden="true" />
            </div>
          </Link>
        ))}
        {!problems.length ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chưa có prompt Writing đã xuất bản</h2>
            <p className="mt-2 text-sm text-ink-soft">Prompt mới sẽ xuất hiện sau khi được review và publish.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
