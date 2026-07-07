import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Dumbbell, Medal, ShieldCheck, Sparkles, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Trang chủ",
  description: "Englishphile giúp học sinh luyện chuyên Anh theo trình độ, bắt đầu bằng diagnostic và Gym cá nhân hóa.",
};

const features = [
  { title: "Diagnostic đầu vào", description: "Ước lượng level và điểm yếu trước khi luyện.", icon: Target },
  { title: "Gym luyện kỹ năng", description: "Reading, Writing, Listening và Use of English trong một hub.", icon: Dumbbell },
  { title: "Gợi ý cá nhân", description: "Bài luyện được chọn theo dữ liệu làm bài và lỗi sai.", icon: Sparkles },
  { title: "Contests và đề cũ", description: "Làm đề theo thời gian, xem điểm và kết quả sau khi nộp.", icon: Medal },
  { title: "Wiki kiến thức", description: "Ghi chú chiến thuật và nền tảng sẽ được mở rộng dần.", icon: BookOpenText },
  { title: "Nội dung đã review", description: "Import, QA và publish do quản trị viên kiểm soát.", icon: ShieldCheck },
];

export default function Home() {
  return (
    <div className="grid gap-10 pb-10">
      <section className="grid min-h-[calc(100vh-9rem)] items-center gap-8 lg:grid-cols-[1fr_0.82fr]">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Personalized English practice</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">Englishphile</h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-ink-soft text-pretty">
            Luyện chuyên Anh theo trình độ, phát hiện điểm yếu và gợi ý bài luyện phù hợp.
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-soft text-pretty">
            Bắt đầu bằng diagnostic, vào Gym để luyện kỹ năng, tham gia Contests khi muốn thử sức với đề theo thời gian, và dùng Wiki để củng cố chiến thuật.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/diagnostic" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
              Kiểm tra trình độ
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/gym" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-panel px-4 text-sm font-semibold text-foreground shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 hover:bg-panel-muted">
              Vào Gym
            </Link>
            <Link href="/contests" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground">
              Xem Contests
            </Link>
          </div>
        </div>

        <div className="surface rounded-2xl p-3">
          <div className="rounded-xl bg-foreground p-4 text-background">
            <div className="border-b border-white/10 pb-4">
              <p className="text-xs uppercase tracking-[0.12em] text-white/55">Practice flow</p>
              <p className="mt-1 text-lg font-semibold">Hôm nay nên làm gì?</p>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                ["Diagnostic", "Ước lượng level"],
                ["Gym", "Luyện bài phù hợp"],
                ["Wrong questions", "Ôn câu từng sai"],
                ["Contest", "Thử đề theo thời gian"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-xl bg-white/8 px-3 py-3">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-white/55">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="surface rounded-2xl p-5">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{feature.description}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
