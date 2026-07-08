import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Sparkles, Target, Timer } from "lucide-react";

import { startDiagnosticAction } from "@/app/diagnostic/actions";
import { LearnerCard } from "@/components/ui/LearnerCard";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getLatestDiagnosticAttempt, hasCompletedDiagnostic } from "@/lib/diagnostic";
import { getDiagnosticCoverage } from "@/lib/diagnostic-blueprint";

export const metadata: Metadata = {
  title: "Bài kiểm tra đầu vào",
  description: "Làm bài kiểm tra đầu vào để ước lượng trình độ và nhận gợi ý bài luyện phù hợp trong Gym.",
};

const introCards = [
  {
    title: "Ước lượng trình độ",
    description: "Biết bạn đang ở đâu với Use of English và Reading.",
    icon: Target,
  },
  {
    title: "Làm một lần khi bắt đầu",
    description: "Bài ngắn khoảng 20 phút, không cần chuẩn bị trước.",
    icon: Timer,
  },
  {
    title: "Gợi ý bài luyện",
    description: "Kết quả được dùng để đề xuất bài phù hợp trong Gym.",
    icon: Sparkles,
  },
];

const testSections = [
  {
    title: "Use of English",
    description: "Ngữ pháp, từ vựng, cloze, word formation và viết lại câu.",
  },
  {
    title: "Reading",
    description: "Đọc hiểu, suy luận và từ vựng trong ngữ cảnh.",
  },
];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiagnosticPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const error = typeof params.error === "string" ? params.error : "";

  const [latest, completed] = await Promise.all([
    getLatestDiagnosticAttempt(user.id),
    hasCompletedDiagnostic(user.id),
  ]);

  const isInProgress = latest?.status === "IN_PROGRESS";

  // Diagnostic is onboarding-only: once finished, learners practice in Gym.
  if (completed && !isInProgress) redirect("/gym");

  let canStart = true;
  if (!isInProgress) {
    const coverage = await getDiagnosticCoverage();
    canStart = coverage.sections.every(
      (section) => !section.targetCount || section.eligibleQuestions >= section.targetCount,
    );
  }

  return (
    <div className="grid gap-6">
      {error ? (
        <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      {/* Hero — light mint panel with primary CTA */}
      <section className="surface-mint rounded-[2rem] p-6 sm:p-10">
        <p className="text-sm font-semibold text-accent">Kiểm tra trình độ</p>

        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Bài kiểm tra đầu vào
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-soft">
          Bài kiểm tra đầu vào gồm Use of English và Reading. Kết quả giúp ước lượng trình độ ban đầu và gợi ý bài
          luyện phù hợp trong Gym.
        </p>

        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
          Writing và Listening sẽ được luyện riêng trong Gym.
        </p>

        {isInProgress ? (
          <Link href="/diagnostic/start" className="btn btn-primary mt-7">
            Làm tiếp bài đang làm
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : canStart ? (
          <form action={startDiagnosticAction} className="mt-7">
            <FormSubmitButton pendingLabel="Đang tạo bài...">
              Làm bài kiểm tra đầu vào
              <ArrowRight className="size-4" aria-hidden="true" />
            </FormSubmitButton>
          </form>
        ) : (
          <div className="mt-7 grid max-w-xl gap-3">
            <p className="rounded-2xl bg-panel px-4 py-3 text-sm font-semibold text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">
              Bài kiểm tra đang được chuẩn bị. Trong lúc chờ, bạn có thể vào Gym luyện trước.
            </p>
            <Link href="/gym" className="btn btn-secondary justify-self-start">
              Vào Gym
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* Why take the test */}
      <div className="grid gap-3 md:grid-cols-3">
        {introCards.map(({ title, description, icon: Icon }) => (
          <LearnerCard key={title}>
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
          </LearnerCard>
        ))}
      </div>

      {/* What the test covers */}
      <LearnerCard>
        <h2 className="text-lg font-semibold">Nội dung bài kiểm tra</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {testSections.map((section) => (
            <div key={section.title} className="rounded-2xl bg-panel-muted p-4">
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{section.description}</p>
            </div>
          ))}
        </div>
      </LearnerCard>
    </div>
  );
}
