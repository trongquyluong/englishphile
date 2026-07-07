import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách riêng tư",
  description: "Cách Englishphile xử lý dữ liệu tài khoản, diagnostic và luyện tập trong giai đoạn beta.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Privacy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Chính sách riêng tư</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Englishphile đang trong giai đoạn beta. Chính sách này tóm tắt dữ liệu được lưu và cách dữ liệu được dùng để cá nhân hóa luyện tập.
        </p>
      </header>

      <section className="surface rounded-2xl p-5 text-sm leading-7 text-ink-soft">
        <h2 className="text-lg font-semibold text-foreground">Dữ liệu được lưu</h2>
        <p className="mt-2">Englishphile có thể lưu email, tên người dùng, họ tên, trường, tỉnh/thành phố, mục tiêu thi, bài làm, diagnostic, câu sai và tiến độ luyện tập.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Mục đích sử dụng</h2>
        <p className="mt-2">Dữ liệu được dùng để đăng nhập, lưu tiến độ, ước lượng trình độ, phát hiện điểm yếu và gợi ý bài luyện phù hợp.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Cam kết beta</h2>
        <p className="mt-2">Englishphile không bán dữ liệu người dùng. Nội dung và tính năng có thể thay đổi khi sản phẩm được cải thiện.</p>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Xóa dữ liệu</h2>
        <p className="mt-2">Nếu muốn chỉnh sửa hoặc xóa dữ liệu tài khoản, hãy liên hệ quản trị viên qua trang Contact.</p>
      </section>
    </article>
  );
}
