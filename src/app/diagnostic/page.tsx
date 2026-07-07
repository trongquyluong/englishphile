import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowRight, CheckCircle2, ClipboardList, RotateCcw } from "lucide-react";

import { startDiagnosticAction } from "@/app/diagnostic/actions";
import { DifficultyBadge } from "@/components/ui/Badges";
import { LearnerCard } from "@/components/ui/LearnerCard";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { diagnosticBlueprint, getDiagnosticCoverage } from "@/lib/diagnostic-blueprint";

export const metadata: Metadata = {
  title: "Diagnostic",
  description: "Làm bài kiểm tra đầu vào để biết trình độ và phần nào cần luyện trước.",
};

const benefitCards = [
  {
    title: "15-25 phút",
    description: "Ngắn gọn, đủ để ước lượng sơ bộ.",
    icon: Activity,
  },
  {
    title: "Dùng kho bài đã xuất bản",
    description: "Câu hỏi được chọn từ bài đã được admin kiểm tra.",
    icon: ClipboardList,
  },
  {
    title: "Có thể làm lại",
    description: "Kết quả mới sẽ cập nhật lại gợi ý trong Gym.",
    icon: RotateCcw,
  },
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

  const [latest, coverage] = await Promise.all([
    getLatestDiagnosticAttempt(user.id),
    getDiagnosticCoverage(),
  ]);

  const breakdown = parseBreakdown(latest?.skillBreakdownJson).slice(0, 4);

  const canStart = coverage.sections.every(
    (section) => !section.targetCount || section.eligibleQuestions >= section.targetCount,
  );

  const totalScoredQuestions = diagnosticBlueprint
    .flatMap((s) => s.items)
    .filter((item) => item.scored && !item.optional)
    .reduce((sum, item) => sum + item.targetCount, 0);

  return (
    <div className="grid gap-6">
      {error ? (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      {/* Hero — dark banner with primary CTA */}
      <section className="relative overflow-hidden rounded-2xl bg-foreground p-6 text-background shadow-[0_24px_70px_-40px_rgba(23,33,27,0.55)] md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-background/60">
          Kiểm tra trình độ
        </p>

        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Bài placement test có cấu trúc
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-background/72">
          Bài kiểm tra đầu vào gồm Use of English và Reading. Kết quả ước lượng trình độ và giúp Gym đề xuất bài luyện phù hợp. Viết và phần nghe không tính vào điểm tự động.
        </p>

        <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
          <span className="rounded-xl bg-white/10 px-3 py-2">
            {totalScoredQuestions} câu tự chấm
          </span>
          <span className="rounded-xl bg-white/10 px-3 py-2">20-30 phút</span>
          <span className="rounded-xl bg-white/10 px-3 py-2">Dùng kho bài đã xuất bản</span>
        </div>

        {canStart ? (
          <form action={startDiagnosticAction} className="mt-6">
            <FormSubmitButton
              pendingLabel="Đang tạo bài..."
              className="gap-2 bg-background text-foreground"
            >
              {latest ? "Làm lại diagnostic" : "Làm bài kiểm tra đầu vào"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </FormSubmitButton>
          </form>
        ) : (
          <div
            role="alert"
            className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-background/80"
          >
            Chưa đủ câu hỏi để bắt đầu. Admin cần thêm nội dung vào kho.
          </div>
        )}
      </section>

      {/* Previous result */}
      {latest ? (
        <LearnerCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-accent">Kết quả gần nhất</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Trình độ ước lượng
                  </h2>
                </div>
                {latest.estimatedLevel ? (
                  <DifficultyBadge difficulty={latest.estimatedLevel} />
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-panel-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Điểm
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {latest.score ?? "—"}/{latest.total ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-panel-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Ngày làm
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {latest.completedAt?.toLocaleDateString("vi-VN") ?? "Đang làm dở"}
                  </p>
                </div>
                <div className="rounded-xl bg-panel-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Trạng thái
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {latest.status === "NEEDS_REVIEW"
                      ? "Cần chấm tay"
                      : latest.status === "COMPLETED"
                        ? "Hoàn thành"
                        : latest.status === "ABANDONED"
                          ? "Đã bỏ dở"
                          : latest.status}
                  </p>
                </div>
              </div>

              <Link
                href={`/diagnostic/result?attempt=${latest.id}`}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
              >
                Xem kết quả chi tiết
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="lg:w-72">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-accent" aria-hidden="true" />
                <h3 className="font-semibold">Phần cần chú ý</h3>
              </div>
              <div className="mt-4 grid gap-2">
                {breakdown.length ? (
                  breakdown.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-xl bg-panel-muted px-3 py-2.5 text-sm"
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className="text-ink-soft">{item.statusLabel}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">
                    Chưa có breakdown kỹ năng.
                  </p>
                )}
              </div>
            </div>
          </div>
        </LearnerCard>
      ) : (
        /* No previous result — show benefit cards */
        <div className="grid gap-3 md:grid-cols-3">
          {benefitCards.map(({ title, description, icon: Icon }) => (
            <LearnerCard key={title}>
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
            </LearnerCard>
          ))}
        </div>
      )}

      {/* Coverage section */}
      <LearnerCard>
        <h2 className="text-lg font-semibold">Nội dung bài kiểm tra</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {coverage.sections.map((section) => (
            <div
              key={section.id}
              className="rounded-xl bg-panel-muted p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{section.message}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-panel px-2 py-1 text-xs font-semibold text-ink-soft tabular-nums shadow-[inset_0_0_0_1px_rgba(23,33,27,0.08)]">
                  {section.eligibleQuestions}/{section.targetCount}
                </span>
              </div>
            </div>
          ))}
        </div>

        {coverage.warnings.length ? (
          <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-warning">
            {coverage.warnings.slice(0, 3).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </LearnerCard>
    </div>
  );
}
