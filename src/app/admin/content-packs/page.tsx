import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Archive, FileArchive, ShieldCheck } from "lucide-react";
import { archiveContentPackAction } from "@/app/admin/content-packs/actions";
import { ContentPackStatusBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type ManifestRecord = Record<string, unknown>;

function manifestFileCount(manifestJson: Prisma.JsonValue | null, fallback: number) {
  const manifest = manifestJson && typeof manifestJson === "object" && !Array.isArray(manifestJson) ? (manifestJson as ManifestRecord) : null;
  if (manifest && Array.isArray(manifest.files)) return manifest.files.length;
  if (manifest && typeof manifest.totalIndividualFiles === "number") return manifest.totalIndividualFiles;
  return fallback;
}

function summaryNumber(summary: unknown, key: string) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return 0;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

export default async function ContentPacksPage() {
  await requireAdmin();

  const packs = await prisma.contentPack.findMany({
    include: {
      importedBy: { select: { displayName: true } },
      importBatches: { select: { id: true, summary: true } },
      problems: {
        select: {
          contentStatus: true,
          _count: { select: { questions: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Gói dữ liệu</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Content packs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Theo dõi các gói JSON/CSV đã import, nguồn manifest, trạng thái QA và các problem liên quan.
        </p>
      </div>

      <section className="surface overflow-hidden rounded-lg">
        <div className="hidden border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft lg:grid lg:grid-cols-[minmax(260px,1fr)_120px_120px_120px_120px_130px_150px_160px]">
          <span>Pack</span>
          <span>Status</span>
          <span>Problems</span>
          <span>Questions</span>
          <span>Duplicates</span>
          <span>Files</span>
          <span>Imported by</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-line">
          {packs.map((pack) => {
            const questionCount = pack.problems.reduce((total, problem) => total + problem._count.questions, 0);
            const fileCount = manifestFileCount(pack.manifestJson, pack.importBatches.length);
            const duplicateRisk = pack.importBatches.reduce(
              (total, batch) =>
                total +
                summaryNumber(batch.summary, "exactDuplicateQuestionsSkipped") +
                summaryNumber(batch.summary, "highSimilarityQuestionsSkipped") +
                summaryNumber(batch.summary, "possibleDuplicateQuestionsFlagged"),
              0,
            );
            return (
              <div key={pack.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_120px_120px_120px_120px_130px_150px_160px] lg:items-center">
                <div>
                  <Link href={`/admin/content-packs/${pack.id}`} className="font-semibold hover:text-accent-strong">
                    {pack.name}
                  </Link>
                  <p className="mt-1 text-xs text-ink-soft">
                    {pack.version ? `Version ${pack.version}` : "Chưa có version"} · {pack.createdAt.toLocaleString("vi-VN")}
                  </p>
                </div>
                <ContentPackStatusBadge status={pack.status} />
                <span className="tabular-nums text-sm font-semibold">{pack.problems.length}</span>
                <span className="tabular-nums text-sm font-semibold">{questionCount}</span>
                <span className={duplicateRisk ? "tabular-nums text-sm font-semibold text-warning" : "tabular-nums text-sm text-ink-soft"}>{duplicateRisk}</span>
                <span className="tabular-nums text-sm text-ink-soft">{fileCount}</span>
                <span className="text-sm text-ink-soft">{pack.importedBy?.displayName ?? "Không rõ"}</span>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/content-packs/${pack.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
                    <FileArchive className="size-4" aria-hidden="true" />
                    View
                  </Link>
                  <Link href={`/admin/content-qa?contentPackId=${pack.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    QA
                  </Link>
                  <form action={archiveContentPackAction}>
                    <input type="hidden" name="contentPackId" value={pack.id} />
                    <button type="submit" className="inline-flex min-h-10 items-center gap-1 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                      <Archive className="size-4" aria-hidden="true" />
                      Archive
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {!packs.length ? <p className="p-5 text-sm text-ink-soft">Chưa có gói dữ liệu nào.</p> : null}
        </div>
      </section>
    </div>
  );
}
