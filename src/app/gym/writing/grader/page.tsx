import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles } from "lucide-react";
import { WritingGraderForm } from "@/components/writing/WritingGraderForm";
import { isWritingGraderEnabled } from "@/lib/ai/writing-grader";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Chấm bài Writing bằng AI",
  description: "Nhận feedback Writing theo tiêu chí chuyên Anh: nội dung, bố cục, ngôn ngữ và lỗi diễn đạt.",
};

const rubricItems = [
  { label: "Nội dung", maxScore: 9, description: "Bám sát đề, trả lời đủ các vế, ý rõ và có dẫn chứng." },
  { label: "Bố cục", maxScore: 9, description: "Mở – thân – kết rõ ràng, thesis rõ, liên kết tự nhiên." },
  { label: "Ngôn ngữ", maxScore: 9, description: "Từ vựng chính xác, ngữ pháp đúng, câu đa dạng, văn phong trang trọng." },
  { label: "Chính tả & trình bày", maxScore: 3, description: "Chính tả, dấu câu, viết hoa và kỷ luật số từ." },
];

export default async function WritingGraderPage() {
  const [user, enabled] = [await getCurrentUser(), isWritingGraderEnabled()];

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
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          <Sparkles className="size-4" aria-hidden="true" />
          Gym / Writing · Beta
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Chấm bài Writing bằng AI</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft text-pretty">
          Nhận nhận xét theo tiêu chí chuyên Anh: nội dung, bố cục, ngôn ngữ và lỗi diễn đạt.
        </p>
      </section>

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

      <WritingGraderForm enabled={enabled} isAuthenticated={Boolean(user)} />
    </div>
  );
}
