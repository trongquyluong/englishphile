import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Dumbbell,
  GraduationCap,
  Medal,
  RotateCcw,
  Target,
  Trophy,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Trang chủ",
  description:
    "Englishphile giúp học sinh chuyên Anh/HSG làm bài kiểm tra đầu vào, luyện đúng phần đang yếu trong Gym và ôn lại câu sai.",
};

const heroPreviewCards = [
  {
    title: "Diagnostic",
    description: "Biết phần nào cần luyện trước",
    icon: Target,
  },
  {
    title: "Gym",
    description: "Luyện Reading, Use of English, Word Formation…",
    icon: Dumbbell,
  },
  {
    title: "Wiki",
    description: "Đọc chiến thuật làm bài",
    icon: BookOpenText,
  },
];

const routeSteps = [
  {
    title: "Kiểm tra đầu vào",
    description: "Làm một bài ngắn để ước lượng trình độ và biết mình đang yếu phần nào.",
    icon: Target,
    href: "/diagnostic",
    linkLabel: "Làm bài kiểm tra đầu vào",
  },
  {
    title: "Luyện trong Gym",
    description: "Luyện từng dạng bài Reading, Use of English… theo đúng phần cần cải thiện.",
    icon: Dumbbell,
    href: "/gym",
    linkLabel: "Vào Gym",
  },
  {
    title: "Ôn lại câu sai",
    description: "Xem lại những câu từng làm sai và làm lại đến khi chắc.",
    icon: RotateCcw,
    href: "/wrong-questions",
    linkLabel: "Ôn lại câu sai",
  },
  {
    title: "Đọc chiến thuật trong Wiki",
    description: "Đọc cách làm từng dạng bài trước khi luyện để đỡ mất điểm oan.",
    icon: BookOpenText,
    href: "/wiki",
    linkLabel: "Đọc Wiki",
  },
];

const learningModes = [
  {
    title: "Gym",
    purpose: "Trung tâm luyện tập chính: chọn kỹ năng, làm bài theo dạng và độ khó.",
    suggestion: "Vào đều mỗi ngày, mỗi lần vài câu là đủ để tiến bộ.",
    icon: Dumbbell,
    href: "/gym",
    linkLabel: "Vào Gym luyện tập",
  },
  {
    title: "Contests",
    purpose: "Làm đề theo thời gian như thi thật, nộp xong xem điểm và câu sai.",
    suggestion: "Đề thi HSG/Chuyên sẽ được bổ sung sau.",
    icon: Medal,
    href: "/contests",
    linkLabel: "Xem Contests",
  },
  {
    title: "Wiki",
    purpose: "Chiến thuật làm bài và lỗi thường gặp theo từng dạng.",
    suggestion: "Nên đọc trước khi luyện một dạng bài mới.",
    icon: BookOpenText,
    href: "/wiki",
    linkLabel: "Đọc Wiki",
  },
  {
    title: "Kiểm tra đầu vào",
    purpose: "Bài kiểm tra ngắn để ước lượng trình độ và tìm điểm yếu.",
    suggestion: "Làm lại sau một thời gian luyện để xem mình tiến bộ ở đâu.",
    icon: Target,
    href: "/diagnostic",
    linkLabel: "Làm bài kiểm tra đầu vào",
  },
];

const audienceItems = [
  {
    title: "Ôn thi chuyên Anh vào 10",
    description: "Luyện các dạng bài quen thuộc trong đề chuyên: cloze, word formation, viết lại câu…",
    icon: GraduationCap,
  },
  {
    title: "Ôn thi HSG tiếng Anh",
    description: "Làm quen với câu hỏi khó hơn mặt bằng chung và học từ lỗi sai của chính mình.",
    icon: Trophy,
  },
  {
    title: "Muốn luyện đều hơn",
    description: "Mỗi ngày làm vài câu, biết mình đang yếu phần nào và cần luyện gì tiếp.",
    icon: CalendarDays,
  },
];

export default function Home() {
  return (
    <div className="grid gap-14 py-4 sm:gap-16 sm:py-6">
      {/* Hero */}
      <section className="surface-mint rounded-[2rem] p-6 sm:p-10 lg:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-panel px-3.5 py-1.5 text-sm font-semibold text-accent shadow-[inset_0_0_0_1px_var(--line)]">
              <span className="size-2 rounded-full bg-leaf" aria-hidden="true" />
              Englishphile Beta
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Luyện tiếng Anh nâng cao rõ ràng hơn mỗi ngày
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-ink-soft sm:text-lg">
              Làm bài kiểm tra đầu vào, xem điểm yếu cần luyện, rồi vào Gym để luyện từng dạng bài chuyên Anh/HSG.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/diagnostic" className="btn btn-primary">
                Làm bài kiểm tra đầu vào
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/gym" className="btn btn-secondary">
                Vào Gym luyện tập
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Miễn phí trong giai đoạn beta. Chỉ cần một tài khoản học viên.
            </p>
          </div>

          <div className="grid gap-3">
            {heroPreviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="surface flex items-start gap-4 rounded-3xl p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{card.title}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{card.description}</p>
                  </div>
                </div>
              );
            })}
            <p className="rounded-3xl bg-panel/70 px-5 py-4 text-sm leading-6 text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">
              Gợi ý luyện tập được cập nhật sau mỗi lần bạn làm bài.
            </p>
          </div>
        </div>
      </section>

      {/* Lộ trình */}
      <section aria-labelledby="route-heading">
        <div className="max-w-2xl">
          <h2 id="route-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Học theo lộ trình rõ ràng
          </h2>
          <p className="mt-3 text-base leading-7 text-ink-soft">
            Bắt đầu bằng một bài kiểm tra ngắn, sau đó luyện đúng phần đang yếu và ôn lại lỗi cũ.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {routeSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="surface flex flex-col rounded-3xl p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{step.description}</p>
                <Link
                  href={step.href}
                  className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-4 text-sm font-semibold text-accent transition-colors duration-150 hover:text-accent-strong"
                >
                  {step.linkLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Các chế độ học */}
      <section aria-labelledby="modes-heading">
        <div className="max-w-2xl">
          <h2 id="modes-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Các chế độ học
          </h2>
          <p className="mt-3 text-base leading-7 text-ink-soft">
            Mỗi chế độ phục vụ một việc: luyện hằng ngày, thử sức với đề, đọc chiến thuật, hoặc đo lại trình độ.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {learningModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <article key={mode.title} className="surface flex flex-col rounded-3xl p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-semibold">{mode.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-ink-soft">{mode.purpose}</p>
                <p className="mt-1 text-sm leading-7 text-ink-soft">{mode.suggestion}</p>
                <div className="mt-auto pt-5">
                  <Link href={mode.href} className="btn btn-sm btn-secondary">
                    {mode.linkLabel}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Dành cho ai */}
      <section aria-labelledby="audience-heading" className="surface-mint rounded-[2rem] p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 id="audience-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Dành cho học sinh chuyên Anh/HSG
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-ink-soft">
              Englishphile được làm để học sinh có chỗ luyện tiếng Anh nâng cao một cách đều đặn hơn — không thay thế
              thầy cô hay lớp học, chỉ giúp việc tự luyện bớt rời rạc.
            </p>
            <Link
              href="/about"
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent transition-colors duration-150 hover:text-accent-strong"
            >
              Đọc thêm về Englishphile
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3">
            {audienceItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="surface flex items-start gap-4 rounded-3xl p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{item.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
