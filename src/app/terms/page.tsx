import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản beta cho người học sử dụng Englishphile.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Terms</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Điều khoản sử dụng</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Khi sử dụng Englishphile trong giai đoạn beta, bạn đồng ý với các điều khoản cơ bản dưới đây.
        </p>
      </header>

      <section className="surface rounded-2xl p-5 text-sm leading-7 text-ink-soft">
        <h2 className="text-lg font-semibold text-foreground">Sản phẩm giáo dục beta</h2>
        <p className="mt-2">Englishphile hỗ trợ luyện tập tiếng Anh theo trình độ. Hệ thống không cam kết kết quả thi cụ thể.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Tài khoản</h2>
        <p className="mt-2">Bạn chịu trách nhiệm bảo mật email và mật khẩu. Không chia sẻ tài khoản nếu điều đó làm sai lệch tiến độ cá nhân.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Nội dung</h2>
        <p className="mt-2">Nội dung có thể được cập nhật, chỉnh sửa, lưu trữ hoặc gỡ khỏi luồng học viên khi quản trị viên phát hiện lỗi.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Sử dụng hợp lý</h2>
        <p className="mt-2">Không cố tình spam form, phá hệ thống, tải nội dung trái phép hoặc sử dụng dữ liệu của người khác.</p>
      </section>
    </article>
  );
}
