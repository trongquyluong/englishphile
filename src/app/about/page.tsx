import type { Metadata } from "next";
import { GraduationCap, PenLine, Users, Mail, ExternalLink } from "lucide-react";
import { FounderPortrait } from "@/components/about/FounderPortrait";
import { EnglishphileLogo } from "@/components/about/EnglishphileLogo";

export const metadata: Metadata = {
  title: "Về Englishphile",
  description:
    "Câu chuyện Englishphile: bắt đầu từ một blog ôn chuyên Anh năm 2022, nay mở rộng thành website ôn thi chuyên Anh với bài luyện và cách chữa lỗi có hệ thống.",
};

const CONTACT_EMAIL = "trongquy.forwork@gmail.com";
const FACEBOOK_URL = "https://www.facebook.com/makoto.is.me";
const INSTAGRAM_URL = "https://www.instagram.com/h.makoto_/";
const LINKEDIN_URL = "https://www.linkedin.com/in/quy-luong-trong/";

const milestones = [
  {
    period: "2022",
    detail: "Englishphile bắt đầu như một blog chia sẻ kiến thức chuyên Anh.",
  },
  {
    period: "2023–2025",
    detail:
      "Cộng đồng lớn dần quanh các bài viết, ba mùa thi thử và hai sự kiện ôn thi vào trường chuyên.",
  },
  {
    period: "2026",
    detail:
      "Englishphile chuyển lên website để các bạn có thể làm bài, xem lỗi và tìm phần cần luyện tiếp rõ ràng hơn.",
  },
];

const blogStats = [
  { value: "8.000+", label: "người theo dõi" },
  { value: "100+", label: "bài viết" },
  { value: "3", label: "mùa thi thử" },
  { value: "2", label: "sự kiện ôn thi vào chuyên" },
];

const founderProfile = {
  name: "Lương Trọng Quý",
  tagline: "Founder của Englishphile · ASEAN Scholar tại National Junior College · cựu học sinh chuyên Anh Quốc Học Huế",
};

const founderIntro =
  "Tớ bắt đầu Englishphile từ thời còn học chuyên Anh, khi nhận ra nhiều bạn ôn thi cần tài liệu rõ ràng hơn, bài luyện đủ khó hơn và một cách chữa lỗi có hệ thống hơn.";

const founderHighlights = [
  {
    icon: GraduationCap,
    title: "Chuyên Anh & học thuật",
    items: [
      "ASEAN Scholar tại National Junior College (Singapore)",
      "Á khoa chuyên Anh Quốc Học Huế 2023",
      "Giải nhất HSG cấp Tỉnh lớp 9 môn tiếng Anh",
      "Giải Khuyến khích HSGQG môn tiếng Anh 2023",
    ],
  },
  {
    icon: PenLine,
    title: "Englishphile & mentoring",
    items: [
      "Viết hơn 100 bài về phương pháp và các dạng bài chuyên Anh",
      "Soạn đề thi thử, ghi chú ôn tập và bài luyện bám theo điểm yếu",
      "Mentor các bạn cấp hai ôn vào lớp chuyên Anh",
    ],
  },
  {
    icon: Users,
    title: "Leadership & sự kiện",
    items: [
      "Secretary-General và Board Advisor tại ACHMUN",
      "Tổ chức hội nghị MUN với hơn 200 đại biểu",
      "Workshop Junior High Compass với hơn 70 người tham dự",
    ],
  },
];

