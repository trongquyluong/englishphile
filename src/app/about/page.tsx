import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, GraduationCap, Mail, PenLine, Users } from "lucide-react";
import { FounderPortrait } from "@/components/about/FounderPortrait";

export const metadata: Metadata = {
  title: "Về Englishphile",
  description:
    "Câu chuyện Englishphile: bắt đầu từ một blog ôn chuyên Anh năm 2022, nay mở rộng thành website luyện tập cho học sinh muốn vào lớp chuyên Anh.",
};

const CONTACT_EMAIL = "trongquy.forwork@gmail.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/quy-luong-trong/";

const milestones = [
  {
    period: "2022",
    detail: "Englishphile bắt đầu như một blog chia sẻ kiến thức chuyên Anh.",
  },
  {
    period: "2023–2025",
    detail:
      "Cộng đồng lớn dần quanh các bài viết, hai mùa thi thử và một sự kiện chia sẻ kinh nghiệm ôn thi vào trường chuyên.",
  },
  {
    period: "2026",
    detail: "Englishphile mở rộng thành website luyện tập: đọc, làm bài và xem lại lỗi ở cùng một chỗ.",
  },
];

const blogStats = [
  { value: "8.000+", label: "người theo dõi" },
  { value: "100+", label: "bài viết" },
  { value: "2", label: "mùa thi thử" },
  { value: "1", label: "sự kiện ôn thi vào chuyên" },
];

