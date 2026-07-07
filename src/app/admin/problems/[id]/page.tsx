import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Archive, Eye, Pencil, RotateCcw, Rocket, ShieldCheck } from "lucide-react";
import { problemStatusAction } from "@/app/admin/actions";
import { ContentStatusBadge, DifficultyBadge, SkillBadge, TopicTag } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { questionTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function jsonText(value: unknown) {
  return value === null || value === undefined ? "â€”" : JSON.stringify(value, null, 2);
}

function ActionButton({ problemId, intent, label, icon }: { problemId: string; intent: string; label: string; icon: ReactNode }) {
  return (
    <form action={problemStatusAction}>
      <input type="hidden" name="problemId" value={problemId} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value={`/admin/problems/${problemId}`} />
      <button
        type="submit"
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold transition-[background-color,color] duration-150 hover:bg-foreground hover:text-background"
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

export default async function AdminProblemDetailPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const message = getParam(query, "message");
  const error = getParam(query, "error");

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      sourceCollection: true,
      importedBatch: true,
      reviewedBy: { select: { displayName: true } },
      problemTopics: { include: { topic: true } },
      questions: { orderBy: { orderIndex: "asc" } },
      _count: { select: { submissions: true } },
    },
  });

  if (!problem) notFound();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Admin problem</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{problem.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ContentStatusBadge status={problem.contentStatus} />
            <SkillBadge skill={problem.skillType} />
            <DifficultyBadge difficulty={problem.difficulty} />
            <span className="text-sm text-ink-soft">{questionTypeLabels[problem.questionType]}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/problems/${problem.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
            <Pencil className="size-4" aria-hidden="true" />
            Chỉnh sửa
          </Link>
          <Link href={`/admin/problems/${problem.id}/preview`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
            <Eye className="size-4" aria-hidden="true" />
            Xem trước
          </Link>
          <ActionButton problemId={problem.id} intent="publish" label="Xuất bản" icon={<Rocket className="size-4" aria-hidden="true" />} />
          <ActionButton problemId={problem.id} intent="archive" label="Lưu trữ" icon={<Archive className="size-4" aria-hidden="true" />} />
          <ActionButton problemId={problem.id} intent="needs-review" label="Mark needs review" icon={<ShieldCheck className="size-4" aria-hidden="true" />} />
          <ActionButton problemId={problem.id} intent="draft" label="Restore draft" icon={<RotateCcw className="size-4" aria-hidden="true" />} />
        </div>
      </div>

      {message ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="surface rounded-lg p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Metadata</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Slug</dt>
              <dd className="mt-1 text-ink-soft">{problem.slug}</dd>
            </div>
            <div>
              <dt className="font-semibold">Nguồn</dt>
              <dd className="mt-1 text-ink-soft">{problem.sourceCollection?.name ?? "Manual"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Estimated minutes</dt>
              <dd className="mt-1 text-ink-soft">{problem.estimatedMinutes ?? "â€”"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Reviewed by</dt>
              <dd className="mt-1 text-ink-soft">{problem.reviewedBy?.displayName ?? "â€”"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Published at</dt>
              <dd className="mt-1 text-ink-soft">{problem.publishedAt?.toLocaleString("vi-VN") ?? "â€”"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Import batch</dt>
              <dd className="mt-1 text-ink-soft">{problem.importedBatch ? `${problem.importedBatch.importType} Â· ${problem.importedBatch.createdAt.toLocaleString("vi-VN")}` : "â€”"}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="font-semibold">Topics</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {problem.problemTopics.map(({ topic }) => (
                <TopicTag key={topic.id} name={topic.name} />
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm leading-6">
            <div>
              <p className="font-semibold">Statement</p>
              <p className="mt-1 text-ink-soft">{problem.statement}</p>
            </div>
            {problem.instructions ? (
              <div>
                <p className="font-semibold">Instructions</p>
                <p className="mt-1 text-ink-soft">{problem.instructions}</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Submission stats</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-white px-3 py-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Submissions</p>
              <p className="tabular-nums mt-2 text-2xl font-semibold">{problem._count.submissions}</p>
            </div>
            <p className="text-sm leading-6 text-ink-soft">Phân tích acceptance, lỗi thường gặp và weak-skill sẽ được bổ sung ở phase sau.</p>
          </div>
        </aside>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Questions, answers, explanations</h2>
        <div className="mt-4 grid gap-4">
          {problem.questions.map((question) => (
            <article key={question.id} className="rounded-lg bg-panel-muted p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ContentStatusBadge status={question.contentStatus} />
                <span className="text-sm font-semibold">{questionTypeLabels[question.type]}</span>
                <span className="tabular-nums text-xs text-ink-soft">#{question.orderIndex}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{question.prompt}</p>
              {question.passage ? <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-6 text-ink-soft">{question.passage}</p> : null}
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">Options JSON</p>
                  <pre className="mt-1 overflow-auto rounded-md bg-white p-3 text-xs leading-5 text-ink-soft">{jsonText(question.options)}</pre>
                </div>
                <div>
                  <p className="text-sm font-semibold">Answer JSON</p>
                  <pre className="mt-1 overflow-auto rounded-md bg-white p-3 text-xs leading-5 text-ink-soft">{jsonText(question.answer)}</pre>
                </div>
              </div>
              {question.explanation ? <p className="mt-3 text-sm leading-6 text-ink-soft">{question.explanation}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
