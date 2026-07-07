import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { saveManualGradeAction } from "@/app/teacher/grading/actions";
import { SkillBadge } from "@/components/ui/Badges";
import { summarizeCorrectAnswer } from "@/lib/answer-checking";
import { requireTeacher } from "@/lib/classroom/permissions";
import { getSubmissionAnswerForGrading } from "@/lib/grading/manual-grading";
import { manualGradeCorrectnessLabels } from "@/lib/labels";

type PageProps = {
  params: Promise<{ submissionAnswerId: string }>;
};

function formatJson(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function ManualGradingDetailPage({ params }: PageProps) {
  const user = await requireTeacher();
  const { submissionAnswerId } = await params;
  const answer = await getSubmissionAnswerForGrading(submissionAnswerId, user);
  if (!answer) notFound();

  const assignment = answer.submission.assignmentProblemSubmissions[0]?.assignmentSubmission.assignment;
  const isWriting = answer.question.type === "WRITING_PROMPT";
  const isTransformation = answer.question.type === "SENTENCE_TRANSFORMATION";

  return (
    <div className="grid gap-6">
      <Link href="/teacher/grading" className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại hàng đợi
      </Link>

      <header className="surface rounded-lg p-5">
        <SkillBadge skill={answer.question.skillType} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Chấm bài</h1>
        <div className="mt-3 grid gap-1 text-sm text-ink-soft">
          <span>Học sinh: <strong className="text-foreground">{answer.submission.user.displayName}</strong> ({answer.submission.user.email})</span>
          <span>Problem: <strong className="text-foreground">{answer.submission.problem.title}</strong></span>
          <span>Assignment: <strong className="text-foreground">{assignment?.title ?? "—"}</strong></span>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <article className="surface rounded-lg p-5">
            <h2 className="text-lg font-semibold">Đề bài</h2>
            {answer.question.passage ? <p className="mt-3 whitespace-pre-wrap rounded-md bg-panel-muted p-3 text-sm leading-6">{answer.question.passage}</p> : null}
            <p className="mt-3 text-sm leading-6 text-ink-soft">{answer.question.prompt}</p>
            {isTransformation ? (
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="rounded-md bg-panel-muted p-3">
                  <dt className="font-semibold">Keyword</dt>
                  <dd className="mt-1 text-ink-soft">{answer.question.keyword ?? "—"}</dd>
                </div>
                <div className="rounded-md bg-panel-muted p-3">
                  <dt className="font-semibold">Target/model answer</dt>
                  <dd className="mt-1 text-ink-soft">{answer.question.targetSentence ?? summarizeCorrectAnswer(answer.question)}</dd>
                </div>
              </dl>
            ) : null}
          </article>

          <article className="surface rounded-lg p-5">
            <h2 className="text-lg font-semibold">Câu trả lời của học sinh</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">{formatJson(answer.studentAnswer)}</pre>
          </article>

          <article className="surface rounded-lg p-5">
            <h2 className="text-lg font-semibold">Đáp án mẫu / rubric</h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{summarizeCorrectAnswer(answer.question)}</p>
            {answer.question.explanation ? <p className="mt-2 text-sm leading-6 text-ink-soft">{answer.question.explanation}</p> : null}
            {answer.feedback ? <p className="mt-3 rounded-md bg-panel-muted p-3 text-sm text-ink-soft">Phản hồi tự động: {answer.feedback}</p> : null}
          </article>
        </div>

        <form action={saveManualGradeAction} className="surface h-fit rounded-lg p-5 lg:sticky lg:top-24">
          <input type="hidden" name="submissionAnswerId" value={answer.id} />
          <h2 className="text-lg font-semibold">Nhận xét của giáo viên</h2>
          <div className="mt-4 grid gap-2">
            {(Object.keys(manualGradeCorrectnessLabels) as Array<keyof typeof manualGradeCorrectnessLabels>).map((correctness) => (
              <label key={correctness} className="flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold">
                <input name="correctness" type="radio" value={correctness} defaultChecked={correctness === "NEEDS_REVISION"} className="size-4 accent-foreground" />
                {manualGradeCorrectnessLabels[correctness]}
              </label>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Điểm
              <input name="score" type="number" step="0.25" min={0} defaultValue={isWriting ? 3 : 1} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Điểm tối đa
              <input name="maxScore" type="number" step="0.25" min={0.25} defaultValue={isWriting ? 5 : 1} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm font-normal" />
            </label>
          </div>

          {isWriting ? (
            <div className="mt-4 grid gap-3">
              {[
                ["taskResponse", "Bám sát đề"],
                ["coherence", "Mạch lạc và liên kết"],
                ["lexicalResource", "Từ vựng"],
                ["grammarRangeAccuracy", "Ngữ pháp và độ chính xác"],
                ["sophistication", "Độ sắc sảo học thuật"],
              ].map(([name, label]) => (
                <label key={name} className="grid gap-1 text-sm font-semibold">
                  {label}
                  <textarea name={name} className="min-h-16 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" />
                </label>
              ))}
            </div>
          ) : null}

          {isTransformation ? (
            <label className="mt-4 grid gap-1 text-sm font-semibold">
              Ghi chú ngữ pháp
              <textarea name="grammarNote" defaultValue={answer.question.explanation ?? ""} className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" />
            </label>
          ) : null}

          <label className="mt-4 grid gap-1 text-sm font-semibold">
            Nhận xét tổng quát
            <textarea name="feedback" className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" placeholder="Ghi nhận xét cụ thể để học sinh biết cần sửa gì." />
          </label>

          <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
            <Save className="size-4" aria-hidden="true" />
            Lưu điểm
          </button>
        </form>
      </section>
    </div>
  );
}
