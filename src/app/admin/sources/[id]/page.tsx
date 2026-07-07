import Link from "next/link";
import { notFound } from "next/navigation";
import { updateSourceCollectionAction } from "@/app/admin/actions";
import { ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { sourceTypeValues } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function inputClass() {
  return "min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2";
}

export default async function AdminSourceDetailPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const message = getParam(query, "message");
  const error = getParam(query, "error");

  const source = await prisma.sourceCollection.findUnique({
    where: { id },
    include: {
      problems: {
        include: { _count: { select: { questions: true } } },
        orderBy: { updatedAt: "desc" },
      },
      importBatches: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!source) notFound();

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Nguồn tài liệu</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{source.name}</h1>
        <p className="mt-2 text-sm text-ink-soft">{source.description}</p>
      </div>

      {message ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Chỉnh sửa source</h2>
        <form action={updateSourceCollectionAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="sourceId" value={source.id} />
          <label className="grid gap-1.5 text-sm font-medium">
            Tên nguồn
            <input name="name" defaultValue={source.name} className={inputClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Source type
            <select name="sourceType" defaultValue={source.sourceType} className={inputClass()}>
              {sourceTypeValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Original file name
            <input name="originalFileName" defaultValue={source.originalFileName ?? ""} className={inputClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Copyright note
            <input name="copyrightNote" defaultValue={source.copyrightNote ?? ""} className={inputClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Description
            <textarea
              name="description"
              defaultValue={source.description}
              className="min-h-24 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2"
            />
          </label>
          <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background md:col-span-2">
            Lưu thay đổi
          </button>
        </form>
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">Problems từ nguồn này</h2>
        </div>
        <div className="divide-y divide-line">
          {source.problems.map((problem) => (
            <div key={problem.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_130px_150px_100px_100px] lg:items-center">
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
            </div>
          ))}
          {!source.problems.length ? <p className="p-5 text-sm text-ink-soft">Nguồn này chưa có problem.</p> : null}
        </div>
      </section>
    </div>
  );
}
