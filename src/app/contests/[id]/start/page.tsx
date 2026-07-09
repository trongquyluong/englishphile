import Link from "next/link";
import { redirect } from "next/navigation";
import type { ContestAttempt } from "@prisma/client";
import { Clock, Eye } from "lucide-react";
import { submitContestAction } from "@/app/contests/actions";
import { ContestSubmitBar } from "@/components/contests/ContestSubmitBar";
import { QuestionRootWord } from "@/components/questions/QuestionRootWord";
import { isAdminUser, requireUser } from "@/lib/auth/session";
import { findContestByIdOrSlug } from "@/lib/contests";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// --- Answer input helpers ---

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
  return [
    "WORD_FORMATION",
    "OPEN_CLOZE",
    "SHORT_ANSWER",
    "TRIOS_GAPPED_SENTENCES",
    "SENTENCE_TRANSFORMATION",
    "LISTENING_SHORT_ANSWER",
  ].includes(type);
}

// --- Render a single question answer input ---

function QuestionAnswer({
  questionId,
  questionType,
  questionPrompt,
  options,
  rootWord,
  isSentenceTransformation,
  keyword,
  targetSentence,
  inputPrefix,
}: {
  questionId: string;
  questionType: string;
  questionPrompt: string | null;
  options: { id: string; text: string }[];
  rootWord: string | null;
  isSentenceTransformation: boolean;
  keyword: string | null;
  targetSentence: string | null;
  inputPrefix: string;
}) {
  const inputName = `${inputPrefix}:${questionId}`;

  if (isSentenceTransformation) {
    return (
      <div className="mt-3 grid gap-2">
        <span className="text-xs font-semibold text-accent">Viết lại câu — giữ nghĩa, không thêm thông tin</span>
        <p className="text-sm font-semibold leading-7">{questionPrompt}</p>
        {keyword ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft/60 px-3 py-1.5 text-sm">
            <span className="text-xs font-normal text-ink-soft">Từ bắt buộc</span>
            <span className="font-bold text-foreground">{keyword}</span>
          </span>
        ) : null}
        {targetSentence ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft/60 px-3 py-1.5 text-sm">
            <span className="text-xs font-normal text-ink-soft">Bắt đầu bằng</span>
            <span className="font-normal italic text-foreground">{targetSentence}</span>
          </span>
        ) : null}
        <textarea name={inputName} rows={3} className="field mt-2 min-h-24 w-full p-3" />
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 text-sm font-semibold leading-7">{questionPrompt}</p>
      {rootWord ? (
        <div className="mt-2">
          <QuestionRootWord question={{ type: questionType as never, prompt: questionPrompt ?? "", rootWord }} className="bg-white" />
        </div>
      ) : null}
      {options.length ? (
        <div className="mt-3 grid gap-2">
          {options.map((option) => (
            <label key={option.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-panel px-4 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-150 hover:bg-accent-soft/40">
              <input type="radio" name={inputName} value={option.id} className="accent-[var(--accent)]" />
              <span className="font-semibold">{option.id}.</span>
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      ) : textQuestion(questionType) ? (
        <input name={inputName} className="field mt-3 min-h-11 w-full" placeholder="Nhập câu trả lời" />
      ) : (
        <textarea name={inputName} className="field mt-3 min-h-32 w-full p-3" placeholder="Viết câu trả lời" />
      )}
    </>
  );
}

// --- Render problem-based section (backwards compatible) ---

function ProblemSection({
  contestProblem,
  problemIndex,
}: {
  contestProblem: {
    id: string;
    section: string;
    problem: {
      id: string;
      title: string;
      statement: string | null;
      instructions: string | null;
      questions: {
        id: string;
        type: string;
        prompt: string | null;
        options: unknown;
        rootWord: string | null;
        keyword: string | null;
        targetSentence: string | null;
      }[];
    };
  };
  problemIndex: number;
}) {
  const isSentenceTransformation = contestProblem.problem.questions.some((q) => q.type === "SENTENCE_TRANSFORMATION");

  return (
    <section className="surface rounded-3xl p-6">
      <p className="text-xs font-semibold text-accent">{contestProblem.section}</p>
      <h2 className="mt-2 text-xl font-semibold text-balance">
        {problemIndex + 1}. {contestProblem.problem.title}
      </h2>
      {contestProblem.problem.statement ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">{contestProblem.problem.statement}</p>
      ) : null}
      {contestProblem.problem.instructions ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">{contestProblem.problem.instructions}</p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {contestProblem.problem.questions.map((question, questionIndex) => {
          const options = getOptions(question.options);
          return (
            <article key={question.id} className="rounded-2xl bg-panel-muted p-4">
              <p className="text-sm font-semibold">Câu {questionIndex + 1}</p>
              {question.prompt ? (
                <QuestionAnswer
                  questionId={question.id}
                  questionType={question.type}
                  questionPrompt={question.prompt}
                  options={options}
                  rootWord={question.rootWord}
                  isSentenceTransformation={isSentenceTransformation}
                  keyword={question.keyword}
                  targetSentence={question.targetSentence}
                  inputPrefix={`answer:${contestProblem.problem.id}`}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// --- Render section-based content (standalone questions from ContestBuilder) ---

function BuilderSection({
  section,
  globalQuestionOffset,
}: {
  section: {
    id: string;
    title: string;
    skillType: string;
    instructions: string | null;
    audioUrl: string | null;
    passageText: string | null;
    questions: {
      id: string;
      type: string;
      prompt: string | null;
      optionsJson: unknown;
      rootWord: string | null;
      keyword: string | null;
      targetSentence: string | null;
    }[];
  };
  globalQuestionOffset: number;
}) {
  const isListening = section.skillType === "LISTENING";
  const isReading = section.skillType === "READING";
  const isSentenceTransformation = section.questions.some((q) => q.type === "SENTENCE_TRANSFORMATION");

  return (
    <section className="surface rounded-3xl p-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-accent">{section.title}</p>
        {isListening ? <span className="rounded-full bg-panel-muted px-2 py-0.5 text-xs">🎧 Nghe</span> : null}
        {isReading ? <span className="rounded-full bg-panel-muted px-2 py-0.5 text-xs">📖 Đọc</span> : null}
      </div>

      {/* Listening audio player */}
      {isListening && section.audioUrl ? (
        <div className="mt-4">
          <audio controls className="w-full max-w-xl" src={section.audioUrl}>
            Trình duyệt không hỗ trợ phát audio.
          </audio>
        </div>
      ) : null}

      {/* Reading passage */}
      {isReading && section.passageText ? (
        <div className="mt-4 rounded-2xl bg-panel p-4 text-sm leading-7 text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">
          {section.passageText}
        </div>
      ) : null}

      {/* Instructions */}
      {section.instructions ? (
        <p className="mt-3 text-sm leading-6 text-ink-soft italic">{section.instructions}</p>
      ) : null}

      {/* Questions */}
      <div className="mt-5 grid gap-4">
        {section.questions.map((question, qIndex) => {
          const options = getOptions(question.optionsJson);
          const globalNum = globalQuestionOffset + qIndex + 1;
          return (
            <article key={question.id} className="rounded-2xl bg-panel-muted p-4">
              <p className="text-sm font-semibold">Câu {globalNum}</p>
              {question.prompt ? (
                <QuestionAnswer
                  questionId={question.id}
                  questionType={question.type}
                  questionPrompt={question.prompt}
                  options={options}
                  rootWord={question.rootWord}
                  isSentenceTransformation={isSentenceTransformation}
                  keyword={question.keyword}
                  targetSentence={question.targetSentence}
                  inputPrefix={`sectionAnswer:${section.id}`}
                />
              ) : null}
            </article>
          );
        })}
        {section.questions.length === 0 && (
          <p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">Section này chưa có câu hỏi.</p>
        )}
      </div>
    </section>
  );
}

// --- Main page ---

export default async function ContestStartPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";
  const error = typeof query.error === "string" ? query.error : "";
  const isPreview = query.preview === "1" && isAdminUser(user);
  const contest = await findContestByIdOrSlug(id);
  if (!contest) redirect("/contests");

  // Admin preview renders the candidate view without an attempt; nothing is saved.
  let attempt: ContestAttempt | null = null;
  if (!isPreview) {
    if (!attemptId) redirect(`/contests/${contest.slug}`);
    attempt = await prisma.contestAttempt.findFirst({
      where: { id: attemptId, contestId: contest.id, userId: user.id },
    });
    if (!attempt) redirect(`/contests/${contest.slug}`);
    if (attempt.status !== "IN_PROGRESS") redirect(`/contests/${contest.slug}/result?attempt=${attempt.id}`);
  }

  // Precompute cumulative offsets for section-based questions
  const problemCount = contest.problems.reduce((sum, cp) => sum + cp.problem.questions.length, 0);
  const sectionOffsets = contest.sections.map((section, i) => {
    let offset = problemCount;
    for (let j = 0; j < i; j++) {
      offset += contest.sections[j].questions.length;
    }
    return offset;
  });

  const examContent = (
    <>
      {/* Problem-based content (backwards compatible) */}
      {contest.problems.map((contestProblem, problemIndex) => (
        <ProblemSection key={contestProblem.id} contestProblem={contestProblem as never} problemIndex={problemIndex} />
      ))}

      {/* Section-based content (standalone questions from ContestBuilder) */}
      {contest.sections.map((section, sectionIndex) => (
        <BuilderSection
          key={section.id}
          section={section as never}
          globalQuestionOffset={sectionOffsets[sectionIndex]}
        />
      ))}
    </>
  );

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
          {attempt ? (
            <span className="rounded-full bg-panel-muted px-2.5 py-1">Không lưu kết quả cho tới khi nộp bài</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent-strong">
              <Eye className="size-4" aria-hidden="true" />
              Chế độ xem trước
            </span>
          )}
        </div>
      </header>

      {attempt ? (
        <form action={submitContestAction} className="grid gap-5">
          <input type="hidden" name="contestId" value={contest.id} />
          <input type="hidden" name="attemptId" value={attempt.id} />
          {error ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

          {examContent}

          <ContestSubmitBar
            returnHref={`/contests/${contest.slug}`}
            startedAt={attempt.startedAt.toISOString()}
            durationMinutes={contest.durationMinutes}
          />
        </form>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3">
            <p className="text-sm font-semibold">
              Bạn đang xem contest ở góc nhìn thí sinh. Câu trả lời trong chế độ này không được lưu hay chấm điểm.
            </p>
            <Link href={`/admin/contests-builder/${contest.id}/edit`} className="btn btn-sm btn-secondary">
              Quay lại builder
            </Link>
          </div>

          {examContent}

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-[0_18px_60px_-32px_rgba(23,33,27,0.45)] backdrop-blur">
            <p className="text-sm text-ink-soft">Chế độ xem trước — nút nộp bài bị ẩn.</p>
            <Link href={`/admin/contests-builder/${contest.id}/edit`} className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 text-sm font-semibold text-background">
              Quay lại builder
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