const awardsTimeline = [
  { year: "2024", detail: "Học bổng toàn phần ASEAN Scholar" },
  { year: "2023", detail: "Á khoa chuyên Anh Quốc Học Huế" },
  { year: "2023–2024", detail: "Giải nhì HSG cấp tỉnh THPT môn tiếng Anh" },
  { year: "Lớp 9", detail: "Giải nhất HSG cấp Tỉnh lớp 9 môn tiếng Anh" },
  { year: "Lớp 8", detail: "Giải nhì HSG cấp Tỉnh lớp 9 môn tiếng Anh" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      {/* Hero */}
      <section className="surface-mint rounded-[2rem] p-6 sm:p-10" aria-labelledby="about-title">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-accent">Về Englishphile</p>
            <h1 id="about-title" className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Từ một blog ôn chuyên Anh đến website ôn thi chuyên Anh
            </h1>
            <p className="mt-4 text-base leading-8 text-ink-soft text-pretty">
              Englishphile bắt đầu vào năm 2022 như một blog chia sẻ kiến thức chuyên Anh. Sau gần bốn năm, tớ đang mở
              rộng dự án thành website — để các bạn có thể vừa đọc, vừa luyện, vừa xem lại lỗi của mình rõ ràng hơn.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-xs lg:justify-self-end">
            <EnglishphileLogo />
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="story-heading">
        <h2 id="story-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Englishphile là gì?
        </h2>
        <div className="mt-4 grid max-w-3xl gap-4 text-[15px] leading-7 text-ink-soft text-pretty">
          <p>
            Năm 2022, tớ mở một blog để chia sẻ những gì tớ học được khi ôn chuyên Anh. Lý do rất đơn giản: nhiều bạn
            quanh tớ không có đủ tài liệu rõ ràng — kinh nghiệm làm bài, cách học từng dạng, đề luyện chất lượng đều nằm
            rải rác ở nhiều nơi.
          </p>
          <p>
            Gần bốn năm sau, blog đã đi xa hơn dự tính ban đầu. Cùng các cộng sự, tớ duy trì bài viết đều đặn, đồng tổ
            chức ba mùa thi thử và hai sự kiện ôn thi vào trường chuyên.
          </p>
          <p>
            Năm 2026, tớ bắt đầu chuyển Englishphile lên website để việc ôn thi không chỉ dừng lại ở việc đọc bài viết. Các
            bạn có thể làm bài, xem lại lỗi và tìm phần cần luyện tiếp rõ ràng hơn.
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
          Mục tiêu vẫn như những ngày đầu, chỉ rộng hơn: đến được với nhiều bạn muốn vào lớp chuyên Anh ở các trường
          chuyên trên cả nước — và lần này, không chỉ dừng ở việc đọc.
        </p>
      </section>

      {/* Founder */}
      <section className="surface rounded-3xl p-6 md:p-8" aria-labelledby="founder-heading">
        <h2 id="founder-heading" className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
          Và về tớ, founder của Englishphile
        </h2>

        <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
          {/* Founder photo */}
          <div className="mx-auto w-full max-w-[14rem] sm:max-w-[16rem]">
            <FounderPortrait />
          </div>

          {/* Founder intro */}
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{founderProfile.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{founderProfile.tagline}</p>
            </div>

            <p className="text-[15px] leading-7 text-ink-soft text-pretty">{founderIntro}</p>

            {/* Awards timeline */}
            <div className="mt-4 rounded-2xl bg-panel-muted p-4">
              <p className="mb-3 text-sm font-semibold">Thành tích nổi bật</p>
              <ol className="space-y-2">
                {awardsTimeline.map((award) => (
                  <li key={award.year + award.detail} className="flex gap-3 text-sm">
                    <span className="w-16 flex-shrink-0 font-medium text-accent-strong">{award.year}</span>
                    <span className="text-ink-soft">{award.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Highlights */}
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
          {/* Primary: Email */}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="btn btn-primary"
            aria-label="Gửi email cho Englishphile"
          >
            <Mail className="size-4" aria-hidden="true" />
            Gửi email
          </a>
        </div>

        {/* Social links - smaller, secondary */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-ghost text-ink-soft"
            aria-label="Facebook của tớ"
          >
            Facebook
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-ghost text-ink-soft"
            aria-label="Instagram của tớ"
          >
            Instagram
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-ghost text-ink-soft"
            aria-label="LinkedIn của tớ"
          >
            LinkedIn
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>

        <p className="mt-4 text-sm leading-6 text-ink-soft">
          Khi báo lỗi, bạn có thể xem thêm{" "}
          <a href="/contact" className="font-semibold text-accent-strong hover:underline">
            hướng dẫn liên hệ
          </a>{" "}
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
