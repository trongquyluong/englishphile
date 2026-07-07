import Link from "next/link";
import type { ContentStatus, Difficulty, Prisma, SkillType } from "@prisma/client";
import type { ReactNode } from "react";
import { Archive, Eye, Pencil, Rocket } from "lucide-react";
import { problemStatusAction } from "@/app/admin/actions";
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

function StatusButton({
  problemId,
  intent,
  label,
  icon,
}: {
  problemId: string;
  intent: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <form action={problemStatusAction}>
      <input type="hidden" name="problemId" value={problemId} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value="/admin/review" />
      <button
        type="submit"
        className="inline-flex min-h-10 items-center gap-1 rounded-md bg-panel-muted px-3 text-sm font-semibold transition-[background-color,color] duration-150 hover:bg-foreground hover:text-background"
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

export default async function AdminReviewPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const q = getParam(params, "q");
  const status = getParam(params, "status") as ContentStatus | undefined;
  const skill = getParam(params, "skill") as SkillType | undefined;
  const difficulty = getParam(params, "difficulty") as Difficulty | undefined;
  const source = getParam(params, "source");
  const batch = getParam(params, "batch");
  const contentPack = getParam(params, "contentPackId");

  const where: Prisma.ProblemWhereInput = {
    contentStatus: status && contentStatusOrder.includes(status) ? status : { in: ["DRAFT", "NEEDS_REVIEW"] },
  };

  if (skill && skillOrder.includes(skill)) where.skillType = skill;
  if (difficulty && difficultyOrder.includes(difficulty)) where.difficulty = difficulty;
  if (source) where.sourceCollectionId = source;
  if (batch) where.importedBatchId = batch;
  if (contentPack) where.contentPackId = contentPack;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { statement: { contains: q } },
      { questions: { some: { prompt: { contains: q } } } },
    ];
  }

  const [problems, sources, batches, contentPacks] = await Promise.all([
    prisma.problem.findMany({
      where,
      include: {
        sourceCollection: { select: { name: true } },
        importedBatch: { select: { id: true, createdAt: true, importType: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ contentStatus: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.sourceCollection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, createdAt: true, importType: true } }),
    prisma.contentPack.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, version: true } }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Duyệt nội dung</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Review queue</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Các bài ở trạng thái Bản nháp hoặc Cần duyệt được kiểm tra tại đây trước khi xuất bản cho học viên.
        </p>
      </div>

      <form className="surface grid gap-3 rounded-lg p-4 md:grid-cols-3 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm title / prompt"
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] lg:col-span-2"
        />
        <select name="status" defaultValue={status ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
          <option value="">Draft + cần duyệt</option>
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
        <select name="batch" defaultValue={batch ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] lg:col-span-2">
          <option value="">Tất cả import batch</option>
          {batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.importType} Â· {item.createdAt.toLocaleString("vi-VN")}
            </option>
          ))}
        </select>
        <select name="contentPackId" defaultValue={contentPack ?? ""} className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] lg:col-span-2">
          <option value="">Tất cả gói dữ liệu</option>
          {contentPacks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}{item.version ? ` Â· ${item.version}` : ""}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Lọc
        </button>
      </form>

      <section className="surface overflow-hidden rounded-lg">
        <div className="hidden border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft lg:grid lg:grid-cols-[130px_minmax(240px,1fr)_150px_110px_170px_90px_1fr]">
          <span>Status</span>
          <span>Problem title</span>
          <span>Skill</span>
          <span>Độ khó</span>
          <span>Nguồn</span>
          <span>Câu hỏi</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-line">
          {problems.map((problem) => (
            <div key={problem.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[130px_minmax(240px,1fr)_150px_110px_170px_90px_1fr] lg:items-center">
              <ContentStatusBadge status={problem.contentStatus} />
              <div>
                <Link href={`/admin/problems/${problem.id}`} className="font-semibold hover:text-accent-strong">
                  {problem.title}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">
                  {problem.importedBatch ? `Import ${problem.importedBatch.importType} Â· ${problem.importedBatch.createdAt.toLocaleDateString("vi-VN")}` : "Manual / seed"}
                </p>
              </div>
              <SkillBadge skill={problem.skillType} />
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className="text-sm text-ink-soft">{problem.sourceCollection?.name ?? "Manual"}</span>
              <span className="tabular-nums text-sm font-semibold">{problem._count.questions}</span>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/problems/${problem.id}/edit`} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
                  <Pencil className="size-4" aria-hidden="true" />
                  Chỉnh sửa
                </Link>
                <Link href={`/admin/problems/${problem.id}/preview`} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                  <Eye className="size-4" aria-hidden="true" />
                  Xem trước
                </Link>
                <StatusButton problemId={problem.id} intent="publish" label="Xuất bản" icon={<Rocket className="size-4" aria-hidden="true" />} />
                <StatusButton problemId={problem.id} intent="archive" label="Lưu trữ" icon={<Archive className="size-4" aria-hidden="true" />} />
              </div>
            </div>
          ))}
          {!problems.length ? <p className="p-5 text-sm text-ink-soft">Không có nội dung cần duyệt với bộ lọc hiện tại.</p> : null}
        </div>
      </section>
    </div>
  );
}
