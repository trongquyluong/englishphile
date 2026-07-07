import Link from "next/link";
import { ContentStatusBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { contentStatusOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AdminSourcesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const q = getParam(params, "q");

  const sources = await prisma.sourceCollection.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }, { originalFileName: { contains: q } }] } : undefined,
    include: {
      problems: {
        select: {
          contentStatus: true,
          _count: { select: { questions: true } },
        },
      },
      _count: { select: { importBatches: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Nguồn tài liệu</h1>
        <p className="mt-2 text-sm text-ink-soft">Quản lý source collections được seed hoặc tạo từ import.</p>
      </div>

      <form className="surface flex flex-col gap-3 rounded-lg p-4 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm nguồn..."
          className="min-h-10 flex-1 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        />
        <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Tìm
        </button>
      </form>

      <section className="surface overflow-hidden rounded-lg">
        <div className="divide-y divide-line">
          {sources.map((source) => {
            const questionCount = source.problems.reduce((sum, problem) => sum + problem._count.questions, 0);
            const statusCounts = new Map(contentStatusOrder.map((status) => [status, 0]));
            for (const problem of source.problems) {
              statusCounts.set(problem.contentStatus, (statusCounts.get(problem.contentStatus) ?? 0) + 1);
            }
            return (
              <div key={source.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_120px_120px_1fr_100px] lg:items-center">
                <div>
                  <Link href={`/admin/sources/${source.id}`} className="font-semibold hover:text-accent-strong">
                    {source.name}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">{source.description}</p>
                  {source.copyrightNote ? <p className="mt-1 text-xs text-ink-soft">{source.copyrightNote}</p> : null}
                </div>
                <span className="text-sm font-semibold">{source.sourceType}</span>
                <span className="tabular-nums text-sm text-ink-soft">{source.problems.length} problems Â· {questionCount} questions</span>
                <div className="flex flex-wrap gap-1.5">
                  {contentStatusOrder.map((status) => (
                    <span key={status} className="inline-flex items-center gap-1">
                      <ContentStatusBadge status={status} />
                      <span className="tabular-nums text-xs text-ink-soft">{statusCounts.get(status) ?? 0}</span>
                    </span>
                  ))}
                </div>
                <span className="tabular-nums text-sm text-ink-soft">{source._count.importBatches} imports</span>
              </div>
            );
          })}
          {!sources.length ? <p className="p-5 text-sm text-ink-soft">Không có nguồn phù hợp.</p> : null}
        </div>
      </section>
    </div>
  );
}
