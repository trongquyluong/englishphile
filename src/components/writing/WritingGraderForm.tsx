"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListChecks, LoaderCircle, LogIn, Quote, Sparkles } from "lucide-react";
import {
  countWords,
  DEFAULT_TARGET_WORD_COUNT,
  targetWordCountOptions,
  WRITING_GRADER_MAX_WORDS,
  WRITING_GRADER_MIN_WORDS,
  type TargetWordCount,
  type WritingGradeResult,
} from "@/lib/writing-grader-shared";
import type { WritingPrompt } from "@/lib/writing-prompts";

type PromptData = WritingPrompt;

type Props = {
  enabled: boolean;
  isAuthenticated: boolean;
  prompt: PromptData;
};

const criterionRows = [
  { key: "content", label: "Nội dung" },
  { key: "organization", label: "Bố cục" },
  { key: "language", label: "Ngôn ngữ" },
  { key: "mechanics", label: "Chính tả & trình bày" },
] as const;

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function CriterionCard({ label, score, maxScore, comment }: { label: string; score: number; maxScore: number; comment: string }) {
  const percent = maxScore > 0 ? Math.min(100, Math.max(0, (score / maxScore) * 100)) : 0;
  return (
    <div className="rounded-2xl bg-panel-muted p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <p className="tabular-nums text-sm font-semibold">
          {formatScore(score)}
          <span className="font-medium text-ink-soft">/{maxScore}</span>
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      {comment ? <p className="mt-3 text-sm leading-6 text-ink-soft">{comment}</p> : null}
    </div>
  );
}

