import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { submitDiagnosticAction } from "@/app/diagnostic/actions";
import { DifficultyBadge, QuestionNumberBadge, SkillBadge } from "@/components/ui/Badges";
import { LearnerCard } from "@/components/ui/LearnerCard";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getDiagnosticQuestionsForAttempt, getLatestDiagnosticAttempt } from "@/lib/diagnostic";
import { getVisibleRootWord } from "@/components/questions/QuestionRootWord";

type PageProps = {
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

const TEXT_QUESTION_TYPES = [
  "WORD_FORMATION",
  "OPEN_CLOZE",
  "SHORT_ANSWER",
  "TRIOS_GAPPED_SENTENCES",
  "LISTENING_SHORT_ANSWER",
];

const SENTENCE_TRANSFORMATION_TYPES = ["SENTENCE_TRANSFORMATION"];

export default async function DiagnosticStartPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  let attemptId = typeof params.attempt === "string" ? params.attempt : "";

  // Auto-find IN_PROGRESS attempt if none provided
  if (!attemptId) {
    const inProgress = await getLatestDiagnosticAttempt(user.id, "IN_PROGRESS");
    if (inProgress) {
      attemptId = inProgress.id;
    } else {
      redirect("/diagnostic");
    }
  }

  const data = await getDiagnosticQuestionsForAttempt(attemptId, user.id);
  if (!data) redirect("/diagnostic");
  if (data.attempt.status === "COMPLETED" || data.attempt.status === "NEEDS_REVIEW") {
    redirect(`/diagnostic/result?attempt=${attemptId}`);
  }
  if (data.attempt.status !== "IN_PROGRESS") redirect("/diagnostic");

  const questionsById = new Map(data.questions.map((q) => [q.id, q]));
  const visibleSections = data.sections
    .map((section) => ({
      ...section,
      questions: section.questionIds.flatMap((id) => {
        const question = questionsById.get(id);
        return question ? [question] : [];
      }),
    }))
    .filter((section) => section.questions.length > 0);

  const totalQuestions = visibleSections.reduce((sum, s) => sum + s.questions.length, 0);

  if (!data.questions.length) {
    return (
      <LearnerCard className="p-6">
        <h2 className="text-xl font-semibold">Bài kiểm tra đang được chuẩn bị</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Chưa có đủ câu hỏi cho bài kiểm tra. Trong lúc chờ, bạn có thể vào Gym luyện trước.
        </p>
        <Link href="/gym" className="btn btn-sm btn-secondary mt-5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Vào Gym
        </Link>
      </LearnerCard>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Back link */}
      <Link href="/diagnostic" className="btn btn-sm btn-ghost justify-self-start bg-panel-muted text-ink-soft">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Rời bài
      </Link>

      {/* Progress header */}
      <LearnerCard className="p-5">
        <div>
          <p className="text-sm font-semibold text-accent">Bài kiểm tra đầu vào</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            {totalQuestions} câu hỏi — làm theo thứ tự
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Làm từ đầu đến cuối, không cần nhanh. Một số câu tự luận sẽ được xem lại sau, không tính vào điểm tự động.
          </p>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-panel-muted"
          role="progressbar"
          aria-label={`Tiến độ: ${totalQuestions} câu`}
        >
          <div className="h-full rounded-full bg-accent" />
        </div>
      </LearnerCard>

      {/* Questions form */}
      <form action={submitDiagnosticAction} className="grid gap-5">
        <input type="hidden" name="attemptId" value={attemptId} />

        {error ? (
          <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}

        {visibleSections.map((section, sectionIndex) => (
          <LearnerCard key={section.id} className="overflow-hidden p-0">
            {/* Section header */}
            <div className="border-b border-line bg-panel-muted/55 px-5 py-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-accent">{section.title}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{section.description}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-panel px-2.5 py-1 text-xs font-semibold text-ink-soft tabular-nums shadow-[inset_0_0_0_1px_var(--line)]">
                  {section.questions.length} câu
                </span>
              </div>
            </div>

            {/* Questions */}
            <div className="divide-y divide-line">
              {section.questions.map((question, questionIndex) => {
                const globalIndex = visibleSections
                  .slice(0, sectionIndex)
                  .reduce((sum, s) => sum + s.questions.length, 0) + questionIndex;
                const options = getOptions(question.options);
                const rootWord = getVisibleRootWord(question);
                const isText = TEXT_QUESTION_TYPES.includes(question.type);
                const isSentenceTransformation = SENTENCE_TRANSFORMATION_TYPES.includes(question.type);

                return (
                  <fieldset
                    key={question.id}
                    className="p-5"
                    aria-labelledby={`q-prompt-${question.id}`}
                  >
                    {/* Question header */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <QuestionNumberBadge number={globalIndex + 1} />
                      <SkillBadge skill={question.skillType} />
                      <DifficultyBadge difficulty={question.difficulty} />
                      <span className="text-xs text-ink-soft">{question.problemTitle}</span>
                    </div>

                    {/* Passage */}
                    {question.passage ? (
                      <div className="mb-4 rounded-2xl bg-panel-muted p-4 text-sm leading-7 text-ink-soft">
                        {question.passage}
                      </div>
                    ) : null}

                    {/* Sentence Transformation: enhanced layout */}
                    {isSentenceTransformation ? (
                      <div className="grid gap-3">
                        <span className="text-xs font-semibold text-accent">
                          Viết lại câu — giữ nghĩa, không thêm thông tin
                        </span>
                        <p id={`q-prompt-${question.id}`} className="text-sm font-semibold leading-7">
                          {question.prompt}
                        </p>
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
                          <p className="text-xs leading-5 text-ink-soft">
                            Nếu đề không cho từ bắt buộc hoặc phần mở đầu, hãy nhập cả câu hoàn chỉnh sao cho nghĩa tương đương.
                          </p>
                        ) : null}
                        <textarea
                          name={`answer:${question.id}`}
                          rows={3}
                          placeholder={
                            question.keyword || question.targetSentence
                              ? "Nhập câu viết lại hoàn chỉnh, dùng từ cho sẵn."
                              : "Nhập câu viết lại hoàn chỉnh, đảm bảo nghĩa tương đương."
                          }
                          className="field min-h-24 p-3"
                        />
                      </div>
                    ) : (
                      <>
                        {/* Prompt */}
                        <p id={`q-prompt-${question.id}`} className="text-sm font-semibold leading-7">
                          {question.prompt}
                        </p>

                        {/* Root word for word formation */}
                        {rootWord ? (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-soft/60 px-3 py-1.5 text-sm">
                            <span className="text-xs font-normal text-ink-soft">Từ gốc</span>
                            <span className="font-semibold text-foreground">{rootWord}</span>
                          </div>
                        ) : null}

                        {/* Answer input */}
                        <div className="mt-4">
                          {options.length > 0 ? (
                            /* Multiple choice */
                            <div className="grid gap-2">
                              {options.map((option) => (
                                <label
                                  key={option.id}
                                  className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-panel px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-accent-soft/40"
                                >
                                  <input
                                    type="radio"
                                    name={`answer:${question.id}`}
                                    value={option.id}
                                    className="mt-0.5 size-4 accent-[var(--accent)]"
                                  />
                                  <span>
                                    <span className="mr-1 font-semibold">{option.id}.</span>
                                    {option.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : question.type === "ERROR_IDENTIFICATION" ? (
                            /* Error identification: two inputs */
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="grid gap-1.5">
                                <label htmlFor={`err-part-${question.id}`} className="text-xs font-semibold text-ink-soft">
                                  Dòng sai
                                </label>
                                <input
                                  id={`err-part-${question.id}`}
                                  name={`answer:${question.id}:part`}
                                  placeholder="Ghi số dòng"
                                  className="field min-h-11"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <label htmlFor={`err-corr-${question.id}`} className="text-xs font-semibold text-ink-soft">
                                  Sửa thành
                                </label>
                                <input
                                  id={`err-corr-${question.id}`}
                                  name={`answer:${question.id}:correction`}
                                  placeholder="Đáp án đúng"
                                  className="field min-h-11"
                                />
                              </div>
                            </div>
                          ) : question.type === "WRITING_PROMPT" ? (
                            /* Writing */
                            <div className="grid gap-1.5">
                              <label htmlFor={`write-${question.id}`} className="text-xs font-semibold text-ink-soft">
                                Viết câu trả lời
                              </label>
                              <textarea
                                id={`write-${question.id}`}
                                name={`answer:${question.id}`}
                                rows={5}
                                placeholder="Viết dàn ý hoặc đoạn trả lời. Phần này không tính vào điểm tự động."
                                className="field min-h-36 w-full p-3"
                              />
                            </div>
                          ) : isText ? (
                            /* Text answer */
                            <div className="grid gap-1.5">
                              <label htmlFor={`text-${question.id}`} className="text-xs font-semibold text-ink-soft">
                                Câu trả lời
                              </label>
                              <input
                                id={`text-${question.id}`}
                                name={`answer:${question.id}`}
                                placeholder="Nhập câu trả lời"
                                className="field min-h-11 w-full"
                              />
                            </div>
                          ) : (
                            <p className="rounded-2xl bg-panel-muted p-3 text-sm text-ink-soft">
                              Dạng này sẽ được kiểm tra thủ công.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </fieldset>
                );
              })}
            </div>
          </LearnerCard>
        ))}

        {/* Sticky submit bar */}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-[var(--shadow-float)] backdrop-blur-sm">
          <Link href="/diagnostic" className="btn btn-ghost bg-panel-muted">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Rời bài
          </Link>
          <FormSubmitButton pendingLabel="Đang nộp...">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Nộp bài
          </FormSubmitButton>
        </div>
      </form>
    </div>
  );
}
