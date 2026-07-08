import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách riêng tư",
  description: "Cách Englishphile lưu và sử dụng dữ liệu tài khoản, diagnostic và luyện tập trong giai đoạn beta.",
};

const lastUpdated = "09/07/2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <header className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Privacy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Chính sách riêng tư</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Englishphile là sản phẩm luyện tập tiếng Anh đang trong giai đoạn beta. Trang này giải thích Englishphile lưu những dữ liệu gì
          và dùng chúng vào việc gì, bằng ngôn ngữ dễ đọc thay vì văn bản pháp lý. Trang này không phải là tư vấn pháp lý.
        </p>
        <p className="mt-3 text-xs font-medium text-ink-soft">Cập nhật lần cuối: {lastUpdated}</p>
      </header>

      <section className="surface rounded-2xl p-6 text-sm leading-7 text-ink-soft">
        <h2 className="text-lg font-semibold text-foreground">Dữ liệu Englishphile có thể lưu</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>Thông tin tài khoản: email, tên đăng nhập, tên hiển thị, họ tên; trường và tỉnh/thành phố nếu bạn điền.</li>
          <li>Dữ liệu đăng nhập và phiên làm việc để giữ bạn đăng nhập an toàn.</li>
          <li>Bài làm diagnostic và mức trình độ ước lượng từ bài làm đó.</li>
          <li>Bài luyện tập, tiến độ, lịch sử nộp bài và danh sách câu sai để xem lại.</li>
          <li>Log kỹ thuật cơ bản cần cho việc vận hành và xử lý lỗi của dịch vụ.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Dữ liệu được dùng vào việc gì</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>Đăng nhập và quản lý tài khoản của bạn.</li>
          <li>Lưu tiến độ để bạn tiếp tục luyện tập giữa các lần đăng nhập.</li>
          <li>Ước lượng trình độ và gợi ý bài luyện phù hợp với điểm yếu của bạn.</li>
          <li>Giữ dịch vụ ổn định, an toàn và phát hiện lạm dụng.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Những điều Englishphile không làm</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
          <li>Không bán dữ liệu cá nhân của người dùng.</li>
          <li>
            Không công khai kết quả học tập của từng cá nhân theo mặc định. Nếu bạn tham gia contest có bảng xếp hạng, chỉ tên hiển thị
            xuất hiện, không bao giờ là email.
          </li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Hạ tầng bên thứ ba</h2>
        <p className="mt-2">
          Englishphile chạy trên hạ tầng của các nhà cung cấp bên thứ ba: ứng dụng được host trên Vercel và dữ liệu được lưu trong cơ sở
          dữ liệu PostgreSQL trên Neon. Dữ liệu của bạn nằm trên các hệ thống này để dịch vụ hoạt động; các nhà cung cấp có chính sách
          bảo mật riêng của họ.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Nhận xét Writing bằng AI</h2>
        <p className="mt-2">
          Khi bạn gửi bài viết để nhận nhận xét Writing, đề bài và bài viết sẽ được chuyển tới nhà cung cấp AI bên thứ ba để tạo nhận xét,
          theo chính sách dữ liệu riêng của nhà cung cấp đó. Việc gửi bài được coi là đồng ý sử dụng dữ liệu cho mục đích này.
          Vì vậy, đừng đưa thông tin cá nhân hoặc nội dung nhạy cảm vào bài viết.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Cookie và phiên đăng nhập</h2>
        <p className="mt-2">
          Englishphile dùng cookie để duy trì phiên đăng nhập và các chức năng cơ bản của ứng dụng. Không có cookie quảng cáo hay theo
          dõi chéo trang.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Thời gian lưu trữ</h2>
        <p className="mt-2">
          Dữ liệu được giữ trong thời gian tài khoản của bạn còn hoạt động, hoặc trong mức cần thiết để vận hành dịch vụ.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-foreground">Lựa chọn của bạn</h2>
        <p className="mt-2">
          Bạn có thể yêu cầu chỉnh sửa hoặc xóa dữ liệu tài khoản qua thông tin liên hệ trong trang{" "}
          <Link href="/about" className="font-semibold text-accent-strong hover:underline">
            Về Englishphile
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
