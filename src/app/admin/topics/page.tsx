import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AdminTopicsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const q = getParam(params, "q");

  const topics = await prisma.topic.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }] } : undefined,
    include: {
      problemTopics: {
        include: {
          problem: { select: { _count: { select: { questions: true } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Topic</h1>
        <p className="mt-2 text-sm text-ink-soft">Topic được tái sử dụng khi import nếu trùng tên hoặc slug.</p>
      </div>

      <form className="surface flex flex-col gap-3 rounded-lg p-4 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm topic..."
          className="min-h-10 flex-1 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        />
        <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Tìm
        </button>
      </form>

      <section className="surface overflow-hidden rounded-lg">
        <div className="divide-y divide-line">
          {topics.map((topic) => {
            const questionCount = topic.problemTopics.reduce((sum, item) => sum + item.problem._count.questions, 0);
            return (
              <div key={topic.id} className="grid gap-2 px-5 py-4 lg:grid-cols-[1fr_1fr_130px_140px_120px] lg:items-center">
                <div>
                  <Link href={`/admin/topics/${topic.id}`} className="font-semibold hover:text-accent-strong">
                    {topic.name}
                  </Link>
                  <p className="mt-1 text-xs text-ink-soft">{topic.slug}</p>
                </div>
                <p className="text-sm text-ink-soft">{topic.description ?? "Chưa có mô tả."}</p>
                <span className="tabular-nums text-sm text-ink-soft">{topic.problemTopics.length} problems</span>
                <span className="tabular-nums text-sm text-ink-soft">{questionCount} questions</span>
                <Link href={`/problems?topic=${topic.slug}`} className="text-sm font-semibold text-accent-strong">
                  Xem kho bài
                </Link>
              </div>
            );
          })}
          {!topics.length ? <p className="p-5 text-sm text-ink-soft">Không có topic phù hợp.</p> : null}
        </div>
      </section>
    </div>
  );
}
