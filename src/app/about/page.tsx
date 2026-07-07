import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Dumbbell, Mail, Medal, ShieldCheck, Sparkles, User } from "lucide-react";

export const metadata: Metadata = {
  title: "Về Englishphile",
  description: "Englishphile là nơi luyện tiếng Anh nâng cao cho học sinh chuyên Anh, với diagnostic, Gym, Contests và Wiki.",
};

export default function AboutPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="grid gap-6">
      {/* Hero — Về Englishphile */}
      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-sm font-semibold text-accent">Về Englishphile</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Nơi học sinh luyện tiếng Anh nâng cao một cách đều đặn
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft text-pretty">
          Englishphile được làm để học sinh có chỗ luyện tiếng Anh nâng cao mà không cần tìm đề rời rạc trên internet. Mình muốn biến việc luyện đề, sửa lỗi và đọc chiến thuật thành một thói quen rõ ràng hơn — phù hợp với lịch bận và mục tiêu của từng người.
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

      {/* Về mình */}
      <section className="surface rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2">
          <User className="size-5 text-accent" aria-hidden="true" />
          <p className="text-sm font-semibold text-accent">Về mình</p>
        </div>
        <div className="mt-4 grid gap-4 max-w-3xl text-sm leading-7 text-ink-soft text-pretty">
          <p>
            Mình là người viết và vận hành Englishphile. Trước đây mình cũng là học sinh chuẩn bị thi chuyên Anh, và mình biết cảm giác khi kho tài liệu luyện thi trên mạng thì nhiều nhưng không biết bắt đầu từ đâu.
          </p>
          <p>
            Englishphile ra đời vì mình muốn có một nơi mà mình có thể quay lại thường xuyên — làm diagnostic, xem lỗi sai, đọc chiến thuật — mà không phải tự sắp xếp lại từ đầu mỗi lần.
          </p>
          <p>
            Nếu bạn thấy có gì chưa đúng — đề bài sai, gợi ý không hợp lý, hoặc giao diện gây nhầm lẫn — hãy báo lại. Mình sẽ sửa.
          </p>
        </div>
      </section>

      {/* How it works — kept from original, simplified */}
      <section className="surface rounded-2xl p-5" aria-labelledby="how-it-works">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-accent" aria-hidden="true" />
          <h2 id="how-it-works" className="text-lg font-semibold">Cách Englishphile hoạt động</h2>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl bg-panel-muted p-4">
            <h3 className="font-semibold">Diagnostic</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Làm bài kiểm tra ngắn để hệ thống ước lượng trình độ và xác định phần cần ưu tiên luyện trước.
            </p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <h3 className="font-semibold">Gym</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Luyện từng kỹ năng riêng với bài đã xuất bản. Hệ thống gợi ý bài phù hợp với trình độ và lỗi sai cá nhân.
            </p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <h3 className="font-semibold">Wiki</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Đọc chiến thuật làm dạng bài, cách tránh lỗi thường gặp và mẹo khi thi.
            </p>
          </div>
          <div className="rounded-xl bg-panel-muted p-4">
            <h3 className="font-semibold">Contests</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Thử làm đề cũ hoặc contest theo thời gian để kiểm tra sức bền trong điều kiện gần thi thật.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          Nội dung được kiểm tra chất lượng trước khi hiển thị. Bài nháp hoặc cần duyệt không xuất hiện trong luồng học viên.
        </p>
      </section>

      {/* Contact */}
      <section className="surface rounded-2xl p-5" aria-labelledby="about-contact">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-accent" aria-hidden="true" />
          <h2 id="about-contact" className="text-lg font-semibold">Liên hệ</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft text-pretty">
          Nếu bạn gặp lỗi, cần hỗ trợ tài khoản, hoặc muốn báo nội dung chưa chính xác, hãy liên hệ qua email dưới đây.
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

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Gym", Dumbbell, "/gym"],
          ["Contests", Medal, "/contests"],
          ["Wiki", BookOpenText, "/wiki"],
          ["Nội dung", ShieldCheck, "/admin/content-qa"],
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
