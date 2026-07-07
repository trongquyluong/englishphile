import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  Dumbbell,
  FileArchive,
  Target,
  Trophy,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { Sidebar } from "@/components/layout/Sidebar";
import { ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { isAdminUser, requireUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { getStudentSkillStats } from "@/lib/analytics/student";
import { getActiveLearningRecommendations, getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { submissionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type LifecycleCard = [string, number, ContentStatus];

const modeCards = [
  { title: "Gym", href: "/gym", icon: Dumbbell, description: "Hub luyện Reading, Writing, Listening và Use of English." },
  { title: "Contests", href: "/contests", icon: Trophy, description: "Thử đề cũ hoặc contest theo thời gian." },
  { title: "Wiki", href: "/wiki", icon: BookOpenText, description: "Ghi chú chiến thuật và kiến thức nền." },
  { title: "Profile", href: "/profile", icon: UserRound, description: "Cập nhật hồ sơ học viên và mục tiêu thi." },
];

function accuracyText(correct: number, total: number) {
  return total ? `${Math.round((correct / total) * 100)}%` : "—";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const canManageContent = isAdminUser(user);

  const [statuses, recentSubmissions, answerStats, skillStats, fallbackRecommendations, diagnostic, profileRecommendations] =
    await Promise.all([
      prisma.userProblemStatus.findMany({ where: { userId: user.id } }),
      prisma.submission.findMany({
        where: { userId: user.id },
        include: { problem: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.submissionAnswer.findMany({
        where: { submission: { userId: user.id }, isCorrect: { not: null } },
        select: { isCorrect: true },
      }),
      canManageContent ? Promise.resolve([]) : getStudentSkillStats(user.id),
      canManageContent ? Promise.resolve([]) : getRecommendedProblemsForStudent(user.id, 6),
      canManageContent ? Promise.resolve(null) : getLatestDiagnosticAttempt(user.id),
      canManageContent ? Promise.resolve([]) : getActiveLearningRecommendations(user.id, 6),
    ]);

  const attempted = statuses.reduce((sum, item) => sum + item.attempts, 0);
  const solved = statuses.filter((item) => item.status === "SOLVED").length;
  const wrongCount = statuses.filter((item) => item.status === "WRONG").length;
  const correct = answerStats.filter((item) => item.isCorrect).length;
  const accuracy = accuracyText(correct, answerStats.length);
  const weakestSkill = skillStats
    .filter((skill) => skill.attempted > 0)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))[0];

  const profileProblemIds = new Set(profileRecommendations.map((item) => item.problemId).filter(Boolean));
  const todayRecommendations = [
    ...profileRecommendations
      .filter((item) => item.problem)
      .map((item) => ({ ...item.problem!, reason: item.reason })),
    ...fallbackRecommendations.filter((problem) => !profileProblemIds.has(problem.id)),
  ].slice(0, 4);

  if (canManageContent) {
    const [
      lifecycleCounts,
      contentPacks,
      recentImports,
      gradingQueueCount,
      betaStats,
      activeContests,
      duplicateSkips,
    ] = await Promise.all([
      Promise.all([
        prisma.problem.count({ where: { contentStatus: "NEEDS_REVIEW" } }),
        prisma.problem.count({ where: { contentStatus: "DRAFT" } }),
        prisma.problem.count({ where: { contentStatus: "PUBLISHED" } }),
        prisma.problem.count({ where: { contentStatus: "ARCHIVED" } }),
      ]),
      prisma.contentPack.count(),
      prisma.importBatch.findMany({
        include: { sourceCollection: true, contentPack: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.submissionAnswer.count({
        where: {
          OR: [{ isCorrect: null }, { manualGrade: { correctness: "NEEDS_REVISION" } }],
        },
      }),
      Promise.all([
        prisma.user.count(),
        prisma.diagnosticAttempt.count({ where: { status: { in: ["COMPLETED", "NEEDS_REVIEW"] } } }),
        prisma.importBatch.count(),
      ]),
      prisma.contest.count({ where: { status: { in: ["SCHEDULED", "LIVE"] }, visibility: "PUBLIC" } }),
      prisma.importBatch.findMany({ select: { summary: true }, take: 100 }),
    ]);

    const duplicateSkipTotal = duplicateSkips.reduce((sum, batch) => {
      const summary = batch.summary && typeof batch.summary === "object" ? (batch.summary as Record<string, unknown>) : {};
      return (
        sum +
        Number(summary.duplicatesSkipped ?? 0) +
        Number(summary.exactDuplicatesSkipped ?? 0) +
        Number(summary.highSimilarityDuplicatesSkipped ?? 0)
      );
    }, 0);

    return (
      <div className="grid gap-6">
        <section className="surface rounded-2xl p-6">
          <p className="text-sm font-semibold text-accent">Quản trị</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Chào {user.displayName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            Khu vực quản trị tập trung vào import gói dữ liệu, QA, review nội dung, contests và chấm bài cần đánh giá thủ công.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/admin/import" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              <FileArchive className="size-4" aria-hidden="true" />
              Import gói dữ liệu
            </Link>
            <Link href="/admin/content-qa" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Kiểm tra chất lượng
            </Link>
            <Link href="/teacher/grading" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Chấm bài
            </Link>
            <Link href="/admin/contests" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Contests
            </Link>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ["Cần duyệt", lifecycleCounts[0], "NEEDS_REVIEW" as const],
            ["Bản nháp", lifecycleCounts[1], "DRAFT" as const],
            ["Đã xuất bản", lifecycleCounts[2], "PUBLISHED" as const],
            ["Đã lưu trữ", lifecycleCounts[3], "ARCHIVED" as const],
          ] satisfies LifecycleCard[]).map(([label, value, status]) => (
            <div key={label} className="surface rounded-2xl p-4">
              <ContentStatusBadge status={status} />
              <p className="mt-3 text-sm text-ink-soft">{label}</p>
              <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
          <div className="surface rounded-2xl p-4">
            <p className="text-sm text-ink-soft">Gói dữ liệu</p>
            <p className="tabular-nums mt-2 text-2xl font-semibold">{contentPacks}</p>
            <p className="mt-1 text-xs text-ink-soft">Bài cần chấm: {gradingQueueCount}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Tổng user", betaStats[0]],
            ["Đã làm diagnostic", betaStats[1]],
            ["Problem đã publish", lifecycleCounts[2]],
            ["Cần review", lifecycleCounts[0]],
            ["Contest đang mở", activeContests],
            ["Duplicate đã chặn", duplicateSkipTotal],
          ].map(([label, value]) => (
            <div key={label} className="surface rounded-2xl p-4">
              <p className="text-sm text-ink-soft">{label}</p>
              <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-semibold">Import gần đây</h2>
          <div className="mt-4 grid gap-2">
            {recentImports.map((batch) => (
              <Link key={batch.id} href={batch.contentPack ? `/admin/content-packs/${batch.contentPack.id}` : "/admin/import"} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
                <span className="font-semibold">{batch.contentPack?.name ?? batch.sourceCollection?.name ?? batch.importType}</span>
                <span className="text-ink-soft"> · {batch.createdAt.toLocaleString("vi-VN")}</span>
              </Link>
            ))}
            {!recentImports.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có import batch.</p> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Sidebar />
      <div className="grid gap-6">
        <section className="relative overflow-hidden rounded-2xl bg-foreground p-6 text-background shadow-[0_24px_70px_-40px_rgba(23,33,27,0.55)]">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-background/60">Luyện tập cá nhân hóa</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Chào {user.displayName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-background/72">
            Bắt đầu bằng diagnostic, nhận gợi ý theo điểm yếu, vào Gym để luyện kỹ năng và thử Contests khi muốn kiểm tra sức bền.
          </p>
        </section>

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">Kiểm tra trình độ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {diagnostic ? "Diagnostic gần nhất" : "Làm bài kiểm tra đầu vào"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                {diagnostic
                  ? "Kết quả diagnostic đang được dùng để ưu tiên bài luyện hôm nay."
                  : "Englishphile sẽ ước lượng trình độ và gợi ý bài luyện phù hợp."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/diagnostic" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
                <Target className="size-4" aria-hidden="true" />
                {diagnostic ? "Làm lại diagnostic" : "Làm bài kiểm tra đầu vào"}
              </Link>
              {diagnostic ? (
                <Link href={`/diagnostic/result?attempt=${diagnostic.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
                  Xem kết quả
                </Link>
              ) : null}
            </div>
          </div>
          {diagnostic ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Level</p>
                <p className="mt-2 text-xl font-semibold">{diagnostic.estimatedLevel ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Điểm</p>
                <p className="tabular-nums mt-2 text-xl font-semibold">{diagnostic.score ?? "—"}/{diagnostic.total ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Ngày làm</p>
                <p className="mt-2 text-sm font-semibold">{diagnostic.completedAt?.toLocaleDateString("vi-VN") ?? "Đang làm"}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Bài nên luyện hôm nay</h2>
              <p className="mt-1 text-sm text-ink-soft">Gợi ý dựa trên diagnostic, kỹ năng yếu, topic yếu và lỗi sai gần đây.</p>
            </div>
            <Link href="/recommendations" className="text-sm font-semibold text-accent-strong">Xem tất cả</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {todayRecommendations.map((problem) => (
              <Link key={problem.id} href={`/problems/${problem.slug}`} className="grid gap-3 rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_var(--line)] transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[var(--shadow-border-hover)]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-balance">{problem.title}</h3>
                  <ArrowRight className="size-4 text-ink-soft" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <SkillBadge skill={problem.skillType} />
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <p className="text-sm text-ink-soft">{problem.reason}</p>
              </Link>
            ))}
            {!todayRecommendations.length ? (
              <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có gợi ý. Hãy làm diagnostic để bắt đầu.</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Đi tiếp ở đâu?</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {modeCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="surface surface-hover rounded-2xl p-5">
                  <Icon className="size-5 text-accent" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <DashboardStats
          stats={[
            { label: "Problems attempted", value: attempted },
            { label: "Problems solved", value: solved },
            { label: "Độ chính xác", value: accuracy },
            { label: "Câu đang sai", value: wrongCount },
            { label: "Kỹ năng yếu nhất", value: weakestSkill?.label ?? "—", hint: weakestSkill ? weakestSkill.statusLabel : "Chưa đủ dữ liệu" },
          ]}
        />

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tiến độ gần đây</h2>
              <p className="mt-1 text-sm text-ink-soft">Các submission mới nhất và trạng thái chấm.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/analytics" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
                <BarChart3 className="size-4" aria-hidden="true" />
                Thống kê
              </Link>
              <Link href="/wrong-questions" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
                <TriangleAlert className="size-4" aria-hidden="true" />
                Lỗi sai
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {recentSubmissions.map((submission) => (
              <Link key={submission.id} href={`/problems/${submission.problem.slug}`} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
                <span className="font-semibold">{submission.problem.title}</span>
                <span className="text-ink-soft">
                  {" "}· {submissionStatusLabels[submission.status]} · {submission.score ?? "—"}/{submission.total ?? "—"}
                </span>
              </Link>
            ))}
            {!recentSubmissions.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có submission. Hãy bắt đầu bằng diagnostic hoặc một bài ngắn.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