const founderHighlights = [
  {
    icon: GraduationCap,
    title: "Chuyên Anh & học thuật",
    items: [
      "Cựu học sinh chuyên Anh, THPT chuyên Quốc Học Huế",
      "Giải học sinh giỏi tiếng Anh",
      "ASEAN Scholar tại National Junior College (Singapore)",
    ],
  },
  {
    icon: PenLine,
    title: "Nội dung & mentoring",
    items: [
      "Viết hơn 100 bài về phương pháp và các dạng bài chuyên Anh",
      "Soạn đề thi thử, ghi chú ôn tập và bài luyện bám theo điểm yếu",
      "Mentor học sinh THCS ôn vào lớp chuyên Anh",
    ],
  },
  {
    icon: Users,
    title: "Leadership & sự kiện",
    items: [
      "Secretary-General và Board Advisor tại ACHMUN",
      "Tổ chức hội nghị MUN với hơn 200 đại biểu",
      "Workshop Junior High Compass với hơn 70 người tham dự và gần 10 diễn giả",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      {/* Hero — personal intro */}
      <section className="surface-mint rounded-[2rem] p-6 sm:p-10" aria-labelledby="about-title">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-accent">Về Englishphile</p>
            <h1 id="about-title" className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Từ một blog ôn chuyên Anh đến một website luyện tập cá nhân
            </h1>
            <p className="mt-4 text-base leading-8 text-ink-soft text-pretty">
              Englishphile bắt đầu vào năm 2022 như một blog chia sẻ kiến thức chuyên Anh. Sau gần bốn năm, mình đang mở
              rộng dự án thành một website — để học sinh có thể vừa đọc, vừa luyện, vừa xem lại lỗi của mình rõ ràng
              hơn.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-xs lg:justify-self-end">
            <FounderPortrait />
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="story-heading">
        <h2 id="story-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Englishphile bắt đầu từ một blog nhỏ
        </h2>
        <div className="mt-4 grid max-w-3xl gap-4 text-[15px] leading-7 text-ink-soft text-pretty">
          <p>
            Năm 2022, mình mở một blog để chia sẻ những gì mình học được khi ôn chuyên Anh. Lý do rất đơn giản: nhiều
            bạn quanh mình không có đủ tài liệu rõ ràng — kinh nghiệm làm bài, cách học từng dạng, đề luyện chất lượng
            đều nằm rải rác ở nhiều nơi.
          </p>
          <p>
            Gần bốn năm sau, blog đã đi xa hơn dự tính ban đầu. Cùng các cộng sự, mình duy trì bài viết đều đặn, đồng tổ
            chức hai mùa thi thử và một sự kiện chia sẻ kinh nghiệm ôn thi vào trường chuyên.
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {blogStats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse gap-1 rounded-2xl bg-panel-muted p-4">
              <dt className="text-xs font-medium leading-5 text-ink-soft">{stat.label}</dt>
              <dd className="text-xl font-semibold tabular">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <ol className="mt-7 grid gap-6 border-l border-line-strong pl-6">
          {milestones.map((milestone) => (
            <li key={milestone.period} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[calc(1.5rem+4.5px)] top-1.5 size-2 rounded-full bg-accent ring-4 ring-accent-soft"
              />
              <p className="text-sm font-semibold text-accent-strong">{milestone.period}</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft text-pretty">{milestone.detail}</p>
            </li>
          ))}
        </ol>

        <p className="mt-7 max-w-3xl text-[15px] leading-7 text-ink-soft text-pretty">
          Mục tiêu của giai đoạn mới vẫn như những ngày đầu, chỉ rộng hơn: đến được với nhiều học sinh muốn vào lớp
          chuyên Anh ở các trường chuyên trên cả nước — và lần này, không chỉ dừng ở việc đọc.
        </p>
      </section>

      {/* Founder */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="founder-heading">
        <h2 id="founder-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Người làm Englishphile
        </h2>
        <div className="mt-4 grid max-w-3xl gap-4 text-[15px] leading-7 text-ink-soft text-pretty">
          <p>
            Mình là Lương Trọng Quý, người viết phần lớn nội dung trên Englishphile từ những ngày đầu. Mình từng học
            chuyên Anh ở THPT chuyên Quốc Học Huế và hiện là ASEAN Scholar tại National Junior College (Singapore).
          </p>
          <p>
            Englishphile được xây từ trải nghiệm rất thật: quá trình ôn chuyên Anh cần tài liệu rõ ràng, bài luyện đủ
            khó, và một cách nhìn lại lỗi sau mỗi lần làm bài. Hồi ôn thi, mình phải tự ghép ba thứ đó từ nhiều nguồn
            khác nhau — website này là cách mình gom chúng về một chỗ.
          </p>
          <p>
            Mấy năm qua, mình cũng mentor các bạn cấp hai ôn vào lớp chuyên Anh: tự soạn đề thi thử, ghi chú ôn tập và
            bài luyện bám theo điểm yếu của từng bạn. Nhiều thứ trên website này bắt đầu từ chính những buổi học đó.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {founderHighlights.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <div key={highlight.title} className="rounded-2xl bg-panel-muted p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-panel text-accent-strong">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold">{highlight.title}</h3>
                <ul className="mt-2 grid list-disc gap-1.5 pl-4 text-sm leading-6 text-ink-soft marker:text-accent">
                  {highlight.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why the website exists */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="why-heading">
        <h2 id="why-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Vì sao mình làm website này
        </h2>
        <div className="mt-4 grid max-w-3xl gap-4 text-[15px] leading-7 text-ink-soft text-pretty">
          <p>
            Blog giúp mình chia sẻ cách học. Nhưng đọc xong, phần khó nhất vẫn nằm ở phía bạn: tìm đề phù hợp, tự chấm,
            tự đoán xem mình yếu ở đâu. Website là bước tiếp theo để phần đó bớt mù mờ.
          </p>
          <p>
            Trên Englishphile, bạn bắt đầu bằng{" "}
            <Link href="/diagnostic" className="font-semibold text-accent-strong hover:underline">
              bài kiểm tra đầu vào
            </Link>{" "}
            để có ước lượng ban đầu về trình độ.{" "}
            <Link href="/gym" className="font-semibold text-accent-strong hover:underline">
              Gym
            </Link>{" "}
            là chỗ luyện từng kỹ năng, với gợi ý bám theo phần bạn còn yếu.{" "}
            <Link href="/wiki" className="font-semibold text-accent-strong hover:underline">
              Wiki
            </Link>{" "}
            tiếp tục vai trò của blog — nơi lưu chiến thuật và lý thuyết. Còn{" "}
            <Link href="/contests" className="font-semibold text-accent-strong hover:underline">
              Contests
            </Link>{" "}
            dành cho lúc bạn muốn thử sức với đề trong điều kiện tính giờ.
          </p>
          <p>
            Mục tiêu không phải là làm mọi thứ phức tạp hơn, mà là làm quá trình ôn thi rõ ràng hơn: làm bài, thấy phần
            yếu, luyện tiếp, rồi quay lại xem lỗi.
          </p>
        </div>
        <Link
          href="/diagnostic"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent transition-colors duration-150 hover:text-accent-strong"
        >
          Bắt đầu với bài kiểm tra đầu vào
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Contact */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Liên hệ & góp ý
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-ink-soft text-pretty">
          Nếu bạn gặp lỗi, muốn góp ý nội dung, hoặc cần hỏi về dữ liệu tài khoản, hãy liên hệ qua email dưới đây.
        </p>
        <p className="mt-4 text-sm font-semibold text-accent-strong">{CONTACT_EMAIL}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary">
            <Mail className="size-4" aria-hidden="true" />
            Gửi email
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Xem LinkedIn
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          Khi báo lỗi, bạn có thể xem thêm{" "}
          <Link href="/contact" className="font-semibold text-accent-strong hover:underline">
            hướng dẫn liên hệ
          </Link>{" "}
          để admin kiểm tra nhanh hơn.
        </p>
      </section>

      {/* Closing note */}
      <p className="rounded-3xl bg-panel-muted px-6 py-5 text-center text-sm leading-7 text-ink-soft text-pretty">
        Englishphile vẫn đang trong giai đoạn beta. Nếu bạn thấy một câu hỏi sai, một phần giải thích chưa rõ, hoặc một
        tính năng khó dùng, góp ý của bạn sẽ giúp website tốt hơn.
      </p>
    </div>
  );
}
