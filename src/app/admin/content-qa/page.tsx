import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { Archive, ListChecks, Rocket, ShieldAlert } from "lucide-react";
import { contentQaBulkAction } from "@/app/admin/content-packs/actions";
import { ContentStatusBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { getContentQaReport, type QaSeverity } from "@/lib/content-packs/qa";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const severityLabels: Record<QaSeverity, string> = {
  ERROR: "Lỗi nghiêm trọng",
  WARNING: "Cảnh báo",
  INFO: "Gợi ý",
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function severityClass(severity: QaSeverity) {
  if (severity === "ERROR") return "bg-red-50 text-danger";
  if (severity === "WARNING") return "bg-amber-100 text-amber-900";
  return "bg-panel-muted text-ink-soft";
}

export default async function ContentQaPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const contentPackId = getParam(params, "contentPackId");
  const message = getParam(params, "message");
  const error = getParam(params, "error");

  const [packs, report] = await Promise.all([
    prisma.contentPack.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, version: true } }),
    getContentQaReport(contentPackId ? { contentPackId } : {}),
  ]);

  const selectedPack = packs.find((pack) => pack.id === contentPackId);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Kiểm tra chất lượng</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Content QA</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Kiểm tra lỗi cấu trúc trước khi publish. Bulk publish chỉ áp dụng cho problem không có lỗi nghiêm trọng.
        </p>
      </div>

      {message ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <form className="surface grid gap-3 rounded-lg p-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm">
          <span className="font-semibold">Gói dữ liệu</span>
          <select name="contentPackId" defaultValue={contentPackId ?? ""} className="min-h-10 rounded-md bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            <option value="">Tất cả problem</option>
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}{pack.version ? ` Â· ${pack.version}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Chạy QA
        </button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Problems checked", report.summary.problemsChecked],
          ["Có thể publish", report.summary.publishableProblems],
          ["Lỗi nghiêm trọng", report.summary.errors],
          ["Cảnh báo", report.summary.warnings],
          ["Gợi ý", report.summary.infos],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
            <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {selectedPack ? (
        <div className="surface rounded-lg p-4 text-sm">
          <p>
            Đang xem QA cho <Link href={`/admin/content-packs/${selectedPack.id}`} className="font-semibold text-accent-strong">{selectedPack.name}</Link>.
          </p>
        </div>
      ) : null}

      <form action={contentQaBulkAction} className="surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">QA theo problem</h2>
              <p className="mt-1 text-sm text-ink-soft">Chọn problem rồi áp dụng bulk action.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button name="intent" value="publish-safe" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
              <Rocket className="size-4" aria-hidden="true" />
              Publish các bài không có lỗi
            </button>
            <button name="intent" value="needs-review" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
              <ListChecks className="size-4" aria-hidden="true" />
              Đánh dấu cần duyệt
            </button>
            <button name="intent" value="archive" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
              <Archive className="size-4" aria-hidden="true" />
              Lưu trữ
            </button>
          </div>
        </div>
        <div className="divide-y divide-line">
          {report.problems.map((problem) => (
            <div key={problem.problemId} className="grid gap-3 px-5 py-4 lg:grid-cols-[44px_minmax(260px,1fr)_120px_90px_90px_90px_130px] lg:items-center">
              <label className="relative flex min-h-10 items-center">
                <input type="checkbox" name="problemId" value={problem.problemId} className="size-4 accent-[var(--accent)]" />
                <span className="sr-only">Chọn {problem.title}</span>
              </label>
              <div>
                <Link href={`/admin/problems/${problem.problemId}`} className="font-semibold hover:text-accent-strong">
                  {problem.title}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">{problem.slug}</p>
                <div className="mt-3 grid gap-2">
                  {problem.issues.slice(0, 4).map((issue, index) => (
                    <div key={`${issue.entityId}-${issue.path}-${index}`} className="rounded-md bg-white px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                      <span className={`mr-2 rounded px-1.5 py-0.5 font-semibold ${severityClass(issue.severity)}`}>
                        {severityLabels[issue.severity]}
                      </span>
                      {issue.code ? <span className="mr-2 rounded bg-panel-muted px-1.5 py-0.5 font-semibold text-ink-soft">{issue.code}</span> : null}
                      <span className="font-semibold">{issue.path}</span>
                      <span className="text-ink-soft"> Â· {issue.message}</span>
                    </div>
                  ))}
                  {problem.issues.length > 4 ? <p className="text-xs text-ink-soft">Còn {problem.issues.length - 4} issue khác.</p> : null}
                </div>
              </div>
              <ContentStatusBadge status={problem.contentStatus as ContentStatus} />
              <span className="tabular-nums text-sm font-semibold text-danger">{problem.errors}</span>
              <span className="tabular-nums text-sm font-semibold text-warning">{problem.warnings}</span>
              <span className="tabular-nums text-sm font-semibold text-ink-soft">{problem.infos}</span>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${problem.canPublish ? "bg-accent-soft text-accent-strong" : "bg-red-50 text-danger"}`}>
                {problem.canPublish ? "Có thể publish" : "Không nên publish"}
              </span>
            </div>
          ))}
          {!report.problems.length ? <p className="p-5 text-sm text-ink-soft">Không có problem để kiểm tra.</p> : null}
        </div>
      </form>
    </div>
  );
}
