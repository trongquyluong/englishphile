import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { WritingGraderForm } from "@/components/writing/WritingGraderForm";
import { isWritingGraderEnabled } from "@/lib/ai/writing-grader";
import { getCurrentUser } from "@/lib/auth/session";
import { getWritingPromptBySlug } from "@/lib/writing-prompts";
import { getWritingSubmissionUsage } from "@/lib/writing-submissions";

export const metadata: Metadata = {
  title: "Làm đề Writing",
  description: "Viết bài theo đề đã chọn, sau đó nhận nhận xét theo tiêu chí chuyên Anh.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const rubricItems = [
  { label: "Nội dung", maxScore: 9, description: "Bám sát đề, trả lời đủ các vế, ý rõ và có dẫn chứng." },
  { label: "Bố cục", maxScore: 9, description: "Mở – thân – kết rõ ràng, thesis rõ, liên kết tự nhiên." },
  { label: "Ngôn ngữ", maxScore: 9, description: "Từ vựng chính xác, ngữ pháp đúng, câu đa dạng, văn phong trang trọng." },
  { label: "Chính tả & trình bày", maxScore: 3, description: "Chính tả, dấu câu, viết hoa và kỷ luật số từ." },
];

export default async function WritingGraderPage({ searchParams }: PageProps) {
  const [user, enabled] = [await getCurrentUser(), isWritingGraderEnabled()];
  const params = await searchParams;
  const promptSlug = typeof params.prompt === "string" ? params.prompt : "";

  // Look up prompt from static bank
  const promptData = promptSlug ? getWritingPromptBySlug(promptSlug) : null;

  // Get daily usage
  const usage = user ? await getWritingSubmissionUsage(user.id) : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Link
        href="/gym/writing"
        className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-semibold text-ink-soft transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại Gym Writing
      </Link>

      <section className="surface-mint rounded-[2rem] p-6 sm:p-10">
        <p className="text-sm font-semibold text-accent">Gym / Writing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Làm đề Writing</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft text-pretty">
          Viết bài theo đề đã chọn, sau đó nhận nhận xét theo tiêu chí chuyên Anh: nội dung, bố cục, ngôn ngữ và lỗi diễn đạt.
        </p>
      </section>

      {!promptData ? (
        <section className="surface rounded-3xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Không tìm thấy đề bài</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Vui lòng chọn một đề viết từ <Link href="/gym/writing" className="text-accent-strong hover:underline">Gym Writing</Link>.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {user && usage && (
            <section className="surface rounded-2xl p-4">
              <p className="text-sm font-medium">
                Còn <span className="tabular-nums font-semibold text-accent-strong">{usage.remaining}</span>/{usage.limit} lượt nộp hôm nay
              </p>
            </section>
          )}

          <section className="surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Thang điểm 30 theo tiêu chí chuyên Anh</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rubricItems.map((item) => (
                <div key={item.label} className="rounded-2xl bg-panel-muted p-4">
                  <p className="text-sm font-semibold">
                    {item.label} <span className="tabular-nums font-medium text-ink-soft">/{item.maxScore}</span>
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-ink-soft">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <WritingGraderForm
            enabled={enabled}
            isAuthenticated={Boolean(user)}
            prompt={promptData}
          />
        </>
      )}
    </div>
  );
}
