import Link from "next/link";
import type { ContentStatus, Difficulty, Prisma, SkillType } from "@prisma/client";
import { bulkProblemStatusAction } from "@/app/admin/actions";
import { ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { contentStatusLabels, contentStatusOrder, difficultyLabels, difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AdminProblemsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const q = getParam(params, "q");
  const skill = getParam(params, "skill") as SkillType | undefined;
  const difficulty = getParam(params, "difficulty") as Difficulty | undefined;
  const source = getParam(params, "source");
  const status = getParam(params, "contentStatus") as ContentStatus | undefined;
  const message = getParam(params, "message");
  const error = getParam(params, "error");
  const where: Prisma.ProblemWhereInput = {};

  if (skill && skillOrder.includes(skill)) where.skillType = skill;
  if (difficulty && difficultyOrder.includes(difficulty)) where.difficulty = difficulty;
  if (source) where.sourceCollectionId = source;
  if (status && contentStatusOrder.includes(status)) where.contentStatus = status;
  if (q) where.OR = [{ title: { contains: q } }, { slug: { contains: q } }, { statement: { contains: q } }];

  const [problems, sources] = await Promise.all([
    prisma.problem.findMany({
      where,
      include: {
        sourceCollection: true,
        importedBatch: { select: { importType: true, createdAt: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 150,
    }),
    prisma.sourceCollection.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Quản lý kho bài</h1>
        <p className="mt-2 text-sm text-ink-soft">Quản lý metadata, lifecycle và batch actions cho problem bank.</p>
      </div>

      {message ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <form className="surface grid gap-3 rounded-lg p-4 md:grid-cols-3 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm title, slug..."
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] lg:col-span-2"
        />
        <select name="contentStatus" defaultValue={status ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
          <option value="">Tất cả trạng thái nội dung</option>
          {contentStatusOrder.map((item) => (
            <option key={item} value={item}>
              {contentStatusLabels[item]}
            </option>
          ))}
        </select>
        <select name="skill" defaultValue={skill ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
          <option value="">Tất cả skill</option>
          {skillOrder.map((item) => (
            <option key={item} value={item}>
              {skillLabels[item]}
            </option>
          ))}
        </select>
        <select name="difficulty" defaultValue={difficulty ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
          <option value="">Tất cả độ khó</option>
          {difficultyOrder.map((item) => (
            <option key={item} value={item}>
              {difficultyLabels[item]}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={source ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
          <option value="">Tất cả nguồn</option>
          {sources.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background lg:col-span-6">
          Lọc
        </button>
      </form>

      <form action={bulkProblemStatusAction} className="surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Danh sách problem</h2>
            <p className="mt-1 text-sm text-ink-soft">Chọn nhiều bài để cập nhật hàng loạt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select name="bulkStatus" defaultValue="PUBLISHED" className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
              <option value="PUBLISHED">Xuất bản selected</option>
              <option value="ARCHIVED">Lưu trữ selected</option>
              <option value="NEEDS_REVIEW">Mark needs review</option>
              <option value="DRAFT">Restore to draft</option>
            </select>
            <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Cập nhật hàng loạt
            </button>
          </div>
        </div>
        <div className="divide-y divide-line">
          {problems.map((problem) => (
            <div key={problem.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[44px_minmax(260px,1fr)_130px_150px_110px_100px_160px] lg:items-center">
              <label className="relative flex min-h-10 items-center">
                <input type="checkbox" name="problemId" value={problem.id} className="size-4 accent-[var(--accent)]" />
                <span className="sr-only">Chọn {problem.title}</span>
              </label>
              <div>
                <Link href={`/admin/problems/${problem.id}`} className="font-semibold hover:text-accent-strong">
                  {problem.title}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">{problem.slug}</p>
                {problem.importedBatch ? (
                  <p className="mt-1 text-xs text-ink-soft">Import {problem.importedBatch.importType} Â· {problem.importedBatch.createdAt.toLocaleDateString("vi-VN")}</p>
                ) : null}
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
          {!problems.length ? <p className="p-5 text-sm text-ink-soft">Không có problem phù hợp.</p> : null}
        </div>
      </form>
    </div>
  );
}
