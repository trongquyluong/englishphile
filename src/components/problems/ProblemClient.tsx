"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { QuestionRenderer } from "@/components/questions/QuestionRenderer";
import { SubmissionResult } from "@/components/submissions/SubmissionResult";
import type { AnswerMap, ClientProblem, SubmissionResultPayload } from "@/lib/problem-types";
import { cn } from "@/lib/utils";

type HistoryItem = {
  id: string;
  status: string;
  score: number | null;
  total: number | null;
  createdAt: string;
};

type ProblemClientProps = {
  problem: ClientProblem;
  history: HistoryItem[];
  isAuthenticated: boolean;
  previewMode?: boolean;
};

const tabs = ["Đề bài", "Gợi ý", "Lời giải", "Thảo luận", "Lịch sử nộp bài"] as const;
type Tab = (typeof tabs)[number];

export function ProblemClient({ problem, history, isAuthenticated, previewMode = false }: ProblemClientProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [activeTab, setActiveTab] = useState<Tab>("Đề bài");
  const [result, setResult] = useState<SubmissionResultPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = useMemo(
    () =>
      problem.questions.filter((question) => {
        const answer = answers[question.id];
        if (answer && typeof answer === "object") {
          return Object.values(answer).some((value) => String(value ?? "").trim().length > 0);
        }
        return String(answer ?? "").trim().length > 0;
      }).length,
    [answers, problem.questions],
  );

  const handleChange = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (previewMode) {
      setError("Chế độ xem trước dành cho quản trị — không lưu kết quả.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: problem.id,
        answers,
      }),
    });

    if (!response.ok) {
      setError(response.status === 401 ? "Bạn cần đăng nhập để lưu submission." : "Không thể nộp bài lúc này.");
      setIsSubmitting(false);
      return;
    }

    const payload = (await response.json()) as SubmissionResultPayload;
    setResult(payload);
    setActiveTab("Lời giải");
    setIsSubmitting(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {previewMode ? (
        <div className="rounded-lg bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 lg:col-span-2">
          Chế độ xem trước dành cho quản trị — không lưu kết quả.
        </div>
      ) : null}
      <section className="surface rounded-lg">
        <div className="flex gap-1 overflow-x-auto border-b border-line p-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "min-h-10 shrink-0 rounded-md px-3 text-sm font-semibold transition-[background-color,color] duration-150",
                activeTab === tab ? "bg-foreground text-background" : "text-ink-soft hover:bg-panel-muted hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "Đề bài" ? (
            <div className="grid gap-5">
              {problem.instructions ? (
                <div className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
                  {problem.instructions}
                </div>
              ) : null}
              <QuestionRenderer problem={problem} answers={answers} onChange={handleChange} disabled={isSubmitting} />
            </div>
          ) : null}

          {activeTab === "Gợi ý" ? (
            <div className="rounded-lg bg-panel-muted p-5 text-sm leading-7 text-ink-soft">
              <p className="font-semibold text-foreground">Gợi ý luyện tập</p>
              <p className="mt-2">
                Xác định dạng bài trước khi chọn đáp án. Với câu có nhiều chỗ trống, đọc toàn đoạn để nắm mạch ý rồi
                mới xử lý từng câu.
              </p>
              {problem.instructions ? <p className="mt-2">{problem.instructions}</p> : null}
            </div>
          ) : null}

          {activeTab === "Lời giải" ? (
            result ? (
              <SubmissionResult result={result} />
            ) : (
              <div className="rounded-lg bg-panel-muted p-5 text-sm leading-7 text-ink-soft">
                Hãy nộp bài để mở kết quả, đáp án đúng và giải thích cho từng câu.
              </div>
            )
          ) : null}

          {activeTab === "Thảo luận" ? (
            <div className="rounded-lg bg-panel-muted p-5 text-sm leading-7 text-ink-soft">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <MessageSquare className="size-4" aria-hidden="true" />
                Thảo luận
              </div>
              <p className="mt-2">Khu vực thảo luận theo bài sẽ được bổ sung ở phase sau.</p>
            </div>
          ) : null}

          {activeTab === "Lịch sử nộp bài" ? (
            <div className="grid gap-2">
              {history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className="rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                    <span className="font-semibold">{item.status}</span>
                    <span className="text-ink-soft">
                      {" "}
                      · {item.score ?? "—"}/{item.total ?? "—"} · {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-panel-muted p-5 text-sm text-ink-soft">Chưa có submission cho bài này.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <aside className="surface h-fit rounded-lg p-5 lg:sticky lg:top-24">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Answer panel</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Đã trả lời <span className="tabular font-semibold text-foreground">{answeredCount}</span>/
          <span className="tabular">{problem.questions.length}</span> câu.
        </p>

        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}

        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-4" aria-hidden="true" />
            {previewMode ? "Không lưu kết quả ở chế độ xem trước" : isSubmitting ? "Đang nộp..." : "Nộp bài"}
          </button>
        ) : (
          <Link
            href="/auth/sign-in"
            className="mt-5 flex min-h-11 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background"
          >
            Đăng nhập để nộp bài
          </Link>
        )}

        <p className="mt-4 text-xs leading-5 text-ink-soft">
          MCQ, cloze, word formation, reading và trios được chấm tự động. Writing và biến thể sentence transformation sẽ
          cần chấm thủ công khi không khớp chính xác.
        </p>
      </aside>
    </div>
  );
}
