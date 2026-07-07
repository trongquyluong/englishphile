import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowRight, ClipboardCheck, RotateCcw, Sparkles } from "lucide-react";
import { startDiagnosticAction } from "@/app/diagnostic/actions";
import { DifficultyBadge } from "@/components/ui/Badges";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { diagnosticBlueprint, getDiagnosticCoverage } from "@/lib/diagnostic-blueprint";

export const metadata: Metadata = {
  title: "Diagnostic",
  description: "Bài kiểm tra đầu vào để ước lượng trình độ và gợi ý lộ trình luyện tập trên Englishphile.",
};

const diagnosticCards = [
  { title: "15-25 phút", description: "Bài ngắn, đủ để ước lượng ban đầu.", icon: Activity },
  { title: "Không dùng nháp lớp học", description: "Chỉ lấy câu hỏi đã xuất bản trong kho.", icon: ClipboardCheck },
  { title: "Có thể làm lại", description: "Kết quả mới sẽ cập nhật gợi ý luyện tập.", icon: RotateCcw },
];

function parseBreakdown(value: unknown) {
  return Array.isArray(value)
    ? (value as Array<{ label?: string; statusLabel?: string; accuracy?: number | null; attempted?: number }>)
    : [];
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiagnosticPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const [latest, coverage] = await Promise.all([getLatestDiagnosticAttempt(user.id), getDiagnosticCoverage()]);
  const breakdown = parseBreakdown(latest?.skillBreakdownJson).slice(0, 4);
  const expectedQuestions = diagnosticBlueprint
    .flatMap((section) => section.items)
    .filter((item) => item.scored && !item.optional)
    .reduce((sum, item) => sum + item.targetCount, 0);

  return (
    <div className="grid gap-6">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
      <section className="relative overflow-hidden rounded-2xl bg-foreground p-6 text-background shadow-[0_24px_70px_-40px_rgba(23,33,27,0.55)] md:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-background/60">Kiểm tra trình độ</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-5xl">Bài placement test có cấu trúc</h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-background/72">
            Englishphile kiểm tra Use of English Core, Reading và các phần optional như Writing/Listening nếu có dữ liệu. Kết quả dùng để ước lượng level, độ tin cậy và hướng luyện trong Gym.
          </p>
          <div className="mt-5 grid gap-2 text-sm text-background/72 sm:grid-cols-3">
            <span className="rounded-xl bg-white/10 px-3 py-2">{expectedQuestions} câu tự chấm mục tiêu</span>
            <span className="rounded-xl bg-white/10 px-3 py-2">20-30 phút</span>
            <span className="rounded-xl bg-white/10 px-3 py-2">Không dùng nội dung nháp</span>
          </div>
          <form action={startDiagnosticAction} className="mt-6">
            <FormSubmitButton pendingLabel="Đang tạo bài..." className="gap-2 bg-background text-foreground">
              {latest ? "Làm lại diagnostic" : "Làm bài kiểm tra đầu vào"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </FormSubmitButton>
          </form>
        </div>
      </section>

      {latest ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-accent">Kết quả gần nhất</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Trình độ ước lượng</h2>
              </div>
              {latest.estimatedLevel ? <DifficultyBadge difficulty={latest.estimatedLevel} /> : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Điểm</p>
                <p className="tabular-nums mt-2 text-2xl font-semibold">{latest.score ?? "—"}/{latest.total ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Ngày làm</p>
                <p className="mt-2 text-sm font-semibold">{latest.completedAt?.toLocaleDateString("vi-VN") ?? "Đang làm"}</p>
              </div>
              <div className="rounded-xl bg-panel-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Trạng thái</p>
                <p className="mt-2 text-sm font-semibold">{latest.status === "NEEDS_REVIEW" ? "Cần review" : latest.status}</p>
              </div>
            </div>
            <Link href={`/diagnostic/result?attempt=${latest.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              Xem kết quả
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Kỹ năng cần chú ý</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {breakdown.length ? (
                breakdown.map((item) => (
                  <div key={item.label} className="rounded-xl bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.label}</span>
                      <span className="text-ink-soft">{item.statusLabel}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có breakdown kỹ năng.</p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-3">
          {diagnosticCards.map(({ title, description, icon: Icon }) => (
            <article key={title} className="surface rounded-2xl p-5">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
            </article>
          ))}
        </section>
      )}

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Section trong diagnostic</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {coverage.sections.map((section) => (
            <article key={section.id} className="rounded-xl bg-white p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{section.message}</p>
                </div>
                <span className="tabular-nums rounded-lg bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                  {section.eligibleQuestions}/{section.targetCount || "optional"}
                </span>
              </div>
            </article>
          ))}
        </div>
        {coverage.warnings.length ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-warning">
            {coverage.warnings.slice(0, 3).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
