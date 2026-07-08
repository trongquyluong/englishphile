import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, BookOpen, Dumbbell, Headphones, PenTool, Sparkles, Target } from "lucide-react";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { AccuracyBar, LearnerCard } from "@/components/ui/LearnerCard";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getStudentSkillStats } from "@/lib/analytics/student";
import {
  getActiveLearningRecommendations,
  getLatestDiagnosticAttempt,
  hasCompletedDiagnostic,
} from "@/lib/diagnostic";
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
  const [diagnostic, diagnosticCompleted, profileRecommendations, fallbackRecommendations, skillStats, recentSubmissions, wrongCount] = user
    ? await Promise.all([
        getLatestDiagnosticAttempt(user.id),
        hasCompletedDiagnostic(user.id),
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
    : [null, false, [], [], [], [], 0] as const;

  const diagnosticInProgress = diagnostic?.status === "IN_PROGRESS";

  const profileProblemIds = new Set(profileRecommendations.map((item) => item.problemId).filter(Boolean));
  const recommendations = [
    ...profileRecommendations.filter((item) => item.problem).map((item) => ({ ...item.problem!, reason: item.reason })),
    ...fallbackRecommendations.filter((problem) => !profileProblemIds.has(problem.id)),
  ].slice(0, 4);
  const weakestSkill = skillStats.filter((skill) => skill.attempted > 0).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))[0];

  return (
    <div className="grid gap-6">
      <section className="surface-mint rounded-[2rem] p-6 sm:p-10">
        <p className="text-sm font-semibold text-accent">Gym</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-balance">
          {recommendations.length > 0
            ? "Hôm nay nên luyện gì?"
            : "Luyện kỹ năng theo trình độ hiện tại"}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">
          {recommendations.length > 0
            ? "Bài dưới đây được gợi ý dựa trên bài kiểm tra đầu vào và lỗi sai gần đây. Chọn một bài để bắt đầu."
            : "Chọn kỹ năng, làm bài phù hợp, xem lỗi sai và quay lại đúng phần cần cải thiện."}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {recommendations.length > 0 ? (
            <Link href={`/problems/${recommendations[0].slug}`} className="btn btn-primary">
              Luyện bài tiếp theo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : user ? (
            diagnosticCompleted ? (
              <Link href="/gym/use-of-english" className="btn btn-primary">
                Luyện Use of English
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link href={diagnosticInProgress ? "/diagnostic/start" : "/diagnostic"} className="btn btn-primary">
                <Target className="size-4" aria-hidden="true" />
                {diagnosticInProgress ? "Làm tiếp bài kiểm tra đầu vào" : "Làm bài kiểm tra đầu vào"}
              </Link>
            )
          ) : (
            <Link href="/auth/sign-up" className="btn btn-primary">
              Bắt đầu miễn phí
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          <Link href={user ? "/practice/adaptive" : "/auth/sign-in"} className="btn btn-secondary">
            Tạo buổi luyện theo mục tiêu
          </Link>
          {user ? (
            <Link href="/wrong-questions" className="btn btn-ghost">
              Ôn lại câu sai
            </Link>
          ) : null}
        </div>
      </section>

      {!diagnosticCompleted ? (
        <section className="surface rounded-3xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">Kiểm tra trình độ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {diagnosticInProgress ? "Hoàn thành bài kiểm tra đầu vào" : "Bắt đầu bằng bài kiểm tra đầu vào"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {user
                  ? diagnosticInProgress
                    ? "Bạn đang làm dở bài kiểm tra. Hoàn thành để nhận gợi ý bài luyện phù hợp hơn."
                    : "Englishphile sẽ ước lượng trình độ và ưu tiên bài luyện phù hợp hơn."
                  : "Tạo tài khoản để lưu kết quả kiểm tra đầu vào, nhận gợi ý cá nhân và theo dõi tiến bộ."}
              </p>
            </div>
            <Link
              href={user ? (diagnosticInProgress ? "/diagnostic/start" : "/diagnostic") : "/auth/sign-up"}
              className="btn btn-primary"
            >
              <Target className="size-4" aria-hidden="true" />
              {user ? (diagnosticInProgress ? "Làm tiếp bài kiểm tra" : "Làm bài kiểm tra đầu vào") : "Tạo tài khoản"}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {gymCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="surface surface-hover rounded-3xl p-6">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{card.description}</p>
            </Link>
          );
        })}
      </section>

      {user ? (
        <LearnerCard>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Trạng thái kỹ năng</h2>
              <p className="mt-1 text-sm text-ink-soft">Dựa trên bài kiểm tra đầu vào và các bài đã chấm được.</p>
            </div>
            <Link href="/analytics" className="text-sm font-semibold text-accent-strong">Xem thống kê</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {skillStats.slice(0, 8).map((skill) => (
              <Link key={skill.skillType} href={`/analytics/skills/${skill.skillType}`} className="rounded-2xl bg-panel-muted p-4">
                <AccuracyBar accuracy={skill.accuracy} label={skill.label} />
                <p className="mt-2 text-xs text-ink-soft">{skill.statusLabel}</p>
              </Link>
            ))}
            {!skillStats.some((skill) => skill.attempted > 0) ? (
              <p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft md:col-span-2 xl:col-span-4">
                {diagnosticCompleted
                  ? "Chưa đủ dữ liệu. Hãy luyện thêm vài bài để cập nhật trạng thái kỹ năng."
                  : "Chưa đủ dữ liệu. Làm bài kiểm tra đầu vào để mở khóa trạng thái kỹ năng."}
              </p>
            ) : null}
          </div>
        </LearnerCard>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <LearnerCard>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Gợi ý hôm nay</h2>
          </div>
          {user && (
            <p className="mt-1 text-sm text-ink-soft">Dựa trên bài kiểm tra đầu vào, lỗi sai và phần còn yếu.</p>
          )}
          <div className="mt-4 grid gap-3">
            {recommendations.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.slug}`}
                className="rounded-2xl bg-panel-muted p-4 transition-shadow hover:shadow-[var(--shadow-border-hover)]"
              >
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
              <div className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">
                <p>
                  {user
                    ? diagnosticCompleted
                      ? "Chưa có gợi ý mới. Hãy luyện một bài bất kỳ trong Gym."
                      : "Chưa có gợi ý. Hãy làm bài kiểm tra đầu vào hoặc một bài luyện ngắn."
                    : "Đăng nhập để Englishphile đề xuất bài luyện theo trình độ và lỗi sai của bạn."}
                </p>
                {!user ? (
                  <Link href="/auth/sign-in" className="btn btn-sm btn-primary mt-3">
                    Đăng nhập
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </LearnerCard>

        <aside className="surface rounded-3xl p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Tiến độ nhanh</h2>
          </div>
          <dl className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-panel-muted p-4">
              <dt className="text-sm text-ink-soft">Kỹ năng cần chú ý</dt>
              <dd className="mt-1 font-semibold">{weakestSkill?.label ?? "Chưa đủ dữ liệu"}</dd>
            </div>
            <div className="rounded-2xl bg-panel-muted p-4">
              <dt className="text-sm text-ink-soft">Câu đang sai</dt>
              <dd className="tabular-nums mt-1 text-2xl font-semibold">{wrongCount}</dd>
              <Link
                href="/wrong-questions"
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent transition-colors duration-150 hover:text-accent-strong"
              >
                Ôn lại câu sai
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="rounded-2xl bg-panel-muted p-4">
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
