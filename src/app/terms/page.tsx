import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản sử dụng Englishphile trong giai đoạn beta: tài khoản, nội dung, điểm số và giới hạn trách nhiệm.",
};

const lastUpdated = "07/07/2026";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <header className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Terms</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Điều khoản sử dụng</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Englishphile là sản phẩm luyện tập tiếng Anh đang trong giai đoạn beta. Khi tạo tài khoản và sử dụng dịch vụ, bạn đồng ý với
          các điều khoản dưới đây.
        </p>
        <p className="mt-3 text-xs font-medium text-ink-soft">Cập nhật lần cuối: {lastUpdated}</p>
      </header>

      <section className="surface rounded-2xl p-6 text-sm leading-7 text-ink-soft">
        <h2 className="text-lg font-semibold text-foreground">Sản phẩm beta</h2>
        <p className="mt-2">
          Englishphile đang được hoàn thiện. Tính năng, nội dung và giao diện có thể thay đổi, tạm ngưng hoặc gỡ bỏ trong giai đoạn beta.
          Chúng tôi cố gắng báo trước những thay đổi lớn, nhưng không cam kết dịch vụ hoạt động liên tục không gián đoạn.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Tài khoản và sử dụng hợp lệ</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>Dùng dịch vụ cho mục đích học tập hợp pháp.</li>
          <li>Giữ mật khẩu cho riêng mình; không chia sẻ tài khoản hoặc dùng tài khoản của người khác.</li>
          <li>Không lạm dụng hệ thống: spam form, tạo tài khoản hàng loạt hoặc gian lận điểm số.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Nội dung và điểm số</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>
            Nội dung trên Englishphile phục vụ việc học và luyện thi. Englishphile không phải là sản phẩm của bất kỳ hội đồng thi hay
            đơn vị tổ chức thi chính thức nào.
          </li>
          <li>Điểm số và mức trình độ là ước lượng để định hướng luyện tập, không phải chứng chỉ hay kết quả thi chính thức.</li>
          <li>
            Trong giai đoạn beta, đề luyện và contest có thể còn sai sót. Nếu bạn phát hiện lỗi, hãy báo qua thông tin liên hệ trong
            trang{" "}
            <Link href="/about" className="font-semibold text-accent-strong hover:underline">
              Về Englishphile
            </Link>{" "}
            để nội dung được sửa sớm.
          </li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Những việc không được làm</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>Thu thập dữ liệu tự động (scrape) hoặc tải nội dung hàng loạt ra ngoài hệ thống.</li>
          <li>Tấn công, dò quét lỗ hổng, can thiệp hoặc làm gián đoạn dịch vụ.</li>
          <li>Dịch ngược mã nguồn hoặc sao chép hệ thống để xây sản phẩm nhái.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Giới hạn trách nhiệm</h2>
        <p className="mt-2">
          Englishphile được cung cấp nguyên trạng trong giai đoạn beta. Trong phạm vi pháp luật cho phép, Englishphile không chịu trách
          nhiệm cho các thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ, ví dụ gián đoạn truy cập hoặc mất dữ liệu luyện tập.
          Kết quả trên Englishphile chỉ nên dùng để định hướng ôn tập.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Thay đổi điều khoản</h2>
        <p className="mt-2">
          Điều khoản có thể được cập nhật khi sản phẩm thay đổi. Ngày cập nhật mới nhất luôn hiển thị ở đầu trang này; bản đang hiển thị
          là bản có hiệu lực.
        </p>
      </section>
    </article>
  );
}
