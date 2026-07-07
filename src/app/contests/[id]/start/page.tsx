import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { submitContestAction } from "@/app/contests/actions";
import { ContestSubmitBar } from "@/components/contests/ContestSubmitBar";
import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import { requireUser } from "@/lib/auth/session";
import { findContestByIdOrSlug } from "@/lib/contests";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getOptions(options: unknown) {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      const item = option && typeof option === "object" ? (option as Record<string, unknown>) : {};
      const id = String(item.id ?? item.label ?? "");
      const text = String(item.text ?? "");
      return id && text ? { id, text } : null;
    })
    .filter((item): item is { id: string; text: string } => Boolean(item));
}

function textQuestion(type: string) {
  return ["WORD_FORMATION", "OPEN_CLOZE", "SHORT_ANSWER", "TRIOS_GAPPED_SENTENCES", "SENTENCE_TRANSFORMATION", "LISTENING_SHORT_ANSWER"].includes(type);
}

export default async function ContestStartPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";
  const error = typeof query.error === "string" ? query.error : "";
  const contest = await findContestByIdOrSlug(id);
  if (!contest || !attemptId) redirect(`/contests/${id}`);
  const attempt = await prisma.contestAttempt.findFirst({ where: { id: attemptId, contestId: contest.id, userId: user.id } });
  if (!attempt) redirect(`/contests/${contest.slug}`);
  if (attempt.status !== "IN_PROGRESS") redirect(`/contests/${contest.slug}/result?attempt=${attempt.id}`);

  return (
    <div className="grid gap-6">
      <header className="surface rounded-3xl p-6">
        <p className="text-sm font-semibold text-accent">Contest</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{contest.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1 rounded-full bg-panel-muted px-2.5 py-1">
            <Clock className="size-4" aria-hidden="true" />
            {contest.durationMinutes ? `${contest.durationMinutes} phút` : "Không giới hạn"}
          </span>
          <span className="rounded-full bg-panel-muted px-2.5 py-1">Không lưu kết quả cho tới khi nộp bài</span>
        </div>
      </header>

      <form action={submitContestAction} className="grid gap-5">
        <input type="hidden" name="contestId" value={contest.id} />
        <input type="hidden" name="attemptId" value={attempt.id} />
        {error ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

        {contest.problems.map((contestProblem, problemIndex) => (
          <section key={contestProblem.id} className="surface rounded-3xl p-6">
            <p className="text-xs font-semibold text-accent">{contestProblem.section}</p>
            <h2 className="mt-2 text-xl font-semibold text-balance">
              {problemIndex + 1}. {contestProblem.problem.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{contestProblem.problem.statement}</p>
            {contestProblem.problem.instructions ? <p className="mt-2 text-sm leading-6 text-ink-soft">{contestProblem.problem.instructions}</p> : null}

            <div className="mt-5 grid gap-4">
              {contestProblem.problem.questions.map((question, questionIndex) => {
                const options = getOptions(question.options);
                const isSentenceTransformation = question.type === "SENTENCE_TRANSFORMATION";

                return (
                  <article key={question.id} className="rounded-2xl bg-panel-muted p-4">
                    <p className="text-sm font-semibold">Câu {questionIndex + 1}</p>
                    {question.passage ? <div className="mt-3 rounded-2xl bg-panel p-3 text-sm leading-7 text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">{question.passage}</div> : null}

                    {isSentenceTransformation ? (
                      <div className="mt-3 grid gap-2">
                        <span className="text-xs font-semibold text-accent">Viết lại câu — giữ nghĩa, không thêm thông tin</span>
                        <p className="text-sm font-semibold leading-7">{question.prompt}</p>
                        {question.keyword ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft/60 px-3 py-1.5 text-sm">
                            <span className="text-xs font-normal text-ink-soft">Từ bắt buộc</span>
                            <span className="font-bold text-foreground">{question.keyword}</span>
                          </span>
                        ) : null}
                        {question.targetSentence ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft/60 px-3 py-1.5 text-sm">
                            <span className="text-xs font-normal text-ink-soft">Bắt đầu bằng</span>
                            <span className="font-normal italic text-foreground">{question.targetSentence}</span>
                          </span>
                        ) : null}
                        {!question.keyword && !question.targetSentence ? (
                          <p className="text-xs leading-5 text-ink-soft">Nếu đề không cho từ bắt buộc hoặc phần mở đầu, hãy nhập cả câu hoàn chỉnh sao cho nghĩa tương đương.</p>
                        ) : null}
                        <textarea
                          name={`answer:${contestProblem.problemId}:${question.id}`}
                          rows={3}
                          placeholder={question.keyword || question.targetSentence ? "Nhập câu viết lại hoàn chỉnh, dùng từ cho sẵn." : "Nhập câu viết lại hoàn chỉnh, đảm bảo nghĩa tương đương."}
                          className="field mt-2 min-h-24 w-full p-3"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-semibold leading-7">{question.prompt}</p>
                        <QuestionRootWord question={question} className="mt-2" />
                        {options.length ? (
                          <div className="mt-3 grid gap-2">
                            {options.map((option) => (
                              <label key={option.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-panel px-4 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-150 hover:bg-accent-soft/40">
                                <input type="radio" name={`answer:${contestProblem.problemId}:${question.id}`} value={option.id} className="accent-[var(--accent)]" />
                                <span className="font-semibold">{option.id}.</span>
                                <span>{option.text}</span>
                              </label>
                            ))}
                          </div>
                        ) : textQuestion(question.type) ? (
                          <input name={`answer:${contestProblem.problemId}:${question.id}`} className="field mt-3 min-h-11 w-full" placeholder="Nhập câu trả lời" />
                        ) : (
                          <textarea name={`answer:${contestProblem.problemId}:${question.id}`} className="field mt-3 min-h-32 w-full p-3" placeholder="Viết câu trả lời" />
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <ContestSubmitBar returnHref={`/contests/${contest.slug}`} startedAt={attempt.startedAt.toISOString()} durationMinutes={contest.durationMinutes} />
      </form>
    </div>
  );
}