function GradeResultView({ result }: { result: WritingGradeResult }) {
  return (
    <div className="grid gap-4">
      <section className="surface-mint rounded-3xl p-6 md:p-8">
        <p className="text-sm font-semibold text-accent">Điểm ước lượng</p>
        <p className="tabular-nums mt-2 text-5xl font-semibold tracking-tight">
          {formatScore(result.totalScore)}
          <span className="text-2xl font-medium text-ink-soft">/{result.maxScore}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft text-pretty">
          Điểm do AI ước lượng theo tiêu chí chuyên Anh, chỉ để định hướng luyện tập — không phải kết quả thi chính thức.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {criterionRows.map((row) => (
          <CriterionCard
            key={row.key}
            label={row.label}
            score={result.criteria[row.key].score}
            maxScore={result.criteria[row.key].maxScore}
            comment={result.criteria[row.key].comment}
          />
        ))}
      </section>

      {result.warnings.length ? (
        <section className="rounded-3xl bg-warning-soft p-5">
          <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm leading-6 text-warning">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.overallComment ? (
        <section className="surface rounded-3xl p-6">
          <h3 className="text-lg font-semibold">Nhận xét chung</h3>
          <p className="mt-2 text-sm leading-7 text-ink-soft text-pretty">{result.overallComment}</p>
        </section>
      ) : null}

      {result.strengths.length || result.priorityIssues.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {result.strengths.length ? (
            <div className="surface rounded-3xl p-6">
              <h3 className="text-lg font-semibold">Điểm mạnh</h3>
              <ul className="mt-3 grid gap-2.5">
                {result.strengths.map((strength, index) => (
                  <li key={index} className="flex gap-2.5 text-sm leading-6 text-ink-soft">
                    <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.priorityIssues.length ? (
            <div className="surface rounded-3xl p-6">
              <h3 className="text-lg font-semibold">Cần ưu tiên sửa</h3>
              <ul className="mt-3 grid gap-2.5">
                {result.priorityIssues.map((issue, index) => (
                  <li key={index} className="flex gap-2.5 text-sm leading-6 text-ink-soft">
                    <span className="mt-1 shrink-0 text-warning" aria-hidden="true">⚠</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {result.detailedFeedback.length ? (
        <section className="surface rounded-3xl p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Quote className="size-4 text-accent" aria-hidden="true" />
            Nhận xét theo trích dẫn
          </h3>
          <div className="mt-4 grid gap-3">
            {result.detailedFeedback.map((item, index) => (
              <article key={index} className="rounded-2xl bg-panel-muted p-4">
                <blockquote className="border-l-2 border-accent pl-3 text-sm italic leading-6 break-words">
                  „{item.quote}&quot;
                </blockquote>
                <p className="mt-3 text-sm leading-6">
                  <span className="font-semibold">Vấn đề: </span>
                  {item.issue}
                </p>
                {item.explanation ? (
                  <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                    <span className="font-semibold text-foreground">Vì sao quan trọng: </span>
                    {item.explanation}
                  </p>
                ) : null}
                {item.suggestedRevision ? (
                  <p className="mt-2.5 rounded-xl bg-accent-soft/60 p-3 text-sm leading-6 text-accent-strong break-words">
                    <span className="font-semibold">Gợi ý sửa: </span>
                    {item.suggestedRevision}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result.suggestedRewrite?.thesis || result.suggestedRewrite?.paragraph ? (
        <section className="surface rounded-3xl p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            Gợi ý viết lại
          </h3>
          {result.suggestedRewrite.thesis ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Thesis gợi ý</p>
              <p className="mt-1.5 rounded-2xl bg-panel-muted p-4 text-sm leading-7 break-words">{result.suggestedRewrite.thesis}</p>
            </div>
          ) : null}
          {result.suggestedRewrite.paragraph ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Đoạn văn gợi ý</p>
              <p className="mt-1.5 rounded-2xl bg-panel-muted p-4 text-sm leading-7 break-words">{result.suggestedRewrite.paragraph}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {result.nextPracticeTasks.length ? (
        <section className="surface rounded-3xl p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="size-4 text-accent" aria-hidden="true" />
            Bài luyện tiếp theo
          </h3>
          <ol className="mt-3 grid gap-2.5">
            {result.nextPracticeTasks.map((task, index) => (
              <li key={index} className="flex gap-3 text-sm leading-6 text-ink-soft">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-on-accent">
                  {index + 1}
                </span>
                <span>{task}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function WritingGraderForm({ enabled, isAuthenticated, prompt }: Props) {
  const [targetWordCount, setTargetWordCount] = useState<TargetWordCount>(() => {
    // Default to the prompt's target word count
    return DEFAULT_TARGET_WORD_COUNT;
  });
  const [essayText, setEssayText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WritingGradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyLimitError, setDailyLimitError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const wordCount = useMemo(() => countWords(essayText), [essayText]);
  const formDisabled = !enabled || !isAuthenticated || loading;

  const wordCountTone =
    wordCount > WRITING_GRADER_MAX_WORDS
      ? "text-danger"
      : wordCount > 0 && wordCount < WRITING_GRADER_MIN_WORDS
        ? "text-warning"
        : "text-ink-soft";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formDisabled) return;

    if (!essayText.trim()) {
      setError("Vui lòng nhập bài viết của bạn vào ô bài làm.");
      return;
    }
    if (wordCount < WRITING_GRADER_MIN_WORDS) {
      setError(`Bài viết hiện có ${wordCount} từ — cần ít nhất ${WRITING_GRADER_MIN_WORDS} từ để chấm chính xác.`);
      return;
    }
    if (wordCount > WRITING_GRADER_MAX_WORDS) {
      setError(`Bài viết hiện có ${wordCount} từ — vượt giới hạn ${WRITING_GRADER_MAX_WORDS} từ của bản beta. Hãy rút gọn bớt.`);
      return;
    }

    setLoading(true);
    setError(null);
    setDailyLimitError(null);
    setResult(null);
    try {
      const response = await fetch("/api/writing/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptSlug: prompt.slug,
          essayText,
          targetWordCount,
        }),
      });
      const data = (await response.json().catch(() => null)) as { result?: WritingGradeResult; error?: string } | null;
      if (!response.ok || !data?.result) {
        if (response.status === 429) {
          setDailyLimitError(data?.error ?? "Bạn đã dùng hết 5 lượt chấm Writing hôm nay. Hãy quay lại vào ngày mai.");
        } else {
          setError(data?.error ?? "Có lỗi xảy ra khi chấm bài. Vui lòng thử lại.");
        }
        return;
      }
      setResult(data.result);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Không gửi được bài viết. Hãy kiểm tra kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {enabled && !isAuthenticated ? (
        <div className="surface flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink-soft">Bạn cần đăng nhập để nộp bài và nhận nhận xét.</p>
          <Link href="/auth/sign-in" className="btn btn-primary shrink-0 self-start sm:self-auto">
            <LogIn className="size-4" aria-hidden="true" />
            Đăng nhập
          </Link>
        </div>
      ) : null}

      {dailyLimitError ? (
        <div className="rounded-2xl bg-warning-soft p-4 text-sm leading-6 text-warning" role="alert">
          <p className="font-semibold">Đã hết lượt nộp hôm nay</p>
          <p className="mt-1">{dailyLimitError}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="surface rounded-3xl p-6 md:p-8">
        <fieldset disabled={formDisabled} className="grid gap-5">
          {/* Read-only prompt display */}
          <div className="rounded-2xl bg-panel-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Đề bài</p>
            <p className="mt-2 text-sm leading-6">{prompt.statement}</p>
          </div>

          {/* Read-only essay type and target length */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm font-medium">
              <label>Dạng bài</label>
              <div className="field flex min-h-11 items-center rounded-lg border border-panel bg-panel-muted px-3 text-sm text-ink-soft">
                {prompt.essayType}
              </div>
            </div>
            <div className="grid gap-2 text-sm font-medium">
              <label htmlFor="target-word-count">Độ dài mục tiêu</label>
              <select
                id="target-word-count"
                value={targetWordCount}
                onChange={(event) => setTargetWordCount(event.target.value as TargetWordCount)}
                className="field min-h-11"
              >
                {targetWordCountOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 text-sm font-medium">
            <label htmlFor="essay-text">Bài viết của bạn</label>
            <textarea
              id="essay-text"
              value={essayText}
              onChange={(event) => setEssayText(event.target.value)}
              rows={14}
              className="field min-h-72 resize-y p-3"
              placeholder="Viết bài luận tiếng Anh của bạn ở đây..."
            />
            <span className={`tabular-nums text-xs font-medium ${wordCountTone}`}>
              {wordCount} từ · tối thiểu {WRITING_GRADER_MIN_WORDS}, tối đa {WRITING_GRADER_MAX_WORDS} từ
            </span>
          </div>

          {error ? (
            <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm font-medium leading-6 text-danger">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary justify-self-start" disabled={formDisabled}>
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Đang đọc bài viết...
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden="true" />
                Nộp bài
              </>
            )}
          </button>
        </fieldset>
      </form>

      <div ref={resultRef} aria-live="polite">
        {result ? <GradeResultView result={result} /> : null}
      </div>
    </div>
  );
}
