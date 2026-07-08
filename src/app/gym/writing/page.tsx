import Link from "next/link";
import { ArrowRight, FilePenLine, PenTool } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { WRITING_PROMPTS } from "@/lib/writing-prompts";
import { getWritingSubmissionUsage } from "@/lib/writing-submissions";

export default async function GymWritingPage() {
  const user = await getCurrentUser();

  const [submissionMap, usage] = await Promise.all([
    user
      ? prisma.writingSubmission.findMany({
          where: { userId: user.id },
          select: { promptSlug: true, createdAt: true, resultJson: true },
        }).then((subs) => {
          const map = new Map<string, { createdAt: Date; hasResult: boolean }>();
          for (const sub of subs) {
            // Only keep the latest submission per prompt
            const existing = map.get(sub.promptSlug);
            if (!existing || sub.createdAt > existing.createdAt) {
              map.set(sub.promptSlug, { createdAt: sub.createdAt, hasResult: !!sub.resultJson });
            }
          }
          return map;
        })
      : Promise.resolve(new Map<string, { createdAt: Date; hasResult: boolean }>()),
    user ? getWritingSubmissionUsage(user.id) : Promise.resolve({ used: 0, limit: 5, remaining: 5 }),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <PenTool className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Gym / Writing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Luyện viết Writing</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Chọn đề viết, soạn bài, rồi gửi để nhận nhận xét theo tiêu chí chuyên Anh: nội dung, bố cục, ngôn ngữ và lỗi diễn đạt.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl p-5">
          <FilePenLine className="size-5 text-accent" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink-soft">Số lượng đề viết</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">{WRITING_PROMPTS.length}</p>
        </div>
        {user ? (
          <div className="surface rounded-2xl p-5">
            <PenTool className="size-5 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink-soft">Đề đã làm</p>
            <p className="tabular-nums mt-2 text-3xl font-semibold">{submissionMap.size}</p>
          </div>
        ) : null}
        <Link href="/wiki" className="surface surface-hover rounded-2xl p-5">
          <p className="text-sm font-semibold text-accent">Wiki</p>
          <h2 className="mt-2 text-lg font-semibold">Ôn cấu trúc bài viết</h2>
        </Link>
      </section>

      {user && (
        <section className="surface rounded-2xl p-4">
          <p className="text-sm font-medium">
            Còn <span className="tabular-nums font-semibold text-accent-strong">{usage.remaining}</span>/{usage.limit} lượt nộp hôm nay
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {WRITING_PROMPTS.map((prompt) => {
          const submission = submissionMap.get(prompt.slug);
          const isCompleted = !!submission;
          const hasResult = submission?.hasResult;
          return (
            <Link
              key={prompt.slug}
              href={`/gym/writing/grader?prompt=${encodeURIComponent(prompt.slug)}`}
              className={`rounded-2xl p-5 transition-all duration-150 ${isCompleted ? "surface surface-hover border border-accent/20 bg-accent/5" : "surface surface-hover"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-balance">{prompt.title}</h2>
                <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-strong">
                  {prompt.difficulty}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-panel-muted px-2.5 py-1 font-medium text-ink-soft">
                  {prompt.essayType}
                </span>
                <span className="rounded-full bg-panel-muted px-2.5 py-1 font-medium text-ink-soft">
                  {prompt.targetWordCount}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{prompt.statement}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className={`text-xs font-medium ${isCompleted ? "text-accent" : "text-ink-soft"}`}>
                  {isCompleted ? "Đã nộp" : "Chưa làm"}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-accent-strong">
                  {isCompleted ? (hasResult ? "Xem lại" : "Viết lại") : "Viết bài"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {!user && (
        <section className="surface rounded-2xl p-5">
          <p className="text-sm text-ink-soft">
            <Link href="/auth/sign-in" className="font-semibold text-accent-strong hover:underline">Đăng nhập</Link> để lưu bài viết và nhận nhận xét.
          </p>
        </section>
      )}
    </div>
  );
}
