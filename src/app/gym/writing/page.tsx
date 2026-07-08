import Link from "next/link";
import { ArrowRight, FilePenLine, PenTool } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function GymWritingPage() {
  const user = await getCurrentUser();

  const [problems, submissionMap] = await Promise.all([
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED", skillType: "WRITING" },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: 36,
      include: {
        questions: {
          where: { type: "WRITING_PROMPT" },
          take: 1,
          select: { prompt: true, metadata: true },
        },
      },
    }),
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
          <p className="tabular-nums mt-2 text-3xl font-semibold">{problems.length}</p>
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

      {problems.length === 0 ? (
        <section className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
          <h2 className="text-xl font-semibold">Chưa có đề viết nào</h2>
          <p className="mt-2 text-sm text-ink-soft">Đề viết mới sẽ xuất hiện sau khi được review và xuất bản.</p>
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {problems.map((problem) => {
            const submission = submissionMap.get(problem.slug);
            const isCompleted = !!submission;
            const hasResult = submission?.hasResult;
            return (
              <Link
                key={problem.id}
                href={`/gym/writing/grader?prompt=${encodeURIComponent(problem.slug)}`}
                className={`rounded-2xl p-5 transition-all duration-150 ${isCompleted ? "surface surface-hover border border-accent/20 bg-accent/5" : "surface surface-hover"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-balance">{problem.title}</h2>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                {problem.questions[0]?.metadata ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {(() => {
                      const meta = problem.questions[0].metadata as Record<string, unknown>;
                      if (meta.essayType) {
                        return (
                          <span className="rounded-full bg-panel-muted px-2.5 py-1 font-medium text-ink-soft">
                            {String(meta.essayType)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const meta = problem.questions[0].metadata as Record<string, unknown>;
                      if (meta.suggestedLength) {
                        return (
                          <span className="rounded-full bg-panel-muted px-2.5 py-1 font-medium text-ink-soft">
                            {String(meta.suggestedLength)} từ
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : null}
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{problem.statement}</p>
                <div className="mt-4 flex items-center justify-end gap-1.5 text-sm font-semibold text-accent-strong">
                  {isCompleted ? (hasResult ? "Xem lại" : "Viết lại") : "Viết bài"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </section>
      )}

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
