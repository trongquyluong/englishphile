import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentStatus, SkillType } from "@prisma/client";
import { Archive, ListChecks, Rocket, ShieldCheck } from "lucide-react";
import { contentPackBulkAction } from "@/app/admin/content-packs/actions";
import { ContentPackStatusBadge, ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { getContentQaReport } from "@/lib/content-packs/qa";
import { contentStatusLabels, contentStatusOrder, difficultyLabels, difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>(
    (current, item) => {
      current[item] = (current[item] ?? 0) + 1;
      return current;
    },
    {} as Record<T, number>,
  );
}

function summaryNumber(summary: unknown, key: string) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return 0;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function summaryText(summary: unknown, key: string) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function hasDuplicateRisk(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const risk = (metadata as Record<string, unknown>).duplicateRisk;
  return Boolean(risk && typeof risk === "object");
}

function BarRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums font-semibold">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-panel-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function ContentPackDetailPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const message = getParam(query, "message");
  const error = getParam(query, "error");
  const statusFilter = getParam(query, "status") as ContentStatus | undefined;
  const skillFilter = getParam(query, "skill") as SkillType | undefined;
  const qaFilter = getParam(query, "qa");
  const duplicateFilter = getParam(query, "duplicate");

  const [pack, qaReport] = await Promise.all([
    prisma.contentPack.findUnique({
      where: { id },
      include: {
        importedBy: { select: { displayName: true, email: true } },
        importBatches: {
          include: {
            user: { select: { displayName: true } },
            sourceCollection: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        problems: {
          include: {
            sourceCollection: { select: { id: true, name: true } },
            problemTopics: { include: { topic: true } },
            questions: { select: { metadata: true } },
            _count: { select: { questions: true } },
          },
          orderBy: [{ contentStatus: "asc" }, { orderIndex: "asc" }],
        },
      },
    }),
    getContentQaReport({ contentPackId: id }),
  ]);

  if (!pack) notFound();

  const questionCount = pack.problems.reduce((total, problem) => total + problem._count.questions, 0);
  const duplicateSummary = pack.importBatches.reduce(
    (current, batch) => {
      current.exact += summaryNumber(batch.summary, "exactDuplicateQuestionsSkipped");
      current.high += summaryNumber(batch.summary, "highSimilarityQuestionsSkipped");
      current.possible += summaryNumber(batch.summary, "possibleDuplicateQuestionsFlagged");
      current.totalSkipped += summaryNumber(batch.summary, "duplicateQuestionsSkipped");
      return current;
    },
    { exact: 0, high: 0, possible: 0, totalSkipped: 0 },
  );
  const sourceFiles = pack.importBatches.map((batch) => summaryText(batch.summary, "fileName")).filter((fileName): fileName is string => Boolean(fileName));
  const statusCounts = countBy(pack.problems.map((problem) => problem.contentStatus));
  const skillCounts = countBy(pack.problems.map((problem) => problem.skillType));
  const difficultyCounts = countBy(pack.problems.map((problem) => problem.difficulty));
  const qaByProblem = new Map(qaReport.problems.map((problem) => [problem.problemId, problem]));
  const displayProblems = pack.problems.filter((problem) => {
    const qa = qaByProblem.get(problem.id);
    return (
      (!statusFilter || problem.contentStatus === statusFilter) &&
      (!skillFilter || problem.skillType === skillFilter) &&
      (!duplicateFilter || problem.questions.some((question) => hasDuplicateRisk(question.metadata))) &&
      (!qaFilter ||
        (qaFilter === "error" && (qa?.errors ?? 0) > 0) ||
        (qaFilter === "warning" && (qa?.warnings ?? 0) > 0))
    );
  });
  const sourceCollections = Array.from(
    new Map(pack.problems.filter((problem) => problem.sourceCollection).map((problem) => [problem.sourceCollection!.id, problem.sourceCollection!])).values(),
  );
  const topicCounts = pack.problems
    .flatMap((problem) => problem.problemTopics.map((item) => item.topic.name))
    .reduce<Record<string, number>>((current, topic) => {
      current[topic] = (current[topic] ?? 0) + 1;
      return current;
    }, {});
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Gói dữ liệu</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{pack.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            {pack.description ?? "Gói dữ liệu được tạo từ upload hoặc CLI import."}
          </p>
        </div>
        <ContentPackStatusBadge status={pack.status} />
      </div>

      {message ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Problems", pack.problems.length],
          ["Questions", questionCount],
          ["Import batches", pack.importBatches.length],
          ["Có thể publish", qaReport.summary.publishableProblems],
          ["Lỗi QA", qaReport.summary.errors],
          ["Rủi ro trùng", duplicateSummary.possible],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
            <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Duplicate summary</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Exact và high-similarity đã bị bỏ qua khi import. Possible duplicate được giữ ở trạng thái cần duyệt và bị QA chặn bulk publish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/content-qa?contentPackId=${pack.id}`} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
              Review possible duplicates
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Trùng chính xác", duplicateSummary.exact],
            ["Rất giống bị bỏ qua", duplicateSummary.high],
            ["Có thể trùng cần duyệt", duplicateSummary.possible],
            ["Tổng question bỏ qua", duplicateSummary.totalSkipped],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-white px-3 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <p className="text-ink-soft">{label}</p>
              <p className="tabular-nums mt-1 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        {sourceFiles.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {sourceFiles.map((fileName) => (
              <span key={fileName} className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                {fileName}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hành động chất lượng</h2>
            <p className="mt-1 text-sm text-ink-soft">Bulk publish luôn chạy QA và bỏ qua problem có lỗi nghiêm trọng.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/content-qa?contentPackId=${pack.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Chạy QA
            </Link>
            <form action={contentPackBulkAction}>
              <input type="hidden" name="contentPackId" value={pack.id} />
              <input type="hidden" name="intent" value="publish-safe" />
              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
                <Rocket className="size-4" aria-hidden="true" />
                Publish các bài không có lỗi
              </button>
            </form>
            <form action={contentPackBulkAction}>
              <input type="hidden" name="contentPackId" value={pack.id} />
              <input type="hidden" name="intent" value="needs-review" />
              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                <ListChecks className="size-4" aria-hidden="true" />
                Đánh dấu cần duyệt
              </button>
            </form>
            <form action={contentPackBulkAction}>
              <input type="hidden" name="contentPackId" value={pack.id} />
              <input type="hidden" name="intent" value="archive-errors" />
              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                <Archive className="size-4" aria-hidden="true" />
                Lưu trữ các bài lỗi
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Metadata</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p><span className="text-ink-soft">Version:</span> <span className="font-semibold">{pack.version ?? "Chưa có"}</span></p>
            <p><span className="text-ink-soft">File:</span> <span className="font-semibold">{pack.fileName ?? "Multi-file upload"}</span></p>
            <p><span className="text-ink-soft">Imported by:</span> <span className="font-semibold">{pack.importedBy?.displayName ?? "Không rõ"}</span></p>
            <p><span className="text-ink-soft">Ngày tạo:</span> <span className="font-semibold">{pack.createdAt.toLocaleString("vi-VN")}</span></p>
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Phân bố lifecycle</h2>
          <div className="mt-4 grid gap-4">
            {contentStatusOrder.map((status) => (
              <BarRow key={status} label={contentStatusLabels[status]} value={statusCounts[status] ?? 0} total={pack.problems.length} />
            ))}
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">QA report</h2>
          <div className="mt-4 grid gap-2">
            <BarRow label="Lỗi nghiêm trọng" value={qaReport.summary.errors} total={Math.max(1, qaReport.issues.length)} />
            <BarRow label="Cảnh báo" value={qaReport.summary.warnings} total={Math.max(1, qaReport.issues.length)} />
            <BarRow label="Gợi ý" value={qaReport.summary.infos} total={Math.max(1, qaReport.issues.length)} />
          </div>
          <p className="mt-4 rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
            {qaReport.summary.errors === 0 ? "Có thể publish" : "Không nên publish toàn bộ gói"}
          </p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Skill distribution</h2>
          <div className="mt-4 grid gap-4">
            {skillOrder.filter((skill) => skillCounts[skill]).map((skill) => (
              <BarRow key={skill} label={skillLabels[skill]} value={skillCounts[skill] ?? 0} total={pack.problems.length} />
            ))}
          </div>
        </div>
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Difficulty distribution</h2>
          <div className="mt-4 grid gap-4">
            {difficultyOrder.filter((difficulty) => difficultyCounts[difficulty]).map((difficulty) => (
              <BarRow key={difficulty} label={difficultyLabels[difficulty]} value={difficultyCounts[difficulty] ?? 0} total={pack.problems.length} />
            ))}
          </div>
        </div>
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Topic distribution</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {topTopics.length ? (
              topTopics.map(([topic, count]) => (
                <span key={topic} className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                  {topic} Â· {count}
                </span>
              ))
            ) : (
              <p className="text-sm text-ink-soft">Chưa có topic.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Source collections</h2>
          <div className="mt-4 grid gap-2">
            {sourceCollections.length ? (
              sourceCollections.map((source) => (
                <Link key={source.id} href={`/admin/sources/${source.id}`} className="rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                  {source.name}
                </Link>
              ))
            ) : (
              <p className="text-sm text-ink-soft">Chưa gắn source collection.</p>
            )}
          </div>
        </div>
        <div className="surface overflow-hidden rounded-lg">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Import history</h2>
          </div>
          <div className="divide-y divide-line">
            {pack.importBatches.map((batch) => (
              <div key={batch.id} className="px-5 py-4 text-sm">
                <p className="font-semibold">{batch.importType} Â· {batch.status}</p>
                <p className="mt-1 text-ink-soft">{batch.sourceCollection?.name ?? "Nhiá»u nguá»“n"} Â· {batch.user.displayName} Â· {batch.createdAt.toLocaleString("vi-VN")}</p>
              </div>
            ))}
            {!pack.importBatches.length ? <p className="p-5 text-sm text-ink-soft">Chưa có import batch.</p> : null}
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Manifest summary</h2>
        {pack.manifestJson ? (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-white p-4 text-xs leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]">
            {JSON.stringify(pack.manifestJson, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Gói này không có manifest.json.</p>
        )}
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">Problems trong gói</h2>
        </div>
        <form className="grid gap-3 border-b border-line bg-panel-muted/55 px-5 py-4 md:grid-cols-4">
          <select name="status" defaultValue={statusFilter ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm">
            <option value="">Tất cả lifecycle</option>
            {contentStatusOrder.map((status) => (
              <option key={status} value={status}>
                {contentStatusLabels[status]}
              </option>
            ))}
          </select>
          <select name="skill" defaultValue={skillFilter ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm">
            <option value="">Tất cả skill</option>
            {skillOrder.map((skill) => (
              <option key={skill} value={skill}>
                {skillLabels[skill]}
              </option>
            ))}
          </select>
          <select name="qa" defaultValue={qaFilter ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm">
            <option value="">Tất cả QA</option>
            <option value="error">Có QA error</option>
            <option value="warning">Có QA warning</option>
          </select>
          <div className="flex gap-2">
            <select name="duplicate" defaultValue={duplicateFilter ?? ""} className="min-h-10 flex-1 rounded-md bg-white px-3 text-sm">
              <option value="">Tất cả duplicate</option>
              <option value="1">Có cảnh báo trùng</option>
            </select>
            <button type="submit" className="min-h-10 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
              Lọc
            </button>
          </div>
        </form>
        <div className="divide-y divide-line">
          {displayProblems.map((problem) => (
            <div key={problem.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_120px_150px_110px_90px_160px] lg:items-center">
              <div>
                <Link href={`/admin/problems/${problem.id}`} className="font-semibold hover:text-accent-strong">
                  {problem.title}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">{problem.slug}</p>
              </div>
              <ContentStatusBadge status={problem.contentStatus} />
              <SkillBadge skill={problem.skillType} />
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className="tabular-nums text-sm text-ink-soft">{problem._count.questions} câu</span>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/problems/${problem.id}/edit`} className="text-sm font-semibold text-accent-strong">
                  Chỉnh sửa
                </Link>
                <Link href={`/admin/problems/${problem.id}/preview`} className="text-sm font-semibold text-accent-strong">
                  Xem trước
                </Link>
              </div>
            </div>
          ))}
          {!displayProblems.length ? <p className="p-5 text-sm text-ink-soft">Không có problem phù hợp bộ lọc.</p> : null}
        </div>
      </section>
    </div>
  );
}
