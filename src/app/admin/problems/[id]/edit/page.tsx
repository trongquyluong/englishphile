import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProblemWithQuestionsAction } from "@/app/admin/actions";
import { QuestionEditorSwitch } from "@/components/admin/QuestionEditors";
import { ContentStatusBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { contentStatusLabels, contentStatusOrder, difficultyLabels, difficultyOrder, questionTypeLabels, skillLabels, skillOrder } from "@/lib/labels";
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

function textareaClass() {
  return "min-h-28 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2";
}

export default async function AdminProblemEditPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const error = getParam(query, "error");

  const [problem, sources] = await Promise.all([
    prisma.problem.findUnique({
      where: { id },
      include: {
        sourceCollection: true,
        problemTopics: { include: { topic: true } },
        questions: { orderBy: { orderIndex: "asc" } },
      },
    }),
    prisma.sourceCollection.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!problem) notFound();

  const topicText = problem.problemTopics.map(({ topic }) => topic.name).join(", ");

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Chỉnh sửa</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{problem.title}</h1>
          <div className="mt-3">
            <ContentStatusBadge status={problem.contentStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/problems/${problem.id}`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-3 text-sm font-semibold">
            Quay lại detail
          </Link>
          <Link href={`/admin/problems/${problem.id}/preview`} className="inline-flex min-h-10 items-center rounded-md bg-panel-muted px-3 text-sm font-semibold">
            Xem trước
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

      <form action={updateProblemWithQuestionsAction} className="grid gap-5">
        <input type="hidden" name="problemId" value={problem.id} />

        <section className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold">Problem metadata</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Tiêu đề
              <input name="title" defaultValue={problem.title} className={inputClass()} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Slug
              <input name="slug" defaultValue={problem.slug} className={inputClass()} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Skill type
              <select name="skillType" defaultValue={problem.skillType} className={inputClass()}>
                {skillOrder.map((skill) => (
                  <option key={skill} value={skill}>
                    {skillLabels[skill]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Question type
              <select name="questionType" defaultValue={problem.questionType} className={inputClass()}>
                {Object.entries(questionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Độ khó
              <select name="difficulty" defaultValue={problem.difficulty} className={inputClass()}>
                {difficultyOrder.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficultyLabels[difficulty]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Content status
              <select name="contentStatus" defaultValue={problem.contentStatus} className={inputClass()}>
                {contentStatusOrder.map((status) => (
                  <option key={status} value={status}>
                    {contentStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Estimated minutes
              <input name="estimatedMinutes" type="number" defaultValue={problem.estimatedMinutes ?? ""} className={inputClass()} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Source collection
              <select name="sourceCollectionId" defaultValue={problem.sourceCollectionId ?? ""} className={inputClass()}>
                <option value="">Manual / no source</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Topic tags
              <input name="topicTags" defaultValue={topicText} className={inputClass()} placeholder="Inversion, Conditionals" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Statement
              <textarea name="statement" defaultValue={problem.statement} className={textareaClass()} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Instructions
              <textarea name="instructions" defaultValue={problem.instructions ?? ""} className={textareaClass()} />
            </label>
          </div>
        </section>

        <section className="surface rounded-lg p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Questions</h2>
              <p className="mt-1 text-sm text-ink-soft">JSON fields phải hợp lệ trước khi lưu. Không lưu kết quả nếu JSON sai.</p>
            </div>
            <button type="submit" className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Lưu thay đổi
            </button>
          </div>
          <div className="mt-5 grid gap-4">
            {problem.questions.map((question) => (
              <QuestionEditorSwitch key={question.id} question={question} />
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="min-h-11 rounded-md bg-foreground px-5 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}
