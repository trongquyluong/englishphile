import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Thông tin liên hệ và hỗ trợ cho Englishphile.",
};

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <header className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Contact</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Liên hệ Englishphile</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Nếu bạn gặp lỗi, cần hỗ trợ tài khoản, hoặc muốn báo nội dung chưa chính xác, hãy liên hệ người điều hành.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl p-5">
          <Mail className="size-5 text-accent" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">Email hỗ trợ</h2>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="mt-2 block text-sm font-semibold text-accent-strong">
              {contactEmail}
            </a>
          ) : (
            <p className="mt-2 text-sm leading-6 text-ink-soft">Thông tin liên hệ sẽ được cập nhật.</p>
          )}
        </div>
        <div className="surface rounded-2xl p-5">
          <MessageCircle className="size-5 text-accent" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">Báo lỗi</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Mô tả lỗi, trang bạn đang dùng, và thao tác trước khi lỗi xảy ra để admin kiểm tra nhanh hơn.</p>
        </div>
        <div className="surface rounded-2xl p-5">
          <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">Dữ liệu cá nhân</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Bạn có thể yêu cầu chỉnh sửa hoặc xóa dữ liệu tài khoản.</p>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Trước khi gửi yêu cầu</h2>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-soft">
          <li>Kiểm tra trang <Link href="/status" className="font-semibold text-accent-strong">Status</Link> nếu app không phản hồi.</li>
          <li>Không gửi mật khẩu hoặc dữ liệu nhạy cảm trong nội dung hỗ trợ.</li>
          <li>Nếu báo lỗi câu hỏi, hãy gửi tên bài, câu hỏi và lý do bạn nghĩ nội dung cần được xem lại.</li>
        </ul>
      </section>
    </article>
  );
}
