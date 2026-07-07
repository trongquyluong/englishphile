import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Dumbbell, Sparkles, Target } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { getActiveLearningRecommendations, getDiagnosticMetadata, getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
}

function barWidth(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)))}%`;
}

function parseBreakdown(value: unknown) {
  return Array.isArray(value)
    ? (value as Array<{ label?: string; topicName?: string; statusLabel?: string; accuracy?: number | null; attempted?: number; correct?: number }>)
    : [];
}

export default async function DiagnosticResultPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const attemptId = typeof params.attempt === "string" ? params.attempt : "";
  const attempt = attemptId
    ? await prisma.diagnosticAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
    : await getLatestDiagnosticAttempt(user.id);
  if (!attempt) redirect("/diagnostic");

  const skillBreakdown = parseBreakdown(attempt.skillBreakdownJson);
  const topicBreakdown = parseBreakdown(attempt.topicBreakdownJson);
  const recommendations = await getActiveLearningRecommendations(user.id, 5);
  const accuracy = attempt.total ? (attempt.score ?? 0) / attempt.total : null;
  const metadata = getDiagnosticMetadata(attempt.recommendationJson);
  const scoring = metadata.scoring;

  return (
    <div className="grid gap-6">
      <header className="surface rounded-2xl p-5">
        <p className="text-sm font-semibold text-accent">Kết quả diagnostic</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">Trình độ ước lượng của bạn</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {scoring?.levelExplanation ?? "Kết quả này dùng để gợi ý bài luyện phù hợp hơn, không phải điểm thi chính thức."}
            </p>
          </div>
          {attempt.estimatedLevel ? <DifficultyBadge difficulty={attempt.estimatedLevel} /> : null}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Điểm có trọng số</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">{attempt.score ?? "—"}/{attempt.total ?? "—"}</p>
        </div>
        <div className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Độ chính xác</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">{percent(accuracy)}</p>
        </div>
        <div className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Độ tin cậy</p>
          <p className="mt-2 text-2xl font-semibold">{scoring?.confidenceLabel ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-soft">{scoring?.confidenceReason}</p>
        </div>
        <div className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Ngày hoàn thành</p>
          <p className="mt-2 text-base font-semibold">{attempt.completedAt?.toLocaleString("vi-VN") ?? "Chưa hoàn thành"}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Theo kỹ năng</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {skillBreakdown.map((item) => (
              <div key={item.label} className="rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-ink-soft">{item.statusLabel}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: barWidth(item.accuracy) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Target className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Topic cần chú ý</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {topicBreakdown.slice(0, 8).map((item) => (
              <div key={item.topicName} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]">
                <span className="font-semibold">{item.topicName}</span>
                <span className="text-ink-soft">{percent(item.accuracy)}</span>
              </div>
            ))}
            {!topicBreakdown.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có đủ dữ liệu topic.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Điểm mạnh</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {scoring?.strengths?.length ? (
              scoring.strengths.map((item) => (
                <p key={item.skillType} className="rounded-xl bg-accent-soft px-3 py-3 text-sm font-semibold text-accent-strong">
                  {item.label} · {percent(item.accuracy)}
                </p>
              ))
            ) : (
              <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có skill đủ dữ liệu để gọi là điểm mạnh.</p>
            )}
          </div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Target className="size-5 text-warning" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Cần luyện thêm</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {scoring?.weakAreas?.length ? (
              scoring.weakAreas.map((item) => (
                <p key={item.skillType} className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-warning">
                  {item.label} · {item.statusLabel}
                </p>
              ))
            ) : (
              <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa phát hiện điểm yếu rõ ràng.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Gym path nên theo</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/gym" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              <Dumbbell className="size-4" aria-hidden="true" />
              Vào Gym
            </Link>
            <Link href="/recommendations" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Luyện bài được gợi ý
            </Link>
            <Link href="/analytics" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Xem thống kê
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((recommendation) => (
            <Link
              key={recommendation.id}
              href={recommendation.problem ? `/problems/${recommendation.problem.slug}` : "/recommendations"}
              className="grid gap-2 rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{recommendation.problem?.title ?? recommendation.reason}</h3>
                <ArrowRight className="size-4 text-ink-soft" aria-hidden="true" />
              </div>
              <p className="text-sm text-ink-soft">{recommendation.reason}</p>
            </Link>
          ))}
          {!recommendations.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có gợi ý mới.</p> : null}
        </div>
      </section>
    </div>
  );
}
