import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { submitDiagnosticAction } from "@/app/diagnostic/actions";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getDiagnosticQuestionsForAttempt } from "@/lib/diagnostic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getOptions(options: unknown) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => {
    const item = option && typeof option === "object" ? (option as Record<string, unknown>) : {};
    const id = String(item.id ?? item.label ?? "");
    const text = String(item.text ?? "");
    return id && text ? { id, text } : null;
  }).filter((item): item is { id: string; text: string } => Boolean(item));
}

function textQuestion(type: string) {
  return ["WORD_FORMATION", "OPEN_CLOZE", "SHORT_ANSWER", "TRIOS_GAPPED_SENTENCES", "SENTENCE_TRANSFORMATION", "LISTENING_SHORT_ANSWER"].includes(type);
}

export default async function DiagnosticStartPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const attemptId = typeof params.attempt === "string" ? params.attempt : "";
  const error = typeof params.error === "string" ? params.error : "";
  if (!attemptId) redirect("/diagnostic");

  const data = await getDiagnosticQuestionsForAttempt(attemptId, user.id);
  if (!data) redirect("/diagnostic");
  if (data.attempt.status === "COMPLETED" || data.attempt.status === "NEEDS_REVIEW") redirect(`/diagnostic/result?attempt=${attemptId}`);

  const questionsById = new Map(data.questions.map((question) => [question.id, question]));
  const visibleSections = data.sections
    .map((section) => ({
      ...section,
      questions: section.questionIds.flatMap((id) => {
        const question = questionsById.get(id);
        return question ? [question] : [];
      }),
    }))
    .filter((section) => section.questions.length > 0 || section.warning);
  const totalQuestions = visibleSections.reduce((sum, section) => sum + section.questions.length, 0);

  return (
    <div className="grid gap-6">
      <header className="surface rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">Diagnostic placement</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Làm theo từng section</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Bài kiểm tra ưu tiên câu diagnostic-eligible đã publish. Sentence transformation không khớp chính xác và Writing sẽ được đánh dấu cần review, không ép vào điểm tự động.
            </p>
          </div>
          <div className="rounded-xl bg-panel-muted px-4 py-3 text-sm">
            <p className="font-semibold">Tiến độ</p>
            <p className="tabular-nums mt-1 text-ink-soft">{totalQuestions} câu · {visibleSections.length} section</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-panel-muted">
          <div className="h-full rounded-full bg-accent" style={{ width: totalQuestions ? "100%" : "0%" }} />
        </div>
      </header>

      {data.questions.length ? (
        <form action={submitDiagnosticAction} className="grid gap-5">
          <input type="hidden" name="attemptId" value={attemptId} />
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
          {visibleSections.map((section) => (
            <section key={section.id} className="surface overflow-hidden rounded-2xl">
              <div className="border-b border-line bg-panel-muted/55 px-5 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-accent">{section.title}</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">{section.description}</h2>
                  </div>
                  <span className="tabular-nums rounded-lg bg-white px-2 py-1 text-xs font-semibold text-ink-soft shadow-[var(--shadow-border)]">
                    {section.questions.length}/{section.targetCount || "optional"} câu
                  </span>
                </div>
                {section.warning ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warning">{section.warning}</p> : null}
              </div>

              <div className="divide-y divide-line">
                {section.questions.map((question, sectionIndex) => {
                  const options = getOptions(question.options);
                  return (
                    <article key={question.id} className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-foreground px-2 py-1 text-xs font-semibold text-background">Câu {sectionIndex + 1}</span>
                        <SkillBadge skill={question.skillType} />
                        <DifficultyBadge difficulty={question.difficulty} />
                        <span className="text-xs text-ink-soft">{question.problem.title}</span>
                      </div>
                      {question.passage ? (
                        <div className="mt-4 rounded-xl bg-panel-muted p-4 text-sm leading-7 text-ink-soft">{question.passage}</div>
                      ) : null}
                      <p className="mt-4 text-sm font-semibold leading-7">{question.prompt}</p>
                      {options.length ? (
                        <div className="mt-4 grid gap-2">
                          {options.map((option) => (
                            <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 text-sm shadow-[var(--shadow-border)]">
                              <input type="radio" name={`answer:${question.id}`} value={option.id} className="accent-[var(--accent)]" />
                              <span className="font-semibold">{option.id}.</span>
                              <span>{option.text}</span>
                            </label>
                          ))}
                        </div>
                      ) : question.type === "ERROR_IDENTIFICATION" ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input
                            name={`answer:${question.id}:part`}
                            placeholder="Phần sai / dòng sai"
                            className="min-h-11 rounded-xl bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
                          />
                          <input
                            name={`answer:${question.id}:correction`}
                            placeholder="Sửa thành..."
                            className="min-h-11 rounded-xl bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
                          />
                        </div>
                      ) : question.type === "WRITING_PROMPT" ? (
                        <textarea
                          name={`answer:${question.id}`}
                          placeholder="Viết dàn ý hoặc đoạn trả lời ngắn. Phần này không tính vào level tự động."
                          className="mt-4 min-h-36 w-full rounded-xl bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
                        />
                      ) : textQuestion(question.type) ? (
                        <input
                          name={`answer:${question.id}`}
                          placeholder="Nhập câu trả lời"
                          className="mt-4 min-h-11 w-full rounded-xl bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
                        />
                      ) : (
                        <p className="mt-4 rounded-xl bg-panel-muted p-3 text-sm text-ink-soft">Dạng này sẽ được kiểm tra thủ công.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="sticky bottom-4 z-10 flex flex-wrap justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-[0_18px_60px_-32px_rgba(23,33,27,0.45)] backdrop-blur">
            <Link href="/diagnostic" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-panel-muted px-4 text-sm font-semibold">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Rời bài
            </Link>
            <FormSubmitButton pendingLabel="Đang nộp diagnostic..." className="gap-2 px-5">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Nộp diagnostic
            </FormSubmitButton>
          </div>
        </form>
      ) : (
        <section className="surface rounded-2xl p-6">
          <h2 className="text-xl font-semibold">Chưa có câu hỏi phù hợp</h2>
          <p className="mt-2 text-sm text-ink-soft">Hãy publish một số bài trong kho trước khi chạy diagnostic.</p>
        </section>
      )}
    </div>
  );
}
