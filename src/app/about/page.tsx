import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Dumbbell, Mail, Medal, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Về Englishphile",
  description: "Englishphile là nền tảng luyện chuyên Anh cá nhân hóa theo diagnostic, Gym, Contests và Wiki.",
};

const steps = [
  ["Diagnostic", "Làm bài kiểm tra ngắn để ước lượng trình độ và điểm yếu ban đầu."],
  ["Gym", "Luyện Reading, Writing, Listening và Use of English bằng bài đã xuất bản."],
  ["Contests", "Thử đề cũ hoặc contest theo thời gian khi muốn kiểm tra sức bền."],
  ["Wiki", "Ôn chiến thuật và ghi chú nền tảng khi cần củng cố lý thuyết."],
];

export default function AboutPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-sm font-semibold text-accent">Về Englishphile</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Nền tảng luyện tiếng Anh cá nhân hóa cho học sinh chuẩn bị kỳ thi chuyên sâu
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft text-pretty">
          Englishphile giúp học viên kiểm tra trình độ, luyện tập trong Gym, thử sức với Contests và dùng Wiki để củng cố kiến thức. Nội dung được quản trị viên import, kiểm tra chất lượng và publish trước khi hiển thị cho học viên.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/diagnostic" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
            Kiểm tra trình độ
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/gym" className="inline-flex min-h-11 items-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
            Vào Gym
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {steps.map(([title, description]) => (
          <article key={title} className="surface rounded-2xl p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Gợi ý hoạt động như thế nào?</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-ink-soft text-pretty">
            Hệ thống dùng kết quả diagnostic, lịch sử làm bài, lỗi sai và kỹ năng yếu để đề xuất bài luyện. Gợi ý luôn ưu tiên nội dung đã xuất bản.
          </p>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Nội dung được kiểm soát ra sao?</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-ink-soft text-pretty">
            Quản trị viên đưa dữ liệu vào bằng file JSON/CSV, chạy duplicate check, QA và review trước khi publish. Bài nháp hoặc cần duyệt không xuất hiện trong luồng học viên.
          </p>
        </div>
      </section>

      <section className="surface rounded-2xl p-5" aria-labelledby="about-contact">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-accent" aria-hidden="true" />
          <h2 id="about-contact" className="text-lg font-semibold">Liên hệ</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft text-pretty">
          Nếu bạn gặp lỗi, cần hỗ trợ tài khoản, muốn báo nội dung chưa chính xác hoặc yêu cầu chỉnh sửa/xóa dữ liệu, hãy liên hệ qua
          email dưới đây.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
            >
              <Mail className="size-4" aria-hidden="true" />
              {contactEmail}
            </a>
          ) : null}
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
            Xem hướng dẫn liên hệ
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Gym", Dumbbell, "/gym"],
          ["Contests", Medal, "/contests"],
          ["Wiki", BookOpenText, "/wiki"],
          ["Content QA", ShieldCheck, "/admin/content-qa"],
        ].map(([title, Icon, href]) => (
          <Link key={String(title)} href={String(href)} className="surface surface-hover rounded-2xl p-5">
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">{String(title)}</h2>
          </Link>
        ))}
      </section>
    </div>
  );
}
